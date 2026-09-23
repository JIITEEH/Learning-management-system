# Build roadmap

Adapted from the LearnHub build roadmap. The roadmap was written for
ThesisTrack's stack — React, Vite, and SQLite. This project keeps the stack
described in [PRODUCT.md](PRODUCT.md): plain HTML with no build step, Express,
MySQL, and server-side sessions. The **order** of the steps and the features
in them carry over unchanged; only the tooling differs.

Where a roadmap task named a React or SQLite artefact, the equivalent for this
stack is given instead. Nothing is dropped silently — a task that does not
apply says so and says why.

## Scope of the first version

Everything here must work before anything in "Later" is started.

| # | Capability | Roadmap step |
|---|------------|--------------|
| 1 | Register, sign in and out, change a password | 3 |
| 2 | Roles and permission codes, with per-account overrides | 3 |
| 3 | An account lifecycle an administrator moves through | 3 |
| 4 | Shared page shell, navigation per role, design tokens | 4 |
| 5 | Instructors create courses; students join with a code | 5 |
| 6 | Modules and lessons, with uploaded files and progress | 6 |
| 7 | Assignments with due dates, and file submissions | 7 |
| 8 | Grading with feedback, and a gradebook that exports to CSV | 8 |
| 9 | Announcements, and a dashboard per role | 9 |
| 10 | Tests covering every permission rule | 12 |
| 11 | Deployed over HTTPS with a restorable backup | 13 |

## Later

Held back deliberately. Nothing above depends on any of it, and each can be
added to a working system. New ideas go on this list rather than into the
build.

- Quizzes with server-side auto-grading (roadmap step 10 — the largest
  single feature, and the one with no equivalent in ThesisTrack)
- Notifications and a deadline calendar (roadmap step 11)
- Discussion forums
- Parent accounts
- Analytics and charts
- Live chat or video class
- Mobile app
- Certificates on completion

## The steps

Status is one of: **done**, **partly done**, **to do**.

### Foundation

| # | Step | Status | Notes for this stack |
|---|------|--------|----------------------|
| 1 | Plan and set up the project | **partly done** | Repo, Express server, `/api/health`, `.env` and `config.js` exist. No React or Vite: the pages are served as authored. |
| 2 | Design the database | **done** | `database/schema.sql` is the single source of truth, not numbered migrations. 14 tables, covering courses through submissions. |
| 3 | Accounts, sign-in and roles | **done** | Sessions are server-side via `express-session`, not a token with a `token_version`. Permissions are read per request. |
| 4 | Page shell and design system | **to do** | Design tokens live in the `:root` block of `styles.css`. Pages are HTML files under `public/pages/`, not lazy-loaded routes. |

### Core learning features

| # | Step | Status |
|---|------|--------|
| 5 | Courses and enrollment | **to do** |
| 6 | Modules and lessons | **to do** |
| 7 | Assignments and submissions | **to do** |
| 8 | Grading and gradebook | **to do** |
| 9 | Announcements and dashboards | **to do** |

### Launch

| # | Step | Status | Notes for this stack |
|---|------|--------|----------------------|
| 12 | Testing and security review | **to do** | There is no test framework yet; choosing one is part of this step. |
| 13 | Deploy and launch | **to do** | MySQL replaces SQLite, so the backup step is `mysqldump`, not `VACUUM INTO`. |

Step 10 (quizzes) and step 11 (notifications and calendar) are held on the
Later list above. The roadmap marks both as "Next" rather than MVP.

## Screens

The HTML files already exist under `public/pages/` as empty shells — a head
with the shared stylesheet and `main.js`, and an empty body. This is the
inventory, and which step fills each one.

| Page | For | Filled in step |
|------|-----|----------------|
| `index.html` | Everyone | 4 |
| `login.html`, `register.html` | Signed out | 4 |
| `account.html` | Every signed-in account | 4 |
| `dashboard.html` | Every role, different content | 9 |
| `courses.html` | Students and instructors | 5 |
| `course.html` | One course, tabbed | 5 |
| `lesson.html` | A lesson and its files | 6 |
| `assignments.html` | Assignments and submissions | 7 |
| `schedule.html` | Weekly meetings | 5 |
| `files.html` | Uploads the viewer may see | 6 |
| `users.html`, `roles.html`, `admin.html` | Administrators | 4 |
| `404.html` | Everyone | 4 |

A gradebook page is not in the list above and is added in step 8.

## Rules for every step

From the roadmap, and they sit alongside the conventions in
[AGENTS.md](AGENTS.md) rather than replacing them.

- **Check permissions on the server.** Hiding a control is not access
  control. Every request confirms the account is enrolled in, or owns, what
  it is reaching for.
- **Never trust the browser's clock or its answers.** Submission times are
  recorded on the server in UTC.
- **Commit small and often**, with a message saying what changed.
- **Test each role.** After every step, sign in as a student, an instructor
  and an administrator, and try to reach what you should not.
- **Keep secrets out of the code.** They belong in `.env`, which Git ignores.
- **Finish a step before starting the next**: schema, then API, then screen,
  then test, so there is always something that runs.
