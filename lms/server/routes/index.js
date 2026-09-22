import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import roleRoutes from "./roles.js";
import permissionRoutes from "./permissions.js";
import courseRoutes from "./courses.js";
import lessonRoutes from "./lessons.js";
import enrollmentRoutes from "./enrollments.js";
import assignmentRoutes from "./assignments.js";
import fileRoutes from "./files.js";
import scheduleRoutes from "./schedules.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

// Foundation: accounts, roles, permissions
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);

// Teaching and learning
router.use("/courses", courseRoutes);
router.use("/lessons", lessonRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/assignments", assignmentRoutes);

// Foundation: uploads and schedules
router.use("/files", fileRoutes);
router.use("/schedules", scheduleRoutes);

export default router;
