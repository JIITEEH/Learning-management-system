import { Router } from "express";

import { query, queryOne, transaction } from "../db/pool.js";
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
  const role = await queryOne(
    `SELECT id, name, label, description, is_system, created_at
       FROM roles WHERE id = :id`,
    { id },
  );
  if (!role) throw httpError(404, "Role not found");
  return role;
}

async function codesFor(roleId) {
  const rows = await query(
    `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = :roleId
      ORDER BY p.code`,
    { roleId },
  );
  return rows.map((row) => row.code);
}

/**
 * Turn a list of permission codes into ids, refusing the whole request if
 * any code is unknown. The catalogue is small enough to read in one go, so
 * this avoids expanding a list into the SQL.
 */
async function idsForCodes(codes) {
  if (!Array.isArray(codes)) {
    throw httpError(400, "`codes` must be an array of permission codes");
  }
  const catalogue = await query("SELECT id, code FROM permissions");
  const byCode = new Map(catalogue.map((row) => [row.code, row.id]));

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
    const roles = await query(
      `SELECT r.id, r.name, r.label, r.description, r.is_system,
              COUNT(DISTINCT rp.permission_id) AS permission_count,
              COUNT(DISTINCT u.id) AS user_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN users u ON u.role_id = r.id
        GROUP BY r.id
        ORDER BY r.name`,
    );
    res.json({ roles: roles.map(publicRole) });
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

    const taken = await queryOne("SELECT id FROM roles WHERE name = :name", { name });
    if (taken) throw httpError(409, "A role with that name already exists");

    const codes = req.body?.codes ?? [];
    const permissionIds = await idsForCodes(codes);

    const roleId = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO roles (name, label, description, is_system)
         VALUES (:name, :label, :description, 0)`,
        { name, label, description },
      );
      for (const permissionId of permissionIds) {
        await connection.execute(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES (:roleId, :permissionId)`,
          { roleId: result.insertId, permissionId },
        );
      }
      return result.insertId;
    });

    res.status(201).json({ role: publicRole(await findRole(roleId)), codes: await codesFor(roleId) });
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    res.json({ role: publicRole(role), codes: await codesFor(role.id) });
  }),
);

router.patch(
  "/:id",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);

    // A system role may be relabelled, but its name is what seed.sql and the
    // bootstrap check look it up by, so that stays fixed.
    let name = role.name;
    if (req.body?.name !== undefined && req.body.name !== role.name) {
      if (role.is_system) throw httpError(409, "A system role cannot be renamed");
      name = readName(req.body);
      const taken = await queryOne(
        "SELECT id FROM roles WHERE name = :name AND id <> :id",
        { name, id: role.id },
      );
      if (taken) throw httpError(409, "A role with that name already exists");
    }

    const label = req.body?.label === undefined ? role.label : String(req.body.label).trim();
    if (!label) throw httpError(400, "Label is required");
    const description =
      req.body?.description === undefined
        ? role.description
        : String(req.body.description).trim() || null;

    await query(
      `UPDATE roles SET name = :name, label = :label, description = :description
        WHERE id = :id`,
      { name, label, description, id: role.id },
    );

    res.json({ role: publicRole(await findRole(role.id)), codes: await codesFor(role.id) });
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
    const { total } = await queryOne(
      "SELECT COUNT(*) AS total FROM users WHERE role_id = :id",
      { id: role.id },
    );
    if (Number(total) > 0) {
      throw httpError(409, `${total} account(s) still hold this role`);
    }

    await query("DELETE FROM roles WHERE id = :id", { id: role.id });
    res.status(204).end();
  }),
);

router.get(
  "/:id/permissions",
  requireAuth,
  asyncRoute(async (req, res) => {
    const role = await findRole(req.params.id);
    res.json({ roleId: role.id, codes: await codesFor(role.id) });
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

    await transaction(async (connection) => {
      await connection.execute("DELETE FROM role_permissions WHERE role_id = :roleId", {
        roleId: role.id,
      });
      for (const permissionId of permissionIds) {
        await connection.execute(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES (:roleId, :permissionId)`,
          { roleId: role.id, permissionId },
        );
      }
    });

    res.json({ roleId: role.id, codes: await codesFor(role.id) });
  }),
);

export default router;
