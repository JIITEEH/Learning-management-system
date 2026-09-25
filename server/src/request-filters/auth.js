// Who is making this request, and may they?
//
// Signing in stores { id, email, fullName, role } in req.session.user, plus the account's
// session version in req.session.version. Nothing else is trusted from the session: the
// account's status and permissions are read from the database on every request, so suspending
// an account or taking away a permission applies on the person's very next click.
import * as User from '../database-queries/userModel.js';
import * as Permission from '../database-queries/permissionModel.js';

const REFUSED_STATUS = {
  pending: 'This account is awaiting approval',
  suspended: 'This account is suspended',
};

// Runs on every request: req.user is the signed-in account, or null
export function currentUser(req, res, next) {
  req.user = req.session?.user ?? null;
  next();
}

// Why this request must be turned away, as { status, error }, or null when it may go on
async function refusalFor(req) {
  if (!req.user) return { status: 401, error: 'Authentication required' };

  const state = await User.findSessionState(req.user.id);
  if (!state) return { status: 401, error: 'Authentication required' }; // account deleted

  // The password changed after this session signed in (on another device, or by a reset link).
  // A session older than session versions carries none, and counts as version 0.
  if ((req.session.version ?? 0) !== state.session_version) {
    req.session.user = null;
    return { status: 401, error: 'Your password was changed. Sign in again.' };
  }

  if (state.status !== 'active') {
    return { status: 403, error: REFUSED_STATUS[state.status] ?? 'This account cannot be used' };
  }
  return null;
}

// Any signed-in, active account may continue
export async function requireAuth(req, res, next) {
  const refusal = await refusalFor(req);
  if (refusal) return res.status(refusal.status).json({ error: refusal.error });
  next();
}

// The account must hold every code listed:
//   router.post('/', requirePermission('course.create'), createCourse);
// Leaves the account's codes on req.permissions, so the controller can check more without
// another query.
export function requirePermission(...codes) {
  return async (req, res, next) => {
    const refusal = await refusalFor(req);
    if (refusal) return res.status(refusal.status).json({ error: refusal.error });

    const held = await Permission.effectiveCodes(req.user.id);
    const missing = codes.filter((code) => !held.has(code));
    if (missing.length > 0) {
      return res.status(403).json({ error: 'Insufficient permissions', missing });
    }
    req.permissions = held;
    next();
  };
}
