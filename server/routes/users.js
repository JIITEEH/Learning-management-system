import { Router } from "express";
import bcrypt from "bcryptjs";

import * as users from "../db/repositories/users.repo.js";
import * as roles from "../db/repositories/roles.repo.js";
import * as permissions from "../db/repositories/permissions.repo.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { httpError, asyncRoute } from "../middleware/errors.js";
import { assertPasswordStrength, readEmail, readFullName } from "../validate.js";

const router = Router();

const HASH_ROUNDS = 12;
const STATUSES = ["pending", "active", "suspended"];

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
  const user = await users.findById(id);
  if (!user) throw httpError(404, "Account not found");
  return user;
}

/** True when the requester holds every code listed. */
async function holds(req, ...codes) {
  const held = req.permissions ?? (await permissions.effectiveCodesFor(req.user.id));
  req.permissions = held;
  return codes.every((code) => held.has(code));
}

function assertStatus(status) {
  if (!STATUSES.includes(status)) {
    throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
  }
  return status;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

router.get(
  "/",
  requirePermission("user.read"),
  asyncRoute(async (req, res) => {
    const status = req.query.status ? assertStatus(String(req.query.status)) : null;
    const roleName = req.query.role ? String(req.query.role) : null;

    const rows = await users.list({ status, roleName });
    res.json({ users: rows.map(publicUser) });
  }),
);

router.post(
  "/",
  requirePermission("user.create"),
  asyncRoute(async (req, res) => {
    const email = readEmail(req.body?.email);
    const fullName = readFullName(req.body?.fullName);
    const password = String(req.body?.password ?? "");
    assertPasswordStrength(password);

    const status = assertStatus(req.body?.status ?? "active");

    // Handing out a role is handing out its permissions, so creating an
    // account with one takes role.manage on top of user.create.
    const roleName = String(req.body?.role ?? "student");
    const role = await roles.findByName(roleName);
    if (!role) throw httpError(400, `No such role: ${roleName}`);
    if (roleName !== "student" && !(await holds(req, "role.manage"))) {
      throw httpError(403, "Assigning a role other than student requires role.manage");
    }

    if (await users.emailTaken(email)) {
      throw httpError(409, "That email address is already registered");
    }

    const id = await users.insert({
      email,
      passwordHash: await bcrypt.hash(password, HASH_ROUNDS),
      fullName,
      roleId: role.id,
      status,
    });

    res.status(201).json({ user: publicUser(await findUser(id)) });
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
      req.body?.fullName === undefined ? user.full_name : readFullName(req.body.fullName);

    let email = user.email;
    if (req.body?.email !== undefined) {
      email = readEmail(req.body.email);
      if (await users.emailTaken(email, id)) {
        throw httpError(409, "That email address is already registered");
      }
    }

    let roleId = user.role_id;
    if (req.body?.role !== undefined && req.body.role !== user.role) {
      if (!(await holds(req, "role.manage"))) {
        throw httpError(403, "Changing a role requires role.manage");
      }
      // Changing your own role is how an administrator locks themselves out.
      if (isSelf) throw httpError(409, "You cannot change your own role");

      const role = await roles.findByName(String(req.body.role));
      if (!role) throw httpError(400, `No such role: ${req.body.role}`);
      roleId = role.id;
    }

    await users.updateProfile({ id, fullName, email, roleId });

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
    await users.remove(id);
    res.status(204).end();
  }),
);

/** Move an account through the pending → active → suspended lifecycle. */
router.patch(
  "/:id/status",
  requirePermission("user.update"),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const status = assertStatus(String(req.body?.status ?? ""));
    if (id === req.user.id && status !== "active") {
      throw httpError(409, "You cannot suspend your own account");
    }

    await findUser(id);
    await users.updateStatus(id, status);
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

    res.json({
      userId: user.id,
      role: user.role,
      fromRole: await roles.codesFor(user.role_id),
      overrides: await users.listOverrides(user.id),
      effective: [...(await permissions.effectiveCodesFor(user.id))].sort(),
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

    const byCode = await permissions.idsByCode();

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

    await users.replaceOverrides(user.id, rows, req.user.id);

    res.json({
      userId: user.id,
      effective: [...(await permissions.effectiveCodesFor(user.id))].sort(),
    });
  }),
);

export default router;
