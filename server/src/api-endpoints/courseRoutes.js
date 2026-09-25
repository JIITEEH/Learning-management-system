import { Router } from 'express';
import {
  createCourse,
  deleteCourse,
  getCourse,
  getRoster,
  listCourses,
  replaceJoinCode,
  setCourseStatus,
  updateCourse,
} from '../request-handlers/courseController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// The permission code is the first gate. Each handler then checks the person's link to this
// particular course (teaching, enrolled, or administrator), in permission-rules/access.js.
router.get('/', requirePermission('course.read'), listCourses);
router.post('/', requirePermission('course.create'), createCourse);
router.get('/:id', requirePermission('course.read'), getCourse);
router.patch('/:id', requirePermission('course.update'), updateCourse);
router.delete('/:id', requirePermission('course.delete'), deleteCourse);
router.patch('/:id/status', requirePermission('course.publish'), setCourseStatus);
router.post('/:id/join-code', requirePermission('course.update'), replaceJoinCode);
router.get('/:id/roster', requirePermission('enrollment.read'), getRoster);

export default router;
