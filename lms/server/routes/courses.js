import { Router } from "express";
import { requirePermission } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

router.get("/", requirePermission("course.read"), todo);
router.post("/", requirePermission("course.create"), todo);
router.get("/:id", requirePermission("course.read"), todo);
router.patch("/:id", requirePermission("course.update"), todo);
router.delete("/:id", requirePermission("course.delete"), todo);
router.patch("/:id/status", requirePermission("course.publish"), todo);

// Contents of one course
router.get("/:id/modules", requirePermission("lesson.read"), todo);
router.post("/:id/modules", requirePermission("lesson.manage"), todo);
router.get("/:id/assignments", requirePermission("assignment.read"), todo);
router.get("/:id/schedules", requirePermission("schedule.read"), todo);
router.get("/:id/files", requirePermission("file.read"), todo);
router.get("/:id/roster", requirePermission("enrollment.read"), todo);

export default router;
