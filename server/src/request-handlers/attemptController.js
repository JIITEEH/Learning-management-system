// Taking a quiz: starting an attempt, handing it in to be marked, and reading the result.
//
// Time is kept by the server. When an attempt starts, its end is fixed (the time limit, or the
// quiz's closing time if that comes sooner), and answers handed in after it, beyond a minute of
// grace for a slow connection, are not counted. The browser's countdown is only a display.
import * as Attempt from '../database-queries/attemptModel.js';
import * as Quiz from '../database-queries/quizModel.js';
import { nowUtc } from '../helpers/grades.js';
import { HttpError } from '../helpers/httpError.js';
import { markAttempt } from '../helpers/quizMarking.js';
import { parseId } from '../helpers/validate.js';
import { reachQuiz } from '../permission-rules/access.js';
import { isClosed, questionToJson, quizToJson } from './quizController.js';

const GRACE_SECONDS = 60;

// MySQL's 'YYYY-MM-DD HH:MM:SS' in UTC, from a Date
const toUtc = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

// Past its end and the grace after it: time is up, whatever the browser says
function timeIsUp(attempt) {
  if (!attempt.ends_at) return false;
  return Date.now() > Date.parse(`${attempt.ends_at.replace(' ', 'T')}Z`) + GRACE_SECONDS * 1000;
}

// An attempt someone started and never handed in, now out of time, is closed with no answers:
// 0 points. Done when it is next looked at, so no background job is needed.
async function closeIfExpired(attempt) {
  if (attempt.submitted_at || !timeIsUp(attempt)) return attempt;
  await Attempt.submit({ id: attempt.id, answers: [], score: 0 });
  return Attempt.findById(attempt.id);
}

function attemptToJson(attempt) {
  return {
    id: attempt.id,
    quizId: attempt.quiz_id,
    attemptNumber: attempt.attempt_number,
    startedAt: attempt.started_at,
    endsAt: attempt.ends_at,
    submittedAt: attempt.submitted_at,
    score: attempt.score === null ? null : Number(attempt.score),
    maxScore: Number(attempt.max_score),
  };
}

// The questions to answer, without the answers
async function questionsFor(quizId) {
  const [questions, options] = await Promise.all([Quiz.listQuestions(quizId), Quiz.listOptions(quizId)]);
  return { questions, options };
}

// The attempt in the URL, which must be the requester's own
async function findOwnAttempt(req) {
  const attempt = await Attempt.findById(parseId(req.params.id, 'Attempt not found'));
  if (!attempt || attempt.user_id !== req.user.id) throw new HttpError(404, 'Attempt not found');
  const reached = await reachQuiz(req, attempt.quiz_id);
  return { attempt: await closeIfExpired(attempt), ...reached };
}

// A student's own attempts at a quiz, and whether they may start another
export async function myAttempts(req, res) {
  const { quiz, relation } = await reachQuiz(req, req.params.id);
  if (relation !== 'enrolled') return res.json({ attempts: [], canStart: false });
  const attempts = await Promise.all((await Attempt.listFor(quiz.id, req.user.id)).map(closeIfExpired));
  const open = attempts.find((attempt) => !attempt.submitted_at);
  const canStart = !isClosed(quiz) && Number(quiz.question_count) > 0 && (Boolean(open) || attempts.length < quiz.max_attempts);
  res.json({ attempts: attempts.map(attemptToJson), openAttemptId: open?.id ?? null, canStart });
}

// Starts an attempt, or carries on with the one already open (after a reload, say). Only a
// student taking the course may, and only while the quiz is open and attempts remain.
export async function startAttempt(req, res) {
  const { quiz, relation } = await reachQuiz(req, req.params.id);
  if (relation !== 'enrolled') throw new HttpError(403, 'Only students taking this course can take its quizzes');

  const attempts = await Promise.all((await Attempt.listFor(quiz.id, req.user.id)).map(closeIfExpired));
  let attempt = attempts.find((row) => !row.submitted_at);
  if (!attempt) {
    if (isClosed(quiz)) throw new HttpError(409, 'This quiz has closed');
    if (Number(quiz.question_count) === 0) throw new HttpError(409, 'This quiz has no questions yet');
    if (attempts.length >= quiz.max_attempts) throw new HttpError(409, 'You have used every attempt at this quiz');

    // The end is the time limit from now, or the closing time if that comes first
    const ends = [];
    if (quiz.time_limit_minutes) ends.push(new Date(Date.now() + quiz.time_limit_minutes * 60000));
    if (quiz.due_at) ends.push(new Date(`${quiz.due_at.replace(' ', 'T')}Z`));
    const endsAt = ends.length ? toUtc(new Date(Math.min(...ends))) : null;
    try {
      const id = await Attempt.create({
        quizId: quiz.id,
        userId: req.user.id,
        attemptNumber: attempts.length + 1,
        endsAt,
        maxScore: Number(quiz.total_points),
      });
      attempt = await Attempt.findById(id);
    } catch (error) {
      // Two "Start" clicks at once: the second finds the first's attempt number taken
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      throw new HttpError(409, 'An attempt was just started. Reload the page to carry on with it.');
    }
  }

  const { questions, options } = await questionsFor(quiz.id);
  res.status(201).json({
    attempt: attemptToJson(attempt),
    quiz: quizToJson(quiz),
    questions: questions.map((question) => questionToJson(question, options)),
    serverNow: nowUtc(),
  });
}

// An attempt: still open, its questions to carry on with; handed in, its score and which
// questions were right. The right answers themselves are never sent to a student.
export async function getAttempt(req, res) {
  const { attempt, quiz } = await findOwnAttempt(req);
  const { questions, options } = await questionsFor(quiz.id);
  const reply = { attempt: attemptToJson(attempt), quiz: quizToJson(quiz), serverNow: nowUtc() };

  if (!attempt.submitted_at) {
    reply.questions = questions.map((question) => questionToJson(question, options));
  } else {
    const answers = new Map((await Attempt.listAnswers(attempt.id)).map((row) => [row.question_id, row]));
    reply.questions = questions.map((question) => {
      const answer = answers.get(question.id);
      return {
        ...questionToJson(question, options),
        yourAnswer: answer
          ? { optionIds: answer.option_ids ? answer.option_ids.split(',').map(Number) : [], text: answer.text_answer }
          : null,
        isCorrect: Boolean(answer?.is_correct),
        pointsAwarded: answer ? Number(answer.points_awarded) : 0,
      };
    });
  }
  res.json(reply);
}

// Hands an attempt in. Body: { answers: [{ questionId, optionIds: [..] } | { questionId, text }] }.
// Marked here and now; the reply is the same as getAttempt's for a finished attempt.
export async function submitAttempt(req, res) {
  const { attempt, quiz } = await findOwnAttempt(req);
  if (attempt.submitted_at) {
    throw new HttpError(409, timeIsUp(attempt) ? 'Time ran out before this attempt was handed in' : 'This attempt is already handed in');
  }

  const { questions, options } = await questionsFor(quiz.id);
  const { answers, score } = markAttempt(questions, options, req.body?.answers);
  const closedByThisCall = await Attempt.submit({ id: attempt.id, answers, score });
  if (!closedByThisCall) throw new HttpError(409, 'This attempt is already handed in');
  return getAttempt(req, res);
}
