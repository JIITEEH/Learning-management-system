import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

const todo = (_req, res) =>
  res.status(501).json({ error: 'Not implemented' });

// Uploads are attached to something — owner_type and owner_id come in the
// form body alongside the file itself.
//
// The upload middleware (upload.array("files", 10) from middleware/upload.js)
// is added together with the handler, not before it. It writes every file to
// disk the moment the request arrives, so on a placeholder that answers "not
// implemented" the files would stay on disk with no record of them, and
// anyone signed in could fill the disk 250 MB at a time.
router.post('/', requirePermission('file.upload'), todo);

router.get('/', requireAuth, todo);
router.get('/:id', requirePermission('file.read'), todo);

// Streams the file from storage/uploads after checking access.
router.get('/:id/download', requirePermission('file.read'), todo);
router.delete('/:id', requirePermission('file.delete'), todo);

export default router;
