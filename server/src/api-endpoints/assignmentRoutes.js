import { Router } from 'express';
import { deleteAssignment, getAssignment, updateAssignment } from '../request-handlers/assignmentController.js';
import { allowHandIn, handIn, listSubmissions } from '../request-handlers/submissionController.js';
import { requirePermission } from '../request-filters/auth.js';
import { upload } from '../request-filters/upload.js';

const router = Router();

// Each handler also checks the requester's link to this assignment's course (permission-rules/access.js)
router.get('/:id', requirePermission('assignment.read'), getAssignment);
router.patch('/:id', requirePermission('assignment.manage'), updateAssignment);
router.delete('/:id', requirePermission('assignment.manage'), deleteAssignment);
router.get('/:id/submissions', requirePermission('submission.read'), listSubmissions);

// Handing in: the access check runs before `upload`, which saves files to disk as they arrive.
// A written answer comes as form field "body", files as "files" (up to 10).
router.post('/:id/submission', requirePermission('submission.create'), allowHandIn, upload.array('files', 10), handIn);

export default router;
