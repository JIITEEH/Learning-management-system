// SQL for quizzes and their questions (the quizzes, quiz_questions and quiz_options tables,
// schema/04_assessment.sql). `due_at` is stored in UTC, like an assignment's.
import { query, queryOne, transaction } from '../database/index.js';

// Every quiz row carries how many questions it has and how many points they add up to
const SELECT_QUIZ = `
  SELECT q.id, q.course_id, q.title, q.instructions, q.due_at, q.time_limit_minutes, q.max_attempts,
         q.is_published, q.created_at,
         (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count,
         (SELECT COALESCE(SUM(qq.points), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS total_points
    FROM quizzes q
`;

export function findById(id) {
  return queryOne(`${SELECT_QUIZ} WHERE q.id = :id`, { id });
}

// A course's quizzes, soonest closing first, those with no closing time last.
// `publishedOnly` for students, who never see a quiz still being built.
export function listForCourse(courseId, { publishedOnly = false } = {}) {
  return query(
    `${SELECT_QUIZ}
      WHERE q.course_id = :courseId AND (:publishedOnly = 0 OR q.is_published = 1)
      ORDER BY q.due_at IS NULL, q.due_at, q.id`,
    { courseId, publishedOnly: publishedOnly ? 1 : 0 },
  );
}

// Returns the new id. A new quiz starts unpublished.
export async function create({ courseId, title, instructions, dueAt, timeLimitMinutes, maxAttempts }) {
  const result = await query(
    `INSERT INTO quizzes (course_id, title, instructions, due_at, time_limit_minutes, max_attempts)
     VALUES (:courseId, :title, :instructions, :dueAt, :timeLimitMinutes, :maxAttempts)`,
    { courseId, title, instructions, dueAt, timeLimitMinutes, maxAttempts },
  );
  return result.insertId;
}

export function update({ id, title, instructions, dueAt, timeLimitMinutes, maxAttempts, isPublished }) {
  return query(
    `UPDATE quizzes
        SET title = :title, instructions = :instructions, due_at = :dueAt,
            time_limit_minutes = :timeLimitMinutes, max_attempts = :maxAttempts, is_published = :isPublished
      WHERE id = :id`,
    { id, title, instructions, dueAt, timeLimitMinutes, maxAttempts, isPublished: isPublished ? 1 : 0 },
  );
}

// Deletes the quiz and everything under it, one level at a time from the bottom up. This MySQL
// release skips rows when a delete cascades through two levels of links, so nothing is left to
// the cascade (see database/README.md).
export function remove(id) {
  return transaction(async (connection) => {
    await connection.execute(
      'DELETE a FROM quiz_answers a JOIN quiz_attempts t ON t.id = a.attempt_id WHERE t.quiz_id = :id',
      { id },
    );
    await connection.execute('DELETE FROM quiz_attempts WHERE quiz_id = :id', { id });
    await connection.execute(
      'DELETE o FROM quiz_options o JOIN quiz_questions qq ON qq.id = o.question_id WHERE qq.quiz_id = :id',
      { id },
    );
    await connection.execute('DELETE FROM quiz_questions WHERE quiz_id = :id', { id });
    await connection.execute('DELETE FROM quizzes WHERE id = :id', { id });
  });
}

// Quizzes closing between two UTC times, in the courses someone teaches or takes: the same
// courses as their timetable and their assignment deadlines. A student sees published quizzes
// only. `handed_in` counts their own finished attempts, so the calendar can mark it.
export function listClosingBetween(userId, from, to) {
  return query(
    `SELECT q.id, q.title, q.due_at, c.id AS course_id, c.code AS course_code, c.title AS course_title,
            c.instructor_id = :userId AS teaching,
            (SELECT COUNT(*) FROM quiz_attempts t
              WHERE t.quiz_id = q.id AND t.user_id = :userId AND t.submitted_at IS NOT NULL) AS handed_in
       FROM quizzes q
       JOIN courses c ON c.id = q.course_id
      WHERE q.due_at >= :from AND q.due_at < :to
        AND (c.instructor_id = :userId
             OR (q.is_published = 1 AND c.status <> 'draft' AND EXISTS (
                  SELECT 1 FROM enrollments e
                   WHERE e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped')))
      ORDER BY q.due_at, q.id`,
    { userId, from, to },
  );
}

// --- Questions -------------------------------------------------------------------------------

export function findQuestion(id) {
  return queryOne('SELECT id, quiz_id, position, kind, prompt, points FROM quiz_questions WHERE id = :id', { id });
}

export function listQuestions(quizId) {
  return query(
    'SELECT id, quiz_id, position, kind, prompt, points FROM quiz_questions WHERE quiz_id = :quizId ORDER BY position, id',
    { quizId },
  );
}

// Every option of every question in a quiz, in one query
export function listOptions(quizId) {
  return query(
    `SELECT o.id, o.question_id, o.position, o.label, o.is_correct
       FROM quiz_options o
       JOIN quiz_questions qq ON qq.id = o.question_id
      WHERE qq.quiz_id = :quizId
      ORDER BY o.question_id, o.position, o.id`,
    { quizId },
  );
}

async function insertOptions(connection, questionId, options) {
  for (const [index, option] of options.entries()) {
    await connection.execute(
      'INSERT INTO quiz_options (question_id, position, label, is_correct) VALUES (:questionId, :position, :label, :isCorrect)',
      { questionId, position: index + 1, label: option.label, isCorrect: option.isCorrect ? 1 : 0 },
    );
  }
}

// Adds a question at the end of the quiz, with its options. Returns the new id.
export function addQuestion({ quizId, kind, prompt, points, options }) {
  return transaction(async (connection) => {
    const [[{ next }]] = await connection.execute(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM quiz_questions WHERE quiz_id = :quizId',
      { quizId },
    );
    const [result] = await connection.execute(
      'INSERT INTO quiz_questions (quiz_id, position, kind, prompt, points) VALUES (:quizId, :position, :kind, :prompt, :points)',
      { quizId, position: next, kind, prompt, points },
    );
    await insertOptions(connection, result.insertId, options);
    return result.insertId;
  });
}

// Replaces a question's text, kind, points and options
export function updateQuestion({ id, kind, prompt, points, options }) {
  return transaction(async (connection) => {
    await connection.execute(
      'UPDATE quiz_questions SET kind = :kind, prompt = :prompt, points = :points WHERE id = :id',
      { id, kind, prompt, points },
    );
    await connection.execute('DELETE FROM quiz_options WHERE question_id = :id', { id });
    await insertOptions(connection, id, options);
  });
}

export function removeQuestion(id) {
  return transaction(async (connection) => {
    await connection.execute('DELETE FROM quiz_answers WHERE question_id = :id', { id });
    await connection.execute('DELETE FROM quiz_options WHERE question_id = :id', { id });
    await connection.execute('DELETE FROM quiz_questions WHERE id = :id', { id });
  });
}

// Whether anyone has started the quiz: from then on its questions are fixed, so everyone is
// marked against the same ones
export async function hasAttempts(quizId) {
  return Boolean(await queryOne('SELECT 1 FROM quiz_attempts WHERE quiz_id = :quizId LIMIT 1', { quizId }));
}
