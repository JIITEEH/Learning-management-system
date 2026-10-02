// A person's own notifications: the list behind the bell, and marking them read. Every handler
// works only on the signed-in account's own rows, so no permission code is needed beyond signing in.
import * as Notification from '../database-queries/notificationModel.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';

function toJson(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
    actorName: row.actor_name,
  };
}

export async function listNotifications(req, res) {
  const [rows, unread] = await Promise.all([
    Notification.listForUser(req.user.id),
    Notification.unreadCount(req.user.id),
  ]);
  res.json({ notifications: rows.map(toJson), unread });
}

export async function markNotificationRead(req, res) {
  const id = parseId(req.params.id, 'Notification not found');
  if (!(await Notification.markRead(req.user.id, id))) throw new HttpError(404, 'Notification not found');
  res.json({ unread: await Notification.unreadCount(req.user.id) });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.markAllRead(req.user.id);
  res.json({ unread: 0 });
}
