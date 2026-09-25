// SQL for lessons (the lessons table, schema/02_catalog.sql). A lesson belongs to a module, which
// belongs to a course; `position` orders lessons within their module.
import { query, queryOne, transaction } from '../database/index.js';

// One lesson, with the ids needed to check who may reach it
export function findById(id) {
  return queryOne(
    `SELECT l.id, l.module_id, l.title, l.content, l.position, l.updated_at,
            m.course_id, m.title AS module_title
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE l.id = :id`,
    { id },
  );
}

// Every lesson in a course, in reading order (by module, then by lesson). Titles only: this feeds
// the outline and the previous / next buttons, which do not need the text.
export function listForCourse(courseId) {
  return query(
    `SELECT l.id, l.module_id, l.title, l.position
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
      WHERE m.course_id = :courseId
      ORDER BY m.position, m.id, l.position, l.id`,
    { courseId },
  );
}

export async function idsInModule(moduleId) {
  const rows = await query('SELECT id FROM lessons WHERE module_id = :moduleId', { moduleId });
  return rows.map((row) => row.id);
}

export async function idsInCourse(courseId) {
  const rows = await query(
    'SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = :courseId',
    { courseId },
  );
  return rows.map((row) => row.id);
}

// Adds a lesson at the end of its module. Returns the new id.
export async function create({ moduleId, title, content }) {
  const result = await query(
    `INSERT INTO lessons (module_id, title, content, position)
     SELECT :moduleId, :title, :content, COALESCE(MAX(position), 0) + 1 FROM lessons WHERE module_id = :moduleId`,
    { moduleId, title, content },
  );
  return result.insertId;
}

export function update({ id, title, content }) {
  return query('UPDATE lessons SET title = :title, content = :content WHERE id = :id', { id, title, content });
}

// Swaps a lesson with its neighbour above ('up') or below ('down') in the same module
export function move(id, direction) {
  return transaction(async (connection) => {
    const [[current]] = await connection.execute('SELECT module_id, position FROM lessons WHERE id = :id FOR UPDATE', { id });
    const [[neighbour]] = await connection.execute(
      direction === 'up'
        ? 'SELECT id, position FROM lessons WHERE module_id = :moduleId AND position < :position ORDER BY position DESC LIMIT 1'
        : 'SELECT id, position FROM lessons WHERE module_id = :moduleId AND position > :position ORDER BY position LIMIT 1',
      { moduleId: current.module_id, position: current.position },
    );
    if (!neighbour) return;
    await connection.execute('UPDATE lessons SET position = :position WHERE id = :id', { id, position: neighbour.position });
    await connection.execute('UPDATE lessons SET position = :position WHERE id = :id', {
      id: neighbour.id,
      position: current.position,
    });
  });
}

// Also deletes its progress records (ON DELETE CASCADE). The controller removes its files first.
export function remove(id) {
  return query('DELETE FROM lessons WHERE id = :id', { id });
}
