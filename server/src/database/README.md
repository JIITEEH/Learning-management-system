# Database

MySQL 8, one database, organised by domain. Everything about the structure of
the data is in this folder — nothing is defined anywhere else. The SQL that
the running app sends lives next door, in `../database-queries/`.

## Layout

```
database/
├── index.js         the connection pool, and the query helpers every model uses
├── manage.js        the npm run db:… commands
├── reset.sql        drops every table, so the schema can be reapplied
├── schema/          the structure, one file per domain, applied in order
│   ├── 01_identity.sql      roles, permissions, users, overrides
│   ├── 02_catalog.sql       courses, modules, lessons
│   ├── 03_enrollment.sql    enrollments, lesson progress
│   ├── 04_assessment.sql    assignments, submissions
│   ├── 05_files.sql         upload metadata
│   └── 06_scheduling.sql    weekly course meetings
├── seed/            structural rows only, applied in order
│   ├── 01_roles.sql
│   ├── 02_permissions.sql
│   └── 03_role_permissions.sql
└── migrations/      dated changes to a database that already holds real data
```

The numbers are the apply order, and they are also the dependency order: a
file may reference tables from a lower-numbered file and never from a higher
one. Each file's header says which ones it depends on.

## Commands

Run from the top of the project. All of them read the connection settings
from `.env` through `server/src/config/index.js`, so they always reach the
same database the server does.

| Command | What it does |
|---------|--------------|
| `npm run db:setup` | Reset, schema, then seed. A fresh development database in one step. |
| `npm run db:schema` | Apply `schema/` in order. |
| `npm run db:seed` | Apply `seed/` in order. |
| `npm run db:reset` | Drop every table. Destroys all data. |
| `npm run db:migrate` | Apply any migration not yet applied. |
| `npm run db:status` | Table count, whether the seed has run, migrations outstanding. |

Starting from nothing:

```sh
cp .env.example .env     # then fill in DB_USER and DB_PASSWORD
npm run db:setup
npm run dev
```

`db:setup` creates the database if it does not exist, so there is no step
before it.

## The rules

**One database, many tables.** Courses, accounts and submissions live
together so that foreign keys hold them consistent, a gradebook query is a
join rather than application code, and a write that touches two domains is one
transaction. The separation this project wants is in the *files* — and, on the
server, in `database-queries/` — not in separate MySQL schemas.

**`schema/` is the source of truth for structure.** Changing a table means
editing the file that defines it. The files describe the current shape of the
database; they are not a history of how it got there.

**`seed/` is structural rows only** — roles and permission codes, the things
the server's own checks assume exist. Real accounts, courses and content are
created through the application, never seeded. This is why there is no demo
data here.

**A new permission needs two edits:** a row in `seed/02_permissions.sql` and a
grant in `seed/03_role_permissions.sql`. A code the server checks for but
never inserted will simply deny everyone.

**Times are UTC.** Every connection from the app runs in UTC (see
`index.js`), so `TIMESTAMP` columns and `NOW()` read and compare in UTC, and
the browser converts to the viewer's local time. A `DATETIME` column is stored
exactly as written, with no conversion, so the app must write it in UTC too —
this matters for `assignments.due_at` when step 7 builds it. The schedule's
`TIME` and `DATE` columns are the exception on purpose: "class at 9:00" means
9:00 at the school, wherever the server runs.

**Adding a table** means adding it to the right `schema/` file, and adding its
`DROP TABLE` to `reset.sql` — otherwise `db:reset` leaves it behind and the
next `db:schema` fails on a table that already exists.

## Migrations

`migrations/` is empty, and stays empty until the database holds data worth
keeping. Before that point, changing a table means editing its `schema/` file
and running `npm run db:setup` again.

Once there is real data, a change needs both: the edit to `schema/` so the
structure stays described in one place, and a migration so existing databases
can be brought forward. Name them so they sort chronologically:

```
migrations/2026-09-23_add_course_visibility.sql
```

They are applied once, in filename order, and recorded in a
`schema_migrations` table that `npm run db:migrate` maintains. An applied
migration is never edited — its effects are already in databases you cannot
reach. Correct it with a new one.
