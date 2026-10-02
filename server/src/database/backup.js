// Copies the database and the uploaded files into a dated folder, and deletes backups older than
// the retention window. The same tool as the thesis management system's, with MySQL's own
// mysqldump in place of SQLite's VACUUM INTO.
//
// Run from the top of the project:
//   npm run db:backup                              make a backup, then prune old ones
//   npm run db:backup -- --list                    show what is stored
//   npm run db:backup -- --restore <folder>        put a backup back
//
// Each backup is one folder holding everything needed to bring the system back:
//
//   server/backups/2026-10-02T17-30-45/
//     database.sql    every table and row, written by mysqldump
//     uploads/        every uploaded file
//     manifest.json   what was in it, for checking a backup before trusting it
//
// mysqldump and mysql (the command line client) come with MySQL itself.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import config from '../config/index.js';

const COUNTED_TABLES = ['users', 'courses', 'enrollments', 'assignments', 'submissions', 'files'];

// Sortable, filename-safe, and readable: 2026-10-02T17-30-45
export function backupName(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/:/g, '-');
}

function folderSize(dir) {
  if (!fs.existsSync(dir)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += fs.statSync(path.join(entry.parentPath, entry.name)).size;
  }
  return { files, bytes };
}

// mysqldump and mysql read the password from a small settings file that only this account can
// read, deleted straight afterwards. On the command line it would be visible to every other
// program on the machine for as long as the command runs.
function withLoginFile(db, work) {
  const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-backup-'));
  const file = path.join(dir, 'login.cnf');
  fs.writeFileSync(
    file,
    `[client]\nhost=${quote(db.host)}\nport=${db.port}\nuser=${quote(db.user)}\npassword=${quote(db.password)}\n`,
    { mode: 0o600 },
  );
  try {
    return work(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Runs mysqldump or mysql, with standard input or output connected to a file
function runTool(tool, args, { input, output }) {
  const inFd = input ? fs.openSync(input, 'r') : 'ignore';
  const outFd = output ? fs.openSync(output, 'w') : 'ignore';
  try {
    const result = spawnSync(tool, args, { stdio: [inFd, outFd, 'pipe'], encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') {
      throw new Error(`${tool} was not found. It comes with MySQL; make sure MySQL's bin folder is on your PATH.`);
    }
    if (result.status !== 0) {
      throw new Error(`${tool} failed: ${(result.stderr || `exit code ${result.status}`).trim().split('\n').at(-1)}`);
    }
  } finally {
    if (typeof inFd === 'number') fs.closeSync(inFd);
    if (typeof outFd === 'number') fs.closeSync(outFd);
  }
}

// --protocol=TCP so the tools reach the same server the app does, even when 'localhost' would
// otherwise make them use a local socket file
const toolArgs = (loginFile) => [`--defaults-extra-file=${loginFile}`, '--protocol=TCP', '--default-character-set=utf8mb4'];

// The first free folder name: two backups in the same second get -2, -3 rather than failing
function freeFolder(backupDir, name) {
  const base = path.join(backupDir, name);
  let folder = base;
  for (let attempt = 2; fs.existsSync(folder); attempt += 1) folder = `${base}-${attempt}`;
  return folder;
}

// `label` is added to the folder name, e.g. "before-restore"
export async function createBackup({
  db = config.db,
  uploadDir = config.uploadDir,
  backupDir = config.backupDir,
  date = new Date(),
  label = '',
} = {}) {
  const folder = freeFolder(backupDir, label ? `${backupName(date)}-${label}` : backupName(date));
  fs.mkdirSync(folder, { recursive: true });

  // --single-transaction reads every table as it was at one moment, without stopping the app:
  // a consistent copy even while people are using the site
  const dumpFile = path.join(folder, 'database.sql');
  try {
    withLoginFile(db, (loginFile) =>
      runTool('mysqldump', [...toolArgs(loginFile), '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', db.database], {
        output: dumpFile,
      }),
    );
  } catch (error) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw error;
  }

  const connection = await mysql.createConnection({ ...db });
  const tables = {};
  try {
    for (const table of COUNTED_TABLES) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
      tables[table] = Number(row.n);
    }
  } finally {
    await connection.end();
  }

  const uploadsTarget = path.join(folder, 'uploads');
  if (fs.existsSync(uploadDir)) fs.cpSync(uploadDir, uploadsTarget, { recursive: true });
  else fs.mkdirSync(uploadsTarget, { recursive: true });

  const manifest = {
    createdAt: date.toISOString(),
    database: db.database,
    tables,
    uploads: folderSize(uploadsTarget),
    databaseBytes: fs.statSync(dumpFile).size,
  };
  fs.writeFileSync(path.join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { folder, manifest };
}

export function listBackups(backupDir = config.backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(backupDir, entry.name, 'database.sql')))
    .map((entry) => {
      const folder = path.join(backupDir, entry.name);
      let manifest = null;
      try {
        manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
      } catch {
        // A backup without a readable manifest is still a backup
      }
      return { name: entry.name, folder, manifest, createdAt: manifest?.createdAt ?? fs.statSync(folder).mtime.toISOString() };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Deletes backups older than the retention window, but never the newest one: an old backup is
// better than none if backups have silently stopped running.
export function pruneBackups({ backupDir = config.backupDir, keepDays = config.backupKeepDays, now = new Date() } = {}) {
  const backups = listBackups(backupDir);
  if (backups.length <= 1) return [];
  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const backup of backups.slice(0, -1)) {
    if (new Date(backup.createdAt).getTime() >= cutoff) continue;
    fs.rmSync(backup.folder, { recursive: true, force: true });
    removed.push(backup.name);
  }
  return removed;
}

// Finds the folder someone typed after --restore: a path from where they typed it (npm passes
// that folder as INIT_CWD), or just a backup's name, looked up in the backup folder
export function resolveBackupFolder(target, { typedFrom = process.env.INIT_CWD || process.cwd(), backupDir = config.backupDir } = {}) {
  const candidates = [path.resolve(typedFrom, target), path.join(backupDir, path.basename(target))];
  return candidates.find((folder) => fs.existsSync(path.join(folder, 'database.sql'))) ?? candidates[0];
}

// Puts a backup back. The current database and uploads are backed up first, into a folder
// ending "-before-restore", so a restore of the wrong backup can itself be undone.
export async function restoreBackup(folder, {
  db = config.db,
  uploadDir = config.uploadDir,
  backupDir = config.backupDir,
  date = new Date(),
} = {}) {
  const dumpFile = path.join(folder, 'database.sql');
  if (!fs.existsSync(dumpFile)) throw new Error(`${folder} does not look like a backup: no database.sql inside it.`);

  const safety = await createBackup({ db, uploadDir, backupDir, date, label: 'before-restore' });

  // Empty the database first. The dump replaces the tables it holds, but a table added since the
  // backup was made would otherwise survive, out of step with everything around it.
  const connection = await mysql.createConnection({ ...db });
  try {
    const [rows] = await connection.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?',
      [db.database],
    );
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { name } of rows) await connection.query(`DROP TABLE \`${name}\``);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }
  withLoginFile(db, (loginFile) => runTool('mysql', [...toolArgs(loginFile), db.database], { input: dumpFile }));

  fs.rmSync(uploadDir, { recursive: true, force: true });
  const backupUploads = path.join(folder, 'uploads');
  if (fs.existsSync(backupUploads)) fs.cpSync(backupUploads, uploadDir, { recursive: true });
  else fs.mkdirSync(uploadDir, { recursive: true });

  return { restoredFrom: folder, safetyBackup: safety.folder };
}

// Copies one backup folder off the machine with rclone, which talks to Google Drive, Backblaze
// B2, Dropbox and most other storage. Local backups survive a mistake or a damaged file; only an
// off-machine copy survives losing the machine itself.
// `run` can be replaced, so the tests can check the command without rclone installed.
export function syncToRemote({
  folder,
  remote = config.backupRemote,
  run = (command, args) => spawnSync(command, args, { encoding: 'utf8' }),
} = {}) {
  if (!remote) return { skipped: 'no BACKUP_REMOTE set' };
  const destination = `${remote.replace(/\/+$/, '')}/${path.basename(folder)}`;
  const result = run('rclone', ['copy', folder, destination, '--checksum']);
  if (result.error?.code === 'ENOENT') {
    return { failed: 'rclone is not installed, so the backup stayed on this machine', destination };
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().split('\n').at(-1) || `exit code ${result.status}`;
    return { failed: detail, destination };
  }
  return { copiedTo: destination };
}

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--list') {
      const backups = listBackups();
      if (backups.length === 0) {
        console.log(`No backups yet in ${config.backupDir}. Run "npm run db:backup" to make one.`);
      } else {
        console.log(`${backups.length} backup(s) in ${config.backupDir}:\n`);
        for (const { name, manifest } of backups) {
          const counts = manifest?.tables ?? {};
          console.log(
            `  ${name}  ${mb(manifest?.databaseBytes ?? 0)} database, ${manifest?.uploads?.files ?? '?'} file(s)` +
              `  users:${counts.users ?? '?'} courses:${counts.courses ?? '?'} submissions:${counts.submissions ?? '?'}`,
          );
        }
      }
    } else if (args[0] === '--restore') {
      if (!args[1]) {
        console.error('Which backup? Run "npm run db:backup -- --list" to see them, then');
        console.error('  npm run db:backup -- --restore 2026-10-02T17-30-45');
        process.exit(1);
      }
      const { restoredFrom, safetyBackup } = await restoreBackup(resolveBackupFolder(args[1]));
      console.log(`Restored ${config.db.database} from ${restoredFrom}`);
      console.log(`  What was there before is kept in ${safetyBackup}`);
      console.log('  Restart the server so nobody stays signed in to the old data.');
    } else {
      const { folder, manifest } = await createBackup();
      console.log(`Backed up ${manifest.database} to ${folder}`);
      console.log(`  ${mb(manifest.databaseBytes)} database, ${manifest.uploads.files} uploaded file(s), ${mb(manifest.uploads.bytes)}`);
      console.log(`  users: ${manifest.tables.users}, courses: ${manifest.tables.courses}, submissions: ${manifest.tables.submissions}`);

      const removed = pruneBackups();
      if (removed.length > 0) {
        console.log(`  Removed ${removed.length} backup(s) older than ${config.backupKeepDays} days: ${removed.join(', ')}`);
      }
      const sync = syncToRemote({ folder });
      if (sync.copiedTo) {
        console.log(`  Copied off this machine to ${sync.copiedTo}`);
      } else if (sync.failed) {
        // The local backup worked, so this is a warning, not a failure
        console.warn(`  Could not copy off this machine: ${sync.failed}`);
        console.warn('  The backup is safe on this disk, but not if the machine is lost.');
      } else {
        console.log('  Kept on this machine only. Set BACKUP_REMOTE to copy it off.');
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
