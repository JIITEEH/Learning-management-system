import { Router } from "express";

import * as roles from "../db/repositories/roles.repo.js";
import * as permissions from "../db/repositories/permissions.repo.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { httpError, asyncRoute } from "../middleware/errors.js";

const router = Router();

/** Column names are snake_case, the JSON is camelCase — same as /api/users. */
function publicRole(row) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description,
    isSystem: Boolean(row.is_system),
    ...(row.permission_count === undefined
      ? {}
      : { permissionCount: Number(row.permission_count), userCount: Number(row.user_count) }),
    ...(row.created_at === undefined ? {} : { createdAt: row.created_at }),
  };
}

/** Resolve :id, or 404. */
async function findRole(id) {
  const role = await roles.findById(id);
  if (!role) throw httpError(404, "Role not found");
  return role;
}

/**
 * Turn a list of permission codes into ids, refusing the whole request if any
 * code is unknown — a typo silently dropping a permission is worse than a 400.
 */
async function idsForCodes(codes) {
  if (!Array.isArray(codes)) {
    throw httpError(400, "`codes` must be an array of permission codes");
  }
  const byCode = await permissions.idsByCode();

  const unknown = codes.filter((code) => !byCode.has(code));
  if (unknown.length > 0) {
    throw httpError(400, `Unknown permission codes: ${unknown.join(", ")}`);
  }
  return [...new Set(codes)].map((code) => byCode.get(code));
}

function readName(body) {
  const name = String(body?.name ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(name)) {
    throw httpError(400, "Role name must be 2–40 characters: letters, digits, _ or -");
  }
  return name;
}

// Any signed-in user may read the role list — the account and admin pages
// need it to show who holds what.
router.get(
  "/",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const rows = await roles.listWithCounts();
    res.json({ roles: rows.map(publicRole) });
  }),
);

router.post(
  "/",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const name = readName(req.body);
    const label = String(req.body?.label ?? "").trim();
    const description = String(req.body?.description ?? "").trim() || null;
    if (!label) throw httpError(400, "Label is required");

    if (await roles.nameTaken(name)) {
      throw httpError(409, "A role with that name already exists");
    }

    const permissionIds = await idsForCodes(req.body?.codes ?? []);
    const roleId = await roles.insertWithPermissions({
      name,
      label,
      description,
      permissionIds,
    });

    res.status(201).json({
      role: publicRole(await findRole(roleId)),
      codes: await roles.codesFor(roleId),
    });
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    res.json({ role: publicRole(role), codes: await roles.codesFor(role.id) });
  }),
);

router.patch(
  "/:id",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);

    // A system role may be relabelled, but its name is what the seed and the
    // bootstrap check look it up by, so that stays fixed.
    let name = role.name;
    if (req.body?.name !== undefined && req.body.name !== role.name) {
      if (role.is_system) throw httpError(409, "A system role cannot be renamed");
      name = readName(req.body);
      if (await roles.nameTaken(name, role.id)) {
        throw httpError(409, "A role with that name already exists");
      }
    }

    const label = req.body?.label === undefined ? role.label : String(req.body.label).trim();
    if (!label) throw httpError(400, "Label is required");
    const description =
      req.body?.description === undefined
        ? role.description
        : String(req.body.description).trim() || null;

    await roles.update({ id: role.id, name, label, description });

    res.json({
      role: publicRole(await findRole(role.id)),
      codes: await roles.codesFor(role.id),
    });
  }),
);

router.delete(
  "/:id",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    if (role.is_system) throw httpError(409, "A system role cannot be deleted");

    // users.role_id is ON DELETE RESTRICT, so say why rather than letting the
    // constraint surface as a 500.
    const total = await roles.countUsers(role.id);
    if (total > 0) {
      throw httpError(409, `${total} account(s) still hold this role`);
    }

    await roles.remove(role.id);
    res.status(204).end();
  }),
);

router.get(
  "/:id/permissions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    res.json({ roleId: role.id, codes: await roles.codesFor(role.id) });
  }),
);

/**
 * Replace a role's permission set. The whole set is sent, so a code left out
 * is a code taken away — and because permissions are read per request, that
 * lands on everyone holding the role straight away.
 */
router.put(
  "/:id/permissions",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    const permissionIds = await idsForCodes(req.body?.codes ?? []);

    await roles.replacePermissions(role.id, permissionIds);

    res.json({ roleId: role.id, codes: await roles.codesFor(role.id) });
  }),
);

export default router;
