# Learning Management System

Courses, lessons, enrolment, assignments, and grading — built on five
foundations carried over from the thesis management system: **accounts**,
**roles**, **permissions**, **file uploads**, and **schedules**.

React (built with Vite) in the browser, Node/Express on the server, MySQL for
storage — the same tools as the thesis management system (ThesisTrack).

## Layout

Arranged like the thesis management system (ThesisTrack), so the two projects
open the same way.

```
.
├── AGENTS.md                   Rules for contributors and AI agents
├── PRODUCT.md                  What this is for, and for whom
├── ROADMAP.md                  The build plan, step by step
├── package.json                npm workspace: one install, one set of commands
├── .env.example                Copy to .env and fill in; .env is gitignored
├── client/                     The screens (React + Vite)
│   ├── index.html
│   ├── vite.config.js          Port 5174, and /api passed on to the server
│   └── src/
│       ├── main.jsx            Starts the app
│       ├── App.jsx             Which screen shows at which address
│       ├── screens/            One file per screen (auth/, admin/ grouped)
│       ├── ui-pieces/          Parts shared by screens: layout, tabs, forms…
│       ├── api-client/api.js   Every call to the server
│       ├── shared-state/       Who is signed in; pop-up messages
│       ├── reusable-logic/     useApi (load data), useSubmit (send a form)
│       ├── helpers/            Turning stored codes and dates into words
│       └── styles/index.css    Every colour, font and spacing value
└── server/
    ├── package.json
    ├── uploads/                Uploaded files — gitignored, never served directly
    └── src/
        ├── index.js            Starts the server
        ├── app.js              Every request's path through the server
        ├── config/             Settings, read once from .env
        ├── api-endpoints/      Which addresses exist, and what guards each one
        ├── request-handlers/   What happens at each address
        ├── database-queries/   Every SQL statement, one model per table
        ├── database/           Connection, schema, seed, and the db: commands
        ├── request-filters/    Sign-in, permissions, limits, headers, uploads, errors
        ├── permission-rules/   Who may reach a given course
        └── helpers/            HttpError, input checks, passwords, email
```

A request travels down that list: `api-endpoints/courseRoutes.js` says
`PATCH /api/courses/:id` needs the `course.update` permission and hands it to
`request-handlers/courseController.js`, which checks this person manages this
course, then calls `database-queries/courseModel.js` to save it.

`server/uploads/` is outside anything the server hands to browsers on purpose:
uploaded files are only ever streamed after an access check.

## Permissions

Access is permission-based rather than role-based. A role holds a set of codes
(`course.create`, `submission.grade`, `schedule.manage`, …), and routes are
gated on the code, not the role:

```js
router.post('/', requirePermission('course.create'), createCourse);
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
npm run dev                 # open http://localhost:5174
```

`npm run dev` starts two programs side by side, as in ThesisTrack: the server
on port 3000, and Vite on port 5174, which shows the screens and updates them
the moment a file is saved. Vite passes every `/api` request on to the
server. Port 5174 rather than ThesisTrack's 5173, so both can run at once.
Opening a page on 3000 during development sends you on to 5174.

The server restarts itself when a server file is saved. It boots without a
database, but anything that touches one fails until MySQL is up and
`db:setup` has run. `npm run db:status` says what the database holds.

For a real deployment, `npm run build` turns the screens into plain files in
`client/dist/`, and `npm start` serves them and the API together from port
3000. While `client/dist/` exists, port 3000 serves that build even during
development, so delete it when you are done checking a build.

"Forgot password" sends its link by email. Without a mail server in `.env`,
the link is printed in the terminal running `npm run dev` instead, which is
enough on your own computer. To send real email, fill in the `SMTP_` lines;
`.env.example` explains how to use a Gmail app password. Set `APP_URL` to the
address people open the site at, since the link in the email points there.

## Status

Accounts work end to end: registering, signing in and out, changing a
password, resetting a forgotten one by email, and the approve / suspend
lifecycle an administrator moves an account through. Roles and permissions,
with per-account exceptions, are managed from the Administration screens.

Courses and enrollments work: instructors create, publish and archive
courses; students join with a code; the course's People tab manages who is
enrolled. Lessons, assignments, files and schedules have their tables but no
endpoints or screens yet. Modules and lessons come next, per
[ROADMAP.md](ROADMAP.md).

The dashboard shows placeholder cards, which stay as dashes until roadmap
step 9 gives them something real to count.
