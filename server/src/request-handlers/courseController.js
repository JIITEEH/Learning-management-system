// Courses: listing, creating, editing, publishing, deleting, join codes, and the class list.
import { randomInt } from 'node:crypto';
import * as Assignment from '../database-queries/assignmentModel.js';
import * as Course from '../database-queries/courseModel.js';
import * as Enrollment from '../database-queries/enrollmentModel.js';
import * as File from '../database-queries/fileModel.js';
import * as Lesson from '../database-queries/lessonModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import { discardFiles } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, optionalText, requireText } from '../helpers/validate.js';
import { manageCourse, reachCourse } from '../permission-rules/access.js';

const STATUSES = ['draft', 'published', 'archived'];

// Letters and digits that cannot be confused when read aloud or copied from a projector:
// no 0/O and no 1/I/L
const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_LENGTH = 8;

function newJoinCode() {
  let code = '';
  for (let i = 0; i < JOIN_LENGTH; i++) code += JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)];
  return code;
}

// Runs `save(code)` with a fresh join code, retrying on the rare clash with an existing one.
// Retrying after the database refuses a duplicate is safer than checking first: two courses
// created at the same moment could both pass a check.
async function withNewJoinCode(save) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await save(newJoinCode());
    } catch (error) {
      const joinCodeClash = error.code === 'ER_DUP_ENTRY' && error.message.includes('join_code');
      if (!joinCodeClash) throw error;
    }
  }
  throw new HttpError(500, 'Could not generate a unique join code');
}

// The JSON shape of a course. The join code is only shown to someone who manages the course:
// it is how students let themselves in, so any student who saw it could pass it on.
function toJson(row, relation) {
  const manages = relation === 'teaching' || relation === 'overseeing';
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    instructorId: row.instructor_id,
    instructorName: row.instructor_name,
    studentCount: Number(row.student_count),
    relation,
    ...(manages ? { joinCode: row.join_code } : {}),
    createdAt: row.created_at,
  };
}

// Reads code, title and description from the body. When editing, a field left out keeps the
// course's current value.
function readDetails(body = {}, current = {}) {
  const code = requireText(body.code ?? current.code, 'Course code', { max: 32 }).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 _-]+$/.test(code)) {
    throw new HttpError(400, 'Course code may only use letters, digits, spaces, _ or -');
  }
  return {
    code,
    title: requireText(body.title ?? current.title, 'Title', { max: 200 }),
    description: optionalText(body.description === undefined ? current.description : body.description, 'Description', {
      max: 5000,
    }),
  };
}

// "My courses": every course for an administrator, otherwise the ones taught or taken
export async function listCourses(req, res) {
  const seesAll = req.permissions.has('course.manage_any');
  const rows = seesAll ? await Course.listAll() : await Course.listForUser(req.user.id);
  const otherRelation = seesAll ? 'overseeing' : 'enrolled';
  res.json({
    courses: rows.map((row) => toJson(row, row.instructor_id === req.user.id ? 'teaching' : otherRelation)),
  });
}

// A new course starts as a draft, taught by whoever created it
export async function createCourse(req, res) {
  const details = readDetails(req.body);
  if (await Course.codeTaken(details.code)) throw new HttpError(409, 'Another course already uses that code');
  const id = await withNewJoinCode((joinCode) => Course.create({ ...details, joinCode, instructorId: req.user.id }));
  res.status(201).json({ course: toJson(await Course.findById(id), 'teaching') });
}

export async function getCourse(req, res) {
  const { course, relation } = await reachCourse(req, req.params.id);
  res.json({ course: toJson(course, relation) });
}

export async function updateCourse(req, res) {
  const { course, relation } = await manageCourse(req, req.params.id);
  const details = readDetails(req.body, course);
  if (await Course.codeTaken(details.code, course.id)) throw new HttpError(409, 'Another course already uses that code');
  await Course.updateDetails({ id: course.id, ...details });
  res.json({ course: toJson(await Course.findById(course.id), relation) });
}

// Deleting a course takes its lessons, assignments, submissions, their files and its enrollments
// with it, so a published course must be archived first: a moment for someone to notice it is
// still in use
export async function deleteCourse(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  if (course.status === 'published') throw new HttpError(409, 'Archive the course before deleting it');
  const submissionIds = await Submission.idsForAssignments(await Assignment.idsInCourse(course.id));
  const files = [
    ...(await File.listForAll('lesson', await Lesson.idsInCourse(course.id))),
    ...(await File.listForAll('submission', submissionIds)),
  ];
  await Course.remove(course.id);
  await discardFiles(files);
  res.status(204).end();
}

// draft -> published -> archived, in whatever order the instructor needs
export async function setCourseStatus(req, res) {
  const { course, relation } = await manageCourse(req, req.params.id);
  await Course.updateStatus(course.id, oneOf(req.body?.status, STATUSES, 'Status'));
  res.json({ course: toJson(await Course.findById(course.id), relation) });
}

// Replaces a join code that has leaked; the old one stops working at once
export async function replaceJoinCode(req, res) {
  const { course, relation } = await manageCourse(req, req.params.id);
  await withNewJoinCode((joinCode) => Course.updateJoinCode(course.id, joinCode));
  res.json({ course: toJson(await Course.findById(course.id), relation) });
}

// Everyone in the course, for its People tab. Only for those who manage the course.
export async function getRoster(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const rows = await Enrollment.listForCourse(course.id);
  res.json({
    enrollments: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      enrolledAt: row.enrolled_at,
      completedAt: row.completed_at,
    })),
  });
}
