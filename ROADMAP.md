# Build roadmap

Adapted from the LearnHub build roadmap. The roadmap was written for
ThesisTrack's stack — React, Vite, and SQLite. This project uses the same
React and Vite front end and the same Express server layout, but keeps MySQL
and server-side sessions (see [PRODUCT.md](PRODUCT.md)). The **order** of the
steps and the features in them carry over unchanged.

Where a roadmap task named an SQLite or token-based artefact, the equivalent
for this stack is given instead. Nothing is dropped silently — a task that does not
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
- Downloading every submission for an assignment as one zip (considered in
  step 7 and left out: it needs an extra library)

## The steps

Status is one of: **done**, **partly done**, **to do**.

### Foundation

| # | Step | Status | Notes for this stack |
|---|------|--------|----------------------|
| 1 | Plan and set up the project | **done** | Repo, Express server, `/api/health`, `.env` and `config.js`, with a `TRUST_PROXY` setting for running behind nginx. ESLint 9, and a GitHub Actions workflow on Node 22.13 and 24 that lints, builds the database and boots the server on every push. React and Vite in `client/`, started together with the server by `npm run dev`. |
| 2 | Design the database | **done** | `server/src/database/schema/` is the single source of truth — one file per domain, numbered in dependency order. 15 tables in one database, covering accounts and password resets through submissions. The quiz, announcement and notification tables the roadmap lists are not created yet: announcements arrive with step 9, and quizzes and notifications are on the Later list. `migrations/` stays empty until there is real data. |
| 3 | Accounts, sign-in and roles | **done** | Sessions are server-side via `express-session` in an HttpOnly, SameSite cookie, not a token. `users.session_version` does the job of the roadmap's `token_version`: changing or resetting a password moves it on, which signs out every other device. Status and permissions are read per request, so a suspension or a revoked permission applies on the next click. Wrong passwords are limited per account and per network address. Forgot and reset password by email over SMTP (Gmail, as in ThesisTrack); with no mail server set, the link is printed in the terminal. Email verification on sign-up is replaced by administrator approval: a new account cannot sign in until an administrator makes it active. In production the server refuses to start without a real `SESSION_SECRET`. |
| 4 | Page shell and design system | **done** | Design tokens live in the `:root` block of `client/src/styles/index.css`. Screens are React components under `client/src/screens/`; the course and administrator screens load on demand. The shared bar is `ui-pieces/layout/AppLayout.jsx`, and its links follow the account's permissions. Signing in, registering, password reset, the account screen, the front page, the 404 screen and the three administrator screens are built. |

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
| 6 | Modules and lessons | **done** |
| 7 | Assignments and submissions | **done** |
| 8 | Grading and gradebook | **done** |
| 9 | Announcements and dashboards | **to do** |

### Step 6 as built

Instructors add, rename, reorder (up / down buttons) and delete modules and
lessons, write lesson text and attach files. Lesson text is plain text: a
blank line starts a paragraph and web addresses become links, and nothing
typed can run as code. Students open lessons, download files, mark lessons
done, and see a progress bar on the course's Lessons tab.

Uploads are checked before anything reaches disk, a refused upload leaves
nothing behind, and deleting a lesson, module or course deletes its files.
While building it, MySQL 26.7.0 was found to skip part of a two-level
cascade when a course is deleted; deletes now remove each level themselves
(see `server/src/database/README.md`).

### Step 7 as built

Instructors create assignments with instructions, a due date (entered in
their local time, stored in UTC) and a maximum score, and see every student
in the course with what they handed in. Students hand in a written answer
and/or files. Late work is accepted and marked Late; work can be changed
until it is graded, and each change moves the hand-in time, which is always
the server's clock. A classmate can never see another student's work or
files. The Files page lists every lesson and submission file the account may
see. Downloading every submission as one zip was left for later.

### Step 8 as built

Instructors score each submission (up to the assignment's maximum) with
written feedback. Grades stay private until returned, one at a time or all
at once, and until then the score is left out of every reply to the student.
A returned grade can be corrected, and the student sees the correction.
The course's Gradebook tab shows every student against every assignment
with a total, and downloads as CSV with spreadsheet formulas neutralised.
Totals follow one rule (server/src/helpers/grades.js): a score counts; work
handed in but not scored is left out; nothing handed in counts as 0 once
past due. Students see their own running total on the Assignments tab.

### Launch

| # | Step | Status | Notes for this stack |
|---|------|--------|----------------------|
| 12 | Testing and security review | **to do** | There is no test framework yet; choosing one is part of this step. |
| 13 | Deploy and launch | **to do** | MySQL replaces SQLite, so the backup step is `mysqldump`, not `VACUUM INTO`. |

Step 10 (quizzes) and step 11 (notifications and calendar) are held on the
Later list above. The roadmap marks both as "Next" rather than MVP.

## Screens

Each screen is a file under `client/src/screens/`, shown at the address in
`client/src/App.jsx`. This is the inventory, and which step builds each one.

| Address | Screen | For | Step |
|---------|--------|-----|------|
| `/` | `Home.jsx` | Everyone | 4 — **built** |
| `/login`, `/register` | `auth/Login.jsx`, `auth/Register.jsx` | Signed out | 4 — **built** |
| `/forgot-password`, `/reset-password` | `auth/ForgotPassword.jsx`, `auth/ResetPassword.jsx` | Signed out | 3 — **built** |
| `/account` | `Account.jsx` | Every signed-in account | 4 — **built** |
| `/dashboard` | `Dashboard.jsx` | Every role, different content | 9 (placeholders until then) |
| `/courses` | `Courses.jsx` | Students and instructors | 5 — **built** |
| `/courses/:id` | `Course.jsx` | One course, tabbed | 5 — **built** (Overview, People, Lessons from step 6, Assignments from step 7, Gradebook from step 8; Schedule waits) |
| `/courses/:courseId/lessons/:lessonId` | `Lesson.jsx` | A lesson, its files, previous / next | 6 — **built** |
| `/courses/:courseId/assignments/:assignmentId` | `Assignment.jsx` | An assignment, handing in, and the instructor's list of submissions | 7 — **built** |
| — | a schedule screen | Weekly meetings | Not in the roadmap's step 5, so it follows as its own piece |
| `/files` | `Files.jsx` | Every lesson and submission file the viewer may see | 7 — **built** (moved from step 6, so it was built once, when both kinds of file existed) |
| `/admin`, `/admin/users`, `/admin/roles` | `admin/Admin.jsx`, `admin/Users.jsx`, `admin/Roles.jsx` | Administrators | 4 — **built** |
| anything else | `NotFound.jsx` | Everyone | 4 — **built** |

The gradebook is a tab of the course page rather than a screen of its own (step 8).

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
