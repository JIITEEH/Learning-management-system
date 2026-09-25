// Managing accounts: listing, creating, editing, approving or suspending, deleting, and
// per-account permission overrides.
import * as User from '../database-queries/userModel.js';
import * as Role from '../database-queries/roleModel.js';
import * as Permission from '../database-queries/permissionModel.js';
import { HttpError } from '../helpers/httpError.js';
import { hashPassword } from '../helpers/password.js';
import { oneOf, parseId, requireEmail, requirePassword, requireText } from '../helpers/validate.js';

const STATUSES = ['pending', 'active', 'suspended'];

// The JSON shape of an account in every /api/users response
function toJson(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    role: row.role,
    roleId: row.role_id,
    roleLabel: row.role_label,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

async function findAccount(idValue) {
  const account = await User.findById(parseId(idValue, 'Account not found'));
  if (!account) throw new HttpError(404, 'Account not found');
  return account;
}

// Whether the requester holds a code. Routes guarded only by requireAuth have not loaded the
// requester's codes yet, so they are loaded here the first time they are needed.
async function holds(req, code) {
  req.permissions ??= await Permission.effectiveCodes(req.user.id);
  return req.permissions.has(code);
}

export async function listUsers(req, res) {
  const status = req.query.status ? oneOf(String(req.query.status), STATUSES, 'Status') : null;
  const roleName = req.query.role ? String(req.query.role) : null;
  const rows = await User.list({ status, roleName });
  res.json({ users: rows.map(toJson) });
}

// Creating an account with any role but student hands out that role's permissions, so it takes
// role.manage on top of user.create
export async function createUser(req, res) {
  const email = requireEmail(req.body?.email);
  const fullName = requireText(req.body?.fullName, 'Full name', { max: 160 });
  const password = requirePassword(req.body?.password);
  const status = oneOf(req.body?.status ?? 'active', STATUSES, 'Status');
  const roleName = String(req.body?.role ?? 'student');

  const role = await Role.findByName(roleName);
  if (!role) throw new HttpError(400, `No such role: ${roleName}`);
  if (roleName !== 'student' && !(await holds(req, 'role.manage'))) {
    throw new HttpError(403, 'Assigning a role other than student requires role.manage');
  }
  if (await User.emailTaken(email)) throw new HttpError(409, 'That email address is already registered');

  const id = await User.create({ email, passwordHash: await hashPassword(password), fullName, roleId: role.id, status });
  res.status(201).json({ user: toJson(await User.findById(id)) });
}

// Anyone may read their own account; reading someone else's takes user.read
export async function getUser(req, res) {
  const account = await findAccount(req.params.id);
  if (account.id !== req.user.id && !(await holds(req, 'user.read'))) {
    throw new HttpError(403, 'Insufficient permissions');
  }
  res.json({ user: toJson(account) });
}

// Anyone may change their own name and email. Changing someone else's takes user.update, and
// changing a role takes role.manage. Fields left out of the request keep their current value.
export async function updateUser(req, res) {
  const account = await findAccount(req.params.id);
  const isSelf = account.id === req.user.id;
  if (!isSelf && !(await holds(req, 'user.update'))) throw new HttpError(403, 'Insufficient permissions');

  const body = req.body ?? {};
  const fullName = body.fullName === undefined ? account.full_name : requireText(body.fullName, 'Full name', { max: 160 });
  const email = body.email === undefined ? account.email : requireEmail(body.email);
  if (email !== account.email && (await User.emailTaken(email, account.id))) {
    throw new HttpError(409, 'That email address is already registered');
  }

  let roleId = account.role_id;
  if (body.role !== undefined && body.role !== account.role) {
    if (!(await holds(req, 'role.manage'))) throw new HttpError(403, 'Changing a role requires role.manage');
    // An administrator changing their own role is how the last administrator locks everyone out
    if (isSelf) throw new HttpError(409, 'You cannot change your own role');
    const role = await Role.findByName(String(body.role));
    if (!role) throw new HttpError(400, `No such role: ${body.role}`);
    roleId = role.id;
  }

  await User.updateProfile({ id: account.id, fullName, email, roleId });
  res.json({ user: toJson(await User.findById(account.id)) });
}

// Moves an account through pending -> active -> suspended
export async function setUserStatus(req, res) {
  const account = await findAccount(req.params.id);
  const status = oneOf(req.body?.status, STATUSES, 'Status');
  if (account.id === req.user.id && status !== 'active') {
    throw new HttpError(409, 'You cannot suspend your own account');
  }
  await User.updateStatus(account.id, status);
  res.json({ user: toJson(await User.findById(account.id)) });
}

export async function deleteUser(req, res) {
  const account = await findAccount(req.params.id);
  if (account.id === req.user.id) throw new HttpError(409, 'You cannot delete your own account');
  await User.remove(account.id);
  res.status(204).end();
}

// What an account can do, and why: the codes its role grants, the overrides on top, and the
// effective set the server actually enforces
export async function getUserPermissions(req, res) {
  const account = await findAccount(req.params.id);
  res.json({
    userId: account.id,
    role: account.role,
    fromRole: await Role.codesFor(account.role_id),
    overrides: await Permission.listOverrides(account.id),
    effective: [...(await Permission.effectiveCodes(account.id))].sort(),
  });
}

// Replaces an account's overrides with the list sent: [{ code, effect: 'allow' | 'deny' }].
// A code left out goes back to whatever the role says.
export async function setUserPermissions(req, res) {
  const account = await findAccount(req.params.id);
  const entries = req.body?.overrides;
  if (!Array.isArray(entries)) throw new HttpError(400, '`overrides` must be an array of { code, effect }');

  const idsByCode = await Permission.idsByCode();
  const seen = new Set();
  const overrides = entries.map((entry) => {
    const code = String(entry?.code ?? '');
    const effect = oneOf(entry?.effect ?? 'allow', ['allow', 'deny'], `Effect for ${code}`);
    if (!idsByCode.has(code)) throw new HttpError(400, `Unknown permission code: ${code}`);
    if (seen.has(code)) throw new HttpError(400, `Duplicate override for ${code}`);
    seen.add(code);
    return { permissionId: idsByCode.get(code), effect };
  });

  // Denying yourself role.manage would leave you unable to undo it
  const deniesOwnRoleManage = entries.some((entry) => entry?.code === 'role.manage' && entry?.effect === 'deny');
  if (account.id === req.user.id && deniesOwnRoleManage) {
    throw new HttpError(409, 'You cannot deny yourself role.manage');
  }

  await Permission.replaceOverrides(account.id, overrides, req.user.id);
  res.json({ userId: account.id, effective: [...(await Permission.effectiveCodes(account.id))].sort() });
}
