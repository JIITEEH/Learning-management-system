import { Router } from 'express';
import { allowLessonUpload, uploadLessonFiles } from '../request-handlers/fileController.js';
import { deleteLesson, getLesson, moveLesson, setProgress, updateLesson } from '../request-handlers/lessonController.js';
import { requirePermission } from '../request-filters/auth.js';
import { upload } from '../request-filters/upload.js';

const router = Router();

// Each handler also checks the requester's link to this lesson's course (permission-rules/access.js)
router.get('/:id', requirePermission('lesson.read'), getLesson);
router.patch('/:id', requirePermission('lesson.manage'), updateLesson);
router.post('/:id/move', requirePermission('lesson.manage'), moveLesson);
router.delete('/:id', requirePermission('lesson.manage'), deleteLesson);
router.put('/:id/progress', requirePermission('lesson.read'), setProgress);

// Order matters: the access check runs before `upload`, which saves files to disk as they arrive.
// Up to 10 files per request, sent as form field "files".
router.post(
  '/:id/files',
  requirePermission('lesson.manage', 'file.upload'),
  allowLessonUpload,
  upload.array('files', 10),
  uploadLessonFiles,
);

export default router;
