import { Router } from 'express';
import { deleteFile, downloadFile } from '../request-handlers/fileController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Each handler also checks the requester may reach the lesson the file belongs to
router.get('/:id/download', requirePermission('file.read'), downloadFile);
router.delete('/:id', requirePermission('file.delete'), deleteFile);

export default router;
