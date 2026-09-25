// SQL for accounts (the users table, schema/01_identity.sql).
//
// Rows come back as the database spells them (full_name, not fullName). Turning a row into JSON
// is the controller's job, because different endpoints show different parts of an account.
import { query, queryOne } from '../database/index.js';

// Every column a caller may see. password_hash is left out on purpose: only the two
// find...WithPassword functions add it, so an accidental res.json(row) can never leak a hash.
const ACCOUNT_COLUMNS = `
  u.id, u.email, u.full_name, u.status, u.role_id, u.session_version,
  u.last_login_at, u.created_at, r.name AS role, r.label AS role_label
`;
const FROM_USERS = 'FROM users u JOIN roles r ON r.id = u.role_id';
const SELECT_ACCOUNT = `SELECT ${ACCOUNT_COLUMNS} ${FROM_USERS}`;

export function findById(id) {
  return queryOne(`${SELECT_ACCOUNT} WHERE u.id = :id`, { id });
}

export function findByEmail(email) {
  return queryOne(`${SELECT_ACCOUNT} WHERE u.email = :email`, { email });
}

// For checking a password at sign-in: the whole account plus its hash, in one query
export function findByEmailWithPassword(email) {
  return queryOne(`SELECT ${ACCOUNT_COLUMNS}, u.password_hash ${FROM_USERS} WHERE u.email = :email`, { email });
}

// For checking the current password before changing it
export function findByIdWithPassword(id) {
  return queryOne('SELECT id, password_hash FROM users WHERE id = :id', { id });
}

// What the sign-in check compares on every request: the account's status right now, and its
// session version (which moves on when the password changes, signing out other devices).
// Null when the account has been deleted.
export function findSessionState(id) {
  return queryOne('SELECT status, session_version FROM users WHERE id = :id', { id });
}

// Every account, optionally narrowed by status and role. A null filter matches everything.
export function list({ status = null, roleName = null } = {}) {
  return query(
    `${SELECT_ACCOUNT}
      WHERE (:status IS NULL OR u.status = :status)
        AND (:roleName IS NULL OR r.name = :roleName)
      ORDER BY u.full_name`,
    { status, roleName },
  );
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM users');
  return Number(row.total);
}

// `exceptId` leaves one account out, so saving an account with its own email is not a clash
export async function emailTaken(email, exceptId = null) {
  const row = await queryOne(
    'SELECT 1 FROM users WHERE email = :email AND (:exceptId IS NULL OR id <> :exceptId)',
    { email, exceptId },
  );
  return row !== null;
}

// Returns the new account's id
export async function create({ email, passwordHash, fullName, roleId, status }) {
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, role_id, status)
     VALUES (:email, :passwordHash, :fullName, :roleId, :status)`,
    { email, passwordHash, fullName, roleId, status },
  );
  return result.insertId;
}

export function updateProfile({ id, fullName, email, roleId }) {
  return query(
    'UPDATE users SET full_name = :fullName, email = :email, role_id = :roleId WHERE id = :id',
    { id, fullName, email, roleId },
  );
}

export function updateStatus(id, status) {
  return query('UPDATE users SET status = :status WHERE id = :id', { id, status });
}

// Saves a new password hash and moves the session version on, which signs out every other device
// still using the old password. Returns the new version, so the caller can keep its own session.
export async function updatePassword(id, passwordHash) {
  await query(
    'UPDATE users SET password_hash = :passwordHash, session_version = session_version + 1 WHERE id = :id',
    { id, passwordHash },
  );
  const row = await queryOne('SELECT session_version FROM users WHERE id = :id', { id });
  return row.session_version;
}

export function recordSignIn(id) {
  return query('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id });
}

export function remove(id) {
  return query('DELETE FROM users WHERE id = :id', { id });
}
