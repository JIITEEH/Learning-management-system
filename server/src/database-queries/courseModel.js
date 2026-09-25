// SQL for courses (the courses table, schema/02_catalog.sql).
import { query, queryOne } from '../database/index.js';

// The columns every course listing uses, plus the instructor's name and the number of active
// students, so a course card can be drawn from one row without further queries.
const SELECT_COURSE = `
  SELECT c.id, c.code, c.join_code, c.title, c.description, c.status,
         c.instructor_id, c.created_at, c.updated_at,
         u.full_name AS instructor_name,
         (SELECT COUNT(*) FROM enrollments e
           WHERE e.course_id = c.id AND e.status = 'active') AS student_count
    FROM courses c
    LEFT JOIN users u ON u.id = c.instructor_id
`;

export function findById(id) {
  return queryOne(`${SELECT_COURSE} WHERE c.id = :id`, { id });
}

export function findByJoinCode(joinCode) {
  return queryOne(`${SELECT_COURSE} WHERE c.join_code = :joinCode`, { joinCode });
}

// Every course, newest first (for an administrator)
export function listAll() {
  return query(`${SELECT_COURSE} ORDER BY c.created_at DESC, c.id DESC`);
}

// The courses one account teaches or takes. A student only sees a course once it leaves draft,
// and not at all once dropped from it.
export function listForUser(userId) {
  return query(
    `${SELECT_COURSE}
      WHERE c.instructor_id = :userId
         OR (c.status <> 'draft' AND EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped'))
      ORDER BY c.created_at DESC, c.id DESC`,
    { userId },
  );
}

// How an account is connected to a course: 'teaching', 'enrolled' (not dropped), or null
export async function relationOf(courseId, userId) {
  const row = await queryOne(
    `SELECT c.instructor_id = :userId AS teaching,
            EXISTS (SELECT 1 FROM enrollments e
                     WHERE e.course_id = c.id AND e.user_id = :userId
                       AND e.status <> 'dropped') AS enrolled
       FROM courses c
      WHERE c.id = :courseId`,
    { courseId, userId },
  );
  if (row?.teaching) return 'teaching';
  if (row?.enrolled) return 'enrolled';
  return null;
}

export async function codeTaken(code, exceptId = null) {
  const row = await queryOne(
    'SELECT 1 FROM courses WHERE code = :code AND (:exceptId IS NULL OR id <> :exceptId)',
    { code, exceptId },
  );
  return row !== null;
}

// Returns the new course's id
export async function create({ code, joinCode, title, description, instructorId }) {
  const result = await query(
    `INSERT INTO courses (code, join_code, title, description, instructor_id)
     VALUES (:code, :joinCode, :title, :description, :instructorId)`,
    { code, joinCode, title, description, instructorId },
  );
  return result.insertId;
}

export function updateDetails({ id, code, title, description }) {
  return query(
    'UPDATE courses SET code = :code, title = :title, description = :description WHERE id = :id',
    { id, code, title, description },
  );
}

export function updateStatus(id, status) {
  return query('UPDATE courses SET status = :status WHERE id = :id', { id, status });
}

export function updateJoinCode(id, joinCode) {
  return query('UPDATE courses SET join_code = :joinCode WHERE id = :id', { id, joinCode });
}

// Also deletes its modules, lessons and enrollments (ON DELETE CASCADE in the schema)
export function remove(id) {
  return query('DELETE FROM courses WHERE id = :id', { id });
}
