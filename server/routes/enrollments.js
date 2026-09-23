import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

router.get("/", requirePermission("enrollment.read"), todo);
router.post("/", requirePermission("enrollment.manage"), todo);
router.patch("/:id", requirePermission("enrollment.manage"), todo);
router.delete("/:id", requirePermission("enrollment.manage"), todo);

// Self-service: a student enrolling themselves in an open course.
router.get("/me", requireAuth, todo);
router.post("/me", requirePermission("enrollment.self"), todo);

export default router;
