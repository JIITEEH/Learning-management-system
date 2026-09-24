import "dotenv/config";

/**
 * How far to believe the X-Forwarded-For and X-Forwarded-Proto headers that
 * a proxy such as nginx adds. Behind one, every request arrives from the
 * proxy's own address, so without this the app sees one visitor for the
 * whole school — and never sees HTTPS, so a secure cookie is never sent.
 *
 *   unset / empty  no proxy (development): ignore the headers
 *   1, 2, …        that many proxies in front of the app
 *   anything else  passed to Express as is, e.g. "loopback" or an address
 *
 * `true` is refused. It would believe the headers from anyone, and a visitor
 * could then claim a fresh address on every request to slip past the
 * sign-in limit.
 */
function readTrustProxy(value = "") {
  const setting = value.trim();
  if (setting === "" || setting === "false") return false;
  if (setting === "true") {
    throw new Error("TRUST_PROXY=true would let anyone fake their address; use 1 for one proxy");
  }
  return /^\d+$/.test(setting) ? Number(setting) : setting;
}

const env = process.env.NODE_ENV ?? "development";
const port = Number(process.env.PORT ?? 3000);

/**
 * The key that signs the session cookie. Anyone who knows it can forge a
 * cookie that says "signed in as" any account, so a server open to the
 * internet refuses to start on the placeholder from .env.example, or with no
 * key at all. On a laptop the placeholder is allowed, so a fresh checkout
 * runs without setup.
 */
function readSessionSecret(value) {
  if (env !== "production") return value || "change-me";
  if (!value || value === "change-me" || value.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters in production",
    );
  }
  return value;
}

export const config = {
  env,
  port,
  sessionSecret: readSessionSecret(process.env.SESSION_SECRET),
  trustProxy: readTrustProxy(process.env.TRUST_PROXY),
  // Where links in emails point. Never taken from the request's Host header,
  // which a visitor controls: a forged one would send reset links elsewhere.
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
  // Outgoing email. With no host set, messages are printed in the terminal
  // instead (see mail.js).
  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "LearnHub <no-reply@localhost>",
  },
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "lms",
  },
};

export const isProduction = config.env === "production";
