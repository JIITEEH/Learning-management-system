// A course's outline: its modules (chapters), the lessons in each, and a student's progress.
import * as File from '../database-queries/fileModel.js';
import * as Lesson from '../database-queries/lessonModel.js';
import * as Module from '../database-queries/moduleModel.js';
import * as Progress from '../database-queries/progressModel.js';
import { discardFiles } from '../helpers/files.js';
import { LESSON_TEXT_MAX, oneOf, optionalText, requireText } from '../helpers/validate.js';
import { manageCourse, reachCourse, reachModule } from '../permission-rules/access.js';

// The whole outline in three queries (modules, lessons, finished lessons), put together here,
// rather than one query per module
export async function getOutline(req, res) {
  const { course, relation } = await reachCourse(req, req.params.id);
  const [modules, lessons] = await Promise.all([Module.listForCourse(course.id), Lesson.listForCourse(course.id)]);
  // Progress is only kept for students taking the course
  const finished = relation === 'enrolled' ? await Progress.completedInCourse(req.user.id, course.id) : new Set();

  res.json({
    modules: modules.map((courseModule) => ({
      id: courseModule.id,
      title: courseModule.title,
      lessons: lessons
        .filter((lesson) => lesson.module_id === courseModule.id)
        .map((lesson) => ({ id: lesson.id, title: lesson.title, completed: finished.has(lesson.id) })),
    })),
    progress: relation === 'enrolled' ? { completed: finished.size, total: lessons.length } : null,
  });
}

export async function createModule(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const id = await Module.create({ courseId: course.id, title: requireText(req.body?.title, 'Module title') });
  res.status(201).json({ module: { id } });
}

export async function renameModule(req, res) {
  const { courseModule } = await reachModule(req, req.params.id, { manage: true });
  await Module.rename(courseModule.id, requireText(req.body?.title, 'Module title'));
  res.status(204).end();
}

// Moves a module one place 'up' or 'down' in the course
export async function moveModule(req, res) {
  const { courseModule } = await reachModule(req, req.params.id, { manage: true });
  await Module.move(courseModule.id, oneOf(req.body?.direction, ['up', 'down'], 'Direction'));
  res.status(204).end();
}

// Deletes the module, its lessons and everything attached to them, including uploaded files
export async function deleteModule(req, res) {
  const { courseModule } = await reachModule(req, req.params.id, { manage: true });
  const files = await File.listForLessons(await Lesson.idsInModule(courseModule.id));
  await Module.remove(courseModule.id);
  await discardFiles(files);
  res.status(204).end();
}

// Adds a lesson at the end of a module. Content can be written straight away or later.
export async function createLesson(req, res) {
  const { courseModule } = await reachModule(req, req.params.id, { manage: true });
  const id = await Lesson.create({
    moduleId: courseModule.id,
    title: requireText(req.body?.title, 'Lesson title'),
    content: optionalText(req.body?.content, 'Lesson text', { max: LESSON_TEXT_MAX }),
  });
  res.status(201).json({ lesson: { id } });
}
