import { Router } from 'express';
import { myAttempts, startAttempt } from '../request-handlers/attemptController.js';
import { addQuestion, deleteQuiz, getQuiz, quizResults, updateQuiz } from '../request-handlers/quizController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Each handler also checks the requester's link to this quiz's course (permission-rules/access.js)
router.get('/:id', requirePermission('quiz.read'), getQuiz);
router.patch('/:id', requirePermission('quiz.manage'), updateQuiz);
router.delete('/:id', requirePermission('quiz.manage'), deleteQuiz);
router.post('/:id/questions', requirePermission('quiz.manage'), addQuestion);
router.get('/:id/results', requirePermission('quiz.manage'), quizResults);
// A student's own attempts, and starting (or carrying on with) one
router.get('/:id/attempts', requirePermission('quiz.take'), myAttempts);
router.post('/:id/attempts', requirePermission('quiz.take'), startAttempt);

export default router;
