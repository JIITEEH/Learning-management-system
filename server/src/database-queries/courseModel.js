// SQL for courses (the courses table, schema/02_catalog.sql).
import { query, queryOne, transaction } from '../database/index.js';

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

// Deletes the course and everything in it, from the bottom up: progress, lessons, modules,
// submissions, assignments, then the course (which takes its enrollments and schedules with it).
// One transaction, so it happens completely or not at all. Uploaded files are not linked by the
// schema, so the controller removes those.
//
// The schema's ON DELETE CASCADE should do this alone, but MySQL 26.7.0 does not follow a cascade
// two levels down reliably: deleting a course removed the lessons of its first module and left
// the lessons of every later module behind. So nothing here relies on a cascade deeper than one
// level. See database/README.md.
export function remove(id) {
  return transaction(async (connection) => {
    const inCourse = 'JOIN modules m ON m.id = l.module_id WHERE m.course_id = :id';
    await connection.execute(`DELETE p FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id ${inCourse}`, { id });
    await connection.execute(`DELETE l FROM lessons l ${inCourse}`, { id });
    await connection.execute('DELETE FROM modules WHERE course_id = :id', { id });
    await connection.execute(
      'DELETE s FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = :id',
      { id },
    );
    await connection.execute('DELETE FROM assignments WHERE course_id = :id', { id });
    await connection.execute('DELETE FROM courses WHERE id = :id', { id });
  });
}
