// Session-based access control.
//
// Login puts { id, email, fullName, role } on req.session.user, and the
// account's session version on req.session.version. Neither the account's
// status nor its permissions are trusted from the session — both are read per
// request, so that suspending an account or revoking a permission takes
// effect immediately rather than at next sign-in. The version is compared on
// every request too, which is how a password change signs out every other
// device.
//
// The queries behind that, and the rule that a deny beats an allow, live in
// db/repositories/. This file is the gate; those are the lookups.

import { effectiveCodesFor } from "../db/repositories/permissions.repo.js";
import { sessionStateOf } from "../db/repositories/users.repo.js";

const REFUSED = {
  pending: "This account is awaiting approval",
  suspended: "This account is suspended",
};

/** Attaches req.user for every request. Null when signed out. */
export function currentUser(req, _res, next) {
  req.user = req.session?.user ?? null;
  next();
}

/**
 * Why this request must be turned away, or null when it may go on.
 *
 * The status comes from the database, not the session: the session holds
 * the status as it was at sign-in, so an account suspended since then would
 * otherwise carry on as if nothing had happened. An account deleted since
 * sign-in is treated as signed out.
 *
 * A session signed in before the account's password last changed is signed
 * out here: its version is behind the account's. A session from before
 * versions existed carries none, and counts as version 0.
 */
async function refusal(req) {
  if (!req.user) return { status: 401, error: "Authentication required" };

  const state = await sessionStateOf(req.user.id);
  if (state === null) return { status: 401, error: "Authentication required" };

  if ((req.session.version ?? 0) !== state.session_version) {
    req.session.user = null;
    req.user = null;
    return { status: 401, error: "Your password was changed. Sign in again." };
  }

  if (state.status !== "active") {
    return { status: 403, error: REFUSED[state.status] ?? "This account cannot be used" };
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const refused = await refusal(req);
    if (refused) return res.status(refused.status).json({ error: refused.error });
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Gate a route on a permission code:
 *   router.post("/", requirePermission("course.create"), handler)
 */
export function requirePermission(...codes) {
  return async (req, res, next) => {
    try {
      const refused = await refusal(req);
      if (refused) return res.status(refused.status).json({ error: refused.error });

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
  return async (req, res, next) => {
    try {
      const refused = await refusal(req);
      if (refused) return res.status(refused.status).json({ error: refused.error });

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
