// SQL for the audit log (the audit_log table, schema/08_audit.sql). Entries are only ever added
// and read: there is no function to change or remove one.
import { query } from '../database/index.js';

// Adds one entry. `actor` is the signed-in user from the session ({ id, fullName }); their name is
// copied in, so the entry still says who it was after their account is gone.
export async function record({ actor, action, targetType, targetId = null, targetLabel = '', details = '' }) {
  await query(
    `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
     VALUES (:actorId, :actorName, :action, :targetType, :targetId, :targetLabel, :details)`,
    {
      actorId: actor?.id ?? null,
      actorName: actor?.fullName ?? 'System',
      action,
      targetType,
      targetId,
      targetLabel: targetLabel.slice(0, 255),
      details: details.slice(0, 1000),
    },
  );
}

// Newest first. Pass the id of the oldest entry already shown as `before` to get the next page.
// Returns { entries, nextBefore }, where nextBefore is null when there is nothing older.
export async function list({ limit = 50, before = null, targetType = null } = {}) {
  // One extra row says whether an older page exists, without a second COUNT query
  const rows = await query(
    `SELECT id, actor_id, actor_name, action, target_type, target_id, target_label, details, created_at
       FROM audit_log
      WHERE (:before IS NULL OR id < :before)
        AND (:targetType IS NULL OR target_type = :targetType)
      ORDER BY id DESC
      LIMIT :limit`,
    { before, targetType, limit: String(limit + 1) },
  );
  const entries = rows.slice(0, limit);
  return { entries, nextBefore: rows.length > limit ? entries.at(-1).id : null };
}
