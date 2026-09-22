# AGENTS.md

Instructions for AI coding agents working in this repository. Human
contributors should follow the same rules.

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
- Do not commit secrets, `.env` files, uploaded files under `lms/storage/`, or
  anything already in `.gitignore`.

## Project conventions

A Learning Management System: plain HTML and JavaScript in the browser,
Node/Express on the server, MySQL for storage. Everything lives under `lms/`.

### Server

- `lms/server/` is native ES modules (`"type": "module"`). Use `import`, and
  include the `.js` extension in relative imports — Node requires it.
- Every query goes through the helpers in `lms/server/db/pool.js`. Use
  named placeholders (`:userId`) and never interpolate values into SQL.
- Add a resource by adding a router under `lms/server/routes/` and mounting it
  in `routes/index.js`. One module per resource.
- Configuration is read once in `lms/server/config.js`. Do not read
  `process.env` anywhere else.

### Permissions

- Access is permission-based, not role-based. Gate routes with
  `requirePermission("course.create")` from `lms/server/middleware/auth.js`.
  Reserve `requireRole` for the rare case where the role itself is the rule.
- A new permission code needs a row in `permissions` and a grant in
  `role_permissions` — add both to `lms/database/seed.sql`.
- Permissions are read per request, not cached in the session, so that a
  revoked permission takes effect immediately. Keep it that way.

### Database

- `lms/database/schema.sql` is the single source of truth for structure.
  Changing a table means editing that file.
- `seed.sql` holds structural rows only — roles and permission codes. Real
  accounts, courses, and content are created through the application, never
  seeded.

### Uploads

- Files go through `upload` in `lms/server/middleware/upload.js`. It generates
  the name on disk; never store a client-supplied filename as the path.
- Every upload gets a row in `files` with its `owner_type` / `owner_id`. The
  bytes live in `lms/storage/uploads/`, which is gitignored.
- Serve a file only after checking the requester may see what it is attached
  to. Do not expose `lms/storage/` as a static directory.

### Front end

- **Do not add a front-end framework or bundler without asking.** The pages are
  plain HTML served as authored; there is no build step for the browser.
- Pages talk to the server through `lms/public/assets/js/api.js`. Do not call
  `fetch` directly from a page script.
- All colour, type, and spacing values are custom properties in the `:root`
  block at the top of `lms/public/assets/css/styles.css`. Add new values there
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
