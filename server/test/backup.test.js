import './setup.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { makeUser, startApi } from './helpers.js';
import config from '../src/config/index.js';
import { query } from '../src/database/index.js';
import { createBackup, listBackups, pruneBackups, restoreBackup, syncToRemote } from '../src/database/backup.js';

const api = await startApi();
const countUsers = async () => Number((await query('SELECT COUNT(*) AS n FROM users'))[0].n);

// The backup tools come with MySQL; a machine with only the server's network port cannot run them
const hasTools = !spawnSync('mysqldump', ['--version']).error;
const needsTools = { skip: hasTools ? false : 'mysqldump is not installed here' };

describe('making and restoring a backup', needsTools, () => {
  it('puts the database and the uploaded files back exactly as they were', async () => {
    await makeUser(api, 'student');
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, 'kept.txt'), 'in the backup');
    const usersBefore = await countUsers();

    const { folder, manifest } = await createBackup();
    assert.ok(fs.existsSync(path.join(folder, 'database.sql')));
    assert.equal(manifest.tables.users, usersBefore);
    assert.equal(manifest.uploads.files, 1);

    // Things that happen after the backup...
    await makeUser(api, 'student');
    fs.writeFileSync(path.join(config.uploadDir, 'later.txt'), 'not in the backup');
    assert.equal(await countUsers(), usersBefore + 1);

    // ...are gone once it is restored, and kept in the backup made just before
    const { safetyBackup } = await restoreBackup(folder);
    assert.equal(await countUsers(), usersBefore);
    assert.deepEqual(fs.readdirSync(config.uploadDir), ['kept.txt']);
    assert.match(path.basename(safetyBackup), /-before-restore$/);
    const safety = JSON.parse(fs.readFileSync(path.join(safetyBackup, 'manifest.json'), 'utf8'));
    assert.equal(safety.tables.users, usersBefore + 1);
  });

  it('gives two backups in the same second different folders', async () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const first = await createBackup({ date });
    const second = await createBackup({ date });
    assert.notEqual(first.folder, second.folder);
  });
});

describe('keeping backups tidy', () => {
  it('deletes backups past the retention window, but never the newest', () => {
    const dir = fs.mkdtempSync(path.join(config.backupDir, '..', 'prune-'));
    const fake = (name, createdAt) => {
      fs.mkdirSync(path.join(dir, name));
      fs.writeFileSync(path.join(dir, name, 'database.sql'), '');
      fs.writeFileSync(path.join(dir, name, 'manifest.json'), JSON.stringify({ createdAt }));
    };
    fake('2026-01-01T00-00-00', '2026-01-01T00:00:00Z');
    fake('2026-01-20T00-00-00', '2026-01-20T00:00:00Z');
    const now = new Date('2026-03-01T00:00:00Z');
    assert.deepEqual(pruneBackups({ backupDir: dir, keepDays: 14, now }), ['2026-01-01T00-00-00']);
    assert.deepEqual(pruneBackups({ backupDir: dir, keepDays: 14, now }), [], 'the last one stays');
    assert.equal(listBackups(dir).length, 1);
  });

  it('copies off the machine only when told where, and says plainly when it cannot', () => {
    assert.ok(syncToRemote({ folder: '/x/2026', remote: '' }).skipped);
    const calls = [];
    const ok = syncToRemote({ folder: '/x/2026', remote: 'gdrive:lms/', run: (cmd, args) => calls.push([cmd, ...args]) && { status: 0 } });
    assert.equal(ok.copiedTo, 'gdrive:lms/2026');
    assert.deepEqual(calls[0], ['rclone', 'copy', '/x/2026', 'gdrive:lms/2026', '--checksum']);
    const missing = syncToRemote({ folder: '/x/2026', remote: 'gdrive:lms', run: () => ({ error: { code: 'ENOENT' } }) });
    assert.match(missing.failed, /rclone is not installed/);
  });
});
