// A cap on wrong passwords, so nobody can guess at an account without limit.
//
// Two counts of failed sign-ins, each over a 15-minute window:
//   - one email from one network address: 5 failures. This protects a single account. It is keyed
//     on both, so a stranger guessing at your email does not lock *you* out from elsewhere.
//   - one network address across every account: 30 failures. This stops someone trying one common
//     password against every account in turn.
// A correct password clears the first count.
//
// The counts live in this process's memory, so a restart forgets them. rateLimit.js does the
// simpler job of capping every request to a route; this file counts only failures.
const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT = 5;
const PER_ADDRESS = 30;

const failures = new Map(); // key -> { count, resetAt }

const accountKey = (ip, email) => `account:${ip}:${email}`;
const addressKey = (ip) => `address:${ip}`;

// The live count for a key, or null once its window has run out
function current(key, now) {
  const entry = failures.get(key);
  return entry && entry.resetAt > now ? entry : null;
}

// Minutes until this sign-in may be tried again, or 0 when it may go ahead.
// Checked before the password, so a blocked guess costs no password hashing either.
export function minutesBlocked(ip, email, now = Date.now()) {
  const account = current(accountKey(ip, email), now);
  const address = current(addressKey(ip), now);
  const blockedUntil = Math.max(
    account?.count >= PER_ACCOUNT ? account.resetAt : 0,
    address?.count >= PER_ADDRESS ? address.resetAt : 0,
  );
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 60000) : 0;
}

export function recordFailure(ip, email, now = Date.now()) {
  for (const key of [accountKey(ip, email), addressKey(ip)]) {
    const entry = current(key, now) ?? { count: 0, resetAt: now + WINDOW_MS };
    entry.count += 1;
    failures.set(key, entry);
  }
}

export function recordSuccess(ip, email) {
  failures.delete(accountKey(ip, email));
}

// Forget windows that have run out, so the map cannot grow for ever. unref() stops this timer
// from keeping the server running on its own.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(key);
  }
}, WINDOW_MS).unref();
