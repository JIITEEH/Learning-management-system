// SQL for announcements (the announcements table, schema/07_communication.sql)
import { query, queryOne } from '../database/index.js';

const SELECT_ANNOUNCEMENT = `
  SELECT n.id, n.course_id, n.author_id, n.title, n.body, n.created_at, n.updated_at,
         u.full_name AS author_name
    FROM announcements n
    LEFT JOIN users u ON u.id = n.author_id
`;

export function findById(id) {
  return queryOne(`${SELECT_ANNOUNCEMENT} WHERE n.id = :id`, { id });
}

// A course's announcements, newest first
export function listForCourse(courseId) {
  return query(`${SELECT_ANNOUNCEMENT} WHERE n.course_id = :courseId ORDER BY n.created_at DESC, n.id DESC`, { courseId });
}

// Returns the new id
export async function create({ courseId, authorId, title, body }) {
  const result = await query(
    'INSERT INTO announcements (course_id, author_id, title, body) VALUES (:courseId, :authorId, :title, :body)',
    { courseId, authorId, title, body },
  );
  return result.insertId;
}

export function update({ id, title, body }) {
  return query('UPDATE announcements SET title = :title, body = :body WHERE id = :id', { id, title, body });
}

export function remove(id) {
  return query('DELETE FROM announcements WHERE id = :id', { id });
}
