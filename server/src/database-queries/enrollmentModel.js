// SQL for enrollments (the enrollments table, schema/03_enrollment.sql): who takes which course.
import { query, queryOne } from '../database/index.js';

const SELECT_ENROLLMENT = `
  SELECT e.id, e.user_id, e.course_id, e.status, e.enrolled_at, e.completed_at,
         u.full_name, u.email
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
`;

export function findById(id) {
  return queryOne(`${SELECT_ENROLLMENT} WHERE e.id = :id`, { id });
}

// One account's enrollment in one course, whatever its status, or null
export function findFor(courseId, userId) {
  return queryOne(`${SELECT_ENROLLMENT} WHERE e.course_id = :courseId AND e.user_id = :userId`, {
    courseId,
    userId,
  });
}

// Everyone in a course, dropped included, sorted by name
export function listForCourse(courseId) {
  return query(`${SELECT_ENROLLMENT} WHERE e.course_id = :courseId ORDER BY u.full_name`, { courseId });
}

// Enrolls an account, or reactivates its old row: the table allows one row per person per
// course. LAST_INSERT_ID(id) makes insertId return the existing row's id in that case.
export async function enroll(courseId, userId) {
  const result = await query(
    `INSERT INTO enrollments (user_id, course_id) VALUES (:userId, :courseId)
     ON DUPLICATE KEY UPDATE status = 'active', completed_at = NULL, id = LAST_INSERT_ID(id)`,
    { courseId, userId },
  );
  return result.insertId;
}

// 'completed' records when; any other status clears that date
export function updateStatus(id, status) {
  return query(
    `UPDATE enrollments
        SET status = :status,
            completed_at = IF(:status = 'completed', CURRENT_TIMESTAMP, NULL)
      WHERE id = :id`,
    { id, status },
  );
}

export function remove(id) {
  return query('DELETE FROM enrollments WHERE id = :id', { id });
}
