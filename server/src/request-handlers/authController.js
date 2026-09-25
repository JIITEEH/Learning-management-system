// Registering, signing in and out, and passwords.
import { createHash, randomBytes } from 'node:crypto';
import config from '../config/index.js';
import * as User from '../database-queries/userModel.js';
import * as Role from '../database-queries/roleModel.js';
import * as Permission from '../database-queries/permissionModel.js';
import * as PasswordReset from '../database-queries/passwordResetModel.js';
import { passwordResetMessage, sendInBackground } from '../helpers/email.js';
import { HttpError } from '../helpers/httpError.js';
import { hashPassword, verifyPassword } from '../helpers/password.js';
import { requireEmail, requirePassword, requireText } from '../helpers/validate.js';
import { minutesBlocked, recordFailure, recordSuccess } from '../request-filters/loginLimit.js';

// How long a reset link works, and how soon one account may be sent another
const RESET_MINUTES = 30;
const RESET_COOLDOWN_SECONDS = 60;

// Only this hash of a reset link's secret is stored
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// What is kept in the session, and what the client gets back about the signed-in account
function sessionUser(row) {
  return { id: row.id, email: row.email, fullName: row.full_name, role: row.role, status: row.status };
}

// The account plus the permission codes it holds right now, sorted, for the client to show or
// hide controls. The server checks the same codes again on every request.
async function accountResponse(account) {
  const codes = await Permission.effectiveCodes(account.id);
  return { user: sessionUser(account), permissions: [...codes].sort() };
}

// Self-registration. The role is never taken from the request: a new account is always a student
// awaiting an administrator's approval. The one exception is the very first account on an empty
// system, which becomes an active administrator, or nobody could ever approve anyone.
export async function register(req, res) {
  const email = requireEmail(req.body?.email);
  const fullName = requireText(req.body?.fullName, 'Full name', { max: 160 });
  const password = requirePassword(req.body?.password);

  if (await User.emailTaken(email)) throw new HttpError(409, 'That email address is already registered');

  const isFirstAccount = (await User.count()) === 0;
  const role = await Role.findByName(isFirstAccount ? 'admin' : 'student');
  if (!role) throw new HttpError(500, 'Roles are missing. Has `npm run db:setup` been run?');

  const id = await User.create({
    email,
    passwordHash: await hashPassword(password),
    fullName,
    roleId: role.id,
    status: isFirstAccount ? 'active' : 'pending',
  });
  res.status(201).json({ user: sessionUser(await User.findById(id)) });
}

export async function login(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const waitMinutes = minutesBlocked(req.ip, email);
  if (waitMinutes > 0) {
    res.set('Retry-After', String(waitMinutes * 60));
    throw new HttpError(429, `Too many sign-in attempts. Try again in ${waitMinutes} minute(s).`);
  }

  // The same message, and the same delay, for an unknown email and a wrong password, so the
  // answer never reveals which emails have accounts
  const account = await User.findByEmailWithPassword(email);
  if (!(await verifyPassword(password, account?.password_hash))) {
    recordFailure(req.ip, email);
    throw new HttpError(401, 'Email or password is incorrect');
  }
  recordSuccess(req.ip, email);

  if (account.status === 'pending') throw new HttpError(403, 'This account is awaiting approval');
  if (account.status === 'suspended') throw new HttpError(403, 'This account is suspended');

  // A new session id at sign-in, so a session id planted in the browser before sign-in
  // (session fixation) is worthless afterwards
  await new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));

  req.session.user = sessionUser(account);
  req.session.version = account.session_version;
  await User.recordSignIn(account.id);
  res.json(await accountResponse(account));
}

export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('lms.sid');
    res.status(204).end();
  });
}

// The signed-in account, read fresh from the database so a renamed or re-roled account never
// shows stale details
export async function me(req, res) {
  const account = await User.findById(req.user.id);
  if (!account) throw new HttpError(401, 'Authentication required');
  req.session.user = sessionUser(account);
  res.json(await accountResponse(account));
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = requirePassword(req.body?.newPassword, 'New password');

  const credentials = await User.findByIdWithPassword(req.user.id);
  if (!(await verifyPassword(currentPassword, credentials?.password_hash))) {
    throw new HttpError(403, 'Current password is incorrect');
  }

  // Moving the session version on signs out every other device; this one stays signed in by
  // taking the new version into its own session
  req.session.version = await User.updatePassword(req.user.id, await hashPassword(newPassword));
  res.status(204).end();
}

// Emails a reset link. The answer is the same whether or not the email has an account, and the
// email is sent in the background, so neither the reply nor its timing reveals who is registered.
// Only active accounts get a link: a pending or suspended one could not sign in anyway.
export async function forgotPassword(req, res) {
  const email = requireEmail(req.body?.email);
  const account = await User.findByEmail(email);

  if (account?.status === 'active' && !(await PasswordReset.sentWithin(account.id, RESET_COOLDOWN_SECONDS))) {
    const token = randomBytes(32).toString('base64url');
    await PasswordReset.create({ userId: account.id, tokenHash: hashToken(token), minutes: RESET_MINUTES });
    sendInBackground(
      passwordResetMessage({
        to: account.email,
        fullName: account.full_name,
        url: `${config.appUrl}/reset-password#token=${token}`,
        minutes: RESET_MINUTES,
      }),
    );
  }
  res.status(202).json({ ok: true });
}

// Sets a new password with a reset link. The link works once, and using it signs out every
// device, in case whoever made the reset necessary is still signed in somewhere.
export async function resetPassword(req, res) {
  const token = String(req.body?.token ?? '');
  const newPassword = requirePassword(req.body?.newPassword, 'New password');
  const expired = new HttpError(400, 'This reset link has expired or has already been used. Ask for a new one.');

  // Checked before hashing, so a made-up link costs one quick query instead of 0.2 s of hashing
  const tokenHash = hashToken(token);
  if (!token || !(await PasswordReset.isLive(tokenHash))) throw expired;

  const userId = await PasswordReset.use({ tokenHash, passwordHash: await hashPassword(newPassword) });
  if (!userId) throw expired;
  res.status(204).end();
}
