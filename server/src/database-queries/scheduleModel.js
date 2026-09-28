// SQL for weekly class meetings (the schedules table, schema/06_scheduling.sql). Times and dates
// are school clock time, not UTC: "9:00 on Mondays" means 9:00 at the school wherever the server
// runs (see database/README.md).
import { query, queryOne } from '../database/index.js';

// TIME and DATE come back as text ('09:00:00', '2026-06-02') because the pool uses dateStrings
const SELECT_SCHEDULE = `
  SELECT s.id, s.course_id, s.title, s.day_of_week, s.starts_at, s.ends_at, s.location,
         s.effective_from, s.effective_to
    FROM schedules s
`;

export function findById(id) {
  return queryOne(`${SELECT_SCHEDULE} WHERE s.id = :id`, { id });
}

// A course's meetings, in week order (Sunday = 0 first) then by start time
export function listForCourse(courseId) {
  return query(`${SELECT_SCHEDULE} WHERE s.course_id = :courseId ORDER BY s.day_of_week, s.starts_at, s.id`, {
    courseId,
  });
}

// Every meeting of the courses someone teaches or takes (not dropped, and out of draft for a
// student), for their own timetable. An administrator's timetable shows only courses they
// teach or take, not every course they could oversee.
export function listForPerson(userId) {
  return query(
    `SELECT s.id, s.course_id, s.title, s.day_of_week, s.starts_at, s.ends_at, s.location,
            s.effective_from, s.effective_to, c.code AS course_code, c.title AS course_title
       FROM schedules s
       JOIN courses c ON c.id = s.course_id
      WHERE c.instructor_id = :userId
         OR (c.status <> 'draft' AND EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.course_id = c.id AND e.user_id = :userId AND e.status <> 'dropped'))
      ORDER BY s.day_of_week, s.starts_at, s.id`,
    { userId },
  );
}

// Other meetings of the same course that overlap this one: same day, overlapping times, and
// overlapping date ranges (a range with no end runs on for ever)
export function clashesWith({ id = null, courseId, dayOfWeek, startsAt, endsAt, effectiveFrom, effectiveTo }) {
  return query(
    `${SELECT_SCHEDULE}
      WHERE s.course_id = :courseId AND s.day_of_week = :dayOfWeek
        AND (:id IS NULL OR s.id <> :id)
        AND s.starts_at < :endsAt AND :startsAt < s.ends_at
        AND s.effective_from <= COALESCE(:effectiveTo, '9999-12-31')
        AND :effectiveFrom <= COALESCE(s.effective_to, '9999-12-31')`,
    { id, courseId, dayOfWeek, startsAt, endsAt, effectiveFrom, effectiveTo },
  );
}

// Returns the new id
export async function create(meeting) {
  const result = await query(
    `INSERT INTO schedules (course_id, title, day_of_week, starts_at, ends_at, location, effective_from, effective_to)
     VALUES (:courseId, :title, :dayOfWeek, :startsAt, :endsAt, :location, :effectiveFrom, :effectiveTo)`,
    meeting,
  );
  return result.insertId;
}

export function update({ id, title, dayOfWeek, startsAt, endsAt, location, effectiveFrom, effectiveTo }) {
  return query(
    `UPDATE schedules
        SET title = :title, day_of_week = :dayOfWeek, starts_at = :startsAt, ends_at = :endsAt,
            location = :location, effective_from = :effectiveFrom, effective_to = :effectiveTo
      WHERE id = :id`,
    { id, title, dayOfWeek, startsAt, endsAt, location, effectiveFrom, effectiveTo },
  );
}

export function remove(id) {
  return query('DELETE FROM schedules WHERE id = :id', { id });
}
