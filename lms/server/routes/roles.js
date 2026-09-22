import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

router.get("/", requireAuth, todo);
router.post("/", requirePermission("role.manage"), todo);
router.get("/:id", requireAuth, todo);
router.patch("/:id", requirePermission("role.manage"), todo);
router.delete("/:id", requirePermission("role.manage"), todo);

// The permission codes attached to a role.
router.get("/:id/permissions", requireAuth, todo);
router.put("/:id/permissions", requirePermission("role.manage"), todo);

export default router;
