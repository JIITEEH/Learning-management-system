// Who may see or manage a course, and so its modules and lessons. Written once here and used by
// every controller that touches a course. Every function must run after requirePermission, which
// sets req.permissions.
import * as Assignment from '../database-queries/assignmentModel.js';
import * as Course from '../database-queries/courseModel.js';
import * as Lesson from '../database-queries/lessonModel.js';
import * as Module from '../database-queries/moduleModel.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';

// Returns { course, relation } when the requester may see the course, where relation is
// 'teaching', 'enrolled', or 'overseeing' (an administrator holding course.manage_any).
//
// Everyone else gets 404, not 403, and so does an enrolled student asking for a course still in
// draft. A 403 would confirm that a course with that id exists, which an outsider counting
// upwards through ids has no business learning.
export async function reachCourse(req, courseIdValue) {
  const course = await Course.findById(parseId(courseIdValue, 'Course not found'));
  if (!course) throw new HttpError(404, 'Course not found');

  if (req.permissions.has('course.manage_any')) {
    const relation = course.instructor_id === req.user.id ? 'teaching' : 'overseeing';
    return { course, relation };
  }

  const relation = await Course.relationOf(course.id, req.user.id);
  const visible = relation === 'teaching' || (relation === 'enrolled' && course.status !== 'draft');
  if (!visible) throw new HttpError(404, 'Course not found');
  return { course, relation };
}

// As reachCourse, but only for the course's instructor or an administrator
export async function manageCourse(req, courseIdValue) {
  const reached = await reachCourse(req, courseIdValue);
  if (reached.relation === 'enrolled') {
    throw new HttpError(403, "Only the course's instructor or an administrator can do this");
  }
  return reached;
}

// Modules and lessons follow their course: whoever may see the course may see them, and whoever
// manages the course may change them. Each returns the item plus reachCourse's { course, relation }.

export async function reachModule(req, moduleIdValue, { manage = false } = {}) {
  const courseModule = await Module.findById(parseId(moduleIdValue, 'Module not found'));
  if (!courseModule) throw new HttpError(404, 'Module not found');
  const courseId = courseModule.course_id;
  const reached = manage ? await manageCourse(req, courseId) : await reachCourse(req, courseId);
  return { courseModule, ...reached };
}

export async function reachLesson(req, lessonIdValue, { manage = false } = {}) {
  const lesson = await Lesson.findById(parseId(lessonIdValue, 'Lesson not found'));
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  const courseId = lesson.course_id;
  const reached = manage ? await manageCourse(req, courseId) : await reachCourse(req, courseId);
  return { lesson, ...reached };
}

export async function reachAssignment(req, assignmentIdValue, { manage = false } = {}) {
  const assignment = await Assignment.findById(parseId(assignmentIdValue, 'Assignment not found'));
  if (!assignment) throw new HttpError(404, 'Assignment not found');
  const courseId = assignment.course_id;
  const reached = manage ? await manageCourse(req, courseId) : await reachCourse(req, courseId);
  return { assignment, ...reached };
}
