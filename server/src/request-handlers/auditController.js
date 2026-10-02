// The audit log, read-only: who changed what in accounts, roles, courses and enrollments.
// Entries are written by the handlers that make those changes (Audit.record).
import * as Audit from '../database-queries/auditModel.js';

const TARGET_TYPES = ['user', 'role', 'course'];

function toJson(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    details: row.details,
    createdAt: row.created_at,
  };
}

// ?target=user|role|course narrows the list; ?before=<id> fetches the page older than that entry
export async function listAudit(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const before = Number(req.query.before) > 0 ? Math.floor(Number(req.query.before)) : null;
  const targetType = TARGET_TYPES.includes(req.query.target) ? req.query.target : null;
  const { entries, nextBefore } = await Audit.list({ limit, before, targetType });
  res.json({ entries: entries.map(toJson), nextBefore });
}
