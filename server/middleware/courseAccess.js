// Who may reach a course.
//
// Shared by routes/courses.js and routes/enrollments.js, so the rule for
// seeing a course is written once. Both functions expect to run after
// requirePermission, which leaves the requester's permission codes on
// req.permissions.

import * as courses from "../db/repositories/courses.repo.js";
import { httpError } from "./errors.js";

/**
 * The course, and how the requester relates to it — or a 404.
 *
 * An outsider gets "not found" rather than "forbidden", and so does an
 * enrolled student asking for a course still in draft. A 403 would confirm
 * that a course with that number exists, which is itself information an
 * outsider has no business learning by counting upwards through ids.
 *
 * `overseeing` means the requester holds course.manage_any: an administrator
 * who may see and change every course without teaching it.
 */
export async function reachCourse(req, id) {
  const courseId = Number(id);
  const course = Number.isInteger(courseId) ? await courses.findById(courseId) : null;
  if (!course) throw httpError(404, "Course not found");

  if (req.permissions.has("course.manage_any")) {
    const own = course.instructor_id === req.user.id;
    return { course, relation: own ? "teaching" : "overseeing" };
  }

  const relation = await courses.relationOf(course.id, req.user.id);
  const visible =
    relation === "teaching" || (relation === "enrolled" && course.status !== "draft");
  if (!visible) throw httpError(404, "Course not found");

  return { course, relation };
}

/** As reachCourse, but only for someone who manages the course. */
export async function manageCourse(req, id) {
  const reached = await reachCourse(req, id);
  if (reached.relation === "enrolled") {
    throw httpError(403, "Only the course's instructor or an administrator can do this");
  }
  return reached;
}
