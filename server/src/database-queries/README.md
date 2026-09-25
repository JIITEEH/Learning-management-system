# Database queries

Every SQL statement the running app sends lives in this folder. Nowhere else
in `server/src/` writes SQL. (The `db:` commands in `../database/manage.js`
apply the schema files, and are the one exception.)

## Why

A request handler has two jobs that pull in opposite directions: deciding
whether a request is allowed, and getting the data. Mixed together, a
permission rule ends up buried between two queries and neither is easy to
check. Kept apart, a controller reads as a list of rules and a model reads as
a list of statements.

It also means the answer to "what does this system do to the `users` table?"
is one file, not a search across ten.

## The files

One model per table or closely related group of tables:

| Model | Tables (schema file) | Used by |
|-------|----------------------|---------|
| `userModel.js` | `users` (`01_identity.sql`) | auth, user and enrollment controllers, `request-filters/auth.js` |
| `passwordResetModel.js` | `password_resets` (`01_identity.sql`) | `authController.js` |
| `roleModel.js` | `roles`, `role_permissions` (`01_identity.sql`) | auth, user and role controllers |
| `permissionModel.js` | `permissions`, `user_permissions` (`01_identity.sql`) | most controllers, `request-filters/auth.js` |
| `courseModel.js` | `courses` (`02_catalog.sql`) | course and enrollment controllers, `permission-rules/access.js` |
| `enrollmentModel.js` | `enrollments` (`03_enrollment.sql`) | course and enrollment controllers |
| `moduleModel.js` | `modules` (`02_catalog.sql`) | module controller, `permission-rules/access.js` |
| `lessonModel.js` | `lessons` (`02_catalog.sql`) | module, lesson and course controllers, `permission-rules/access.js` |
| `progressModel.js` | `lesson_progress` (`03_enrollment.sql`) | module and lesson controllers |
| `fileModel.js` | `files` (`05_files.sql`) | file, lesson, module and course controllers, `helpers/files.js` |

Controllers import a model under a capitalised name, so a call says which
table it touches:

```js
import * as User from '../database-queries/userModel.js';

const account = await User.findById(id);
```

## The rules

**Models return rows, not responses.** A row comes back as the database
spells it (`full_name`, not `fullName`). Shaping JSON is the controller's job,
because `/api/auth` and `/api/users` deliberately return different views of
the same account.

**Models do not decide who may do anything.** No `req`, no permission checks,
no `HttpError`. A model asked for a row returns it; whether the caller was
allowed to ask was settled before the call.

**Every statement uses named placeholders** (`:userId`) through the helpers in
`../database/index.js`. A value is never pasted into the SQL text, including
one that "cannot" contain anything dangerous.

**A write touching more than one table uses `transaction`.** Replacing a role's
permissions is a delete and a series of inserts; a failure half way through
must not leave the role carrying nothing.

**Anything returning a password hash says so in its name.** `findById` never
selects `password_hash`; `findByIdWithPassword` does. A controller that does
not ask for the hash cannot leak it.

## Adding one

1. Add the tables to the right file in `../database/schema/`.
2. Add `<thing>Model.js` here, with a first comment naming its tables.
3. Call it from a controller. If you are about to write SQL in a controller,
   the statement belongs here instead.
