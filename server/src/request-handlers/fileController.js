// Uploaded files: attaching them to lessons, downloading, deleting, and the Files page.
// A file is only ever sent after checking the requester may see what it is attached to.
import * as File from '../database-queries/fileModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { discardFiles, pathOnDisk, recordUploads } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';
import { reachAssignment, reachLesson } from '../permission-rules/access.js';
import { fileToJson } from './lessonController.js';

// Runs BEFORE the upload filter (see lessonRoutes.js), which saves files to disk the moment they
// arrive. Checking first means someone who may not edit this lesson never gets a byte onto disk.
export async function allowLessonUpload(req, res, next) {
  req.reached = await reachLesson(req, req.params.id, { manage: true });
  next();
}

// Records the files the upload filter has just saved, as attachments of the lesson
export async function uploadLessonFiles(req, res) {
  const uploads = req.files ?? [];
  if (uploads.length === 0) throw new HttpError(400, 'Choose at least one file to upload');
  const { lesson } = req.reached;
  await recordUploads(uploads, { ownerType: 'lesson', ownerId: lesson.id, uploadedBy: req.user.id });
  const files = await File.listFor('lesson', lesson.id);
  res.status(201).json({ files: files.map(fileToJson) });
}

// Checks the requester may see this file, by what it is attached to:
//   a lesson file      anyone who may see the lesson (or, with `manage`, who manages its course)
//   a submission file  the student who handed it in, or someone who manages the course and
//                      holds submission.read
async function findVisibleFile(req, { manage = false } = {}) {
  const file = await File.findById(parseId(req.params.id, 'File not found'));
  if (!file) throw new HttpError(404, 'File not found');

  if (file.owner_type === 'lesson') {
    await reachLesson(req, file.owner_id, { manage });
    return file;
  }
  if (file.owner_type === 'submission' && !manage) {
    const submission = await Submission.findById(file.owner_id);
    const isOwn = submission?.user_id === req.user.id;
    if (!submission || (!isOwn && !req.permissions.has('submission.read'))) throw new HttpError(404, 'File not found');
    await reachAssignment(req, submission.assignment_id, { manage: !isOwn });
    return file;
  }
  throw new HttpError(404, 'File not found');
}

// Sends the file as a download ("Content-Disposition: attachment"), never displayed inside our
// site, so an uploaded web page or script can never run as if it were part of LearnHub
export async function downloadFile(req, res, next) {
  const file = await findVisibleFile(req);
  res.download(pathOnDisk(file), file.original_name, (error) => {
    // The row exists but the bytes are gone (deleted by hand, a lost disk)
    if (error && !res.headersSent) next(new HttpError(404, 'File not found'));
  });
}

// Lesson files only: a student removes their own submission files through the submission routes
export async function deleteFile(req, res) {
  const file = await findVisibleFile(req, { manage: true });
  await discardFiles([file]);
  res.status(204).end();
}

// The Files page: every lesson and submission file this account may see, newest first
export async function listFiles(req, res) {
  const seesAll = req.permissions.has('course.manage_any');
  const [lessonFiles, submissionFiles] = await Promise.all([
    File.listLessonFilesVisibleTo(req.user.id, { seesAll }),
    File.listSubmissionFilesVisibleTo(req.user.id, { seesAll, readsOthers: req.permissions.has('submission.read') }),
  ]);
  const files = [
    ...lessonFiles.map((row) => ({
      id: row.id,
      name: row.original_name,
      size: row.size_bytes,
      uploadedAt: row.uploaded_at,
      kind: 'lesson',
      courseId: row.course_id,
      courseCode: row.course_code,
      attachedTo: { id: row.lesson_id, title: row.lesson_title },
    })),
    ...submissionFiles.map((row) => ({
      id: row.id,
      name: row.original_name,
      size: row.size_bytes,
      uploadedAt: row.uploaded_at,
      kind: 'submission',
      courseId: row.course_id,
      courseCode: row.course_code,
      attachedTo: { id: row.assignment_id, title: row.assignment_title },
      studentName: row.student_name,
    })),
  ].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  res.json({ files });
}
