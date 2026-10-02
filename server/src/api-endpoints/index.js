// Every API address, mounted under /api in app.js. One routes file per resource.
import { Router } from 'express';
import announcementRoutes from './announcementRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import auditRoutes from './auditRoutes.js';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import enrollmentRoutes from './enrollmentRoutes.js';
import fileRoutes from './fileRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import moduleRoutes from './moduleRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import permissionRoutes from './permissionRoutes.js';
import roleRoutes from './roleRoutes.js';
import scheduleRoutes from './scheduleRoutes.js';
import submissionRoutes from './submissionRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/courses', courseRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/modules', moduleRoutes);
router.use('/lessons', lessonRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/submissions', submissionRoutes);
router.use('/files', fileRoutes);
router.use('/announcements', announcementRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);

export default router;
