import { Router } from 'express';
import { getSubmission, removeSubmissionFile } from '../request-handlers/submissionController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Students and instructors both hold assignment.read; the handler decides whose submission each
// may open (their own, or their students' with submission.read)
router.get('/:id', requirePermission('assignment.read'), getSubmission);
router.delete('/:id/files/:fileId', requirePermission('submission.create'), removeSubmissionFile);

export default router;
