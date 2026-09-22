import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

router.get("/", requirePermission("user.read"), todo);
router.post("/", requirePermission("user.create"), todo);
router.get("/:id", requireAuth, todo);
router.patch("/:id", requireAuth, todo);
router.delete("/:id", requirePermission("user.delete"), todo);

// Account status and per-account permission overrides
router.patch("/:id/status", requirePermission("user.update"), todo);
router.get("/:id/permissions", requirePermission("user.read"), todo);
router.put("/:id/permissions", requirePermission("role.manage"), todo);

export default router;
