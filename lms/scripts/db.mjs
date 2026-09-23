#!/usr/bin/env node
//
// Database command line tool.
//
//   node scripts/db.mjs setup     reset, schema, then seed  (a fresh database)
//   node scripts/db.mjs reset     drop every table
//   node scripts/db.mjs schema    apply database/schema/*.sql in order
//   node scripts/db.mjs seed      apply database/seed/*.sql in order
//   node scripts/db.mjs migrate   apply unapplied database/migrations/*.sql
//   node scripts/db.mjs status    show what exists and what is outstanding
//
// Reached through npm: `npm run db:setup`, `npm run db:migrate`, and so on.
//
// This is the one part of the project that does not use the pool in
// server/db/pool.js. It needs two things the pool deliberately does not give
// it: a connection made before the database exists, and multipleStatements,
// which is switched off for the application because it widens the blast
// radius of an injection. Application code keeps using the pool.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

import { config } from "../server/config.js";

const databaseDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "database",
);

/** Every .sql file in a directory, in filename order — hence the numbering. */
async function sqlFiles(dir) {
  const entries = await readdir(path.join(databaseDir, dir)).catch(() => []);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function connect() {
  // No `database` yet: it may not exist. Created, then selected, below.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${config.db.database}\``);
  return connection;
}

/** Run one .sql file and say so. */
async function runFile(connection, relativePath) {
  const sql = await readFile(path.join(databaseDir, relativePath), "utf8");
  await connection.query(sql);
  console.log(`  applied  ${relativePath}`);
}

async function runDirectory(connection, dir) {
  const files = await sqlFiles(dir);
  if (files.length === 0) {
    console.log(`  (nothing in ${dir}/)`);
    return;
  }
  for (const file of files) {
    await runFile(connection, path.join(dir, file));
  }
}

// --- migrations ------------------------------------------------------------
//
// A migration is applied once and never edited afterwards; the ledger below is
// what makes that stick. The schema/ files stay the description of the current
// structure, so a migration that changes a table is written alongside an edit
// to the matching schema file.

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (filename)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci`;

async function pendingMigrations(connection) {
  await connection.query(LEDGER);
  const [rows] = await connection.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.filename));
  const files = await sqlFiles("migrations");
  return files.filter((file) => !applied.has(file));
}

/**
 * Record every migration as applied without running any of them.
 *
 * A database built from schema/ already has the current structure, migrations
 * included — the schema files describe where things ended up, not how they got
 * there. Without this, a fresh `setup` would leave an empty ledger and the next
 * `migrate` would try to apply changes that are already present.
 */
async function baseline(connection) {
  const files = await sqlFiles("migrations");
  await connection.query(LEDGER);
  for (const file of files) {
    await connection.execute(
      "INSERT IGNORE INTO schema_migrations (filename) VALUES (?)",
      [file],
    );
  }
  if (files.length > 0) {
    console.log(`  baselined ${files.length} migration(s) as already applied`);
  }
}

async function migrate(connection) {
  const pending = await pendingMigrations(connection);
  if (pending.length === 0) {
    console.log("  no migrations to apply");
    return;
  }
  for (const file of pending) {
    await runFile(connection, path.join("migrations", file));
    await connection.execute(
      "INSERT INTO schema_migrations (filename) VALUES (?)",
      [file],
    );
  }
}

async function status(connection) {
  // schema_migrations is the tool's own bookkeeping, not part of the schema,
  // so it is left out of the count people compare against schema/.
  const [tables] = await connection.query("SHOW TABLES");
  const count = tables
    .map((row) => Object.values(row)[0])
    .filter((name) => name !== "schema_migrations").length;

  const [[{ roles }]] = await connection.query(
    "SELECT COUNT(*) AS roles FROM roles",
  ).catch(() => [[{ roles: 0 }]]);

  console.log(`  database  ${config.db.database} on ${config.db.host}:${config.db.port}`);
  console.log(`  tables    ${count}`);
  console.log(`  roles     ${roles} seeded`);

  const pending = await pendingMigrations(connection);
  console.log(
    pending.length === 0
      ? "  migrations up to date"
      : `  migrations ${pending.length} pending: ${pending.join(", ")}`,
  );
}

// --- entry point -----------------------------------------------------------

const commands = {
  reset: (c) => runFile(c, "reset.sql"),
  schema: (c) => runDirectory(c, "schema"),
  seed: (c) => runDirectory(c, "seed"),
  migrate,
  status,
  async setup(c) {
    await runFile(c, "reset.sql");
    await runDirectory(c, "schema");
    await runDirectory(c, "seed");
    await baseline(c);
  },
};

const command = process.argv[2];

if (!command || !(command in commands)) {
  console.error(`Usage: node scripts/db.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}

const connection = await connect();
try {
  console.log(`db ${command} → ${config.db.database}`);
  await commands[command](connection);
  console.log("done");
} catch (error) {
  console.error(`\nfailed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
