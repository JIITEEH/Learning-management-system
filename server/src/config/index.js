// Every setting the server reads from the environment, read once, here. No other file touches
// process.env. The values come from the .env file at the top of the project: the npm scripts
// start Node with --env-file-if-exists=../.env, so nothing needs importing to load it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The server/ folder, so relative paths work whatever directory the server is started from
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const port = Number(process.env.PORT) || 3000;

// TRUST_PROXY says how far to believe the X-Forwarded-For header a proxy such as nginx adds.
// Behind a proxy every request arrives from the proxy's own address, so without this the app
// would see one visitor for the whole school, and never see HTTPS.
//   unset       no proxy (development)
//   1, 2, ...   that many proxies in front of the app
//   other text  passed to Express as is, e.g. 'loopback'
// 'true' is refused: it believes the header from anyone, so a visitor could claim a new address
// on every request and slip past the sign-in limit.
function parseTrustProxy(value = '') {
  const setting = value.trim();
  if (setting === '' || setting === 'false') return false;
  if (setting === 'true') {
    throw new Error('TRUST_PROXY=true would let anyone fake their address; use 1 for one proxy');
  }
  return /^\d+$/.test(setting) ? Number(setting) : setting;
}

// The key that signs the session cookie. Whoever knows it can forge a cookie that says
// "signed in as" anyone, so in production the server refuses to start without a real one.
// On a laptop a placeholder is fine, so a fresh checkout runs without setup.
function readSessionSecret(value) {
  if (!isProduction) return value || 'change-me';
  if (!value || value === 'change-me' || value.length < 32) {
    throw new Error('SESSION_SECRET must be a random string of at least 32 characters in production');
  }
  return value;
}

const config = {
  env,
  isProduction,
  port,
  sessionSecret: readSessionSecret(process.env.SESSION_SECRET),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // Where links in emails point. Never taken from the request's Host header, which the visitor
  // controls: a forged one would send password reset links to someone else's site.
  appUrl: (process.env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads'),
  // Outgoing email. With no SMTP_HOST, messages are printed in the terminal instead.
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'LearnHub <no-reply@localhost>',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms',
  },
};

export default config;
