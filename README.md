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
├── ROADMAP.md                  # The build plan, step by step
├── package.json
├── eslint.config.mjs
├── .env.example                # Copy to .env and fill in
├── database/                   # See database/README.md
│   ├── reset.sql               # Drops every table
│   ├── schema/                 # Structure, one file per domain
│   ├── seed/                   # Roles and permission codes
│   └── migrations/             # Dated changes, once there is real data
├── scripts/db.mjs              # npm run db:setup, db:migrate, db:status
├── server/
│   ├── server.js               # Express entry point
│   ├── config.js               # Environment settings, read once
│   ├── db/
│   │   ├── pool.js             # MySQL pool + query helpers
│   │   └── repositories/       # Every SQL statement in the app, by domain
│   ├── middleware/
│   │   ├── auth.js             # Sessions, permission checks
│   │   ├── upload.js           # Multer storage, type and size limits
│   │   └── errors.js           # 404 and error handling
│   └── routes/                 # JSON API, one module per resource
│       ├── auth.js             users.js     roles.js
│       ├── permissions.js      courses.js   lessons.js
│       ├── enrollments.js      assignments.js
│       └── files.js            schedules.js
├── storage/uploads/            # Uploaded bytes — gitignored
└── public/                     # Everything served to the browser
    ├── index.html
    ├── pages/                  # login, dashboard, courses, lesson,
    │                           # users, roles, schedule, files, admin …
    └── assets/                 # css, js, img
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

Requires Node 22.13+ and a MySQL 8 server.

```sh
npm install
cp .env.example .env        # then fill in your database credentials

npm run db:setup            # creates the database, schema, then seed
npm run dev                 # http://localhost:3000
```

`npm run dev` uses Node's own `--watch`, so edits to the server restart it.
Pages under `public/` are served as authored and need no restart, but there is
no hot reload either — reload the browser yourself. The server boots without a
database, but any route that touches one will fail until MySQL is up and
`db:setup` has run. `npm run db:status` says what the database currently holds.

"Forgot password" sends its link by email. Without a mail server in `.env`,
the link is printed in the terminal running `npm run dev` instead, which is
enough on your own computer. To send real email, fill in the `SMTP_` lines;
`.env.example` explains how to use a Gmail app password.

## Status

Accounts work end to end: registering, signing in and out, changing a
password, resetting a forgotten one by email, the role and permission routes, and the account lifecycle an
administrator moves through. Every SQL statement behind them lives in
`server/db/repositories/`.

Courses and enrollments are implemented too. Four route modules are still
stubs answering `501 Not Implemented`: `lessons`, `assignments`, `files`, and
`schedules`.

In the browser, the way in is built: the front page, signing in, registering,
the account page with its change-password form, and a styled 404. The bar
across the top of a signed-in page is drawn by `public/assets/js/shell.js`
from the account's own permissions, so it is written once rather than copied
into every file, and a link nobody may follow is never shown. The dashboard
carries that bar over placeholder cards, which stay as dashes until there is
something real to count.

The administrator screens are built too. `users.html` lists every account,
approves or suspends one, changes its role, and sets per-account exceptions
to what the role allows. `roles.html` creates, edits and deletes roles and
chooses their permissions. `admin.html` links to both, with counts. Each
screen switches off the controls the viewer's permissions do not cover; the
server checks the same permissions again on every request.

`courses.html` lists the courses an account teaches or takes (every course,
for an administrator), lets a student join one with a code, and lets an
instructor create one. `course.html` shows one course in tabs; its Overview
and People tabs work, and the rest wait for later steps.

Still empty shells with a blank `<body>`: `lesson`, `assignments`,
`schedule`, and `files`. Modules and lessons come next, per
[ROADMAP.md](ROADMAP.md).
