import { Router } from 'express';
import {
  getSubmission,
  gradeSubmission,
  removeSubmissionFile,
  returnSubmission,
} from '../request-handlers/submissionController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Students and instructors both hold assignment.read; the handler decides whose submission each
// may open (their own, or their students' with submission.read)
router.get('/:id', requirePermission('assignment.read'), getSubmission);
router.delete('/:id/files/:fileId', requirePermission('submission.create'), removeSubmissionFile);
router.patch('/:id/grade', requirePermission('submission.grade'), gradeSubmission);
router.post('/:id/return', requirePermission('submission.grade'), returnSubmission);

export default router;
