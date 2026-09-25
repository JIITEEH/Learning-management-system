// One lesson: reading it, editing it, moving it, deleting it, and a student marking it done.
import * as File from '../database-queries/fileModel.js';
import * as Lesson from '../database-queries/lessonModel.js';
import * as Progress from '../database-queries/progressModel.js';
import { discardFiles } from '../helpers/files.js';
import { LESSON_TEXT_MAX, oneOf, optionalText, requireText } from '../helpers/validate.js';
import { reachLesson } from '../permission-rules/access.js';

export function fileToJson(file) {
  return {
    id: file.id,
    name: file.original_name,
    type: file.mime_type,
    size: file.size_bytes,
    uploadedAt: file.uploaded_at,
  };
}

// The lesson, its files, where it sits in the course (for previous / next), and whether the
// student has finished it
export async function getLesson(req, res) {
  const { lesson, course, relation } = await reachLesson(req, req.params.id);
  const [files, inOrder] = await Promise.all([File.listFor('lesson', lesson.id), Lesson.listForCourse(course.id)]);
  const index = inOrder.findIndex((other) => other.id === lesson.id);
  const neighbour = (other) => (other ? { id: other.id, title: other.title } : null);
  const finished = relation === 'enrolled' ? await Progress.completedInCourse(req.user.id, course.id) : null;

  res.json({
    lesson: {
      id: lesson.id,
      title: lesson.title,
      content: lesson.content ?? '',
      moduleId: lesson.module_id,
      moduleTitle: lesson.module_title,
      updatedAt: lesson.updated_at,
      completed: finished ? finished.has(lesson.id) : null,
    },
    course: { id: course.id, code: course.code, title: course.title, relation },
    files: files.map(fileToJson),
    previous: neighbour(inOrder[index - 1]),
    next: neighbour(inOrder[index + 1]),
  });
}

// Fields left out of the request keep their current value
export async function updateLesson(req, res) {
  const { lesson } = await reachLesson(req, req.params.id, { manage: true });
  const body = req.body ?? {};
  await Lesson.update({
    id: lesson.id,
    title: body.title === undefined ? lesson.title : requireText(body.title, 'Lesson title'),
    content: body.content === undefined ? lesson.content : optionalText(body.content, 'Lesson text', { max: LESSON_TEXT_MAX }),
  });
  res.status(204).end();
}

// Moves a lesson one place 'up' or 'down' within its module
export async function moveLesson(req, res) {
  const { lesson } = await reachLesson(req, req.params.id, { manage: true });
  await Lesson.move(lesson.id, oneOf(req.body?.direction, ['up', 'down'], 'Direction'));
  res.status(204).end();
}

// Deletes the lesson, the progress recorded on it, and its uploaded files
export async function deleteLesson(req, res) {
  const { lesson } = await reachLesson(req, req.params.id, { manage: true });
  const files = await File.listFor('lesson', lesson.id);
  await Lesson.remove(lesson.id);
  await discardFiles(files);
  res.status(204).end();
}

// A student marks a lesson done, or not done: { completed: true | false }
export async function setProgress(req, res) {
  const { lesson, course, relation } = await reachLesson(req, req.params.id);
  if (relation !== 'enrolled') {
    return res.status(403).json({ error: 'Only students taking this course can mark lessons as done' });
  }
  await Progress.setCompleted(req.user.id, lesson.id, req.body?.completed === true);
  const finished = await Progress.completedInCourse(req.user.id, course.id);
  res.json({ completed: finished.has(lesson.id), progress: { completed: finished.size } });
}
