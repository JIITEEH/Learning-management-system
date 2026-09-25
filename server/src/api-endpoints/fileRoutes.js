import { Router } from 'express';
import { deleteFile, downloadFile, listFiles } from '../request-handlers/fileController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Each handler also checks the requester may see what the file is attached to
router.get('/', requirePermission('file.read'), listFiles);
router.get('/:id/download', requirePermission('file.read'), downloadFile);
router.delete('/:id', requirePermission('file.delete'), deleteFile);

export default router;
