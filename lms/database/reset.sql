-- Reset
--
-- Drops every table so the schema can be applied to a clean database. This
-- destroys all data and is never run against production -- it exists so that
-- `npm run db:reset` can rebuild a development database from the schema files
-- in one step.
--
-- Foreign key checks are disabled for the duration so the drops do not have
-- to be ordered. A table added to schema/ must be added here too.

SET FOREIGN_KEY_CHECKS = 0;

-- 06 · scheduling
DROP TABLE IF EXISTS schedules;

-- 05 · files
DROP TABLE IF EXISTS files;

-- 04 · assessment
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS assignments;

-- 03 · enrollment
DROP TABLE IF EXISTS lesson_progress;
DROP TABLE IF EXISTS enrollments;

-- 02 · catalog
DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS courses;

-- the migration ledger, rebuilt and re-baselined by `npm run db:setup`
DROP TABLE IF EXISTS schema_migrations;

-- 01 · identity
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;
