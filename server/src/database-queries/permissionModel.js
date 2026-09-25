// SQL for permission codes (permissions, role_permissions and user_permissions tables,
// schema/01_identity.sql).
//
// An account's permissions are the codes its role grants, plus per-account "allow" overrides,
// minus per-account "deny" overrides. A deny always wins, which is how one person can be refused
// something their role normally carries.
import { query, transaction } from '../database/index.js';

// The whole catalogue of codes, grouped for display. A few dozen rows, so it is read in one go.
export function listAll() {
  return query('SELECT id, code, category, description FROM permissions ORDER BY category, code');
}

// A Map from code to id, e.g. 'course.create' -> 4. Used to check a list of codes sent in a
// request and translate them to ids in one step.
export async function idsByCode() {
  const rows = await query('SELECT id, code FROM permissions');
  return new Map(rows.map((row) => [row.code, row.id]));
}

// Every code the account holds right now, as a Set. Read on every request rather than stored in
// the session, so taking a permission away takes effect on the person's very next click.
export async function effectiveCodes(userId) {
  const rows = await query(
    `SELECT p.code, 'allow' AS effect
       FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = :userId
     UNION ALL
     SELECT p.code, up.effect
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = :userId`,
    { userId },
  );

  const granted = new Set();
  const denied = new Set();
  for (const row of rows) {
    if (row.effect === 'deny') denied.add(row.code);
    else granted.add(row.code);
  }
  for (const code of denied) granted.delete(code);
  return granted;
}

// The overrides set on one account, with who set each and when
export function listOverrides(userId) {
  return query(
    `SELECT p.code, up.effect, up.granted_at, up.granted_by
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = :userId
      ORDER BY p.code`,
    { userId },
  );
}

// Replaces every override on an account with `overrides` ([{ permissionId, effect }]).
// One transaction, so a failure half way cannot leave the account with only some of them.
export function replaceOverrides(userId, overrides, grantedBy) {
  return transaction(async (connection) => {
    await connection.execute('DELETE FROM user_permissions WHERE user_id = :userId', { userId });
    for (const { permissionId, effect } of overrides) {
      await connection.execute(
        `INSERT INTO user_permissions (user_id, permission_id, effect, granted_by)
         VALUES (:userId, :permissionId, :effect, :grantedBy)`,
        { userId, permissionId, effect, grantedBy },
      );
    }
  });
}
