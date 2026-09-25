// Every API address, mounted under /api in app.js. One routes file per resource.
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import courseRoutes from './courseRoutes.js';
import enrollmentRoutes from './enrollmentRoutes.js';
import fileRoutes from './fileRoutes.js';
import lessonRoutes from './lessonRoutes.js';
import moduleRoutes from './moduleRoutes.js';
import permissionRoutes from './permissionRoutes.js';
import roleRoutes from './roleRoutes.js';
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
router.use('/files', fileRoutes);

export default router;
