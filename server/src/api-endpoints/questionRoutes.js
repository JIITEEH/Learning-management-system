import { Router } from 'express';
import { deleteQuestion, updateQuestion } from '../request-handlers/quizController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// One question of a quiz. Each handler also checks the requester manages the quiz's course.
router.patch('/:id', requirePermission('quiz.manage'), updateQuestion);
router.delete('/:id', requirePermission('quiz.manage'), deleteQuestion);

export default router;
