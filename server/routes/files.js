import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

// Uploads are attached to something — owner_type and owner_id come in the
// form body alongside the file itself.
router.post("/", requirePermission("file.upload"), upload.array("files", 10), todo);

router.get("/", requireAuth, todo);
router.get("/:id", requirePermission("file.read"), todo);

// Streams the file from storage/uploads after checking access.
router.get("/:id/download", requirePermission("file.read"), todo);
router.delete("/:id", requirePermission("file.delete"), todo);

export default router;
