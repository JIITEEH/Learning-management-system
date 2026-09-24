import "dotenv/config";

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

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

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  sessionSecret: required("SESSION_SECRET", "change-me"),
  trustProxy: readTrustProxy(process.env.TRUST_PROXY),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "lms",
  },
};

export const isProduction = config.env === "production";
