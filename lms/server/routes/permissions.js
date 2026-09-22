import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

// The catalogue of permission codes, for building role editors.
router.get("/", requireAuth, todo);

export default router;
