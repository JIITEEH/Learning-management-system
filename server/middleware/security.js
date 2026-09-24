// Protections the browser applies on our behalf.
//
// Both functions run on every request, before any route, and are mounted in
// server.js.

import { config, isProduction } from "../config.js";

/**
 * Where a page may load things from, and who may show it in a frame.
 *
 * Scripts, styles and requests may only come from this server, plus the
 * Google Fonts stylesheet and font files every page links to. So even if
 * someone slipped a <script> into a course title and it escaped escaping,
 * the browser would refuse to run it. `frame-ancestors 'none'` stops another
 * site showing our pages inside an invisible frame and tricking someone into
 * clicking "Delete" on it (clickjacking).
 */
const CONTENT_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(_req, res, next) {
  res.set({
    "Content-Security-Policy": CONTENT_POLICY,
    // The older way of saying frame-ancestors 'none', for older browsers.
    "X-Frame-Options": "DENY",
    // Treat a file as the type the server says it is, never guess. Without
    // this a browser might decide an uploaded .txt is really a web page.
    "X-Content-Type-Options": "nosniff",
    // Other sites are told only that a visitor came from us, not which page.
    "Referrer-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  // Only meaningful over HTTPS, which production is: tells the browser to
  // refuse plain HTTP for this site for the next 180 days.
  if (isProduction) res.set("Strict-Transport-Security", "max-age=15552000");
  next();
}

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuse a request that changes something when it was sent by another
 * website (cross-site request forgery).
 *
 * The browser attaches our session cookie to requests wherever they come
 * from, within limits. SameSite=Lax on the cookie keeps out other domains,
 * but not other sites on the same domain — another app on localhost, or
 * another school subdomain. The browser also stamps every such request with
 * an Origin header naming the page that sent it, which a page cannot forge,
 * so a mismatch is refused.
 *
 * A request with no Origin at all is let through: that is a tool such as
 * curl, which has no session cookie to abuse unless it was handed one.
 */
export function sameOriginOnly(req, res, next) {
  if (READ_ONLY.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  // Our own address, as the visitor sees it. Behind nginx this is the
  // forwarded Host; APP_URL is accepted too, in case the proxy rewrites it.
  const ours = `${req.protocol}://${req.get("host")}`;
  if (origin === ours || origin === config.appUrl) return next();

  res.status(403).json({ error: "Requests from other websites are not accepted" });
}
