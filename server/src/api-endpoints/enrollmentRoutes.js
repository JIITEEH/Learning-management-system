import { Router } from 'express';
import {
  addToCourse,
  joinWithCode,
  removeEnrollment,
  setEnrollmentStatus,
} from '../request-handlers/enrollmentController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

router.post('/me', requirePermission('enrollment.self'), joinWithCode);
router.post('/', requirePermission('enrollment.manage'), addToCourse);
router.patch('/:id', requirePermission('enrollment.manage'), setEnrollmentStatus);
router.delete('/:id', requirePermission('enrollment.manage'), removeEnrollment);

export default router;
