// Quizzes: a course's list, creating, reading, editing, publishing and deleting them, their
// questions, and the instructor's table of results. Taking a quiz is in attemptController.js.
//
// Which options are right is sent only to someone who manages the course. A student gets the
// questions only inside an attempt, without the answers.
import * as Attempt from '../database-queries/attemptModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Quiz from '../database-queries/quizModel.js';
import { nowUtc } from '../helpers/grades.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, optionalDateTime, optionalText, parseId, requireNumber, requireText } from '../helpers/validate.js';
import { manageCourse, reachCourse, reachQuiz } from '../permission-rules/access.js';

const KINDS = ['single', 'multiple', 'true_false', 'short'];
const MAX_OPTIONS = 10;

export function quizToJson(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    instructions: row.instructions ?? '',
    dueAt: row.due_at,
    timeLimitMinutes: row.time_limit_minutes,
    maxAttempts: row.max_attempts,
    isPublished: Boolean(row.is_published),
    questionCount: Number(row.question_count),
    totalPoints: Number(row.total_points),
  };
}

// A question with its options. `withAnswers` (for whoever manages the course) adds which options
// are right; without it a short-answer question has no options at all, since they are the answers.
export function questionToJson(question, options, { withAnswers = false } = {}) {
  const own = options.filter((option) => option.question_id === question.id);
  const shown = !withAnswers && question.kind === 'short' ? [] : own;
  return {
    id: question.id,
    kind: question.kind,
    prompt: question.prompt,
    points: Number(question.points),
    options: shown.map((option) => ({
      id: option.id,
      label: option.label,
      ...(withAnswers ? { isCorrect: Boolean(option.is_correct) } : {}),
    })),
  };
}

export const isClosed = (quiz, now = nowUtc()) => quiz.due_at !== null && quiz.due_at < now;

// Reads quiz settings from the request. When editing, a field left out keeps its current value.
function readQuiz(body = {}, current = null) {
  const pick = (field, read) => (body[field] === undefined && current ? current[field] : read(body[field]));
  const settings = {
    title: pick('title', (value) => requireText(value, 'Title')),
    instructions: pick('instructions', (value) => optionalText(value, 'Instructions', { max: 20000 })),
    dueAt: pick('dueAt', (value) => optionalDateTime(value, 'Closing time')),
    timeLimitMinutes: pick('timeLimitMinutes', (value) =>
      value === null || value === '' || value === undefined ? null : requireNumber(value, 'Time limit', { min: 1, max: 600 })),
    maxAttempts: pick('maxAttempts', (value) => requireNumber(value ?? 1, 'Attempts allowed', { min: 1, max: 10 })),
  };
  if (settings.timeLimitMinutes !== null && !Number.isInteger(settings.timeLimitMinutes)) {
    throw new HttpError(400, 'Time limit must be a whole number of minutes');
  }
  if (!Number.isInteger(settings.maxAttempts)) throw new HttpError(400, 'Attempts allowed must be a whole number');
  return settings;
}

// Reads a question and its options from the request. Every kind ends up as a list of options:
// a true/false question as True and False, a short-answer one as its accepted answers.
function readQuestion(body = {}) {
  const kind = oneOf(body.kind, KINDS, 'Question type');
  const prompt = requireText(body.prompt, 'Question', { max: 2000 });
  const points = Math.round(requireNumber(body.points ?? 1, 'Points', { min: 0.5, max: 1000 }) * 100) / 100;
  let options;

  if (kind === 'true_false') {
    if (typeof body.answer !== 'boolean') throw new HttpError(400, 'Say whether the statement is true or false');
    options = [{ label: 'True', isCorrect: body.answer }, { label: 'False', isCorrect: !body.answer }];
  } else if (kind === 'short') {
    const accepted = Array.isArray(body.acceptedAnswers) ? body.acceptedAnswers : [];
    options = accepted.map((label) => ({ label: requireText(label, 'Accepted answer', { max: 500 }), isCorrect: true }));
    if (options.length === 0) throw new HttpError(400, 'Give at least one accepted answer');
  } else {
    const sent = Array.isArray(body.options) ? body.options : [];
    options = sent.map((option) => ({ label: requireText(option?.label, 'Option', { max: 500 }), isCorrect: option?.isCorrect === true }));
    if (options.length < 2) throw new HttpError(400, 'Give at least two options');
    const right = options.filter((option) => option.isCorrect).length;
    if (kind === 'single' && right !== 1) throw new HttpError(400, 'Mark exactly one option as right');
    if (kind === 'multiple' && right < 1) throw new HttpError(400, 'Mark at least one option as right');
  }
  if (options.length > MAX_OPTIONS) throw new HttpError(400, `A question can have at most ${MAX_OPTIONS} options`);
  return { kind, prompt, points, options };
}

// Questions are fixed once anyone has started, so every attempt is marked against the same ones
async function requireNoAttempts(quizId) {
  if (await Quiz.hasAttempts(quizId)) {
    throw new HttpError(409, 'Someone has already started this quiz, so its questions can no longer change');
  }
}

async function findManagedQuestion(req) {
  const question = await Quiz.findQuestion(parseId(req.params.id, 'Question not found'));
  if (!question) throw new HttpError(404, 'Question not found');
  const { quiz } = await reachQuiz(req, question.quiz_id, { manage: true });
  return { question, quiz };
}

// A course's quizzes. A student sees published ones only, each with their attempts used and best
// score so far.
export async function listQuizzes(req, res) {
  const { course, relation } = await reachCourse(req, req.params.id);
  const isStudent = relation === 'enrolled';
  const rows = await Quiz.listForCourse(course.id, { publishedOnly: isStudent });
  if (!isStudent) return res.json({ quizzes: rows.map(quizToJson) });

  const mine = new Map((await Attempt.summaryForStudent(course.id, req.user.id)).map((row) => [row.quiz_id, row]));
  res.json({
    quizzes: rows.map((row) => {
      const summary = mine.get(row.id);
      return {
        ...quizToJson(row),
        attemptsUsed: summary ? Number(summary.attempts) : 0,
        bestScore: summary ? Number(summary.best_score) : null,
      };
    }),
  });
}

export async function createQuiz(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const id = await Quiz.create({ courseId: course.id, ...readQuiz(req.body) });
  res.status(201).json({ quiz: quizToJson(await Quiz.findById(id)) });
}

// The quiz itself. Whoever manages the course also gets its questions with the answers.
export async function getQuiz(req, res) {
  const { quiz, course, relation } = await reachQuiz(req, req.params.id);
  const manages = relation !== 'enrolled';
  const reply = { quiz: quizToJson(quiz), course: { id: course.id, code: course.code, title: course.title, relation } };
  if (manages) {
    const [questions, options] = await Promise.all([Quiz.listQuestions(quiz.id), Quiz.listOptions(quiz.id)]);
    reply.questions = questions.map((question) => questionToJson(question, options, { withAnswers: true }));
    reply.locked = await Quiz.hasAttempts(quiz.id);
  }
  res.json(reply);
}

// Settings, and publishing: { isPublished: true } shows it to students and tells them about it
export async function updateQuiz(req, res) {
  const { quiz, course } = await reachQuiz(req, req.params.id, { manage: true });
  const current = {
    title: quiz.title,
    instructions: quiz.instructions,
    dueAt: quiz.due_at,
    timeLimitMinutes: quiz.time_limit_minutes,
    maxAttempts: quiz.max_attempts,
  };
  const settings = readQuiz(req.body, current);
  const isPublished = req.body?.isPublished === undefined ? Boolean(quiz.is_published) : req.body.isPublished === true;
  if (isPublished && Number(quiz.question_count) === 0) throw new HttpError(409, 'Add a question before publishing');
  if (!isPublished && quiz.is_published && (await Quiz.hasAttempts(quiz.id))) {
    throw new HttpError(409, 'Students have already taken this quiz, so it cannot be hidden again');
  }

  await Quiz.update({ id: quiz.id, ...settings, isPublished });
  if (isPublished && !quiz.is_published && course.status !== 'draft') {
    await Notification.notify({
      recipients: await Notification.courseStudentIds(course.id),
      actorId: req.user.id,
      type: 'quiz',
      title: `New quiz in ${course.code}`,
      body: settings.title,
      link: `/courses/${course.id}/quizzes/${quiz.id}`,
    });
  }
  res.json({ quiz: quizToJson(await Quiz.findById(quiz.id)) });
}

export async function deleteQuiz(req, res) {
  const { quiz } = await reachQuiz(req, req.params.id, { manage: true });
  await Quiz.remove(quiz.id);
  res.status(204).end();
}

export async function addQuestion(req, res) {
  const { quiz } = await reachQuiz(req, req.params.id, { manage: true });
  await requireNoAttempts(quiz.id);
  const id = await Quiz.addQuestion({ quizId: quiz.id, ...readQuestion(req.body) });
  const [question, options] = await Promise.all([Quiz.findQuestion(id), Quiz.listOptions(quiz.id)]);
  res.status(201).json({ question: questionToJson(question, options, { withAnswers: true }) });
}

export async function updateQuestion(req, res) {
  const { question, quiz } = await findManagedQuestion(req);
  await requireNoAttempts(quiz.id);
  await Quiz.updateQuestion({ id: question.id, ...readQuestion(req.body) });
  const [updated, options] = await Promise.all([Quiz.findQuestion(question.id), Quiz.listOptions(quiz.id)]);
  res.json({ question: questionToJson(updated, options, { withAnswers: true }) });
}

export async function deleteQuestion(req, res) {
  const { question, quiz } = await findManagedQuestion(req);
  await requireNoAttempts(quiz.id);
  await Quiz.removeQuestion(question.id);
  res.status(204).end();
}

// For the instructor: every student in the course, their attempts used and best score
export async function quizResults(req, res) {
  const { quiz, course } = await reachQuiz(req, req.params.id, { manage: true });
  const rows = await Attempt.resultsForQuiz(quiz.id, course.id);
  res.json({
    students: rows.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      attempts: Number(row.attempts),
      bestScore: row.best_score === null ? null : Number(row.best_score),
      lastSubmittedAt: row.last_submitted_at,
    })),
  });
}
