import { Router } from "express";
import bcrypt from "bcryptjs";

import * as users from "../db/repositories/users.repo.js";
import * as roles from "../db/repositories/roles.repo.js";
import { effectiveCodesFor } from "../db/repositories/permissions.repo.js";
import { requireAuth } from "../middleware/auth.js";
import { minutesBlocked, recordFailure, recordSuccess } from "../middleware/loginLimit.js";
import { httpError, asyncRoute } from "../middleware/errors.js";

const router = Router();

const HASH_ROUNDS = 12;
const MIN_PASSWORD = 8;

/** What goes on the session, and what the front end gets back. */
function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
  };
}

function readCredentials(body) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    throw httpError(400, "Email and password are required");
  }
  return { email, password };
}

function assertPasswordStrength(password) {
  if (password.length < MIN_PASSWORD) {
    throw httpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }
}

/**
 * Self-registration. The role is never taken from the request — an account
 * created this way is always a student awaiting approval. The one exception
 * is the very first account on an empty system, which becomes an active
 * administrator; without it there would be nobody able to approve anyone,
 * and the seed holds structural rows only, never accounts.
 */
router.post(
  "/register",
  asyncRoute(async (req, res) => {
    const { email, password } = readCredentials(req.body);
    const fullName = String(req.body?.fullName ?? "").trim();

    if (!fullName) throw httpError(400, "Full name is required");
    if (!email.includes("@")) throw httpError(400, "Email address is not valid");
    assertPasswordStrength(password);

    if (await users.emailTaken(email)) {
      throw httpError(409, "That email address is already registered");
    }

    const bootstrapping = (await users.count()) === 0;
    const roleName = bootstrapping ? "admin" : "student";

    const role = await roles.findByName(roleName);
    if (!role) {
      throw httpError(500, `The '${roleName}' role is missing — has npm run db:seed been run?`);
    }

    const id = await users.insert({
      email,
      passwordHash: await bcrypt.hash(password, HASH_ROUNDS),
      fullName,
      roleId: role.id,
      status: bootstrapping ? "active" : "pending",
    });

    res.status(201).json({ user: publicUser(await users.findById(id)) });
  }),
);

/**
 * Sign in. The session id is regenerated so a fixed pre-login cookie cannot
 * be reused after the fact.
 */
router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const { email, password } = readCredentials(req.body);

    const waitMinutes = minutesBlocked(req.ip, email);
    if (waitMinutes > 0) {
      res.set("Retry-After", String(waitMinutes * 60));
      throw httpError(
        429,
        `Too many sign-in attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`,
      );
    }

    const account = await users.findCredentialsByEmail(email);

    // One message for both a missing account and a wrong password, so the
    // response cannot be used to find out which addresses are registered.
    const matches = account && (await bcrypt.compare(password, account.password_hash));
    if (!matches) {
      recordFailure(req.ip, email);
      throw httpError(401, "Email or password is incorrect");
    }
    recordSuccess(req.ip, email);

    if (account.status === "suspended") throw httpError(403, "This account is suspended");
    if (account.status === "pending") throw httpError(403, "This account is awaiting approval");

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    req.session.user = publicUser(account);
    await users.touchLastLogin(account.id);

    res.json({
      user: req.session.user,
      permissions: [...(await effectiveCodesFor(account.id))].sort(),
    });
  }),
);

router.post("/logout", (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("lms.sid");
    res.status(204).end();
  });
});

/**
 * The signed-in account plus the permission codes it holds right now. Read
 * from the database on every call, not from the session, so a permission
 * taken away is gone the next time a page asks.
 */
router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const account = await users.findById(req.user.id);
    if (!account) throw httpError(401, "Authentication required");

    // The session is a cache of the row; refresh it so a renamed or
    // re-roled account does not keep showing stale details.
    req.session.user = publicUser(account);

    res.json({
      user: req.session.user,
      permissions: [...(await effectiveCodesFor(account.id))].sort(),
    });
  }),
);

router.patch(
  "/password",
  requireAuth,
  asyncRoute(async (req, res) => {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      throw httpError(400, "Current and new passwords are required");
    }
    assertPasswordStrength(newPassword);

    const account = await users.findCredentialsById(req.user.id);
    if (!account) throw httpError(401, "Authentication required");

    const matches = await bcrypt.compare(currentPassword, account.password_hash);
    if (!matches) throw httpError(403, "Current password is incorrect");

    await users.updatePasswordHash(account.id, await bcrypt.hash(newPassword, HASH_ROUNDS));

    res.status(204).end();
  }),
);

export default router;
