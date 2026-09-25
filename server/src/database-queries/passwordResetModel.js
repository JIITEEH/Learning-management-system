// SQL for password reset links (the password_resets table, schema/01_identity.sql).
//
// A reset link carries a long random secret. Only its SHA-256 hash is stored, so someone who can
// read this table still cannot use a link that is waiting in someone's inbox.
import { queryOne, transaction } from '../database/index.js';

// Stores a new link for an account, replacing any earlier one so only the newest link works
export function create({ userId, tokenHash, minutes }) {
  return transaction(async (connection) => {
    await connection.execute('DELETE FROM password_resets WHERE user_id = :userId', { userId });
    await connection.execute(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (:userId, :tokenHash, NOW() + INTERVAL :minutes MINUTE)`,
      { userId, tokenHash, minutes },
    );
  });
}

// Whether this account was sent a link in the last `seconds` (to stop inbox flooding)
export async function sentWithin(userId, seconds) {
  const row = await queryOne(
    `SELECT 1 FROM password_resets
      WHERE user_id = :userId AND created_at > NOW() - INTERVAL :seconds SECOND`,
    { userId, seconds },
  );
  return row !== null;
}

// A link still works when it exists, has not expired, and its account may sign in
const LIVE_LINK = `
  SELECT r.user_id
    FROM password_resets r
    JOIN users u ON u.id = r.user_id
   WHERE r.token_hash = :tokenHash AND r.expires_at > NOW() AND u.status = 'active'
`;

// A quick check before the slow work of hashing the new password
export async function isLive(tokenHash) {
  return (await queryOne(LIVE_LINK, { tokenHash })) !== null;
}

// Uses a link: sets the new password, signs out every device, and deletes the link so it cannot
// be used twice. Returns the account id, or null if the link no longer works.
// FOR UPDATE locks the row, so two requests racing with the same link cannot both succeed.
export function use({ tokenHash, passwordHash }) {
  return transaction(async (connection) => {
    const [rows] = await connection.execute(`${LIVE_LINK} FOR UPDATE`, { tokenHash });
    const userId = rows[0]?.user_id;
    if (!userId) return null;

    await connection.execute(
      `UPDATE users SET password_hash = :passwordHash, session_version = session_version + 1
        WHERE id = :userId`,
      { passwordHash, userId },
    );
    await connection.execute('DELETE FROM password_resets WHERE user_id = :userId', { userId });
    return userId;
  });
}
