// Session-based access control.
//
// Login puts { id, email, fullName, role } on req.session.user. Permissions
// are not stored in the session — they are read per request so that revoking
// a permission takes effect immediately rather than at next sign-in.

import { query } from "../db/pool.js";

/**
 * Every permission code in force for a user: those granted by their role,
 * plus per-account allows, minus per-account denies. A deny always wins.
 */
export async function permissionsFor(userId) {
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

/** Attaches req.user for every request. Null when signed out. */
export function currentUser(req, _res, next) {
  req.user = req.session?.user ?? null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.status === "suspended") {
    return res.status(403).json({ error: "Account suspended" });
  }
  next();
}

/**
 * Gate a route on a permission code:
 *   router.post("/", requirePermission("course.create"), handler)
 */
export function requirePermission(...codes) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const held = await permissionsFor(req.user.id);
      const missing = codes.filter((code) => !held.has(code));
      if (missing.length > 0) {
        return res.status(403).json({ error: "Insufficient permissions", missing });
      }
      req.permissions = held;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Coarser check, for the few places a role itself is the rule. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
