# Feature: Session in the app

**From build-plan:** feature 6c
**Status:** complete

## Goal

6b created sessions but nothing in the app can see one. The app bar still shows a
static `Sign in` link to a person who signed in ten seconds ago, and there is no
way back out. This feature makes the chrome tell the truth about who is signed
in, adds sign out, and leaves behind the session helper that feature 7 will use
to scope every invoice query.

It is the last piece of feature 6.

## Design reference

`blueprint/reference/editor-mockup.html:209` draws the app bar, but **only its
anonymous state**: `Sign in`, `Save`, `Download PDF`. There is no mockup of a
signed-in bar, so this feature decides that treatment. The decision, kept
deliberately small:

- **Signed in:** the user's name in muted text, then a ghost `Sign out` button,
  in place of the `Sign in` link. The name is hidden below `sm`, where the row
  has no width to spare; the button stays.
- **Anonymous:** exactly what is there today.

**No dropdown menu and no avatar.** A menu whose only item is `Sign out` is worse
than a button that says `Sign out`, and `coding-standards.md` asks not to add a
dependency for what a few lines of Tailwind already handle. No new shadcn
primitive is installed by this feature.

Two things in that mockup belong to later features and are **not** built here:
the `Save` button (feature 7) and the `Invoices` nav link (feature 9).

## The shape of it, decided up front

**The session is resolved once, in a root loader.** The editor has no loader
today and is entirely client state. Adding the lookup to `root.tsx` rather than
to each page means every future page (the invoice list, the detail view) gets a
truthful app bar for free, and the answer arrives with the document rather than
after a client fetch, so the bar never flickers from anonymous to signed in.

**The bar stays dumb.** `AppBar` takes an `actions` slot and knows nothing about
invoices; it will not learn about sessions either. A new `SessionActions`
component reads the root loader's data and renders one of the two states, and the
editor passes it into the slot beside `DownloadPdfButton`. Nothing in the
component tree needs to know that the app bar exists.

**Sign out posts to our own route action.** Better Auth's `POST /api/auth/sign-out`
already works through the splat route, but 6b established the pattern for a
reason: a server side call is a function call, not an HTTP request with an
`Origin` header, so it cannot break when the dev server moves. The clearing
cookie must ride the redirect exactly as the session cookie does on sign in.

**Sign out is POST only.** A `GET /sign-out` is a route that any link prefetcher,
crawler, or `<img src>` on another site can fire, and the result is a user
mysteriously logged out. The route exports an `action` and no `loader`, so a GET
is a 405 from the router rather than a working sign out.

## In scope

- `getUser(request, env)` and `requireUser(request, env)` in `app/lib/auth.server.ts`
- `safeRedirectTo(value)`, the same-site guard for `?redirectTo=`, plus both auth
  pages honouring that parameter so the round trip is complete and proven here
  rather than half-built for feature 7
- `/sign-out`: a POST-only route action that ends the session and forwards the
  clearing cookie
- A root loader exposing the signed-in user to every page
- `SessionActions`: the name and `Sign out` when signed in, `Sign in` when not
- Refactoring the two existing `getSession` call sites in the auth pages onto the
  new helper, so there is one way to ask who is signed in
- **Repairing F-35** (the app bar overflowing a 320px screen), because this
  feature adds a third item to the row that already does not fit

## Out of scope

- **Protected routes.** `requireUser` ships here because the build plan asks for
  it, but nothing in the app needs protecting yet: the editor is public by
  design and `/invoices` does not exist until feature 9. Feature 7 is its first
  real caller. See the note under Notes for the AI about shipping it early.
- **The mockup's "Not signed in, your invoice stays in this tab" banner.** It
  ends "create an account to save it", and saving does not exist until feature 7.
  A banner that promises a button nobody can press is worse than no banner.
- **Saving anything** (feature 7), the **invoice list** (feature 9), and
  **carrying the anonymous draft through sign up** (feature 8). Signing out does
  not touch the draft in `sessionStorage`.
- **Account settings, change password, delete account, session management.**
- **Password reset and email verification**, still deferred from 6a.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - One way to ask who is signed in** - add `getUser`,
  `requireUser`, and `safeRedirectTo` to `app/lib/auth.server.ts`, then move
  `sign-in.tsx` and `sign-up.tsx` onto `getUser` so the inline
  `createAuth(env).api.getSession(...)` appears in one place instead of three.
  `requireUser` throws `redirect` to `/sign-in?redirectTo=<current path>` when
  there is no session.

  **Close the loop in the same step:** both auth pages send a successful sign in
  or sign up to `safeRedirectTo(url.searchParams.get("redirectTo"))` instead of a
  hardcoded `/`. Without this the parameter is written by one half of the app and
  read by nobody, and the guard would be untested code protecting a path that
  does not exist yet.

  *Done when:* `pnpm test` covers `safeRedirectTo` for a normal path, a path with
  a query string, `//evil.com`, `https://evil.com`, `javascript:alert(1)`, a
  backslash-prefixed path, an empty string, and a missing value, with everything
  off-site collapsing to `/`; visiting `/sign-in?redirectTo=/sign-up` and signing
  in lands on `/sign-up`, while `?redirectTo=https://example.com` lands on `/`;
  both auth pages still redirect a signed-in visitor to the editor; signing in
  and signing up both still work end to end; and `pnpm typecheck` and
  `pnpm build` are clean.

- [x] **Step 2 - The way out** - `app/routes/sign-out.tsx`: an action that calls
  `auth.api.signOut` with `returnHeaders: true`, forwards every
  `headers.getSetCookie()` entry onto a redirect to `/`, and exports no loader
  and no component. Registered in `app/routes.ts`.

  *Done when:* `curl -X POST` with a valid session cookie answers 302 to `/` and
  sets a clearing cookie; the `session` row for that token is gone from the local
  database afterwards; a `GET /sign-out` does **not** sign anyone out; a POST
  with no session cookie still redirects to `/` rather than erroring, because
  double-clicking sign out is not an error condition; and nothing ran with
  `--remote`.

- [x] **Step 3 - The bar tells the truth** - a root loader returning the signed-in
  user (id, name, email) or `null`, plus `app/components/SessionActions.tsx`
  reading it through `useRouteLoaderData("root")` and rendering either the name
  and a `Sign out` form, or today's `Sign in` link. The editor passes
  `<SessionActions />` into the app bar's `actions` slot, replacing the static
  link and its "6c makes this reflect who is signed in" comment.

  A user whose `name` is blank shows their email instead. Better Auth does not
  require a name, 6b's own validation is what makes it non-empty, and a bar that
  greets someone with an empty space is a worse bug than a long email.

  *Done when:* signed in, the bar shows the name and a `Sign out` button, and
  pressing it lands on the editor signed out with the bar showing `Sign in`
  again; signed out, the bar renders exactly as it does today; a user with a
  blank name shows their email, proven by blanking one locally; the loader
  returns `null` rather than throwing when there is no session; sign out is a
  real `<Form method="post">` rather than a click handler; the draft in
  `sessionStorage` survives signing out; and the console is clean.

- [x] **Step 4 - Repair F-35, which this feature just made worse** - the app bar
  fits a 320px viewport with the new content in it. Per the finding's own
  suggestion, drop the `Editor` pill below `sm` and hide the user's name at the
  same breakpoint; the brand, the `Sign out` button, and `Download PDF` are what
  matter on a phone.

  *Done when:* at 320px there is no horizontal page scroll signed in **or**
  signed out, measured as `document.documentElement.scrollWidth <= clientWidth`;
  the bar still reads correctly at 360px, 768px, and full width; and the finding
  is marked `fixed` in `blueprint/context/findings.md` with that evidence.

## Files / areas

- `app/lib/auth.server.ts` - `getUser`, `requireUser`, `safeRedirectTo`
- `app/lib/auth.server.test.ts` - new, covering `safeRedirectTo`
- `app/routes/sign-out.tsx` - new, action only
- `app/routes.ts` - registers `/sign-out`
- `app/root.tsx` - gains a loader; it has none today
- `app/components/SessionActions.tsx` - new
- `app/components/AppBar.tsx` - the `sm` breakpoint for F-35 only; the component
  keeps knowing nothing about sessions
- `app/routes/editor.tsx` - passes `SessionActions` into the slot
- `app/routes/sign-in.tsx`, `app/routes/sign-up.tsx` - onto `getUser`
- `blueprint/context/findings.md` - F-35 marked `fixed` by step 4

## Data / contracts

```ts
// app/lib/auth.server.ts
export type SessionUser = { id: string; name: string; email: string };

export function getUser(request: Request, env: Env): Promise<SessionUser | null>;
export function requireUser(request: Request, env: Env): Promise<SessionUser>;
export function safeRedirectTo(value: string | null | undefined): string;

// app/root.tsx
// loader -> { user: SessionUser | null }

// POST /sign-out  ->  302 to / with the clearing Set-Cookie
// GET  /sign-out  ->  400; no loader, so the router refuses it
//                     (predicted 405 while specced; React Router answers 400)
```

`SessionUser` is **load-bearing**. It is the shape the app bar reads now and the
shape feature 7 takes `userId` from when it scopes invoice queries, so it is
deliberately the three fields the UI needs rather than Better Auth's whole user
object. Widening it later is easy; narrowing it once three features read it is
not.

Rules this feature must hold to:

- **The session is resolved server side, from the request, every time.** No user
  id is ever read from a form field, a query parameter, or client state. Feature
  7 scopes invoices by the id `getUser` returns, and that is the entire basis of
  one user not seeing another's invoices.
- **The clearing cookie is forwarded or nothing is signed out.** The mirror image
  of 6b's cookie bug: a redirect without the header looks like it worked and
  leaves the session live.
- **`requireUser` throws, never returns null.** A helper that can return
  `undefined` invites `user!.id` at the call site, which is the exact assumption
  that becomes a security bug the day it is wrong.
- **`safeRedirectTo` returns a path, never a URL.** Anything with a scheme, a
  host, or a leading `//` or `\` collapses to `/`.
- **The auth instance is still built per request** through `createAuth(env)`.
- **The anonymous tier is untouched.** The editor, the preview, the template
  switcher, and the PDF download all keep working with no session.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic, and the only unit-testable thing this feature adds:

- **`safeRedirectTo`** (step 1). A pure string function with real edge cases and
  a security consequence if it is wrong, which is exactly the scope rule's
  target. Its table of cases is written into step 1's done-when.

`getUser` and `requireUser` are not unit tested: both need a live D1 binding, and
`vitest.config.ts` deliberately runs in `node` with no Cloudflare plugin. They are
proven against the running app instead, as their steps describe. `SessionActions`
is a component and rides on browser evidence, per the scope rule.

Verify by hand at the end:

- Sign in, confirm the name appears in the bar, sign out, confirm `Sign in` is
  back and the `session` row is gone locally
- Sign out twice in a row and confirm the second is a redirect, not an error
- `GET /sign-out` and confirm it does not end the session
- Build a draft, sign out, and confirm the draft is still in the editor
- Visit `/sign-in` while signed in and confirm it still redirects
- Narrow to 320px signed in and signed out and confirm no sideways scroll
- Download a PDF with no account, to prove the anonymous path is untouched

## Notes for the AI

- **`requireUser` ships ahead of its first caller, deliberately.** The build plan
  asks for it here and feature 7 is the caller. Do not invent a protected route
  to justify it, and do not skip it. If `/audit` later flags it as unused, the
  answer is the build-plan line, not a deletion.
- **Root loaders run on every navigation.** `getUser` is one indexed lookup by
  session token, which is fine, but do not add anything else to that loader
  casually: whatever goes in it is paid for on every page load in the app.
- **`useRouteLoaderData("root")` can return `undefined`** while the root loader
  has not run, and inside the `ErrorBoundary`, which renders without it. Handle
  that rather than asserting; a crash in the app bar takes the whole page down.
- Better Auth's sign out is `auth.api.signOut({ headers: request.headers })`.
  Take `returnHeaders: true` and forward `getSetCookie()`, as 6b does.
- **`signOut` throws when there is no session to end.** Catch it and redirect to
  `/` anyway. Someone pressing sign out on a session that already expired wants
  to end up signed out, not looking at an error page, and the outcome they asked
  for is already true.
- `redirect` is **thrown** in loaders here and returned from actions, matching
  the existing pages.
- The editor's `<AppBar>` block is currently indented one level too deep
  (`editor.tsx:72`). Fix it while touching that JSX; do not reformat anything
  else.
- Bindings reach loaders and actions through `context.get(cloudflareContext)`.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.
