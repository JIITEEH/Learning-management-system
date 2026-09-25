// Handing in work, and instructors reading it. Grading arrives in roadmap step 8.
import * as Enrollment from '../database-queries/enrollmentModel.js';
import * as File from '../database-queries/fileModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { discardFiles, recordUploads } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalText, parseId } from '../helpers/validate.js';
import { reachAssignment } from '../permission-rules/access.js';
import { submissionToJson } from './assignmentController.js';
import { fileToJson } from './lessonController.js';

const ANSWER_MAX = 50000;

// A student may hand in (or change what they handed in) while they take the course, the course
// is open, and the submission has not been graded. Late work is accepted and marked late.
async function reachOwnSubmissionSlot(req, assignmentIdValue) {
  const reached = await reachAssignment(req, assignmentIdValue);
  if (reached.relation !== 'enrolled') throw new HttpError(403, 'Only students taking this course can hand in work');
  if (reached.course.status !== 'published') throw new HttpError(409, 'This course is closed, so work can no longer be handed in');
  const existing = await Submission.findFor(reached.assignment.id, req.user.id);
  if (existing && existing.status !== 'submitted') {
    throw new HttpError(409, 'This work has been graded, so it can no longer be changed');
  }
  return { ...reached, existing };
}

// Runs BEFORE the upload filter (see assignmentRoutes.js), so nobody who may not hand in gets a
// byte onto disk
export async function allowHandIn(req, res, next) {
  req.reached = await reachOwnSubmissionSlot(req, req.params.id);
  next();
}

async function ownSubmissionResponse(submissionId, assignment) {
  const row = await Submission.findById(submissionId);
  const files = await File.listFor('submission', row.id);
  return { ...submissionToJson(row, assignment), files: files.map(fileToJson) };
}

// Hands in: a written answer (form field "body") and/or files (form field "files", up to 10).
// Handing in again replaces the written answer, adds any new files, and moves the hand-in time
// to now.
export async function handIn(req, res) {
  const { assignment, existing } = req.reached;
  const uploads = req.files ?? [];
  const body = optionalText(req.body?.body, 'Answer', { max: ANSWER_MAX });
  const filesAlready = existing ? (await File.listFor('submission', existing.id)).length : 0;
  if (!body && uploads.length === 0 && filesAlready === 0) {
    throw new HttpError(400, 'Write an answer or attach a file before handing in');
  }

  const id = await Submission.handIn({ assignmentId: assignment.id, userId: req.user.id, body });
  await recordUploads(uploads, { ownerType: 'submission', ownerId: id, uploadedBy: req.user.id });
  res.status(existing ? 200 : 201).json({ submission: await ownSubmissionResponse(id, assignment) });
}

// A student removes one of their own files from work not yet graded. That changes the work, so
// its hand-in time moves to now.
export async function removeSubmissionFile(req, res) {
  const submission = await Submission.findById(parseId(req.params.id, 'Submission not found'));
  if (!submission || submission.user_id !== req.user.id) throw new HttpError(404, 'Submission not found');
  const { assignment } = await reachOwnSubmissionSlot(req, submission.assignment_id);

  const file = await File.findById(parseId(req.params.fileId, 'File not found'));
  if (!file || file.owner_type !== 'submission' || file.owner_id !== submission.id) {
    throw new HttpError(404, 'File not found');
  }
  await discardFiles([file]);
  await Submission.touch(submission.id);
  res.json({ submission: await ownSubmissionResponse(submission.id, assignment) });
}

// For the instructor: every student in the course (not dropped), with their submission or null,
// so "who has not handed in" is visible too
export async function listSubmissions(req, res) {
  const { assignment, course } = await reachAssignment(req, req.params.id, { manage: true });
  const [students, submissions] = await Promise.all([
    Enrollment.listForCourse(course.id),
    Submission.listForAssignment(assignment.id),
  ]);
  const files = await File.listForAll('submission', submissions.map((row) => row.id));
  const byStudent = new Map(submissions.map((row) => [row.user_id, row]));
  const fileCount = (submissionId) => files.filter((file) => file.owner_id === submissionId).length;

  res.json({
    students: students
      .filter((student) => student.status !== 'dropped')
      .map((student) => {
        const row = byStudent.get(student.user_id);
        return {
          userId: student.user_id,
          fullName: student.full_name,
          email: student.email,
          submission: row ? { ...submissionToJson(row, assignment), fileCount: fileCount(row.id) } : null,
        };
      }),
  });
}

// One submission with its files: for the student who handed it in, or for someone who manages
// the course and holds submission.read
export async function getSubmission(req, res) {
  const submission = await Submission.findById(parseId(req.params.id, 'Submission not found'));
  if (!submission) throw new HttpError(404, 'Submission not found');
  const isOwn = submission.user_id === req.user.id;
  if (!isOwn && !req.permissions.has('submission.read')) throw new HttpError(404, 'Submission not found');
  const { assignment } = await reachAssignment(req, submission.assignment_id, { manage: !isOwn });

  const files = await File.listFor('submission', submission.id);
  res.json({
    submission: { ...submissionToJson(submission, assignment), files: files.map(fileToJson) },
  });
}
