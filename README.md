# Learning Management System

Courses, lessons, enrolment, assignments, and grading — built on five
foundations carried over from the thesis management system: **accounts**,
**roles**, **permissions**, **file uploads**, and **schedules**.

Plain HTML and JavaScript in the browser, Node/Express on the server, MySQL
for storage.

## Layout

```
.
├── AGENTS.md                   # Rules for contributors and AI agents
├── PRODUCT.md                  # What this is for, and for whom
└── lms/
    ├── package.json
    ├── .env.example            # Copy to .env and fill in
    ├── database/
    │   ├── schema.sql          # Tables, keys, constraints
    │   └── seed.sql            # Roles and permission codes
    ├── server/
    │   ├── server.js           # Express entry point
    │   ├── config.js           # Environment settings, read once
    │   ├── db/pool.js          # MySQL pool + query helpers
    │   ├── middleware/
    │   │   ├── auth.js         # Sessions, permission checks
    │   │   ├── upload.js       # Multer storage, type and size limits
    │   │   └── errors.js       # 404 and error handling
    │   └── routes/             # JSON API, one module per resource
    │       ├── auth.js         users.js     roles.js
    │       ├── permissions.js  courses.js   lessons.js
    │       ├── enrollments.js  assignments.js
    │       └── files.js        schedules.js
    ├── storage/uploads/        # Uploaded bytes — gitignored
    └── public/                 # Everything served to the browser
        ├── index.html
        ├── pages/              # login, dashboard, courses, lesson,
        │                       # users, roles, schedule, files, admin …
        └── assets/             # css, js, img
```

Pages in `public/` are served static and call the JSON API under `/api`
through `public/assets/js/api.js`. There is no build step for the browser.

`storage/` sits outside `public/` on purpose — uploaded files are never served
directly, only streamed after an access check.

## Permissions

Access is permission-based rather than role-based. A role holds a set of codes
(`course.create`, `submission.grade`, `schedule.manage`, …), and routes are
gated on the code, not the role:

```js
router.post("/", requirePermission("course.create"), handler);
```

Per-account overrides in `user_permissions` layer on top of the role, and a
`deny` always beats an `allow`. Permissions are read from the database on each
request, so revoking one takes effect immediately instead of at next sign-in.

The three seeded roles are `admin`, `instructor`, and `student`. They are rows,
not an enum — adding a fourth needs no schema change.

## Running it

Requires Node 20+ and a MySQL 8 server.

```sh
cd lms
npm install
cp .env.example .env        # then fill in your database credentials

mysql -u root -p -e "CREATE DATABASE lms"
mysql -u root -p lms < database/schema.sql
mysql -u root -p lms < database/seed.sql

npm run dev                 # http://localhost:3000
```

`npm run dev` uses Node's own `--watch`, so edits to the server restart it.
The server boots without a database, but any route that touches one will fail
until MySQL is up and the schema is loaded.

## Status

Scaffolding only. The schema and the API routing are in place; every route
handler currently answers `501 Not Implemented`, and every page in `public/`
is blank apart from the shared stylesheet. Screens and handlers come next.
