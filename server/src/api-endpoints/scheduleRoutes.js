import { Router } from 'express';
import { deleteMeeting, myDeadlines, mySchedule, updateMeeting } from '../request-handlers/scheduleController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

router.get('/me', requirePermission('schedule.read'), mySchedule);
router.get('/deadlines', requirePermission('schedule.read'), myDeadlines);
// Each handler also checks the requester manages the meeting's course
router.patch('/:id', requirePermission('schedule.manage'), updateMeeting);
router.delete('/:id', requirePermission('schedule.manage'), deleteMeeting);

export default router;
