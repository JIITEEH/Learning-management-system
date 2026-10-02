// SQL for quiz attempts and their answers (the quiz_attempts and quiz_answers tables,
// schema/04_assessment.sql). Marking happens in helpers/quizMarking.js; this only stores it.
import { query, queryOne, transaction } from '../database/index.js';

const SELECT_ATTEMPT = `
  SELECT id, quiz_id, user_id, attempt_number, started_at, ends_at, submitted_at, score, max_score
    FROM quiz_attempts
`;

export function findById(id) {
  return queryOne(`${SELECT_ATTEMPT} WHERE id = :id`, { id });
}

// One person's attempts at one quiz, first to last
export function listFor(quizId, userId) {
  return query(`${SELECT_ATTEMPT} WHERE quiz_id = :quizId AND user_id = :userId ORDER BY attempt_number`, {
    quizId,
    userId,
  });
}

// Returns the new id. `endsAt` is UTC, or null for no time limit and no closing time.
export async function create({ quizId, userId, attemptNumber, endsAt, maxScore }) {
  const result = await query(
    `INSERT INTO quiz_attempts (quiz_id, user_id, attempt_number, ends_at, max_score)
     VALUES (:quizId, :userId, :attemptNumber, :endsAt, :maxScore)`,
    { quizId, userId, attemptNumber, endsAt, maxScore },
  );
  return result.insertId;
}

// Stores the marked answers and the score, and closes the attempt. Only an attempt still open is
// changed, so handing in twice at once (a double click, two tabs) cannot store two sets of
// answers. Returns whether this call was the one that closed it.
export function submit({ id, answers, score }) {
  return transaction(async (connection) => {
    const [closed] = await connection.execute(
      'UPDATE quiz_attempts SET submitted_at = CURRENT_TIMESTAMP, score = :score WHERE id = :id AND submitted_at IS NULL',
      { id, score },
    );
    if (closed.affectedRows === 0) return false;
    for (const answer of answers) {
      await connection.execute(
        `INSERT INTO quiz_answers (attempt_id, question_id, option_ids, text_answer, is_correct, points_awarded)
         VALUES (:attemptId, :questionId, :optionIds, :textAnswer, :isCorrect, :pointsAwarded)`,
        { attemptId: id, ...answer, isCorrect: answer.isCorrect ? 1 : 0 },
      );
    }
    return true;
  });
}

export function listAnswers(attemptId) {
  return query(
    `SELECT question_id, option_ids, text_answer, is_correct, points_awarded
       FROM quiz_answers WHERE attempt_id = :attemptId`,
    { attemptId },
  );
}

// For the instructor: each student taking the course, with their attempts used and best score
export function resultsForQuiz(quizId, courseId) {
  return query(
    `SELECT e.user_id, u.full_name, u.email,
            COUNT(t.id) AS attempts,
            MAX(t.score) AS best_score,
            MAX(t.submitted_at) AS last_submitted_at
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN quiz_attempts t ON t.user_id = e.user_id AND t.quiz_id = :quizId AND t.submitted_at IS NOT NULL
      WHERE e.course_id = :courseId AND e.status <> 'dropped'
      GROUP BY e.user_id, u.full_name, u.email
      ORDER BY u.full_name`,
    { quizId, courseId },
  );
}

// One student's handed-in attempts and best score on each quiz in a course, in one query
export function summaryForStudent(courseId, userId) {
  return query(
    `SELECT t.quiz_id, COUNT(*) AS attempts, MAX(t.score) AS best_score
       FROM quiz_attempts t
       JOIN quizzes q ON q.id = t.quiz_id
      WHERE q.course_id = :courseId AND t.user_id = :userId AND t.submitted_at IS NOT NULL
      GROUP BY t.quiz_id`,
    { courseId, userId },
  );
}

// Every student's best handed-in score on every quiz in a course, for the gradebook
export function bestScoresForCourse(courseId) {
  return query(
    `SELECT t.quiz_id, t.user_id, MAX(t.score) AS best_score
       FROM quiz_attempts t
       JOIN quizzes q ON q.id = t.quiz_id
      WHERE q.course_id = :courseId AND t.submitted_at IS NOT NULL
      GROUP BY t.quiz_id, t.user_id`,
    { courseId },
  );
}
