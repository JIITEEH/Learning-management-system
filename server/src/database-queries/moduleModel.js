// SQL for modules (the modules table, schema/02_catalog.sql): the chapters of a course, in order.
// `position` sets the order, so modules can be rearranged without changing their ids.
import { query, queryOne, transaction } from '../database/index.js';

export function findById(id) {
  return queryOne('SELECT id, course_id, title, position FROM modules WHERE id = :id', { id });
}

export function listForCourse(courseId) {
  return query('SELECT id, course_id, title, position FROM modules WHERE course_id = :courseId ORDER BY position, id', {
    courseId,
  });
}

// Adds a module at the end of the course. Returns the new id.
export async function create({ courseId, title }) {
  const result = await query(
    `INSERT INTO modules (course_id, title, position)
     SELECT :courseId, :title, COALESCE(MAX(position), 0) + 1 FROM modules WHERE course_id = :courseId`,
    { courseId, title },
  );
  return result.insertId;
}

export function rename(id, title) {
  return query('UPDATE modules SET title = :title WHERE id = :id', { id, title });
}

// Swaps a module with its neighbour above ('up') or below ('down'). Does nothing at either end.
// One transaction, so two modules can never end up sharing a position half way through.
export function move(id, direction) {
  return transaction(async (connection) => {
    const [[current]] = await connection.execute('SELECT course_id, position FROM modules WHERE id = :id FOR UPDATE', { id });
    const [[neighbour]] = await connection.execute(
      direction === 'up'
        ? 'SELECT id, position FROM modules WHERE course_id = :courseId AND position < :position ORDER BY position DESC LIMIT 1'
        : 'SELECT id, position FROM modules WHERE course_id = :courseId AND position > :position ORDER BY position LIMIT 1',
      { courseId: current.course_id, position: current.position },
    );
    if (!neighbour) return;
    await connection.execute('UPDATE modules SET position = :position WHERE id = :id', { id, position: neighbour.position });
    await connection.execute('UPDATE modules SET position = :position WHERE id = :id', {
      id: neighbour.id,
      position: current.position,
    });
  });
}

// Also deletes its lessons and their progress (ON DELETE CASCADE in the schema). Their uploaded
// files are not linked by the schema, so the controller removes those first.
export function remove(id) {
  return query('DELETE FROM modules WHERE id = :id', { id });
}
