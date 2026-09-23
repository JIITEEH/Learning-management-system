// Enrollments — database access.
//
// Schema: database/schema/03_enrollment.sql (enrollments).
// Used by routes/enrollments.js and routes/courses.js.

import { query, queryOne } from "../pool.js";

const SELECT_ENROLLMENT = `
  SELECT e.id, e.user_id, e.course_id, e.status, e.enrolled_at, e.completed_at,
         u.full_name, u.email
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
`;

export function findById(id) {
  return queryOne(`${SELECT_ENROLLMENT} WHERE e.id = :id`, { id });
}

/** One account's enrollment in one course, whatever its status, or null. */
export function findFor(courseId, userId) {
  return queryOne(`${SELECT_ENROLLMENT} WHERE e.course_id = :courseId AND e.user_id = :userId`, {
    courseId,
    userId,
  });
}

/** Everyone enrolled in a course, dropped included, by name. */
export function listForCourse(courseId) {
  return query(`${SELECT_ENROLLMENT} WHERE e.course_id = :courseId ORDER BY u.full_name`, {
    courseId,
  });
}

/**
 * Enroll an account, or bring back one who had dropped. The table allows one
 * row per person per course, so a returning student reuses their old row
 * rather than failing on the duplicate. Returns the enrollment id.
 */
export async function enroll(courseId, userId) {
  const result = await query(
    `INSERT INTO enrollments (user_id, course_id) VALUES (:userId, :courseId)
     ON DUPLICATE KEY UPDATE status = 'active', completed_at = NULL,
                             id = LAST_INSERT_ID(id)`,
    { courseId, userId },
  );
  return result.insertId;
}

/** A completed enrollment records when; any other status clears it. */
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
  return query("DELETE FROM enrollments WHERE id = :id", { id });
}
