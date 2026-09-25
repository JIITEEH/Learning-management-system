// Roles and the permission codes each one carries. Adding a role needs no code change: roles are
// rows in the database, and the server only ever checks permission codes.
import * as Role from '../database-queries/roleModel.js';
import * as Permission from '../database-queries/permissionModel.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalText, parseId, requireText } from '../helpers/validate.js';

function toJson(row) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    // Only the list query counts these
    ...(row.permission_count === undefined
      ? {}
      : { permissionCount: Number(row.permission_count), userCount: Number(row.user_count) }),
  };
}

async function findRole(idValue) {
  const role = await Role.findById(parseId(idValue, 'Role not found'));
  if (!role) throw new HttpError(404, 'Role not found');
  return role;
}

// The internal name, e.g. 'teaching_assistant': lowercase, used in code and URLs
function readName(value) {
  const name = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(name)) {
    throw new HttpError(400, 'Role name must be 2–40 characters: letters, digits, _ or -');
  }
  return name;
}

// Turns a list of codes into ids, refusing the whole request if any code is unknown:
// a typo silently dropping a permission is worse than an error
async function permissionIdsFor(codes) {
  if (!Array.isArray(codes)) throw new HttpError(400, '`codes` must be an array of permission codes');
  const idsByCode = await Permission.idsByCode();
  const unknown = codes.filter((code) => !idsByCode.has(code));
  if (unknown.length > 0) throw new HttpError(400, `Unknown permission codes: ${unknown.join(', ')}`);
  return [...new Set(codes)].map((code) => idsByCode.get(code));
}

async function roleResponse(roleId) {
  return { role: toJson(await Role.findById(roleId)), codes: await Role.codesFor(roleId) };
}

export async function listRoles(req, res) {
  const rows = await Role.listWithCounts();
  res.json({ roles: rows.map(toJson) });
}

export async function getRole(req, res) {
  const role = await findRole(req.params.id);
  res.json(await roleResponse(role.id));
}

export async function createRole(req, res) {
  const name = readName(req.body?.name);
  const label = requireText(req.body?.label, 'Label', { max: 80 });
  const description = optionalText(req.body?.description, 'Description', { max: 255 });
  if (await Role.nameTaken(name)) throw new HttpError(409, 'A role with that name already exists');

  const permissionIds = await permissionIdsFor(req.body?.codes ?? []);
  const id = await Role.create({ name, label, description, permissionIds });
  res.status(201).json(await roleResponse(id));
}

// A built-in role may be relabelled but not renamed: the seed and the first-account check look
// it up by name
export async function updateRole(req, res) {
  const role = await findRole(req.params.id);
  const body = req.body ?? {};

  let name = role.name;
  if (body.name !== undefined && body.name !== role.name) {
    if (role.is_system) throw new HttpError(409, 'A built-in role cannot be renamed');
    name = readName(body.name);
    if (await Role.nameTaken(name, role.id)) throw new HttpError(409, 'A role with that name already exists');
  }
  const label = body.label === undefined ? role.label : requireText(body.label, 'Label', { max: 80 });
  const description =
    body.description === undefined ? role.description : optionalText(body.description, 'Description', { max: 255 });

  await Role.update({ id: role.id, name, label, description });
  res.json(await roleResponse(role.id));
}

export async function deleteRole(req, res) {
  const role = await findRole(req.params.id);
  if (role.is_system) throw new HttpError(409, 'A built-in role cannot be deleted');
  const holders = await Role.countAccounts(role.id);
  if (holders > 0) throw new HttpError(409, `${holders} account(s) still hold this role`);
  await Role.remove(role.id);
  res.status(204).end();
}

// Replaces the role's whole permission set: a code left out is taken away, from everyone holding
// the role, on their next request
export async function setRolePermissions(req, res) {
  const role = await findRole(req.params.id);
  await Role.replacePermissions(role.id, await permissionIdsFor(req.body?.codes ?? []));
  res.json({ roleId: role.id, codes: await Role.codesFor(role.id) });
}
