// Imported first by every test file. Points the server at a throwaway database and upload folder
// before config/index.js reads its settings, so tests never touch real data. Each test file runs
// in its own process with its own database, so files can run side by side.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-test-'));

process.env.NODE_ENV = 'test';
process.env.DB_NAME = `lms_test_${process.pid}`;
process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.SESSION_SECRET = 'test-only-secret';
// Never send real email from a test, whatever the developer's .env says
process.env.SMTP_HOST = '';
// A value left in the developer's shell must not change what the tests see
delete process.env.TRUST_PROXY;

// Build the database from the schema and seed files, exactly as `npm run db:setup` does
const manage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/database/manage.js');
execFileSync(process.execPath, [manage, 'setup'], { env: process.env, stdio: 'ignore' });
