// SQL for uploaded files (the files table, schema/05_files.sql). Only details live here; the file
// itself is on disk in server/uploads under `stored_name`. `owner_type` and `owner_id` say what a
// file is attached to (for now always a lesson). They are not a database link, so deleting a lesson
// does not delete its files: the controller must remove them (see helpers/files.js).
import { query, queryOne } from '../database/index.js';

const SELECT_FILE = `
  SELECT id, owner_type, owner_id, original_name, stored_name, mime_type, size_bytes, uploaded_at
    FROM files
`;

export function findById(id) {
  return queryOne(`${SELECT_FILE} WHERE id = :id`, { id });
}

export function listForLesson(lessonId) {
  return query(`${SELECT_FILE} WHERE owner_type = 'lesson' AND owner_id = :lessonId ORDER BY uploaded_at, id`, {
    lessonId,
  });
}

// Every file attached to any of these lessons. `lessonIds` comes from our own queries, and each
// id is still passed as a placeholder, never pasted into the SQL.
export function listForLessons(lessonIds) {
  if (lessonIds.length === 0) return Promise.resolve([]);
  const placeholders = lessonIds.map((id, index) => `:id${index}`).join(', ');
  const params = Object.fromEntries(lessonIds.map((id, index) => [`id${index}`, id]));
  return query(`${SELECT_FILE} WHERE owner_type = 'lesson' AND owner_id IN (${placeholders})`, params);
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
