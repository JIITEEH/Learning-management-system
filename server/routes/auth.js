import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: "Not implemented" });

router.post("/register", todo);
router.post("/login", todo);
router.post("/logout", todo);

// The signed-in account, plus the permission codes it currently holds —
// the front end uses these to decide what to render.
router.get("/me", requireAuth, todo);
router.patch("/password", requireAuth, todo);

export default router;
