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
import { createAssignment, listAssignments } from '../request-handlers/assignmentController.js';
import { exportGradebook, getGradebook } from '../request-handlers/gradebookController.js';
import { createModule, getOutline } from '../request-handlers/moduleController.js';
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
router.get('/:id/modules', requirePermission('lesson.read'), getOutline);
router.post('/:id/modules', requirePermission('lesson.manage'), createModule);
router.get('/:id/assignments', requirePermission('assignment.read'), listAssignments);
router.post('/:id/assignments', requirePermission('assignment.manage'), createAssignment);
router.get('/:id/gradebook', requirePermission('submission.read'), getGradebook);
router.get('/:id/gradebook.csv', requirePermission('submission.read'), exportGradebook);

export default router;
