import { Router } from 'express';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../request-handlers/notificationController.js';
import { requireAuth } from '../request-filters/auth.js';

const router = Router();

// Every route reads or changes only the signed-in account's own notifications
router.get('/', requireAuth, listNotifications);
router.post('/read-all', requireAuth, markAllNotificationsRead);
router.post('/:id/read', requireAuth, markNotificationRead);

export default router;
