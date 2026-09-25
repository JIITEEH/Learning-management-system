// Enrollments: a student joining with a code, and an instructor adding, changing or removing
// people on a course's class list.
import * as Course from '../database-queries/courseModel.js';
import * as Enrollment from '../database-queries/enrollmentModel.js';
import * as User from '../database-queries/userModel.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, parseId } from '../helpers/validate.js';
import { manageCourse } from '../permission-rules/access.js';

const STATUSES = ['active', 'completed', 'dropped'];

function toJson(row) {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
  };
}

// The enrollment named in the URL, after checking the requester manages its course
async function findManagedEnrollment(req) {
  const enrollment = await Enrollment.findById(parseId(req.params.id, 'Enrollment not found'));
  if (!enrollment) throw new HttpError(404, 'Enrollment not found');
  await manageCourse(req, enrollment.course_id);
  return enrollment;
}

// Joins a course with the code the instructor handed out. Case, spaces and dashes are ignored,
// so "k7q4-mxab" and "K7Q4MXAB" are the same code. A wrong code and a right code for a course
// that is not open get the same answer, so nobody can probe which codes exist.
export async function joinWithCode(req, res) {
  const joinCode = String(req.body?.joinCode ?? '').toUpperCase().replace(/[\s-]/g, '');
  const course = joinCode ? await Course.findByJoinCode(joinCode) : null;
  if (!course || course.status !== 'published') throw new HttpError(404, 'No open course has that join code');
  if (course.instructor_id === req.user.id) throw new HttpError(409, 'You teach this course');

  // Only an instructor or administrator sets an enrollment to dropped, so a dropped student was
  // taken out on purpose and must not walk back in with the code. The instructor can re-add them.
  const existing = await Enrollment.findFor(course.id, req.user.id);
  if (existing?.status === 'dropped') {
    throw new HttpError(403, 'You were removed from this course. Ask your instructor to add you back.');
  }
  if (existing) throw new HttpError(409, 'You are already enrolled in this course');

  await Enrollment.enroll(course.id, req.user.id);
  res.status(201).json({ course: { id: course.id, code: course.code, title: course.title } });
}

// Adds someone by email. Unlike joining with a code this works on a draft course too, so an
// instructor can set up the class list before opening the course.
export async function addToCourse(req, res) {
  const { course } = await manageCourse(req, req.body?.courseId);
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const student = email ? await User.findByEmail(email) : null;
  if (!student) throw new HttpError(404, 'No account has that email address');
  if (student.id === course.instructor_id) throw new HttpError(409, 'That account teaches this course');

  const existing = await Enrollment.findFor(course.id, student.id);
  if (existing && existing.status !== 'dropped') throw new HttpError(409, `${student.full_name} is already enrolled`);

  const id = await Enrollment.enroll(course.id, student.id);
  res.status(201).json({ enrollment: toJson(await Enrollment.findById(id)) });
}

// Marks an enrollment completed or dropped, or brings it back to active
export async function setEnrollmentStatus(req, res) {
  const enrollment = await findManagedEnrollment(req);
  await Enrollment.updateStatus(enrollment.id, oneOf(req.body?.status, STATUSES, 'Status'));
  res.json({ enrollment: toJson(await Enrollment.findById(enrollment.id)) });
}

// Deletes the record outright, for mistakes such as adding the wrong person. Setting the status
// to dropped is the way to take someone out while keeping the record that they took part.
export async function removeEnrollment(req, res) {
  const enrollment = await findManagedEnrollment(req);
  await Enrollment.remove(enrollment.id);
  res.status(204).end();
}
