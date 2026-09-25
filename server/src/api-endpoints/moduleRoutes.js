import { Router } from 'express';
import { createLesson, deleteModule, moveModule, renameModule } from '../request-handlers/moduleController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Each handler also checks the requester manages this module's course (permission-rules/access.js)
router.patch('/:id', requirePermission('lesson.manage'), renameModule);
router.post('/:id/move', requirePermission('lesson.manage'), moveModule);
router.delete('/:id', requirePermission('lesson.manage'), deleteModule);
router.post('/:id/lessons', requirePermission('lesson.manage'), createLesson);

export default router;
