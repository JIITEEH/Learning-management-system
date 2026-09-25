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
- An audit log recording who changed what, such as an administrator
  removing a student from a course (roadmap step 5 asks for it; this
  project's database has no table for it yet)
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
| 1 | Plan and set up the project | **done** | Repo, Express server, `/api/health`, `.env` and `config.js`, with a `TRUST_PROXY` setting for running behind nginx. ESLint 9, and a GitHub Actions workflow on Node 22.13 and 24 that lints, builds the database and boots the server on every push. No React or Vite: the pages are served as authored. |
| 2 | Design the database | **done** | `server/src/database/schema/` is the single source of truth — one file per domain, numbered in dependency order. 15 tables in one database, covering accounts and password resets through submissions. The quiz, announcement and notification tables the roadmap lists are not created yet: announcements arrive with step 9, and quizzes and notifications are on the Later list. `migrations/` stays empty until there is real data. |
| 3 | Accounts, sign-in and roles | **done** | Sessions are server-side via `express-session` in an HttpOnly, SameSite cookie, not a token. `users.session_version` does the job of the roadmap's `token_version`: changing or resetting a password moves it on, which signs out every other device. Status and permissions are read per request, so a suspension or a revoked permission applies on the next click. Wrong passwords are limited per account and per network address. Forgot and reset password by email over SMTP (Gmail, as in ThesisTrack); with no mail server set, the link is printed in the terminal. Email verification on sign-up is replaced by administrator approval: a new account cannot sign in until an administrator makes it active. In production the server refuses to start without a real `SESSION_SECRET`. |
| 4 | Page shell and design system | **done** | Design tokens live in the `:root` block of `styles.css`. Pages are HTML files under `public/pages/`, not lazy-loaded routes. The shared bar is drawn by `assets/js/shell.js` rather than copied into each page, so its links can follow the account's permissions. Signing in, registering, the account page, the front page, `404.html` and the three administrator screens are built. |

### Checked before step 6

Steps 1 to 5 were reviewed against the roadmap's task lists before moving
on. Fixed in that pass: the wrong-password limit, the session secret that
fell back to a public placeholder, a password change that left other
devices signed in, forgot and reset password, text contrast, and layout on
phones and tablets.

Two more were fixed at the end of the pass:

- [x] Instructors no longer hold `user.read`, which let them list every
      account in the system. They see their own students on each course's
      People tab.
- [x] The top bar no longer links to Schedule, Assignments and Files. Each
      link comes back when its page is built.

### Core learning features

| # | Step | Status |
|---|------|--------|
| 5 | Courses and enrollment | **done** |
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
| `index.html` | Everyone | 4 — **built** |
| `login.html`, `register.html` | Signed out | 4 — **built** |
| `account.html` | Every signed-in account | 4 — **built** |
| `dashboard.html` | Every role, different content | 9 |
| `courses.html` | Students and instructors | 5 — **built** |
| `course.html` | One course, tabbed | 5 — **built** (Overview and People; the other tabs wait for steps 6 and 7) |
| `lesson.html` | A lesson and its files | 6 |
| `assignments.html` | Assignments and submissions | 7 |
| `schedule.html` | Weekly meetings | 5 — not built: step 5 in the roadmap does not include schedules, so it follows as its own piece |
| `files.html` | Uploads the viewer may see | 6 |
| `users.html`, `roles.html`, `admin.html` | Administrators | 4 — **built** |
| `404.html` | Everyone | 4 — **built** |

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
