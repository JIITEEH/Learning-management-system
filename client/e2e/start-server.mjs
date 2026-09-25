// Starts LearnHub for the browser tests: the built screens (client/dist) and the API on their own
// port, over a freshly built database of their own with one account per role. The real database
// and uploads are never touched, and email is off. Playwright starts this before the tests and
// stops it afterwards.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNTS, DATABASE, PASSWORD, PORT } from './settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverDir = path.join(root, 'server');
// One fixed folder, emptied at the start of every run: Playwright may stop this script too abruptly
// for it to clean up after itself, so the next run does it instead
const tempDir = path.join(os.tmpdir(), 'lms-e2e');
fs.rmSync(tempDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });

// Only the database connection comes from .env (on GitHub it comes from the workflow instead).
// Everything else is fixed here, so real mail settings can never be used by a test.
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  APP_URL: `http://localhost:${PORT}`,
  DB_NAME: DATABASE,
  UPLOAD_DIR: path.join(tempDir, 'uploads'),
  SESSION_SECRET: 'e2e-only-secret',
  SMTP_HOST: '',
  TRUST_PROXY: '',
};
if (!fs.existsSync(path.join(root, 'client/dist/index.html'))) {
  console.error('client/dist is missing: run `npm run test:e2e` from the top of the project, which builds it first.');
  process.exit(1);
}

const run = (args) => spawnSync(process.execPath, args, { cwd: serverDir, env, stdio: 'inherit' });

// Build the database, then add one active account per role
if (run(['src/database/manage.js', 'setup']).status !== 0) process.exit(1);
const makeAccounts = `
  const { hashPassword } = await import('./src/helpers/password.js');
  const User = await import('./src/database-queries/userModel.js');
  const Role = await import('./src/database-queries/roleModel.js');
  const { pool } = await import('./src/database/index.js');
  const accounts = ${JSON.stringify(ACCOUNTS)};
  const passwordHash = await hashPassword(${JSON.stringify(PASSWORD)});
  for (const [key, account] of Object.entries(accounts)) {
    const role = await Role.findByName(key === 'classmate' ? 'student' : key);
    await User.create({ ...account, passwordHash, roleId: role.id, status: 'active' });
  }
  await pool.end();
`;
if (run(['--input-type=module', '-e', makeAccounts]).status !== 0) process.exit(1);

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill());
server.on('exit', (code) => process.exit(code ?? 0));
