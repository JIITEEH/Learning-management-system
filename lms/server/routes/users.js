import { Router } from "express";
import bcrypt from "bcryptjs";

import { query, queryOne, transaction } from "../db/pool.js";
import { requireAuth, requirePermission, permissionsFor } from "../middleware/auth.js";
import { httpError, asyncRoute } from "../middleware/errors.js";

const router = Router();

const HASH_ROUNDS = 12;
const MIN_PASSWORD = 8;
const STATUSES = ["pending", "active", "suspended"];

const SELECT_USER = `
  SELECT u.id, u.email, u.full_name, u.status, u.role_id, u.last_login_at,
         u.created_at, r.name AS role, r.label AS role_label
    FROM users u
    JOIN roles r ON r.id = u.role_id
`;

/**
 * The shape every account response uses. The column names are snake_case and
 * the JSON is camelCase, matching what /api/auth returns, so a page can read
 * `fullName` wherever the account came from.
 */
function publicUser(row) {
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

async function findUser(id) {
  const user = await queryOne(`${SELECT_USER} WHERE u.id = :id`, { id });
  if (!user) throw httpError(404, "Account not found");
  return user;
}

/** True when the requester holds every code listed. */
async function holds(req, ...codes) {
  const held = req.permissions ?? (await permissionsFor(req.user.id));
  req.permissions = held;
  return codes.every((code) => held.has(code));
}

function readEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw httpError(400, "Email address is not valid");
  return email;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

router.get(
  "/",
  requirePermission("user.read"),
  asyncRoute(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    if (status && !STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
    }
    const roleName = req.query.role ? String(req.query.role) : null;

    const users = await query(
      `${SELECT_USER}
        WHERE (:status IS NULL OR u.status = :status)
          AND (:roleName IS NULL OR r.name = :roleName)
        ORDER BY u.full_name`,
      { status, roleName },
    );
    res.json({ users: users.map(publicUser) });
  }),
);

router.post(
  "/",
  requirePermission("user.create"),
  asyncRoute(async (req, res) => {
    const email = readEmail(req.body?.email);
    const fullName = String(req.body?.fullName ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!fullName) throw httpError(400, "Full name is required");
    if (password.length < MIN_PASSWORD) {
      throw httpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
    }

    const status = req.body?.status ?? "active";
    if (!STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
    }

    // Handing out a role is handing out its permissions, so creating an
    // account with one takes role.manage on top of user.create.
    const roleName = String(req.body?.role ?? "student");
    const role = await queryOne("SELECT id FROM roles WHERE name = :roleName", { roleName });
    if (!role) throw httpError(400, `No such role: ${roleName}`);
    if (roleName !== "student" && !(await holds(req, "role.manage"))) {
      throw httpError(403, "Assigning a role other than student requires role.manage");
    }

    const taken = await queryOne("SELECT id FROM users WHERE email = :email", { email });
    if (taken) throw httpError(409, "That email address is already registered");

    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role_id, status)
       VALUES (:email, :passwordHash, :fullName, :roleId, :status)`,
      { email, passwordHash, fullName, roleId: role.id, status },
    );

    res.status(201).json({ user: publicUser(await findUser(result.insertId)) });
  }),
);

// Readable by the account holder, or by anyone with user.read.
router.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (id !== req.user.id && !(await holds(req, "user.read"))) {
      throw httpError(403, "Insufficient permissions");
    }
    res.json({ user: publicUser(await findUser(id)) });
  }),
);

/**
 * Edit an account. Anyone may change their own name and email; changing
 * someone else's takes user.update, and changing a role takes role.manage.
 */
router.patch(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const user = await findUser(id);
    const isSelf = id === req.user.id;

    if (!isSelf && !(await holds(req, "user.update"))) {
      throw httpError(403, "Insufficient permissions");
    }

    const fullName =
      req.body?.fullName === undefined ? user.full_name : String(req.body.fullName).trim();
    if (!fullName) throw httpError(400, "Full name is required");

    let email = user.email;
    if (req.body?.email !== undefined) {
      email = readEmail(req.body.email);
      const taken = await queryOne(
        "SELECT id FROM users WHERE email = :email AND id <> :id",
        { email, id },
      );
      if (taken) throw httpError(409, "That email address is already registered");
    }

    let roleId = user.role_id;
    if (req.body?.role !== undefined && req.body.role !== user.role) {
      if (!(await holds(req, "role.manage"))) {
        throw httpError(403, "Changing a role requires role.manage");
      }
      // Changing your own role is how an administrator locks themselves out.
      if (isSelf) throw httpError(409, "You cannot change your own role");

      const role = await queryOne("SELECT id FROM roles WHERE name = :roleName", {
        roleName: String(req.body.role),
      });
      if (!role) throw httpError(400, `No such role: ${req.body.role}`);
      roleId = role.id;
    }

    await query(
      `UPDATE users SET full_name = :fullName, email = :email, role_id = :roleId
        WHERE id = :id`,
      { fullName, email, roleId, id },
    );

    res.json({ user: publicUser(await findUser(id)) });
  }),
);

router.delete(
  "/:id",
  requirePermission("user.delete"),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw httpError(409, "You cannot delete your own account");

    await findUser(id);
    await query("DELETE FROM users WHERE id = :id", { id });
    res.status(204).end();
  }),
);

/** Move an account through the pending → active → suspended lifecycle. */
router.patch(
  "/:id/status",
  requirePermission("user.update"),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? "");
    if (!STATUSES.includes(status)) {
      throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
    }
    if (id === req.user.id && status !== "active") {
      throw httpError(409, "You cannot suspend your own account");
    }

    await findUser(id);
    await query("UPDATE users SET status = :status WHERE id = :id", { status, id });
    res.json({ user: publicUser(await findUser(id)) });
  }),
);

// ---------------------------------------------------------------------------
// Per-account permission overrides
// ---------------------------------------------------------------------------

/**
 * What this account can do, and why: the codes its role grants, the
 * per-account overrides on top, and the effective set after a deny has
 * beaten any allow. `effective` is what the server will actually enforce.
 */
router.get(
  "/:id/permissions",
  requirePermission("user.read"),
  asyncRoute(async (req, res) => {
    const user = await findUser(Number(req.params.id));

    const fromRole = await query(
      `SELECT p.code
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = :roleId
        ORDER BY p.code`,
      { roleId: user.role_id },
    );

    const overrides = await query(
      `SELECT p.code, up.effect, up.granted_at, up.granted_by
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = :userId
        ORDER BY p.code`,
      { userId: user.id },
    );

    res.json({
      userId: user.id,
      role: user.role,
      fromRole: fromRole.map((row) => row.code),
      overrides,
      effective: [...(await permissionsFor(user.id))].sort(),
    });
  }),
);

/**
 * Replace this account's overrides with the set sent. Each entry is a code
 * and an effect: `allow` adds something the role does not carry, `deny`
 * takes away something it does. A deny always wins, so denying a code the
 * role grants is how you revoke it from one person without touching the
 * role. Anything left out of the list reverts to whatever the role says.
 */
router.put(
  "/:id/permissions",
  requirePermission("role.manage"),
  asyncRoute(async (req, res) => {
    const user = await findUser(Number(req.params.id));

    const entries = req.body?.overrides;
    if (!Array.isArray(entries)) {
      throw httpError(400, "`overrides` must be an array of { code, effect }");
    }

    const catalogue = await query("SELECT id, code FROM permissions");
    const byCode = new Map(catalogue.map((row) => [row.code, row.id]));

    const seen = new Set();
    const rows = entries.map((entry) => {
      const code = String(entry?.code ?? "");
      const effect = String(entry?.effect ?? "allow");

      if (!byCode.has(code)) throw httpError(400, `Unknown permission code: ${code}`);
      if (effect !== "allow" && effect !== "deny") {
        throw httpError(400, `Effect must be 'allow' or 'deny', got '${effect}' for ${code}`);
      }
      if (seen.has(code)) throw httpError(400, `Duplicate override for ${code}`);
      seen.add(code);

      return { permissionId: byCode.get(code), effect };
    });

    // Denying yourself role.manage would leave nobody able to undo it from
    // this account.
    if (user.id === req.user.id) {
      const selfDeny = entries.find(
        (entry) => entry?.code === "role.manage" && entry?.effect === "deny",
      );
      if (selfDeny) throw httpError(409, "You cannot deny yourself role.manage");
    }

    await transaction(async (connection) => {
      await connection.execute("DELETE FROM user_permissions WHERE user_id = :userId", {
        userId: user.id,
      });
      for (const row of rows) {
        await connection.execute(
          `INSERT INTO user_permissions (user_id, permission_id, effect, granted_by)
           VALUES (:userId, :permissionId, :effect, :grantedBy)`,
          {
            userId: user.id,
            permissionId: row.permissionId,
            effect: row.effect,
            grantedBy: req.user.id,
          },
        );
      }
    });

    res.json({
      userId: user.id,
      effective: [...(await permissionsFor(user.id))].sort(),
    });
  }),
);

export default router;
