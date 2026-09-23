import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

// Filterable by course, day, or date range via query string.
router.get("/", requirePermission("schedule.read"), todo);
router.post("/", requirePermission("schedule.manage"), todo);
router.get("/:id", requirePermission("schedule.read"), todo);
router.patch("/:id", requirePermission("schedule.manage"), todo);
router.delete("/:id", requirePermission("schedule.manage"), todo);

// The signed-in user's own timetable, across every course they are in.
router.get("/me/week", requireAuth, todo);

export default router;
