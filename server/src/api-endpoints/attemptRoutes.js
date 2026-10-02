import { Router } from 'express';
import { getAttempt, submitAttempt } from '../request-handlers/attemptController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// A student's own attempt at a quiz: anyone else's answers 404
router.get('/:id', requirePermission('quiz.take'), getAttempt);
router.post('/:id/submit', requirePermission('quiz.take'), submitAttempt);

export default router;
