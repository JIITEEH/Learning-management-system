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
| 9 | Announcements and dashboards | **done** |

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

### Step 9 as built

Instructors post announcements to a course; everyone who can see the course
reads them on its Announcements tab. The dashboard shows only real
information, chosen by the account's role: a student's courses with lesson
progress, work due soon (overdue first) and recent grades; for staff, work
waiting to be graded and upcoming deadlines; for administrators, accounts
awaiting approval and totals; for everyone, the latest announcements. The
placeholder cards (hours spent, a weekly schedule) and their styles are
gone until something records that information.

The announcements table arrived as the project's first migration, so the
local database kept its administrator account.

### Step 12 as built

76 server tests cover every permission and privacy rule; 11 browser tests
open every screen as each role and walk one course from setup to a returned
grade. The security review of steps 6 to 9 found and fixed four holes, each
with a test that failed before its fix: no total on the files a lesson or
submission could hold (a student could fill the disk), long lessons in
three-byte scripts refused as too large, unlimited password guesses while
changing a password, and a deleted account's files left on disk.

Left for step 13, where they belong: sessions and rate-limit counts live in
the server's memory, so a restart signs everyone out and forgets the counts;
before going live, sessions move into MySQL. File contents are not checked
against their stated type; downloads are always attachments with
`nosniff`, so an uploaded file cannot run as part of the site.

### The schedule, as built

Each course's Schedule tab lists its weekly classes (day, times, an
optional title and room, and the dates it runs from and until); its
instructor adds, edits and removes them, and an overlapping class is saved
with a warning rather than refused. "My week" (`/schedule`) shows every
class across a person's courses, Monday to Sunday, week by week, with today
marked; the dashboard shows today's classes. Times are school clock time.
Changing a time mid-term is done by giving the old class a last date and
adding a new one. No schema change was needed.

### Step 11 as built: deadline calendar and notifications

The Schedule screen has two views. **Week** is the timetable above; **Month**
(`/schedule?view=month`) is a calendar of every assignment due date across a
person's courses. Each due date sits on the day it falls on in the viewer's own
time zone, and a student sees a mark on each one: handed in, late or missing.
On a phone the month becomes a list of only the days with something due. The
server address is `GET /api/schedules/deadlines?from=…&to=…`, at most 62 days
at a time.

**Notifications** copy the thesis management system's design: a
`notifications` table with one row per recipient (added by the migration
`2026-10-02_add_notifications.sql`), and a bell in the top bar with an unread
count, a panel of the newest 20, "Mark all as read", and the next deadlines
under "Coming up". Opening a notification marks it read. One is sent for a new
announcement or assignment (to the course's active students), for work
returned with its grade or a returned grade changed, and for being added to a
course by its instructor. A draft course sends nothing, nobody is told about
their own action, and a grade is never announced while it is still hidden from
the student. The count refreshes every minute while the tab is in view; there
is no push to the phone.

**Deadline reminders** (`npm run reminders`, meant to run once a day) copy the
thesis management system's reminder job. A student is sent a notification and
an email with the same words when an assignment is due, or a quiz closes,
within the next 24 hours and they have not handed it in or taken it, and once
an assignment has been overdue for up to 7 days (late work is still accepted).
Each one is recorded in `deadline_reminders`, so nobody is reminded twice; a
moved deadline is reminded about again. Students in draft courses, who dropped
or finished a course, or whose account is suspended are left out.

### Step 10 as built: quizzes

The one feature with no ThesisTrack equivalent. Each course has a Quizzes tab,
and each quiz a page at `/courses/:courseId/quizzes/:quizId`. Five tables in
`schema/04_assessment.sql` (migration `2026-10-02_add_quizzes.sql`) and the
codes `quiz.read`, `quiz.manage` and `quiz.take`.

- **Questions:** single choice, multiple choice (every right option and no
  wrong one), true or false, and short answer (matched ignoring capital
  letters and extra spaces). Each is all or nothing.
- **Marked by the server** the moment it is handed in. The right answers never
  reach a student's browser: they get the questions only inside an attempt,
  and afterwards see their score and which questions were right, not what the
  right answers were.
- **Time** is kept by the server: an attempt's end is fixed when it starts
  (the time limit, or the closing time if sooner), and answers handed in more
  than a minute after it are not counted. The countdown on screen hands the
  answers in by itself at zero.
- **Attempts:** up to 10, set per quiz; the best score counts, in the
  gradebook, its CSV and a student's own total, and a closed quiz never taken
  counts as 0, as missed assignments do.
- A quiz is built unpublished, and publishing notifies the course's students.
  Once anyone has started, its questions are fixed.

### The audit log, as built

Roadmap step 5 asks for a record of who changed what. It copies the thesis
management system's audit log: an `audit_log` table (`schema/08_audit.sql`,
migration `2026-10-02_add_audit_log.sql`) that is only ever added to, and an
administrators' screen at `/admin/audit`, behind the new code `audit.read`.
It records accounts created by an administrator, approved, suspended,
reactivated, given another role, edited by someone else, given permission
overrides or deleted; roles created, edited, deleted or given other codes;
courses opened, archived or deleted; and students added to, dropped from or
removed from a course. Names are copied in when the change is made, so an entry
still reads correctly after either account is deleted.

### Launch

| # | Step | Status | Notes for this stack |
|---|------|--------|----------------------|
| 12 | Testing and security review | **done** | Server tests with Node's own runner (`npm test`, 76 tests, each file on a throwaway database) and browser tests with Playwright (`npm run test:e2e`, every screen per role on desktop and phone, and one course journey), as in ThesisTrack. Both run in the GitHub check. |
| 13 | Deploy and launch | **partly done** | The restorable backup is built: `npm run db:backup` copies the database (with `mysqldump`, not `VACUUM INTO`) and the uploaded files, `-- --restore` puts one back, and old ones are pruned, as in ThesisTrack (see `server/src/database/README.md`). Putting the site online is left out at the owner's request. |

Steps 10 (quizzes) and 11 (notifications and calendar), which the roadmap
marks as "Next" rather than MVP, are both built; see above.

## Screens

Each screen is a file under `client/src/screens/`, shown at the address in
`client/src/App.jsx`. This is the inventory, and which step builds each one.

| Address | Screen | For | Step |
|---------|--------|-----|------|
| `/` | `Home.jsx` | Everyone | 4 — **built** |
| `/login`, `/register` | `auth/Login.jsx`, `auth/Register.jsx` | Signed out | 4 — **built** |
| `/forgot-password`, `/reset-password` | `auth/ForgotPassword.jsx`, `auth/ResetPassword.jsx` | Signed out | 3 — **built** |
| `/account` | `Account.jsx` | Every signed-in account | 4 — **built** |
| `/dashboard` | `Dashboard.jsx` | Every role, different content | 9 — **built** |
| `/courses` | `Courses.jsx` | Students and instructors | 5 — **built** |
| `/courses/:id` | `Course.jsx` | One course, tabbed | 5 — **built** (Overview, People, Announcements from step 9, Lessons from step 6, Assignments from step 7, Quizzes from step 10, Gradebook from step 8, and Schedule) |
| `/courses/:courseId/lessons/:lessonId` | `Lesson.jsx` | A lesson, its files, previous / next | 6 — **built** |
| `/courses/:courseId/assignments/:assignmentId` | `Assignment.jsx` | An assignment, handing in, and the instructor's list of submissions | 7 — **built** |
| `/schedule` | `Schedule.jsx` | A person's week across all their courses; each course also has a Schedule tab | **built** after step 12, as its own piece |
| `/files` | `Files.jsx` | Every lesson and submission file the viewer may see | 7 — **built** (moved from step 6, so it was built once, when both kinds of file existed) |
| `/courses/:courseId/quizzes/:quizId` | `Quiz.jsx` | A quiz: building it, or taking it and seeing the results | 10 — **built** |
| `/admin`, `/admin/users`, `/admin/roles` | `admin/Admin.jsx`, `admin/Users.jsx`, `admin/Roles.jsx` | Administrators | 4 — **built** |
| `/admin/audit` | `admin/AuditLog.jsx` | Administrators (`audit.read`) | built with the audit log |
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
