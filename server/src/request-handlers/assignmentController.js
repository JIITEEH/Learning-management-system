// Assignments: listing a course's, creating, reading, editing and deleting them.
import * as Assignment from '../database-queries/assignmentModel.js';
import * as File from '../database-queries/fileModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { discardFiles } from '../helpers/files.js';
import { optionalDateTime, optionalText, requireNumber, requireText } from '../helpers/validate.js';
import { manageCourse, reachAssignment, reachCourse } from '../permission-rules/access.js';
import { fileToJson } from './lessonController.js';

export function assignmentToJson(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    instructions: row.instructions ?? '',
    dueAt: row.due_at,
    maxScore: Number(row.max_score),
  };
}

// Handed in after the due date? Both times are UTC in the same 'YYYY-MM-DD HH:MM:SS' form, so
// comparing them as text compares them as times.
export const isLate = (submission, assignment) =>
  Boolean(assignment.due_at && submission.submitted_at > assignment.due_at);

export function submissionToJson(row, assignment) {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    body: row.body ?? '',
    status: row.status,
    submittedAt: row.submitted_at,
    late: isLate(row, assignment),
    score: row.score === null ? null : Number(row.score),
    feedback: row.feedback,
    gradedAt: row.graded_at,
  };
}

// Reads title, instructions, due date and maximum score. When editing, a field left out keeps the
// assignment's current value.
function readAssignment(body = {}, current = null) {
  const pick = (field, read) => (body[field] === undefined && current ? current[field] : read(body[field]));
  return {
    title: pick('title', (value) => requireText(value, 'Title')),
    instructions: pick('instructions', (value) => optionalText(value, 'Instructions', { max: 20000 })),
    dueAt: pick('dueAt', (value) => optionalDateTime(value, 'Due date')),
    maxScore: pick('maxScore', (value) => requireNumber(value ?? 100, 'Maximum score', { min: 1, max: 1000 })),
  };
}

// A course's assignments. A student also gets their own hand-in status on each; the instructor
// gets how many have handed in.
export async function listAssignments(req, res) {
  const { course, relation } = await reachCourse(req, req.params.id);
  const rows = await Assignment.listForCourse(course.id);
  const mine =
    relation === 'enrolled'
      ? new Map((await Submission.listForStudentInCourse(req.user.id, course.id)).map((row) => [row.assignment_id, row]))
      : null;

  res.json({
    assignments: rows.map((row) => ({
      ...assignmentToJson(row),
      ...(mine
        ? { mySubmission: mine.has(row.id) ? submissionToJson(mine.get(row.id), row) : null }
        : { submissionCount: Number(row.submission_count) }),
    })),
  });
}

export async function createAssignment(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const id = await Assignment.create({ courseId: course.id, ...readAssignment(req.body) });
  res.status(201).json({ assignment: assignmentToJson(await Assignment.findById(id)) });
}

// The assignment, and for a student taking the course, their own submission with its files
export async function getAssignment(req, res) {
  const { assignment, course, relation } = await reachAssignment(req, req.params.id);
  let mySubmission = null;
  if (relation === 'enrolled') {
    const row = await Submission.findFor(assignment.id, req.user.id);
    if (row) {
      const files = await File.listFor('submission', row.id);
      mySubmission = { ...submissionToJson(row, assignment), files: files.map(fileToJson) };
    }
  }
  res.json({
    assignment: assignmentToJson(assignment),
    course: { id: course.id, code: course.code, title: course.title, status: course.status, relation },
    mySubmission,
  });
}

export async function updateAssignment(req, res) {
  const { assignment } = await reachAssignment(req, req.params.id, { manage: true });
  const current = {
    title: assignment.title,
    instructions: assignment.instructions,
    dueAt: assignment.due_at,
    maxScore: Number(assignment.max_score),
  };
  await Assignment.update({ id: assignment.id, ...readAssignment(req.body, current) });
  res.json({ assignment: assignmentToJson(await Assignment.findById(assignment.id)) });
}

// Deletes the assignment, every submission to it, and their files
export async function deleteAssignment(req, res) {
  const { assignment } = await reachAssignment(req, req.params.id, { manage: true });
  const files = await File.listForAll('submission', await Submission.idsForAssignments([assignment.id]));
  await Assignment.remove(assignment.id);
  await discardFiles(files);
  res.status(204).end();
}
