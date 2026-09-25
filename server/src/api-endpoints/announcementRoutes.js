import { Router } from 'express';
import { deleteAnnouncement, updateAnnouncement } from '../request-handlers/announcementController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Each handler also checks the requester manages the announcement's course
router.patch('/:id', requirePermission('announcement.manage'), updateAnnouncement);
router.delete('/:id', requirePermission('announcement.manage'), deleteAnnouncement);

export default router;
