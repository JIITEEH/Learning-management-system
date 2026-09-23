// Permissions — database access.
//
// Schema: database/schema/01_identity.sql (permissions, role_permissions,
// user_permissions). Used by routes/permissions.js and middleware/auth.js.

import { query } from "../pool.js";

/**
 * The whole catalogue of permission codes, ordered for display. Small enough
 * to read in one go — there are a few dozen rows and they change only when
 * seed/02_permissions.sql does.
 */
export function listAll() {
  return query(
    `SELECT id, code, category, description
       FROM permissions
      ORDER BY category, code`,
  );
}

/**
 * A Map of code -> id for the whole catalogue.
 *
 * Callers that accept a list of codes from a request use this to translate
 * and validate in one step, which is why the catalogue is read whole rather
 * than expanding a caller's list into an IN clause.
 */
export async function idsByCode() {
  const rows = await query("SELECT id, code FROM permissions");
  return new Map(rows.map((row) => [row.code, row.id]));
}

/**
 * Every permission code in force for one account: those granted by its role,
 * plus per-account allows, minus per-account denies.
 *
 * A deny always wins, which is what lets one person be refused something
 * their role otherwise carries. The rule lives here with the query it depends
 * on — the UNION below is only meaningful together with the reduction.
 *
 * Read on every request rather than cached in the session, so that revoking a
 * permission takes effect immediately.
 */
export async function effectiveCodesFor(userId) {
  const rows = await query(
    `SELECT p.code, 'role' AS source
       FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p ON p.id = rp.permission_id
      WHERE u.id = :userId
      UNION ALL
     SELECT p.code, up.effect AS source
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = :userId`,
    { userId },
  );

  const denied = new Set(rows.filter((r) => r.source === "deny").map((r) => r.code));
  const granted = new Set(rows.filter((r) => r.source !== "deny").map((r) => r.code));

  for (const code of denied) granted.delete(code);
  return granted;
}
