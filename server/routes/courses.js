import { Router } from "express";
import { randomInt } from "node:crypto";

import * as courses from "../db/repositories/courses.repo.js";
import * as enrollments from "../db/repositories/enrollments.repo.js";
import { requirePermission } from "../middleware/auth.js";
import { manageCourse, reachCourse } from "../middleware/courseAccess.js";
import { httpError, asyncRoute } from "../middleware/errors.js";

const router = Router();

const todo = (_req, res) => res.status(501).json({ error: "Not implemented" });

const STATUSES = ["draft", "published", "archived"];

// Letters and digits that cannot be mistaken for one another when read aloud
// or copied from a projector: no 0/O, 1/I/L.
const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_LENGTH = 8;

/**
 * A fresh random join code. It is only a candidate: the column is unique, so
 * the caller retries on the rare collision rather than checking first, which
 * could race with another course being created at the same moment.
 */
function newJoinCode() {
  let code = "";
  for (let i = 0; i < JOIN_LENGTH; i++) code += JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)];
  return code;
}

/** Run `write(code)` with a fresh join code, retrying if one is already in use. */
async function withFreshJoinCode(write) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await write(newJoinCode());
    } catch (error) {
      const joinCodeClash =
        error.code === "ER_DUP_ENTRY" && String(error.message).includes("join_code");
      if (!joinCodeClash) throw error;
    }
  }
  throw httpError(500, "Could not generate a unique join code");
}

/**
 * The JSON shape of a course. The join code is included only for someone
 * who manages the course: it is how students let themselves in, so handing
 * it to every enrolled student would let any of them pass it on.
 */
function publicCourse(row, relation) {
  const manages = relation === "teaching" || relation === "overseeing";
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

function readDetails(body, existing = null) {
  const pick = (key, fallback) =>
    body?.[key] === undefined ? fallback : String(body[key]).trim();

  const code = pick("code", existing?.code ?? "").toUpperCase();
  const title = pick("title", existing?.title ?? "");
  const description = pick("description", existing?.description ?? "") || null;

  if (!/^[A-Z0-9][A-Z0-9 _-]{1,31}$/.test(code)) {
    throw httpError(400, "Course code must be 2–32 characters: letters, digits, spaces, _ or -");
  }
  if (!title) throw httpError(400, "Title is required");
  if (title.length > 200) throw httpError(400, "Title must be 200 characters or fewer");
  return { code, title, description };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/** "My courses": everything for an administrator, otherwise taught or taken. */
router.get(
  "/",
  requirePermission("course.read"),
  asyncRoute(async (req, res) => {
    if (req.permissions.has("course.manage_any")) {
      const rows = await courses.listAll();
      return res.json({
        courses: rows.map((row) =>
          publicCourse(row, row.instructor_id === req.user.id ? "teaching" : "overseeing"),
        ),
      });
    }

    const rows = await courses.listForUser(req.user.id);
    res.json({
      courses: rows.map((row) =>
        publicCourse(row, row.instructor_id === req.user.id ? "teaching" : "enrolled"),
      ),
    });
  }),
);

/** A new course starts as a draft, taught by whoever created it. */
router.post(
  "/",
  requirePermission("course.create"),
  asyncRoute(async (req, res) => {
    const details = readDetails(req.body);
    if (await courses.codeTaken(details.code)) {
      throw httpError(409, "Another course already uses that code");
    }

    const id = await withFreshJoinCode((joinCode) =>
      courses.insert({ ...details, joinCode, instructorId: req.user.id }),
    );
    res.status(201).json({ course: publicCourse(await courses.findById(id), "teaching") });
  }),
);

router.get(
  "/:id",
  requirePermission("course.read"),
  asyncRoute(async (req, res) => {
    const { course, relation } = await reachCourse(req, req.params.id);
    res.json({ course: publicCourse(course, relation) });
  }),
);

router.patch(
  "/:id",
  requirePermission("course.update"),
  asyncRoute(async (req, res) => {
    const { course, relation } = await manageCourse(req, req.params.id);
    const details = readDetails(req.body, course);
    if (await courses.codeTaken(details.code, course.id)) {
      throw httpError(409, "Another course already uses that code");
    }

    await courses.updateDetails({ id: course.id, ...details });
    res.json({ course: publicCourse(await courses.findById(course.id), relation) });
  }),
);

/**
 * Deleting a course takes its modules, lessons and enrollments with it, so
 * only a draft or an archived course may go. A published course has to be
 * archived first, which is a moment for someone to notice it is in use.
 */
router.delete(
  "/:id",
  requirePermission("course.delete"),
  asyncRoute(async (req, res) => {
    const { course } = await manageCourse(req, req.params.id);
    if (course.status === "published") {
      throw httpError(409, "Archive the course before deleting it");
    }
    await courses.remove(course.id);
    res.status(204).end();
  }),
);

/** draft → published → archived, in any order the instructor needs. */
router.patch(
  "/:id/status",
  requirePermission("course.publish"),
  asyncRoute(async (req, res) => {
    const { course, relation } = await manageCourse(req, req.params.id);
    const status = String(req.body?.status ?? "");
    if (!STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
    }

    await courses.updateStatus(course.id, status);
    res.json({ course: publicCourse(await courses.findById(course.id), relation) });
  }),
);

/** Replace a join code that has leaked. The old one stops working at once. */
router.post(
  "/:id/join-code",
  requirePermission("course.update"),
  asyncRoute(async (req, res) => {
    const { course, relation } = await manageCourse(req, req.params.id);
    await withFreshJoinCode((joinCode) => courses.updateJoinCode(course.id, joinCode));
    res.json({ course: publicCourse(await courses.findById(course.id), relation) });
  }),
);

// ---------------------------------------------------------------------------
// Contents of one course
// ---------------------------------------------------------------------------

/** Everyone enrolled, for the course's People tab. Managers only. */
router.get(
  "/:id/roster",
  requirePermission("enrollment.read"),
  asyncRoute(async (req, res) => {
    const { course } = await manageCourse(req, req.params.id);
    const rows = await enrollments.listForCourse(course.id);
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
  }),
);

// Filled in by roadmap steps 6 and 7.
router.get("/:id/modules", requirePermission("lesson.read"), todo);
router.post("/:id/modules", requirePermission("lesson.manage"), todo);
router.get("/:id/assignments", requirePermission("assignment.read"), todo);
router.get("/:id/schedules", requirePermission("schedule.read"), todo);
router.get("/:id/files", requirePermission("file.read"), todo);

export default router;
