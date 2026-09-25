// SQL for uploaded files (the files table, schema/05_files.sql). Only details live here; the file
// itself is on disk in server/uploads under `stored_name`. `owner_type` and `owner_id` say what a
// file is attached to: ('lesson', 12) or ('submission', 40). They are not a database link, so
// deleting a lesson or submission does not delete its files: the controller must remove them
// (see helpers/files.js).
import { query, queryOne } from '../database/index.js';

const SELECT_FILE = `
  SELECT id, owner_type, owner_id, original_name, stored_name, mime_type, size_bytes, uploaded_at
    FROM files
`;

export function findById(id) {
  return queryOne(`${SELECT_FILE} WHERE id = :id`, { id });
}

// The files attached to one thing, oldest first: listFor('lesson', 12)
export function listFor(ownerType, ownerId) {
  return query(`${SELECT_FILE} WHERE owner_type = :ownerType AND owner_id = :ownerId ORDER BY uploaded_at, id`, {
    ownerType,
    ownerId,
  });
}

// The files attached to any of several things of one type: listForAll('lesson', [3, 4, 7]).
// The ids come from our own queries, and each is still passed as a placeholder, never pasted
// into the SQL.
export function listForAll(ownerType, ownerIds) {
  if (ownerIds.length === 0) return Promise.resolve([]);
  const placeholders = ownerIds.map((id, index) => `:id${index}`).join(', ');
  const params = Object.fromEntries(ownerIds.map((id, index) => [`id${index}`, id]));
  return query(`${SELECT_FILE} WHERE owner_type = :ownerType AND owner_id IN (${placeholders})`, { ownerType, ...params });
}

// For the Files page: every lesson file this account may see. That is every lesson file for an
// account that oversees all courses; otherwise the files in courses it teaches, plus those in
// courses it takes once they are out of draft (the same rule as permission-rules/access.js).
export function listLessonFilesVisibleTo(userId, { seesAll }) {
  return query(
    `SELECT f.id, f.original_name, f.size_bytes, f.uploaded_at,
            c.id AS course_id, c.code AS course_code, l.id AS lesson_id, l.title AS lesson_title
       FROM files f
       JOIN lessons l ON f.owner_type = 'lesson' AND l.id = f.owner_id
       JOIN modules m ON m.id = l.module_id
       JOIN courses c ON c.id = m.course_id
      WHERE :seesAll
         OR c.instructor_id = :userId
         OR (c.status <> 'draft' AND EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped'))
      ORDER BY f.uploaded_at DESC, f.id DESC`,
    { userId, seesAll: seesAll ? 1 : 0 },
  );
}

// For the Files page: every submission file this account may see. Its own always; also its
// students' when it teaches the course and holds submission.read; all of them when it oversees
// every course and holds submission.read.
export function listSubmissionFilesVisibleTo(userId, { seesAll, readsOthers }) {
  return query(
    `SELECT f.id, f.original_name, f.size_bytes, f.uploaded_at,
            c.id AS course_id, c.code AS course_code, a.id AS assignment_id, a.title AS assignment_title,
            u.full_name AS student_name
       FROM files f
       JOIN submissions s ON f.owner_type = 'submission' AND s.id = f.owner_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN courses c ON c.id = a.course_id
       JOIN users u ON u.id = s.user_id
      WHERE s.user_id = :userId
         OR (:readsOthers AND (:seesAll OR c.instructor_id = :userId))
      ORDER BY f.uploaded_at DESC, f.id DESC`,
    { userId, seesAll: seesAll ? 1 : 0, readsOthers: readsOthers ? 1 : 0 },
  );
}

// Records an uploaded file. Returns the new id.
export async function create({ uploadedBy, ownerType, ownerId, originalName, storedName, mimeType, sizeBytes }) {
  const result = await query(
    `INSERT INTO files (uploaded_by, owner_type, owner_id, original_name, stored_name, mime_type, size_bytes)
     VALUES (:uploadedBy, :ownerType, :ownerId, :originalName, :storedName, :mimeType, :sizeBytes)`,
    { uploadedBy, ownerType, ownerId, originalName, storedName, mimeType, sizeBytes },
  );
  return result.insertId;
}

export function remove(id) {
  return query('DELETE FROM files WHERE id = :id', { id });
}
