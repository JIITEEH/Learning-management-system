import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: 'Not implemented' });

router.get('/:id', requirePermission('lesson.read'), todo);
router.patch('/:id', requirePermission('lesson.manage'), todo);
router.delete('/:id', requirePermission('lesson.manage'), todo);

// Marks a lesson complete for the signed-in student.
router.post('/:id/complete', requireAuth, todo);

export default router;
