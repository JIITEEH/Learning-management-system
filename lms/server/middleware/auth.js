// Session-based access control.
//
// Login puts { id, email, fullName, role } on req.session.user. Permissions
// are not stored in the session — they are read per request so that revoking
// a permission takes effect immediately rather than at next sign-in.
//
// The query behind that, and the rule that a deny beats an allow, live in
// db/repositories/permissions.repo.js. This file is the gate; that one is the
// lookup.

import { effectiveCodesFor } from "../db/repositories/permissions.repo.js";

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
      const held = await effectiveCodesFor(req.user.id);
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
