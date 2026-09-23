import { Router } from "express";

import * as courses from "../db/repositories/courses.repo.js";
import * as enrollments from "../db/repositories/enrollments.repo.js";
import * as users from "../db/repositories/users.repo.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { manageCourse } from "../middleware/courseAccess.js";
import { httpError, asyncRoute } from "../middleware/errors.js";

const router = Router();

const todo = (_req, res) => res.status(501).json({ error: "Not implemented" });

const STATUSES = ["active", "completed", "dropped"];

function publicEnrollment(row) {
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

/** The enrollment, after confirming the requester manages its course. */
async function reachEnrollment(req) {
  const id = Number(req.params.id);
  const enrollment = Number.isInteger(id) ? await enrollments.findById(id) : null;
  if (!enrollment) throw httpError(404, "Enrollment not found");
  await manageCourse(req, enrollment.course_id);
  return enrollment;
}

// ---------------------------------------------------------------------------
// Self-service
// ---------------------------------------------------------------------------

/**
 * Join a course with the code the instructor handed out. Case, spaces and
 * dashes are ignored, so "k7q4-mxab" and "K7Q4MXAB" are the same code.
 *
 * A wrong code, and a right code for a course that is not open, get the same
 * answer: telling the two apart would let someone probe which codes exist.
 */
router.post(
  "/me",
  requirePermission("enrollment.self"),
  asyncRoute(async (req, res) => {
    const joinCode = String(req.body?.joinCode ?? "")
      .toUpperCase()
      .replace(/[\s-]/g, "");

    const course = joinCode ? await courses.findByJoinCode(joinCode) : null;
    if (!course || course.status !== "published") {
      throw httpError(404, "No open course has that join code");
    }
    if (course.instructor_id === req.user.id) {
      throw httpError(409, "You teach this course");
    }

    const existing = await enrollments.findFor(course.id, req.user.id);
    if (existing && existing.status !== "dropped") {
      throw httpError(409, "You are already enrolled in this course");
    }

    await enrollments.enroll(course.id, req.user.id);
    res.status(201).json({ course: { id: course.id, code: course.code, title: course.title } });
  }),
);

// ---------------------------------------------------------------------------
// Managed by the course's instructor or an administrator
// ---------------------------------------------------------------------------

/**
 * Add someone to a course by their email address. Unlike joining with a
 * code, this works on a draft course too, so an instructor can set up the
 * class list before opening the course.
 */
router.post(
  "/",
  requirePermission("enrollment.manage"),
  asyncRoute(async (req, res) => {
    const { course } = await manageCourse(req, req.body?.courseId);

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const student = email ? await users.findByEmail(email) : null;
    if (!student) throw httpError(404, "No account has that email address");
    if (student.id === course.instructor_id) {
      throw httpError(409, "That account teaches this course");
    }

    const existing = await enrollments.findFor(course.id, student.id);
    if (existing && existing.status !== "dropped") {
      throw httpError(409, `${student.full_name} is already enrolled`);
    }

    const id = await enrollments.enroll(course.id, student.id);
    res.status(201).json({ enrollment: publicEnrollment(await enrollments.findById(id)) });
  }),
);

/** Mark an enrollment completed or dropped, or bring it back to active. */
router.patch(
  "/:id",
  requirePermission("enrollment.manage"),
  asyncRoute(async (req, res) => {
    const enrollment = await reachEnrollment(req);
    const status = String(req.body?.status ?? "");
    if (!STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
    }

    await enrollments.updateStatus(enrollment.id, status);
    res.json({ enrollment: publicEnrollment(await enrollments.findById(enrollment.id)) });
  }),
);

/**
 * Remove an enrollment outright. Dropping keeps the record that the person
 * was once in the course; removing forgets it, which is for mistakes such as
 * adding the wrong person.
 */
router.delete(
  "/:id",
  requirePermission("enrollment.manage"),
  asyncRoute(async (req, res) => {
    const enrollment = await reachEnrollment(req);
    await enrollments.remove(enrollment.id);
    res.status(204).end();
  }),
);

// Not needed yet: a course's list is GET /api/courses/:id/roster, and a
// student's courses are GET /api/courses.
router.get("/", requirePermission("enrollment.read"), todo);
router.get("/me", requireAuth, todo);

export default router;
