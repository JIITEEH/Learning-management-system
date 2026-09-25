// Password hashing. Only the hash is ever stored, never the password itself.
//
// Uses bcrypt, which is deliberately slow (about 0.2 s per hash at 12 rounds) so that someone who
// steals the users table cannot try billions of guesses. ThesisTrack uses Node's scrypt instead;
// both are sound, and bcrypt stays here because every existing account's hash is a bcrypt hash.
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

// Compared against when no account has the email being signed in with. Skipping the check for an
// unknown email would answer ~200x faster, and that delay alone would tell a stranger which
// emails are registered. Computed once, at startup.
const NO_ACCOUNT_HASH = bcrypt.hashSync('no account has this address', ROUNDS);

export function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

// `storedHash` may be null (no such account): the check still takes the usual time, then fails.
export async function verifyPassword(password, storedHash) {
  const matches = await bcrypt.compare(password, storedHash ?? NO_ACCOUNT_HASH);
  return Boolean(storedHash) && matches;
}
