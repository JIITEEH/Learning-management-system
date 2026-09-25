// A cap on how often one network address may call a route.
//
// For the routes anyone can reach without signing in — registering, asking
// for a reset email, using a reset link. Each of them costs the server real
// work (scrambling a password takes about a fifth of a second) or sends an
// email, so without a cap one script could keep the server busy, fill the
// approval list with junk accounts, or flood someone's inbox.
//
// Wrong passwords at sign-in have their own, finer rules in loginLimit.js:
// there only failures count, and one account is protected separately.
//
// Like loginLimit.js, the counts live in this process's memory, so a
// restart forgets them.

/**
 * Middleware allowing `max` requests per address in each `minutes` window:
 *   router.post("/forgot", limitPerAddress({ max: 10, minutes: 15 }), handler)
 */
export function limitPerAddress({ max, minutes }) {
  const windowMs = minutes * 60 * 1000;
  /** address -> { count, resetAt } */
  const counts = new Map();

  // Forget windows that have run out, so the map cannot grow for ever.
  setInterval(() => {
    const now = Date.now();
    for (const [address, entry] of counts) {
      if (entry.resetAt <= now) counts.delete(address);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let entry = counts.get(req.ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      counts.set(req.ip, entry);
    }
    entry.count += 1;
    if (entry.count <= max) return next();

    const waitMinutes = Math.ceil((entry.resetAt - now) / 60000);
    res.set('Retry-After', String(waitMinutes * 60));
    res.status(429).json({
      error: `Too many requests. Try again in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`,
    });
  };
}
