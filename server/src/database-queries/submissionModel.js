// SQL for submissions (the submissions table, schema/04_assessment.sql): the work a student hands
// in for an assignment. One row per student per assignment; handing in again updates that row.
// `submitted_at` is always the server's clock, never a time sent by the browser.
import { query, queryOne } from '../database/index.js';

const SELECT_SUBMISSION = `
  SELECT s.id, s.assignment_id, s.user_id, s.body, s.score, s.feedback, s.status,
         s.submitted_at, s.graded_at, u.full_name, u.email
    FROM submissions s
    JOIN users u ON u.id = s.user_id
`;

export function findById(id) {
  return queryOne(`${SELECT_SUBMISSION} WHERE s.id = :id`, { id });
}

// One student's submission for one assignment, or null
export function findFor(assignmentId, userId) {
  return queryOne(`${SELECT_SUBMISSION} WHERE s.assignment_id = :assignmentId AND s.user_id = :userId`, {
    assignmentId,
    userId,
  });
}

export function listForAssignment(assignmentId) {
  return query(`${SELECT_SUBMISSION} WHERE s.assignment_id = :assignmentId ORDER BY u.full_name`, { assignmentId });
}

// One student's submissions across a course, for their view of its assignments
export function listForStudentInCourse(userId, courseId) {
  return query(
    `${SELECT_SUBMISSION}
       JOIN assignments a ON a.id = s.assignment_id
      WHERE s.user_id = :userId AND a.course_id = :courseId`,
    { userId, courseId },
  );
}

// Hands in, or hands in again: creates the row or replaces its text, and sets submitted_at to
// now either way, so a change after the due date counts as late. Returns the submission's id.
export async function handIn({ assignmentId, userId, body }) {
  const result = await query(
    `INSERT INTO submissions (assignment_id, user_id, body, submitted_at)
     VALUES (:assignmentId, :userId, :body, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE body = :body, submitted_at = CURRENT_TIMESTAMP, id = LAST_INSERT_ID(id)`,
    { assignmentId, userId, body },
  );
  return result.insertId;
}

// Marks a submission as changed now (its files changed), which moves its hand-in time on
export function touch(id) {
  return query('UPDATE submissions SET submitted_at = CURRENT_TIMESTAMP WHERE id = :id', { id });
}

export async function idsForUser(userId) {
  const rows = await query('SELECT id FROM submissions WHERE user_id = :userId', { userId });
  return rows.map((row) => row.id);
}

export async function idsForAssignments(assignmentIds) {
  if (assignmentIds.length === 0) return [];
  const placeholders = assignmentIds.map((id, index) => `:id${index}`).join(', ');
  const params = Object.fromEntries(assignmentIds.map((id, index) => [`id${index}`, id]));
  const rows = await query(`SELECT id FROM submissions WHERE assignment_id IN (${placeholders})`, params);
  return rows.map((row) => row.id);
}

// Every submission in a course, for the gradebook
export function listForCourse(courseId) {
  return query(
    `${SELECT_SUBMISSION}
       JOIN assignments a ON a.id = s.assignment_id
      WHERE a.course_id = :courseId`,
    { courseId },
  );
}

// Saves a score and feedback. Work not yet returned becomes 'graded' (visible to staff only);
// work already returned stays 'returned', so the student sees the corrected grade at once.
export function grade({ id, score, feedback, gradedBy }) {
  return query(
    `UPDATE submissions
        SET score = :score, feedback = :feedback, graded_by = :gradedBy, graded_at = CURRENT_TIMESTAMP,
            status = IF(status = 'returned', 'returned', 'graded')
      WHERE id = :id`,
    { id, score, feedback, gradedBy },
  );
}

// Releases graded work to the student. Returns how many were released.
export async function returnGraded({ id = null, assignmentId = null }) {
  const result = await query(
    `UPDATE submissions SET status = 'returned'
      WHERE status = 'graded' AND (id = :id OR assignment_id = :assignmentId)`,
    { id, assignmentId },
  );
  return result.affectedRows;
}
