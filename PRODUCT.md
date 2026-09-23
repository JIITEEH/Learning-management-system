# Product

## Platform

Web.

## Stack

Plain HTML, CSS, and JavaScript in the browser with no build step and no
front-end framework. Node and Express on the server, MySQL for storage.
Adding a front-end framework or bundler is a decision that goes back to the
user.

## Product Purpose

A Learning Management System: a place where instructors publish courses and
lessons, set schedules, and assess work, and where students enrol, follow
that material, and submit against deadlines.

## Users

Three roles, defined as rows in the `roles` table rather than fixed in code:

- **Student** — enrols in courses, works through lessons, submits assignments,
  and follows their own timetable.
- **Instructor** — owns courses, authors modules and lessons, sets schedules,
  and grades submissions.
- **Administrator** — manages accounts, roles, and permissions.

The role set is expected to grow; nothing should assume there are exactly
three.

## Foundations

Five foundations carry the system, modelled on the user's earlier thesis
management system:

1. **Accounts** — email and password sign-in with a status lifecycle
   (`pending`, `active`, `suspended`).
2. **Roles** — named roles held in the database, each carrying a set of
   permissions.
3. **Permissions** — granular codes such as `course.create` checked on every
   protected route, with per-account allow/deny overrides layered on top of
   the role. A deny always wins.
4. **File uploads** — one `files` table for every attachment in the system,
   pointing at bytes stored outside the web root.
5. **Schedules** — recurring weekly course meetings bounded by an effective
   date range, so a timetable can change mid-term without losing history.

## Capabilities and Constraints

- Sessions are cookie-based and server-side; permissions are read per request
  so a revocation takes effect immediately.
- Uploaded files live in `storage/uploads/`, outside the served directory,
  and are only released after an access check.
- The schema in `database/schema/` is the source of truth for structure,
  split one file per domain. Seed data is structural only — roles and
  permission codes.

## Evidence on Hand

**None yet.** There are no real courses, accounts, or institutional
requirements in hand. The naming and structure of the five foundations were
inferred from the user's description of their thesis management system rather
than copied from it; that source has not been read, so names may need to be
aligned once it is available.

Future work must not invent institutions, course catalogues, student records,
grading policies, or academic calendars. Placeholders stay visibly
placeholder.

## Product Principles

1. **Permissions are checked on the server.** What the front end renders is a
   convenience; the server decides what is allowed.
2. **The schema is the contract.** Structure changes in `database/schema/`
   first, in the file for that domain.
3. **Never fabricate records.** Seeded data is structural, never plausible
   fake people or courses.
4. **No dependency creep on the front end.** Pages are served as authored.
5. **Uploads are untrusted.** Names, types, and sizes are all validated, and
   nothing client-supplied becomes a path.

## Accessibility & Inclusion

No formal standard has been specified, but accessibility is a functional
requirement: the system must be fully keyboard operable, preserve visible
focus, label every form control, and keep text legible at the contrast levels
WCAG AA defines. A student using assistive technology must be able to reach
their courses, deadlines, and submission forms.

## Status

Accounts, roles, and permissions work; courses, lessons, assignments, files,
and schedules are not built yet.

The exact state is recorded once, in the "Status" section of
[README.md](README.md), rather than restated here — two copies drift apart and
then neither can be trusted.
