// Who may see or manage a course. Written once here and used by every controller that touches a
// course. Both functions must run after requirePermission, which sets req.permissions.
import * as Course from '../database-queries/courseModel.js';
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
