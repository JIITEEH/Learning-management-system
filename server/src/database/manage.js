// The database command line tool, reached through npm from the top of the project:
//
//   npm run db:setup     drop everything, then build the schema and seed it (a fresh database)
//   npm run db:reset     drop every table
//   npm run db:schema    apply schema/*.sql in order
//   npm run db:seed      apply seed/*.sql in order
//   npm run db:migrate   apply migrations/*.sql not yet applied
//   npm run db:status    what exists, and what is outstanding
//
// This is the only code that does not use the shared pool in index.js. It needs two things the
// pool deliberately lacks: a connection made before the database exists, and multipleStatements
// (running a whole .sql file in one call). The app keeps that switched off, because it makes an
// SQL injection far more damaging.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import config from '../config/index.js';

// This folder: schema/, seed/, migrations/ and reset.sql sit next to this file
const databaseDir = path.dirname(fileURLToPath(import.meta.url));

// Every .sql file in a folder, in filename order. The number prefix (01_, 02_) is the apply order.
async function sqlFiles(folder) {
  const names = await readdir(path.join(databaseDir, folder)).catch(() => []);
  return names.filter((name) => name.endsWith('.sql')).sort();
}

async function connect() {
  // Connect without choosing a database, because it may not exist yet; create it, then select it
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${config.db.database}\``);
  return connection;
}

async function runFile(connection, relativePath) {
  const sql = await readFile(path.join(databaseDir, relativePath), 'utf8');
  await connection.query(sql);
  console.log(`  applied  ${relativePath}`);
}

async function runFolder(connection, folder) {
  const files = await sqlFiles(folder);
  if (files.length === 0) console.log(`  (nothing in ${folder}/)`);
  for (const file of files) await runFile(connection, path.join(folder, file));
}

// --- Migrations -------------------------------------------------------------------------------
// A migration changes a database that already holds real data. Each one is applied once and
// recorded in schema_migrations, which is how `migrate` knows what is left to do.

const CREATE_LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (filename)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`;

async function pendingMigrations(connection) {
  await connection.query(CREATE_LEDGER);
  const [rows] = await connection.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));
  return (await sqlFiles('migrations')).filter((file) => !applied.has(file));
}

// Marks every migration as applied without running it. A database freshly built from schema/
// already has the current structure, so running old migrations on it would fail.
async function markAllMigrationsApplied(connection) {
  const files = await sqlFiles('migrations');
  await connection.query(CREATE_LEDGER);
  for (const file of files) {
    await connection.execute('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
  }
  if (files.length > 0) console.log(`  marked ${files.length} migration(s) as already applied`);
}

async function migrate(connection) {
  const pending = await pendingMigrations(connection);
  if (pending.length === 0) console.log('  no migrations to apply');
  for (const file of pending) {
    await runFile(connection, path.join('migrations', file));
    await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
  }
}

async function status(connection) {
  const [tables] = await connection.query('SHOW TABLES');
  // schema_migrations is this tool's own bookkeeping, not part of the app's schema
  const tableCount = tables.map((row) => Object.values(row)[0]).filter((name) => name !== 'schema_migrations').length;
  const [[{ roles }]] = await connection
    .query('SELECT COUNT(*) AS roles FROM roles')
    .catch(() => [[{ roles: 0 }]]);
  const pending = await pendingMigrations(connection);

  console.log(`  database   ${config.db.database} on ${config.db.host}:${config.db.port}`);
  console.log(`  tables     ${tableCount}`);
  console.log(`  roles      ${roles} seeded`);
  console.log(pending.length === 0 ? '  migrations up to date' : `  migrations ${pending.length} pending: ${pending.join(', ')}`);
}

const commands = {
  reset: (connection) => runFile(connection, 'reset.sql'),
  schema: (connection) => runFolder(connection, 'schema'),
  seed: (connection) => runFolder(connection, 'seed'),
  migrate,
  status,
  async setup(connection) {
    await runFile(connection, 'reset.sql');
    await runFolder(connection, 'schema');
    await runFolder(connection, 'seed');
    await markAllMigrationsApplied(connection);
  },
};

const command = process.argv[2];
if (!(command in commands)) {
  console.error(`Usage: npm run db:<${Object.keys(commands).join('|')}>`);
  process.exit(1);
}

const connection = await connect();
try {
  console.log(`db ${command} → ${config.db.database}`);
  await commands[command](connection);
  console.log('done');
} catch (error) {
  console.error(`\nfailed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
