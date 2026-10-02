// SQL for deadline reminders (the deadline_reminders table, schema/07_communication.sql): who is
// owed one right now, and recording each one sent so it is never sent twice.
import { query } from '../database/index.js';

// A student is reminded this many hours before an assignment is due or a quiz closes
export const DUE_SOON_HOURS = 24;

// An overdue assignment is reminded about only this soon after it passed. A job switched off for
// weeks, or its first run, then does not remind people about long-missed work. Quizzes get no
// overdue reminder: once closed, a quiz cannot be taken.
export const OVERDUE_WINDOW_DAYS = 7;

// The students owed a reminder at `now` (UTC 'YYYY-MM-DD HH:MM:SS'): taking an open course
// (active, not dropped or completed), with an active account, and
//   - an assignment due within DUE_SOON_HOURS, or overdue within OVERDUE_WINDOW_DAYS, that they
//     have not handed in
//   - a published quiz closing within DUE_SOON_HOURS that they have not taken
// and not already reminded of that kind for that due date. One row per student per item.
export function owed(now) {
  const people = `
    JOIN courses c ON c.id = x.course_id AND c.status = 'published'
    JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
    JOIN users u ON u.id = e.user_id AND u.status = 'active'`;
  const notReminded = (type, kind) => `
    NOT EXISTS (SELECT 1 FROM deadline_reminders r
                 WHERE r.user_id = u.id AND r.item_type = '${type}' AND r.item_id = x.id
                   AND r.due_at = x.due_at AND r.kind = ${kind})`;
  const assignmentKind = "CASE WHEN x.due_at < :now THEN 'overdue' ELSE 'due_soon' END";

  return query(
    `SELECT 'assignment' AS item_type, x.id AS item_id, x.title, x.due_at, ${assignmentKind} AS kind,
            c.id AS course_id, c.code AS course_code, c.title AS course_title, u.id AS user_id, u.full_name, u.email
       FROM assignments x ${people}
      WHERE x.due_at >= :now - INTERVAL ${OVERDUE_WINDOW_DAYS} DAY
        AND x.due_at <= :now + INTERVAL ${DUE_SOON_HOURS} HOUR
        AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = x.id AND s.user_id = u.id)
        AND ${notReminded('assignment', assignmentKind)}
     UNION ALL
     SELECT 'quiz', x.id, x.title, x.due_at, 'due_soon',
            c.id, c.code, c.title, u.id, u.full_name, u.email
       FROM quizzes x ${people}
      WHERE x.is_published = 1
        AND x.due_at > :now
        AND x.due_at <= :now + INTERVAL ${DUE_SOON_HOURS} HOUR
        AND NOT EXISTS (SELECT 1 FROM quiz_attempts t
                         WHERE t.quiz_id = x.id AND t.user_id = u.id AND t.submitted_at IS NOT NULL)
        AND ${notReminded('quiz', "'due_soon'")}
      ORDER BY due_at, item_type, item_id, user_id`,
    { now },
  );
}

// Claims a reminder before it is sent. Returns false if it was already recorded (another run at
// the same moment, say), so the caller skips it.
export async function record({ userId, itemType, itemId, dueAt, kind }) {
  const result = await query(
    `INSERT IGNORE INTO deadline_reminders (user_id, item_type, item_id, due_at, kind)
     VALUES (:userId, :itemType, :itemId, :dueAt, :kind)`,
    { userId, itemType, itemId, dueAt, kind },
  );
  return result.affectedRows > 0;
}
