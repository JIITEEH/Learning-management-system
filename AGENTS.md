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

## Asking follow-up questions

**Ask; do not assume.** The person who owns this project wants to make the
decisions in it, and a silent guess makes one for them.

- **When a request can be read more than one way, ask before acting.** Lay
  out the likely readings as choices, say which you recommend and why, and
  wait for the answer.
- **When a decision comes up part way through** that the owner would
  plausibly care about (a name, a trade-off, deleting something, a change in
  scope), stop and ask rather than choosing quietly. Small mechanical choices
  with one obvious answer do not need a question.
- **End every finished piece of work with follow-up questions:** what to do
  next, whether the result is what was meant, and any decision the work
  turned up. A report that ends without a question is not finished.

Asking does not replace doing. When a request is clear, do the work, and
save the questions for the checkpoint rather than asking before every line.

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

> Ready to push 2 commits to `origin/dev-current`. Push now?

### Pushing to `main` takes two separate yeses

`main` is the branch that gets deployed — whatever sits on it is what people
actually using the system will see. So pushing to it is allowed, but never on
your own initiative, and never on a single yes.

Ask twice, as two separate questions, and wait for a real answer each time:

1. **Confirm the intent.** Say where the commits would come from, how many
   there are, and where `main` is now.

   > `main` is at `ddf5c9c`. Moving it to `dev-current` would add 18 commits.
   > Do you want `main` updated?

2. **Confirm the act.** Only after a yes to the first, say what the push
   itself will do. In particular, whether it only moves `main` further along
   the same line of history — a *fast-forward*, where nothing already on
   `main` is thrown away — or whether it rewrites the branch, which deletes
   commits that were on it.

   > This is a fast-forward, so nothing on `main` is discarded. Push now?

One yes is not two. If the second answer does not arrive, or is anything other
than a plain yes, do not push. And being told yes once does not cover the next
push to `main`: start again at the first question every time.

Two things still need the user to ask for them in so many words: force-pushing
`main`, which deletes commits other people may already have copies of, and
merging into `main` locally as a way around the two questions above.

Where there is no hurry, the pull request route is still the better one —
prepare the branch, draft the description, and let the user merge it. Offer
that first. The two-question push is for when they would rather go direct.

Everyday work still goes to `dev-current`, or to a short-lived branch taken
from it:

```sh
git checkout dev-current
git checkout -b feature/short-description
```

`dev-current` is the working branch. There was once a `dev` branch as well,
carrying a separate lineage of the same project that shared no common ancestor
with this one. It was deleted so the repository holds two branches rather than
three, and its commits were folded into `dev-current` beforehand so that none
were lost. Do not recreate it.

A new branch name also has to be added to the `branches` list in
`.github/workflows/ci.yml`, which watches `main` and `dev-current` only. A
branch missing from that list gets no checks at all, and silently — GitHub
reports nothing rather than failing.

When you do prepare a pull request instead, you may write the branch and draft
the description, but opening it and merging it stay the user's decision.

### Commits

- Write in the imperative mood: "Add course roster view", not "Added".
- One logical change per commit; do not bundle unrelated edits.
- Do not commit secrets, `.env` files, uploaded files under `server/uploads/`, or
  anything already in `.gitignore`.

## Project conventions

A Learning Management System: React and Vite in the browser, Node/Express on
the server, MySQL for storage. It follows the conventions of the owner's
earlier thesis management system (ThesisTrack, in `~/Downloads/Capstone`) so
the two read alike: JavaScript with ES modules throughout, an npm workspace
with `client/` and `server/`, the same plain-English folder names, and single
quotes.

### Server

Each feature is split across three files, and a request passes through them
in this order:

| Folder | Holds | Example |
|--------|-------|---------|
| `api-endpoints/` | Which addresses exist, and which checks guard each one | `courseRoutes.js` |
| `request-handlers/` | What happens at each address: read the request, apply the rules, reply | `courseController.js` |
| `database-queries/` | The SQL, and nothing else | `courseModel.js` |

Alongside them: `request-filters/` (checks every request can pass through:
sign-in, rate limits, security headers, uploads, errors), `permission-rules/`
(who may reach a given course), `helpers/` (small shared tools such as
`HttpError`, input checks, passwords, email), `config/` (settings), and
`database/` (the connection, the SQL files, and the `db:` commands).

- Server code is native ES modules. Use `import`, and include the `.js`
  extension in relative imports — Node requires it.
- **SQL lives in `server/src/database-queries/`, and nowhere else.** A
  controller that needs data calls a model function; it does not write a
  query. See `server/src/database-queries/README.md`.
- Every query goes through the helpers in `server/src/database/index.js`. Use
  named placeholders (`:userId`) and never put values into the SQL text.
- Models return rows as the database spells them (`full_name`). Turning a row
  into JSON is the controller's job, because different endpoints return
  different views of the same record.
- Models never decide who may do what — no `req`, no permission checks.
- Controllers `throw new HttpError(status, message)` for anything the client
  got wrong. Express 5 passes it to `errorHandler`, so there is no try/catch
  and no wrapper around handlers.
- Check request input with the functions in `helpers/validate.js`
  (`requireText`, `requireEmail`, `oneOf`, `parseId`…) rather than writing a
  new check, so a field is accepted or refused the same way everywhere.
- Add a resource with `<resource>Routes.js`, `<resource>Controller.js` and
  `<resource>Model.js`, and mount the routes in `api-endpoints/index.js`.
- Configuration is read once in `server/src/config/index.js`. Do not read
  `process.env` anywhere else. The values come from the `.env` file at the
  top of the project, which the npm scripts hand to Node.

### Permissions

- Access is permission-based, not role-based. Gate routes with
  `requirePermission('course.create')` from `request-filters/auth.js`.
- A code is the first gate only. Whether this person may reach this
  particular course is checked in the controller through
  `permission-rules/access.js`.
- A new permission code needs a row in `permissions` and a grant in
  `role_permissions` — add both to `server/src/database/seed/`, in
  `02_permissions.sql` and `03_role_permissions.sql`.
- Permissions are read per request, not cached in the session, so that a
  revoked permission takes effect immediately. Keep it that way.

### Database

Read `server/src/database/README.md` before changing anything here; it is the
full account. In short:

- **One database, many tables.** Do not add a second MySQL schema. Courses,
  accounts, and submissions live together so foreign keys hold them
  consistent and a cross-domain write is one transaction. Separation belongs
  in the files, not in separate databases.
- `server/src/database/schema/` is the single source of truth for structure,
  split one file per domain and numbered in dependency order. Changing a
  table means editing the file that defines it, not writing a migration alone.
- Adding a table means adding its `DROP TABLE` to `reset.sql` too.
- `seed/` holds structural rows only — roles and permission codes. Real
  accounts, courses, and content are created through the application, never
  seeded.
- Apply everything through the npm scripts (`db:setup`, `db:schema`,
  `db:seed`, `db:migrate`, `db:status`), never by piping a file into `mysql`
  by hand — the scripts read the same `.env` the server does, so they cannot
  reach a different database than the app.

### Uploads

- Files go through `upload` in `request-filters/upload.js`. It generates the
  name on disk; never store a client-supplied filename as the path.
- Mount `upload` only on a route whose handler is written. It saves files to
  disk as the request arrives, before the handler runs.
- Every upload gets a row in `files` with its `owner_type` / `owner_id`. The
  bytes live in `server/uploads/`, which is gitignored.
- Serve a file only after checking the requester may see what it is attached
  to. Never serve `server/uploads/` as a static folder.

### Front end

The screens are React, built with Vite, arranged like ThesisTrack's client:
`screens/` for one file per screen, `ui-pieces/` for parts shared between
screens, `api-client/`, `shared-state/`, `reusable-logic/` and `helpers/`.

- **Do not add a library without asking.** React, react-router, Vite and
  lucide-react (icons) are what ThesisTrack uses; anything beyond them is the
  owner's decision.
- Screens talk to the server through `client/src/api-client/api.js`: add a
  named function there and call it. Lint refuses `fetch` anywhere else.
- Load data with `useApi` and send forms with `useSubmit`
  (`client/src/reusable-logic/`), so loading, busy buttons and error messages
  behave the same on every screen.
- Guard a screen in `App.jsx` with `RequireAuth`, `GuestOnly` or
  `RequirePermission`. These are a courtesy to the person using the app, not
  protection: the server checks the same permission on every request.
- All colour, type, and spacing values are custom properties in the `:root`
  block at the top of `client/src/styles/index.css`. Add new values there
  rather than hard-coding them in a rule.
- The server sends a strict Content-Security-Policy, so no inline `<script>`,
  no inline `style="..."` in HTML, and nothing loaded from other sites except
  Google Fonts. React's `style={{ }}` is fine; it does not count as inline.
- **Accessibility** — keep visible focus styles, label every form control, and
  keep `aria-expanded` in sync on anything that expands. Images need real
  `alt` text, or `alt=""` when decorative.

## Checking your work

There are no tests yet. Before handing work back, lint, run the app, and
exercise what you changed:

```sh
npm run lint
npm run dev          # http://localhost:5174
```

Check that the server boots without errors, that the routes you touched answer
as expected, that the browser console stays free of errors, and that screens
render in a narrow viewport as well as a wide one. For a change that touches
security headers or how files are served, also run `npm run build` and check
the result on http://localhost:3000, then delete `client/dist/`.
