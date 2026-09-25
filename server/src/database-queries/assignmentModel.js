// SQL for assignments (the assignments table, schema/04_assessment.sql). `due_at` is stored in
// UTC (see database/README.md, "Times are UTC").
import { query, queryOne, transaction } from '../database/index.js';

const SELECT_ASSIGNMENT = `
  SELECT id, course_id, title, instructions, due_at, max_score, created_at
    FROM assignments
`;

export function findById(id) {
  return queryOne(`${SELECT_ASSIGNMENT} WHERE id = :id`, { id });
}

// A course's assignments, soonest due first, with those that have no due date last. Each row
// also carries how many students have handed in, for the instructor's overview.
export function listForCourse(courseId) {
  return query(
    `SELECT a.id, a.course_id, a.title, a.due_at, a.max_score,
            (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
       FROM assignments a
      WHERE a.course_id = :courseId
      ORDER BY a.due_at IS NULL, a.due_at, a.id`,
    { courseId },
  );
}

// Returns the new id
export async function create({ courseId, title, instructions, dueAt, maxScore }) {
  const result = await query(
    `INSERT INTO assignments (course_id, title, instructions, due_at, max_score)
     VALUES (:courseId, :title, :instructions, :dueAt, :maxScore)`,
    { courseId, title, instructions, dueAt, maxScore },
  );
  return result.insertId;
}

export function update({ id, title, instructions, dueAt, maxScore }) {
  return query(
    `UPDATE assignments SET title = :title, instructions = :instructions, due_at = :dueAt, max_score = :maxScore
      WHERE id = :id`,
    { id, title, instructions, dueAt, maxScore },
  );
}

// Deletes the assignment and its submissions in one transaction. Their files are not linked by
// the schema, so the controller removes those.
export function remove(id) {
  return transaction(async (connection) => {
    await connection.execute('DELETE FROM submissions WHERE assignment_id = :id', { id });
    await connection.execute('DELETE FROM assignments WHERE id = :id', { id });
  });
}

export async function idsInCourse(courseId) {
  const rows = await query('SELECT id FROM assignments WHERE course_id = :courseId', { courseId });
  return rows.map((row) => row.id);
}
