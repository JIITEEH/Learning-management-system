# AGENTS.md

Instructions for AI coding agents working in this repository. Human
contributors should follow the same rules.

## Explaining your work

**Write for a student who is not studying IT.** That is the audience for every
explanation here — someone capable and interested, who has simply never been
taught the vocabulary. This is not a small courtesy; it is how the person who
owns this project stays able to steer it.

- **Say what something does before you name it.** Describe the thing in
  ordinary words, then give the technical term as a label for what you just
  described. "The file that records the exact version of every downloaded
  package, so a later install gets the same ones — the lockfile" reads better
  than "the lockfile" on its own.
- **Gloss jargon the first time it appears.** Endpoint, schema, migration,
  seed, foreign key, session, middleware, orphan process, least privilege: each
  needs a handful of plain words the first time it comes up in a conversation.
  Do not assume an acronym is common knowledge.
- **Use an everyday comparison when one genuinely fits**, and say where the
  comparison breaks down, so it does not quietly teach something false.
- **Explain why it matters in terms of what the reader would notice** — a page
  that loads, a login that stops working, a push that turns red — not only
  which lines changed.
- **Prefer a short worked example to an abstract description.** A single
  command with its real output teaches more than a paragraph about the command.
- **Keep the substance whole.** Plain language means clearer, not vaguer and
  not shorter. Do not drop caveats, round off numbers, or hide an uncertainty
  to make a sentence flow. A guess must still be labelled a guess, and bad
  news must still be stated plainly.

The same applies to comments in code and to commit messages: explain the
reason a reader could not have guessed, in words a newcomer to the project
can follow.

## Git and GitHub

### Always confirm before pushing

**Never run `git push` without explicitly asking the user first and getting a
clear yes.** This applies to every branch, every remote, and every form of the
command, including `--force`, `--tags`, and pushes that a helper command
performs on your behalf (for example `gh pr create` on an unpushed branch).

Committing is not permission to push. A request to "commit this" or "save this"
means commit locally and stop. Being told to push once does not carry over to
the next push — ask again each time.

When you are ready to push, ask in a form the user can answer directly, naming
what you intend to do:

> Ready to push 2 commits to `origin/dev`. Push now?

### Never push to `main`

`main` is the deployed branch and is off limits to agents. Do not push to it,
do not merge into it locally and push the result, and do not force-push it.

Work goes to `dev` or to a short-lived branch taken from it:

```sh
git checkout dev
git checkout -b feature/short-description
```

Changes reach `main` only through a pull request that the user reviews and
merges themselves. You may prepare the branch and draft the PR description, but
opening and merging the PR is the user's decision. If the user asks you to push
directly to `main`, say that this rule stands against it and offer the branch +
pull request route instead.

### Commits

- Write in the imperative mood: "Add course roster view", not "Added".
- One logical change per commit; do not bundle unrelated edits.
- Do not commit secrets, `.env` files, uploaded files under `storage/`, or
  anything already in `.gitignore`.

## Project conventions

A Learning Management System: plain HTML and JavaScript in the browser,
Node/Express on the server, MySQL for storage. Everything lives under ``.

### Server

- `server/` is native ES modules (`"type": "module"`). Use `import`, and
  include the `.js` extension in relative imports — Node requires it.
- **SQL lives in `server/db/repositories/`, and nowhere else.** A route
  that needs data calls a repository function; it does not write a query. See
  `server/db/repositories/README.md`.
- Every query goes through the helpers in `server/db/pool.js`. Use
  named placeholders (`:userId`) and never interpolate values into SQL.
- Repositories return rows as the database spells them (`full_name`). Turning
  a row into JSON is the route's job, because different endpoints return
  different views of the same record.
- Repositories never decide who may do what — no `req`, no permission checks.
  Authorization stays in the routes so it can be reviewed in one place.
- Add a resource by adding a router under `server/routes/`, a matching
  `<resource>.repo.js` under `db/repositories/`, and mounting the router in
  `routes/index.js`. One module per resource, same name in both places.
- Configuration is read once in `server/config.js`. Do not read
  `process.env` anywhere else.

### Permissions

- Access is permission-based, not role-based. Gate routes with
  `requirePermission("course.create")` from `server/middleware/auth.js`.
  Reserve `requireRole` for the rare case where the role itself is the rule.
- A new permission code needs a row in `permissions` and a grant in
  `role_permissions` — add both to `database/seed/`, in
  `02_permissions.sql` and `03_role_permissions.sql`.
- Permissions are read per request, not cached in the session, so that a
  revoked permission takes effect immediately. Keep it that way.

### Database

Read `database/README.md` before changing anything here; it is the full
account. In short:

- **One database, many tables.** Do not add a second MySQL schema. Courses,
  accounts, and submissions live together so foreign keys hold them
  consistent and a cross-domain write is one transaction. Separation belongs
  in the files, not in separate databases.
- `database/schema/` is the single source of truth for structure, split
  one file per domain and numbered in dependency order. Changing a table
  means editing the file that defines it, not writing a migration alone.
- Adding a table means adding its `DROP TABLE` to `reset.sql` too.
- `seed/` holds structural rows only — roles and permission codes. Real
  accounts, courses, and content are created through the application, never
  seeded.
- Apply everything through the npm scripts (`db:setup`, `db:schema`,
  `db:seed`, `db:migrate`, `db:status`), never by piping a file into `mysql`
  by hand — the scripts read the same `.env` the server does, so they cannot
  reach a different database than the app.

### Uploads

- Files go through `upload` in `server/middleware/upload.js`. It generates
  the name on disk; never store a client-supplied filename as the path.
- Every upload gets a row in `files` with its `owner_type` / `owner_id`. The
  bytes live in `storage/uploads/`, which is gitignored.
- Serve a file only after checking the requester may see what it is attached
  to. Do not expose `storage/` as a static directory.

### Front end

- **Do not add a front-end framework or bundler without asking.** The pages are
  plain HTML served as authored; there is no build step for the browser.
- Pages talk to the server through `public/assets/js/api.js`. Do not call
  `fetch` directly from a page script.
- All colour, type, and spacing values are custom properties in the `:root`
  block at the top of `public/assets/css/styles.css`. Add new values there
  rather than hard-coding them in a rule.
- **Accessibility** — keep visible focus styles, label every form control, and
  keep `aria-expanded` in sync on anything that expands. Images need real
  `alt` text, or `alt=""` when decorative.

## Checking your work

There are no tests yet. Before handing work back, run the server and exercise
what you changed:

```sh
cd lms
npm run dev          # http://localhost:3000
```

Check that the server boots without errors, that the routes you touched answer
as expected, and that pages render in a narrow viewport as well as a wide one.
