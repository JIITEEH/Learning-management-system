import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: 'Not implemented' });

router.get('/:id', requirePermission('assignment.read'), todo);
router.patch('/:id', requirePermission('assignment.manage'), todo);
router.delete('/:id', requirePermission('assignment.manage'), todo);

// Submitting and grading
router.get('/:id/submissions', requirePermission('submission.read'), todo);
// Gets upload.array("files", 10) when its handler is written, and not
// before: see the note on POST /api/files.
router.post('/:id/submissions', requirePermission('submission.create'), todo);
router.get('/:id/submissions/me', requireAuth, todo);
router.patch('/:id/submissions/:submissionId', requirePermission('submission.grade'), todo);

export default router;
