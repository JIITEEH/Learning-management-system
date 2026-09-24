// Accounts — database access.
//
// Schema: database/schema/01_identity.sql (users, user_permissions).
// Used by routes/users.js and routes/auth.js.
//
// Rows come back as the database spells them, snake_case and all. Turning a
// row into JSON is the route's job, because /api/auth and /api/users
// deliberately return different shapes of the same account.

import { query, queryOne, transaction } from "../pool.js";

// The account columns every caller may see. password_hash is not among them:
// it is selected only by the two functions below that say so in their names,
// so an accidental `res.json(row)` cannot leak a hash.
const ACCOUNT_COLUMNS = `
  u.id, u.email, u.full_name, u.status, u.role_id, u.session_version, u.last_login_at,
  u.created_at, r.name AS role, r.label AS role_label
`;

const SELECT_ACCOUNT = `
  SELECT ${ACCOUNT_COLUMNS}
    FROM users u
    JOIN roles r ON r.id = u.role_id
`;

// Same, plus the hash. Only sign-in and a password change need it.
const SELECT_CREDENTIALS = `
  SELECT ${ACCOUNT_COLUMNS}, u.password_hash
    FROM users u
    JOIN roles r ON r.id = u.role_id
`;

/** One account, or null. */
export function findById(id) {
  return queryOne(`${SELECT_ACCOUNT} WHERE u.id = :id`, { id });
}

/**
 * What the sign-in gate compares on every request: the account's status and
 * its session version, or null when the account no longer exists. A session
 * signed in under an older version than this is from before a password
 * change, and is no longer honoured.
 */
export function sessionStateOf(id) {
  return queryOne("SELECT status, session_version FROM users WHERE id = :id", { id });
}

/** One account by email address, or null. No password hash. */
export function findByEmail(email) {
  return queryOne(`${SELECT_ACCOUNT} WHERE u.email = :email`, { email });
}

/** One account including its password hash, for verifying a sign-in. */
export function findCredentialsByEmail(email) {
  return queryOne(`${SELECT_CREDENTIALS} WHERE u.email = :email`, { email });
}

/** One account including its password hash, for verifying a password change. */
export function findCredentialsById(id) {
  return queryOne(`${SELECT_CREDENTIALS} WHERE u.id = :id`, { id });
}

/**
 * Accounts, optionally narrowed by status or role name. A null filter matches
 * everything, so the same statement serves the filtered and unfiltered list.
 */
export function list({ status = null, roleName = null } = {}) {
  return query(
    `${SELECT_ACCOUNT}
      WHERE (:status IS NULL OR u.status = :status)
        AND (:roleName IS NULL OR r.name = :roleName)
      ORDER BY u.full_name`,
    { status, roleName },
  );
}

/** How many accounts exist. Used to detect an empty system at registration. */
export async function count() {
  const { total } = await queryOne("SELECT COUNT(*) AS total FROM users");
  return Number(total);
}

/**
 * Whether an address is already registered. `exceptId` leaves one account out,
 * so editing an account without changing its email does not collide with
 * itself.
 */
export async function emailTaken(email, exceptId = null) {
  const row = await queryOne(
    `SELECT id FROM users
      WHERE email = :email AND (:exceptId IS NULL OR id <> :exceptId)`,
    { email, exceptId },
  );
  return row !== null;
}

/** Create an account. Returns the new id. */
export async function insert({ email, passwordHash, fullName, roleId, status }) {
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role_id, status)
     VALUES (:email, :passwordHash, :fullName, :roleId, :status)`,
    { email, passwordHash, fullName, roleId, status },
  );
  return result.insertId;
}

export function updateProfile({ id, fullName, email, roleId }) {
  return query(
    `UPDATE users SET full_name = :fullName, email = :email, role_id = :roleId
      WHERE id = :id`,
    { fullName, email, roleId, id },
  );
}

export function updateStatus(id, status) {
  return query("UPDATE users SET status = :status WHERE id = :id", { status, id });
}

/**
 * Set a new password and move the session version on, which signs out every
 * other device still using the old password. Returns the new version, so the
 * caller can keep its own session valid.
 */
export async function updatePasswordHash(id, passwordHash) {
  await query(
    `UPDATE users SET password_hash = :passwordHash, session_version = session_version + 1
      WHERE id = :id`,
    { passwordHash, id },
  );
  const { session_version: version } = await queryOne(
    "SELECT session_version FROM users WHERE id = :id",
    { id },
  );
  return version;
}

export function touchLastLogin(id) {
  return query("UPDATE users SET last_login_at = NOW() WHERE id = :id", { id });
}

export function remove(id) {
  return query("DELETE FROM users WHERE id = :id", { id });
}

// ---------------------------------------------------------------------------
// Per-account permission overrides
// ---------------------------------------------------------------------------

/** The overrides set on one account, with who granted each and when. */
export function listOverrides(userId) {
  return query(
    `SELECT p.code, up.effect, up.granted_at, up.granted_by
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = :userId
      ORDER BY p.code`,
    { userId },
  );
}

/**
 * Replace every override on an account with the set given.
 *
 * Delete-then-insert in one transaction, so a failure part way through cannot
 * leave the account with none of its overrides. Anything left out of `rows`
 * reverts to whatever the role says.
 */
export function replaceOverrides(userId, rows, grantedBy) {
  return transaction(async (connection) => {
    await connection.execute("DELETE FROM user_permissions WHERE user_id = :userId", {
      userId,
    });
    for (const row of rows) {
      await connection.execute(
        `INSERT INTO user_permissions (user_id, permission_id, effect, granted_by)
         VALUES (:userId, :permissionId, :effect, :grantedBy)`,
        { userId, permissionId: row.permissionId, effect: row.effect, grantedBy },
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Password reset links
// ---------------------------------------------------------------------------

/**
 * Store a new reset link for an account, replacing any earlier one so only
 * the newest link works. `tokenHash` is the SHA-256 of the secret in the
 * link; the secret itself is never stored.
 */
export function createPasswordReset({ userId, tokenHash, minutes }) {
  return transaction(async (connection) => {
    await connection.execute("DELETE FROM password_resets WHERE user_id = :userId", { userId });
    await connection.execute(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, NOW() + INTERVAL :minutes MINUTE)`,
      { userId, tokenHash, minutes },
    );
  });
}

/** Whether this account was sent a reset link in the last `seconds`. */
export async function resetRequestedWithin(userId, seconds) {
  const row = await queryOne(
    `SELECT 1 FROM password_resets
      WHERE user_id = :userId AND created_at > NOW() - INTERVAL :seconds SECOND`,
    { userId, seconds },
  );
  return row !== null;
}

/**
 * Use a reset link: if it is live and its account is active, set the new
 * password, sign out every device, and delete the link so it cannot be used
 * twice. Returns the account id, or null when the link is unknown, expired or
 * belongs to an account that may not sign in.
 *
 * The row is locked while this runs, so two requests racing with the same
 * link cannot both succeed.
 */
export function consumePasswordReset({ tokenHash, passwordHash }) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT r.user_id
         FROM password_resets r
         JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = :tokenHash
          AND r.expires_at > NOW()
          AND u.status = 'active'
        FOR UPDATE`,
      { tokenHash },
    );
    const userId = rows[0]?.user_id;
    if (!userId) return null;

    await connection.execute(
      `UPDATE users SET password_hash = :passwordHash, session_version = session_version + 1
        WHERE id = :userId`,
      { passwordHash, userId },
    );
    await connection.execute("DELETE FROM password_resets WHERE user_id = :userId", { userId });
    return userId;
  });
}
