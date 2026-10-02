// SQL for notifications (the notifications table, schema/07_communication.sql): one row per
// recipient, so each person reads and dismisses their own copy.
import { query, queryOne } from '../database/index.js';

// The students taking a course now (active, not dropped or completed): who a course-wide
// notification goes to
export async function courseStudentIds(courseId) {
  const rows = await query(
    "SELECT user_id FROM enrollments WHERE course_id = :courseId AND status = 'active'",
    { courseId },
  );
  return rows.map((row) => row.user_id);
}

// Sends one notification to each recipient, skipping the person who caused it: nobody needs to be
// told about their own action. One INSERT for the whole list, however large the class.
// Returns how many were sent.
export async function notify({ recipients, actorId = null, type, title, body = '', link = '' }) {
  const ids = [...new Set(recipients.filter(Boolean))].filter((id) => id !== actorId);
  if (ids.length === 0) return 0;
  // (:user0, …), (:user1, …): each recipient gets its own placeholder; the rest are shared
  const rows = ids.map((_, index) => `(:user${index}, :actorId, :type, :title, :body, :link)`).join(', ');
  const values = { actorId, type, title, body, link };
  ids.forEach((id, index) => {
    values[`user${index}`] = id;
  });
  await query(`INSERT INTO notifications (user_id, actor_id, type, title, body, link) VALUES ${rows}`, values);
  return ids.length;
}

// Someone's latest notifications, newest first, with the name of whoever caused each
export function listForUser(userId, limit = 20) {
  return query(
    `SELECT n.id, n.type, n.title, n.body, n.link, n.read_at, n.created_at, a.full_name AS actor_name
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
      WHERE n.user_id = :userId
      ORDER BY n.id DESC
      LIMIT :limit`,
    { userId, limit: String(limit) },
  );
}

export async function unreadCount(userId) {
  const row = await queryOne('SELECT COUNT(*) AS n FROM notifications WHERE user_id = :userId AND read_at IS NULL', {
    userId,
  });
  return Number(row.n);
}

// Scoped to the owner, so nobody can mark someone else's notification as read.
// Returns whether the notification exists and belongs to them.
export async function markRead(userId, id) {
  await query(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = :id AND user_id = :userId AND read_at IS NULL',
    { id, userId },
  );
  return Boolean(await queryOne('SELECT 1 FROM notifications WHERE id = :id AND user_id = :userId', { id, userId }));
}

export function markAllRead(userId) {
  return query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = :userId AND read_at IS NULL', {
    userId,
  });
}
