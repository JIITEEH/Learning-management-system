import { Router } from 'express';
import { deleteMeeting, mySchedule, updateMeeting } from '../request-handlers/scheduleController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

router.get('/me', requirePermission('schedule.read'), mySchedule);
// Each handler also checks the requester manages the meeting's course
router.patch('/:id', requirePermission('schedule.manage'), updateMeeting);
router.delete('/:id', requirePermission('schedule.manage'), deleteMeeting);

export default router;
