// A cap on wrong passwords, so nobody can guess at an account without limit.
//
// Two tallies of failed sign-ins, each over a 15-minute window:
//
//   - one email address from one network address: 5 failures. This is the
//     one that protects a single account. It is keyed on both, so a stranger
//     guessing at your email does not lock *you* out from somewhere else.
//   - one network address across every account: 30 failures. This stops
//     someone trying one common password against every account in turn.
//
// A correct password clears the first tally. The counts live in this
// process's memory, so a restart forgets them — acceptable for now, and the
// same limitation the sessions have until they move into MySQL.

const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT = 5;
const PER_ADDRESS = 30;

/** key -> { failures, resetAt } */
const tallies = new Map();

function tally(key, now) {
  const entry = tallies.get(key);
  if (entry && entry.resetAt > now) return entry;
  tallies.delete(key);
  return null;
}

const accountKey = (ip, email) => `account:${ip}:${email}`;
const addressKey = (ip) => `address:${ip}`;

/**
 * Minutes until this sign-in may be tried again, or 0 when it may go ahead.
 * Checked before the password is, so a blocked guess costs no hashing either.
 */
export function minutesBlocked(ip, email, now = Date.now()) {
  const account = tally(accountKey(ip, email), now);
  const address = tally(addressKey(ip), now);

  const blockedUntil = Math.max(
    account && account.failures >= PER_ACCOUNT ? account.resetAt : 0,
    address && address.failures >= PER_ADDRESS ? address.resetAt : 0,
  );
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 60000) : 0;
}

export function recordFailure(ip, email, now = Date.now()) {
  for (const key of [accountKey(ip, email), addressKey(ip)]) {
    const entry = tally(key, now) ?? { failures: 0, resetAt: now + WINDOW_MS };
    entry.failures += 1;
    tallies.set(key, entry);
  }
}

export function recordSuccess(ip, email) {
  tallies.delete(accountKey(ip, email));
}

// Forget windows that have run out, so the map cannot grow for ever. unref()
// keeps this timer from holding the process open on its own.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tallies) {
    if (entry.resetAt <= now) tallies.delete(key);
  }
}, WINDOW_MS).unref();
