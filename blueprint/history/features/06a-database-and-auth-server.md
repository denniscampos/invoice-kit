# Feature: Database and auth server

**From build-plan:** feature 6a
**Status:** complete

## Goal

Stand up the database and the auth server the account path needs, with no user
facing surface at all. At the end of this feature the app looks exactly as it
does now, and an HTTP request can create a real account in a real database.

Splitting it this way keeps the risky, unfamiliar half, a new database and a new
library, in its own review cycle. 6b adds the pages that call it, 6c puts the
session in the app.

## Decisions this feature records

**Email verification and password reset are deferred.** This is
`project-overview.md`'s open question 3, parked for exactly this feature, and the
answer is no for MVP: both need an email sender, which would be the first third
party key a self-hoster has to obtain, against a setup promise of "no third-party
service keys to obtain". Sign up therefore works immediately and a forgotten
password means a new account until this is revisited. `project-plan.md` should
be updated and `/overview` re-run so the question stops reading as open; that is
a plan edit and is not done inside this feature.

**Better Auth talks to D1 directly.** Its `database` option accepts a
`D1Database` in the union, confirmed by reading the option's type in the library
source, so there is no Kysely dialect to wire, no `kysely-d1`, and no third party
Cloudflare adapter. The community `better-auth-cloudflare` package is
deliberately not used.

## Local first, and what that means here

Every command this feature runs touches **local** data. D1 in local mode is a
SQLite file under `.wrangler/state`, so development, migrations, and every check
below use `--local` and nothing in this feature reads or writes the real
database.

The remote database is still created, for one reason only: the binding needs a
real `database_id` or the next deploy fails on an invalid one. Creating it is
free, it stays empty, and the migration that fills it runs at deploy time.

Migrations go through `wrangler d1 migrations` rather than raw `d1 execute
--file`, so the applied set is tracked in the database and the remote apply later
is the same file, not a retyped command.

**One consequence worth stating.** Once this lands, the deployed Worker answers
`/api/auth/*` against a database with no tables, so a request to it returns an
error until the remote migration runs. Nothing in the app calls those routes
until 6b, so the only way to meet it is by hand, but the honest fix is to apply
the remote migration in the same session as the deploy that carries this feature.

## In scope

- A D1 database on the account, bound as `DB`
- `better-auth` installed and configured: email and password on, verification
  off, secret and base URL from the environment
- The auth instance built **per request**, because a binding does not exist
  outside one
- Better Auth's own schema, generated and applied as a D1 migration
- Its route handler mounted at `/api/auth/*`
- Local development credentials in `.dev.vars`, and the example file that
  documents them

## Out of scope

- **Every page** (6b and 6c). No sign up form, no sign in form, no sign out
  button, nothing in the app bar. The app's appearance does not change.
- **Route protection** (6c, and feature 7 is its first real caller). There is
  nothing to protect yet: the editor is public by design and `/invoices` does not
  exist until feature 9.
- **Invoice tables** (feature 7). This migration creates Better Auth's four
  tables and nothing else.
- **Social login, passkeys, two factor, organisations.** Email and password only.
- **Setting the deployed secrets and applying the migration remotely.** Both are
  needed before the next deploy and are named under Deployment below, but this
  feature does not deploy.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The database** - create the D1 database with `wrangler d1
  create` so the binding has a real id, add the `d1_databases` binding to
  `wrangler.json` as `DB` with `migrations_dir` pointing at `migrations/`, and
  run `pnpm cf-typegen`. The remote database is left empty; everything from here
  is local. *Done when:* `worker-configuration.d.ts` declares `DB` on `Env`;
  `pnpm check`'s dry run lists it beside the browser and rate limit bindings;
  `wrangler d1 execute <name> --local --command "select 1"` succeeds against the
  local SQLite file; and `pnpm build` passes.

- [x] **Step 2 - The auth server** - `pnpm add better-auth`, then
  `app/lib/auth.server.ts` exporting `createAuth(env: Env)` returning
  `betterAuth({ database: env.DB, emailAndPassword: { enabled: true }, ... })`
  with verification off, `secret` from `BETTER_AUTH_SECRET` and `baseURL` from
  `BETTER_AUTH_URL`. A factory, not a module level constant: bindings are
  request scoped, so a singleton would capture nothing. Add both variables to
  `.dev.vars` and to `.dev.vars.example` if one exists, generating the secret
  with `openssl rand -base64 32`. *Done when:* `pnpm typecheck` and `pnpm build`
  pass, the secret is in `.dev.vars` and **not** in git (confirmed by
  `git status` and the ignore rules), and nothing else in the app imports the
  factory yet.

- [x] **Step 3 - The schema** - generate Better Auth's tables and apply them as a
  D1 migration. The CLI reads a config file to learn the adapter, and it cannot
  be handed a live D1 binding outside a Worker, so the generation config passes
  Node's built in `node:sqlite` `DatabaseSync` instead, which is in the same
  option union and produces SQLite DDL that D1 accepts. Save the emitted SQL as
  `migrations/0001_better_auth.sql` and apply it locally. *Done when:*
  `wrangler d1 execute <name> --local --command "select name from sqlite_master
  where type='table'"` lists `user`, `session`, `account`, and `verification`;
  the migration file is committed; and the generation config is clearly marked as
  a CLI only artifact.

- [x] **Step 4 - The route handler** - a splat resource route at
  `app/routes/api.auth.$.tsx` registered in `app/routes.ts`, whose `loader` and
  `action` both build the instance from the request's env and return
  `auth.handler(request)`. *Done when:* posting a sign up to
  `/api/auth/sign-up/email` returns a success and a session cookie; a row appears
  in `user` locally, confirmed with `wrangler d1 execute --local`; posting the
  same email twice is refused rather than duplicated; a wrong password on
  `/api/auth/sign-in/email` is refused; the editor and the PDF endpoint still
  behave exactly as before; and the Worker log carries no unhandled error.

## Files / areas

- `wrangler.json` - the `d1_databases` binding
- `worker-configuration.d.ts` - regenerated, never hand edited
- `package.json` - `better-auth`
- `app/lib/auth.server.ts` - new, `createAuth(env)`
- `auth.config.ts` - new, CLI only, for schema generation
- `migrations/0001_better_auth.sql` - new
- `app/routes/api.auth.$.tsx` - new, the handler
- `app/routes.ts` - registers it
- `.dev.vars`, `.dev.vars.example` - local credentials

## Data / contracts

**Better Auth owns its four tables and this project does not hand write their
schema**, which the overview states plainly. Everything below is what later
features build on.

```ts
// app/lib/auth.server.ts
export function createAuth(env: Env): ReturnType<typeof betterAuth>;

// POST /api/auth/sign-up/email   { email, password, name }
// POST /api/auth/sign-in/email   { email, password }
// POST /api/auth/sign-out
// GET  /api/auth/get-session
```

Rules later features depend on:

- **The auth instance is built per request.** `env.DB` exists only inside a
  request, so a module level `auth` would be constructed with nothing. Every
  caller goes through `createAuth(env)`.
- **The session is resolved on the server, never trusted from the client.**
  Feature 7 scopes every invoice query by the id it reads from the session, and
  `coding-standards.md` makes that a rule rather than a preference.
- **`userId` will be on every user owned row**, filtered in the query itself.
  Nothing in this feature creates such a row, but the id it mints is the one
  those rows will point at.
- **Passwords, tokens, and hashing belong to Better Auth.** Nothing in this
  project hashes a password or issues a session token.
- **The anonymous tier is untouched.** The editor and `/invoice/pdf` continue to
  work with no session, which is the tier line the overview draws.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

This feature adds almost no pure logic: it is configuration, a schema, and a
handler that delegates. There is nothing here worth a unit test that would not
simply assert that a library was called, so the evidence is the real endpoints
and the real database, as each step's done-when describes. If a step surfaces
logic of our own, it ships a test then.

Verify by hand at the end:

- Post a sign up and see the row in `user`
- Post the same email again and confirm it is refused
- Post a sign in with the wrong password and confirm it is refused
- Post a sign in with the right password and confirm a session cookie comes back
- Load the editor and download a PDF, confirming the anonymous path is unchanged
- Confirm `.dev.vars` is untracked and no secret appears in `git status`

## Deployment

Neither of these is done by this feature, and both are required before the next
deploy, so they are written down rather than remembered:

- `wrangler secret put BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` for the
  deployed Worker
- `wrangler d1 migrations apply <name> --remote`, the same migration file this
  feature wrote and applied locally, because a deploy against a database without
  the tables answers every auth request with an error. Run it in the same session
  as the deploy, not later

## Notes for the AI

- **`wrangler d1 create` makes a real database on the user's Cloudflare account.**
  Ask before running it, and report the database id it returns rather than
  inventing one. It is the only remote thing this feature does, and it creates an
  empty database rather than writing to one.
- **Every other D1 command in this feature carries `--local`.** If a command in a
  done-when is missing it, the command is wrong, not the done-when.
- Bindings reach the route through `context.get(cloudflareContext)`, never a
  module level global.
- `.dev.vars` is already ignored by the repo's ignore rules. Never commit a
  secret, never print one in full, and never put one in `wrangler.json`.
- Better Auth's CLI wants a config it can load outside a Worker. Keep that file
  obviously separate from `auth.server.ts` so nobody wires the app to it.
- Do not hand write the four tables. Generate them, read the SQL before applying
  it, and commit the file.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.

## Findings

Resolved findings archived with this work item at their final status. IDs are
prefixed with the archive name so they stay unique across the project. None of
these were raised against feature 6a: they were repaired by the audit cleanup fix
and closed by the review that followed it, which ran after that fix had already
been logged, so they archive with the next item to complete.

### 06a/F-02 [P2] closed - Ported theme tokens duplicate shadcn tokens with the same values

**File:** app/app.css:20
**Why it matters:** `--color-surface` (#ffffff), `--color-surface-sunken`
(#f0f2f5), `--color-border-strong` (#cdd2d9), and `--color-accent-wash` (#eff4ff)
repeat the values already held by shadcn's `--card`, `--muted`, `--input`, and
`--accent`. Two names for one color drift apart the first time someone retunes
the palette through one of them, and nothing in the build catches it. The
duplicate set is also currently unreferenced, so nothing would reveal the drift
until a later feature used the stale half.
**Found:** 2026-08-13 by /audit (scope: current)
**Suggested fix:** keep only the tokens shadcn has no equivalent for
(`--color-paper*`, `--color-status-*`, `--color-faint`) and delete the four
duplicates, or define them as aliases such as
`--color-surface: var(--card)` so a single edit moves both.
**Resolution:** Fixed 2026-08-15 by /implement. The four duplicates are deleted;
`--color-faint` stays, since shadcn has no equivalent for it, which is the
distinction this entry drew. Verified no references remain in `app/` beyond the
comment that records the removal, and the compiled stylesheet no longer contains
them. The running app is unchanged: app bar white, page `rgb(246,247,249)`,
preview sunken `rgb(240,242,245)`, paper white.

Re-reviewed 2026-08-15 by /audit (scope: full). The four duplicates are gone from
the source and from the compiled stylesheet, `--color-faint` remains as this
entry intended, and the only textual matches left are inside the comment that
records the removal. The running app's colours are unchanged. **Closed.**

### 06a/F-04 [P3] closed - Unused exports in the draft module

**File:** app/lib/invoice-draft.ts:3
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `DRAFT_VERSION`, `DRAFT_STORAGE_KEY`, `DEFAULT_CURRENCY`,
`DEFAULT_TEMPLATE_ID`, `DEFAULT_INVOICE_NUMBER`, `toIsoDate`, and (added by
feature 2) `createLineItem` are exported but used only inside their own module. `coding-standards.md` calls for no unused
exports. Several are plausible API for features 7 and 8, so this is a judgment
call rather than dead code.
**Suggested fix:** drop `export` from the ones nothing outside the module needs,
and re-export them when a caller appears. Leaving them is defensible if you
prefer the module to read as a public API.
**Resolution:** Fixed 2026-08-15 by /implement. `DRAFT_VERSION`,
`DRAFT_STORAGE_KEY`, `DEFAULT_CURRENCY`, `DEFAULT_INVOICE_NUMBER`, and
`createLineItem` are no longer exported. `toIsoDate` keeps its export because
three tests import it, which grep confirmed rather than the list in this entry,
written before those tests existed; a comment now says so. `DEFAULT_TEMPLATE_ID`
and `PartyAddressLine` left this list earlier when real callers appeared. Still open, list revised 2026-08-14 by /audit (scope: current).
Feature 4 moved `DEFAULT_TEMPLATE_ID` to `app/lib/invoice-templates.ts`, where
`invoice-draft.ts` now imports it, so it leaves this list with a real cross-module
caller. The remaining six are unchanged. Feature 4 also added one new instance of
the same pattern: `PartyAddressLine` in `app/lib/format.ts:47` is exported with no
importer, since the templates infer the type from the function's return. Same
judgment call, same fix. Updated again the same day: the F-20 repair gave
`PartyAddressLine` a real importer in `CompactTemplate.tsx`, so it leaves this
list too. The original six from feature 1 and 2 are what remain.

Re-reviewed 2026-08-15 by /audit (scope: full). The five are no longer exported
and `toIsoDate` keeps its export with a comment explaining that its tests are the
reason. Nothing outside the module referenced any of them, and the suite is
green. **Closed.**

### 06a/F-06 [P3] closed - CSS-only packages sit in runtime dependencies

**File:** package.json:17
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `shadcn` and `tw-animate-css` are reached only through
`@import` in `app/app.css`, which is build-time input, yet they sit in
`dependencies` while `tailwindcss`, imported the same way, sits in
`devDependencies`. `shadcn` in particular pulls the whole CLI tree into a
production install, which works against the clone-and-run self-hosting story.
**Suggested fix:** move both to `devDependencies` to match how `tailwindcss` is
already treated, then confirm `pnpm build` still passes.
**Resolution:** Fixed 2026-08-15 by /implement. Both moved to
`devDependencies`. The proof is the build: they are reached only through `@import`
in `app.css`, so `pnpm build` passing afterwards is what shows they were build
time only. Runtime `dependencies` is now fourteen packages with neither in it.

Re-reviewed 2026-08-15 by /audit (scope: full). Both packages are in
`devDependencies`, runtime `dependencies` no longer lists either, and `pnpm build`
passes, which is the evidence that matters for packages reached only through an
`@import`. **Closed.**

### 06a/F-19 [P2] closed - The editor scrolls sideways on a phone-width screen

**File:** app/routes/editor.tsx:70
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** At a 360px viewport the document is 526px wide, so the whole
page scrolls horizontally and the right edge of every card sits off screen.
Measured in the running app: the form column reports 502px against a 345px
document width. The two-column grid is correctly gated behind the `editor`
breakpoint, so this is a minimum width inside the stacked column, not the grid.
Predates feature 4: the same 526px and 502px were measured with feature 4's work
stashed, with and without the template switcher present, so the switcher is a
passenger rather than the cause.
**Suggested fix:** the cause was located on 2026-08-14 by a later /audit pass:
`LineItemsCard.tsx:31` sets `grid-cols-[32px_1fr_78px_110px_104px_32px]`, whose
five fixed tracks and five 8px gaps come to 396px before the description column
gets anything, and the card and page padding carry it the rest of the way to the
measured 502px. Give the row a narrow-screen layout below the `editor`
breakpoint, or let the fixed tracks shrink there. `min-w-0` on the grid items is
usually the missing half of the fix, since grid children default to
`min-width: auto` and refuse to shrink past their content.

**Resolution:** Fixed 2026-08-15 by /implement, and it needed two changes rather
than the one this entry predicted. The line item row now stacks below `sm`, with
the numbers on their own labelled line and the header row hidden, which removed
the 396px of fixed tracks. That alone took the page from 526px to 418px against a
360px viewport, and measuring again found the second cause: the invoice paper in
the preview has its own minimum width, and both grid tracks inherited it. Adding
`min-w-0` to the editor's two columns lets the tracks shrink and leaves the paper
to scroll inside its own frame, which is what feature 3 built that frame for.

Verified at 360px: no horizontal scrollbar, document scroll width equals client
width, the rate field shows `4,500.00` in full, and the row is usable with every
input labelled. Verified at 1440px: fields still on one row at their original 78
and 110 pixel widths, header row visible, per row labels hidden (six present,
none visible).

Re-reviewed 2026-08-15 by /audit (scope: full). Both causes are addressed and the
criterion this entry set, no sideways scroll at 360px, is met: document scroll
width equals client width, the stacked row is usable with every field labelled,
and the 1440px layout is unchanged with the fields on one row at their original
widths. Reviewing the repair turned up a smaller residual at 320px, which is the
app bar rather than either element named here; it has its own entry as F-35.
**Closed.**

### 06a/F-27 [P3] closed - An unstyled print document would ship silently

**File:** app/lib/print-styles.ts:11
**Found:** 2026-08-14 by /audit (scope: full)
**Why it matters:** `PRINT_STYLES` is whatever `?inline` hands back, and under
Vitest that is an empty string because no Tailwind plugin runs there. The
production build was verified to carry the compiled CSS, so this is correct
today, but nothing checks it: if a config change ever broke the plugin chain, the
endpoint would keep returning 200 with a structurally perfect, completely
unstyled document, and the first person to notice would be whoever opened the
PDF. The failure is silent in exactly the artifact nobody re-reads before sending
it to a client.
**Suggested fix:** assert it once where it is cheap. A build-time check that the
emitted server bundle contains a known compiled utility is the honest version,
since the unit suite cannot see the real string. A runtime guard in the route
that refuses to render with empty styles is the smaller version and still beats
silence.

**Resolution:** Fixed 2026-08-15 by /implement. `buildPrintDocument` throws when
handed an empty stylesheet instead of returning a structurally perfect, unstyled
document. The call sits inside the route's existing try/catch, so the failure
surfaces as the 502 the endpoint already defines, with the reason in the Worker
log. Two tests cover it, empty and whitespace, and a real render still returns
89KB of PDF, which is what proves the guard does not fire on the real
stylesheet.

Re-reviewed 2026-08-15 by /audit (scope: full). `buildPrintDocument` throws on an
empty or whitespace stylesheet, two tests cover it, and the only production call
site sits inside the route's try, so the throw becomes the existing 502 with the
reason logged rather than an unhandled error. A real render still returns 89KB of
PDF, which is what shows the guard does not fire on the real stylesheet.
**Closed.**

### 06a/F-31 [P3] closed - The download's object URL is revoked in the same tick as the click

**File:** app/components/invoice/DownloadPdfButton.tsx:32
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** `saveBlob` creates an object URL, clicks a detached anchor,
and revokes the URL on the next line. Chromium starts the download synchronously
inside `click()`, so this works, and it was verified working in Chromium: a real
click produced `INV-0001.pdf` at 92KB. The pattern is known to be fragile
elsewhere, because revoking is what tells the browser the blob can go, and a
browser that begins the transfer after the current task can find the URL already
dead. The anchor also never enters the document, which older Firefox required.
Neither was tested outside Chromium, so this is a portability risk on the app's
one output, not an observed break.
**Suggested fix:** revoke on a later turn rather than immediately, and append the
anchor before clicking and remove it after. Both are one line and neither costs
anything in the browser where it already works.

**Resolution:** Fixed 2026-08-15 by /implement. The anchor is appended to the
document, clicked, and removed, and the object URL is revoked on a later turn via
`setTimeout` rather than in the same task as the click. Verified in the browser:
a click downloaded `INV-0001.pdf` at 91,674 bytes, and afterwards the document
contains zero `a[download]` elements, so nothing is left behind. Note for the
next reader: `document.body.append` does not typecheck in this project because
the Workers runtime types contribute a competing `append`; `appendChild` is
unambiguous.

Re-reviewed 2026-08-15 by /audit (scope: full). The anchor is appended, clicked,
and removed, and the revoke runs on a later task. Verified independently in the
browser: a click downloaded the file and afterwards `a[download]` matched zero
elements, so nothing is orphaned in the DOM. **Closed.**

### 06a/F-32 [P3] closed - Classic's serif is a different face in the PDF than in the preview

**File:** app/components/invoice/templates/ClassicTemplate.tsx:27
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Classic asks for `ui-serif, Georgia, "Times New Roman",
serif`, deliberately a system stack so the document needs no webfont. The
headless browser that renders the PDF runs on Linux, where none of those exist,
so it resolves to Liberation Serif: confirmed by reading the font table of a
rendered file, which embeds LiberationSerif and LiberationSerif-Bold alongside
Inter. The result is a perfectly respectable Times-like invoice, but a user on a
macOS browser approves a preview set in Georgia and downloads a file set in
something else, which is a dent in the "what you see is what downloads" promise
the preview exists to make. Minimal and Compact are unaffected, because Inter is
a webfont and loads in both places.
**Suggested fix:** either accept it and say so in the Classic template's comment,
so the next person does not treat it as a bug, or give Classic a webfont serif
the way the app already treats Inter, at the cost of a second font request in the
document feature 5a deliberately keeps light. Worth deciding with feature 13,
which is the next time the document's assets are opened.

**Resolution:** Accepted and documented 2026-08-15 by /implement, which is the
first of the two paths this entry offered. The comment beside Classic's face
records that the system stack is deliberate, that the Linux render box resolves
it to Liberation Serif while a macOS preview shows Georgia, that the layout is
identical either way, and that closing the gap means adding a webfont request to
every render. Recorded so the next reader treats it as a decision rather than a
bug. The behaviour is unchanged, so this is documentation rather than repair, and
an /audit pass should decide whether that satisfies the finding or whether the
webfont is wanted.

Re-reviewed 2026-08-15 by /audit (scope: full). Closed on the first of the two
paths this entry offered, accept and record, rather than by changing behaviour:
the comment beside Classic's face now states that the system stack is deliberate,
that the PDF comes back in Liberation Serif while a macOS preview shows Georgia,
that the layout is identical, and that closing the gap costs a webfont request on
every render. The difference between preview and PDF still exists and is now a
documented decision rather than an unexplained one. **Closed.** If matching faces
are wanted, that is new work and deserves a new entry rather than reopening this.

### 06a/F-34 [P3] closed - A rate limiter failure becomes an unexplained 500

**File:** app/routes/invoice.pdf.tsx:81

**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** `await isThrottled(env, request)` sits outside every
try/catch in the action; the one that exists starts later and wraps only the
browser work. If either `limit()` call rejects, the action throws, React Router
answers 500 "Unexpected Server Error", and nothing is written to the Worker log,
so the download simply stops working for a reason nobody can see. The binding is
local rather than a network call, so this is unlikely rather than impossible.
The deeper gap is that the choice is unmade: whether a limiter that cannot answer
should let requests through, which risks the quota, or refuse them, which breaks
downloads, is a real decision and the code currently makes it by accident.
**Suggested fix:** wrap the two `limit()` calls, log the failure the way the
render failure is logged, and pick a side explicitly with a comment saying why.
Failing open is the usual choice for a protective limiter, and here it hands the
browser quota to whatever caused the failure, so failing closed with a 503 is
defensible too.

**Resolution:** Fixed 2026-08-15 by /implement. The limiter calls are wrapped, a
failure is logged the way the render failure is, and the endpoint answers 503
with `Retry-After`. The choice is now explicit and commented: **fail closed**,
because waving traffic through hands the account's daily browser allowance to
whatever just broke, and that allowance cannot be refilled before tomorrow.
Verified the ordinary paths still work: a real download returns a PDF and the
throttle still answers 429 on the third request in a minute.

Re-reviewed 2026-08-15 by /audit (scope: full). Read the repair: both `limit()`
calls are inside the try, the failure is logged with the same shape as the render
failure, and the 503 carries `Retry-After`. The fail closed choice is stated in a
comment with its reasoning, so the decision is no longer implicit. Ordinary paths
re-verified: a real download returns a PDF and the throttle still answers 429.
**Closed.**
