# Repositories

Every SQL statement in the application lives in this directory. Nowhere else
in `server/` writes SQL.

## Why

A route has two jobs that pull in opposite directions: deciding whether a
request is allowed, and getting the data. Mixed together they produce handlers
where a permission rule is buried between two queries and neither is easy to
check. Kept apart, a route reads as a list of rules and a repository reads as a
list of statements.

It also means the answer to "what does this system do to the `users` table?" is
one file, not a search across ten.

## The shape

One file per domain, named after its schema file and its route:

| Repository | Schema | Route |
|------------|--------|-------|
| `users.repo.js` | `schema/01_identity.sql` | `routes/users.js`, `routes/auth.js` |
| `roles.repo.js` | `schema/01_identity.sql` | `routes/roles.js` |
| `permissions.repo.js` | `schema/01_identity.sql` | `routes/permissions.js`, `middleware/auth.js` |

Only the identity domain is implemented so far. Courses, lessons, enrollment,
assignments, files and schedules get a repository each as their routes are
built, following the same naming.

Routes import them under a namespace, so a call says which table it touches:

```js
import * as users from "../db/repositories/users.repo.js";

const account = await users.findById(id);
```

## The rules

**Repositories return rows, not responses.** A row comes back as the database
spells it — `full_name`, not `fullName`. Shaping JSON is the route's job,
because `/api/auth` and `/api/users` deliberately return different views of the
same account.

**Repositories do not decide who may do anything.** No `req`, no permission
checks, no `httpError`. A repository asked for a row returns it; whether the
caller was allowed to ask was settled before the call. Keeping authorization in
the routes is what makes it reviewable in one place.

**Every statement uses named placeholders** (`:userId`) through the helpers in
`../pool.js`. A value is never interpolated into SQL, including one that
"cannot" contain anything dangerous.

**A write touching more than one table uses `transaction`.** Replacing a role's
permissions is a delete and a series of inserts; a failure half way through
must not leave the role carrying nothing.

**Anything returning a password hash says so in its name** — `findById` never
selects `password_hash`, `findCredentialsById` does. A route that does not ask
for the hash cannot leak it.

## Adding one

1. Add the tables to the right file in `database/schema/`.
2. Add `<domain>.repo.js` here, with a header naming its schema file.
3. Have the route import it and call it. If you are about to write SQL in
   `routes/`, the statement belongs here instead.
