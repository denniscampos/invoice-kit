# Feature: Sign up and sign in

**From build-plan:** feature 6b
**Status:** complete

## Goal

The two pages that turn 6a's endpoints into something a person can use: create an
account, come back and sign in, and land back in the editor with a session. 6c
then shows who is signed in and adds sign out.

## Design reference

No mockup, and none is needed. `project-overview.md` says sign up and sign in are
"plain, single-purpose pages", and everything they need already exists: the
`Card`, `Input`, `Label`, and `Button` primitives, the theme tokens, and the
`Field` component features 1 and 2 built. This is not a replication of an
existing design, so prose plus the components in the repo is the whole target.

`blueprint/reference/editor-mockup.html` does draw a `Sign in` button in the app
bar, which is where step 3 puts the link.

## The shape of it, decided up front

**The forms post to our own actions, not to `/api/auth` from the browser.**
Better Auth can be called server side through `auth.api.signUpEmail` and
`auth.api.signInEmail`, and that is the right seam here for three reasons:

- `coding-standards.md` asks for `<Form>` and route actions rather than a hand
  rolled `fetch`, so the pages work the way the rest of the app does.
- Validation and error handling happen on the server, where they belong.
- It sidesteps the origin check entirely. A server side call is a function call,
  not an HTTP request with an `Origin` header, so the pages cannot break because
  a dev server came up on a different port. That already happened once while
  verifying 6a.

The session still has to reach the browser, so the action asks for the response
headers (`returnHeaders: true`), takes `headers.getSetCookie()`, and attaches
them to the redirect. **Forgetting that is the one bug that would make sign up
look like it worked while leaving the user signed out.**

## In scope

- `/sign-up` and `/sign-in`, each a plain form in a card
- Route actions calling Better Auth server side, forwarding the session cookie
- Server side validation and readable errors for every refusal Better Auth can
  return
- A `Sign in` link in the app bar so the pages are reachable
- Pinning the dev server port, so `BETTER_AUTH_URL` stops drifting out of sync

## Out of scope

- **Sign out, and anything session aware in the app bar** (6c). The link added
  here is static and always visible; 6c makes it reflect who is signed in.
- **The `requireUser` helper and protected routes** (6c, first used by feature 7).
- **Carrying an anonymous draft through sign up** (feature 8). Signing up does
  not touch the draft in `sessionStorage`; it stays exactly where it was, which
  is also what makes feature 8 possible later.
- **Password reset and email verification.** Deferred at 6a and still deferred:
  a forgotten password means a new account for now.
- **Social login, remember me, and account settings.**

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - A dev server port that does not move** - set
  `server.port: 5180` and `server.strictPort: true` in `vite.config.ts`, and
  point `.dev.vars` and `.dev.vars.example` at `http://localhost:5180`.

  The flag is the fix, not the number: without `strictPort`, Vite walks to the
  next free port when its own is busy, and `BETTER_AUTH_URL` silently stops
  matching. That is exactly what happened while verifying 6a, where the server
  came up on 5177 against a configured 5176 and auth answered 403.

  5180 rather than Vite's default 5173 because another project on this machine
  lives on 5173 and 5174. A port per project means both can run at once and
  neither drifts; sharing one would mean whichever started second refuses to
  start, which is deterministic but needlessly annoying.

  *Done when:* `pnpm dev` serves `http://localhost:5180`; two consecutive runs
  give the same port; a second dev server started while one is running fails with
  a port-in-use error rather than moving; `BETTER_AUTH_URL` matches; and the
  editor and the PDF endpoint still answer on the new port.

- [x] **Step 2 - Sign up** - `/sign-up`: a card with name, email, and password,
  posting to its own action, which calls `auth.api.signUpEmail` with
  `returnHeaders: true`, forwards `headers.getSetCookie()` onto a redirect to the
  editor, and renders a readable message when it refuses. Add
  `authErrorMessage(error)` in `app/lib/auth-errors.ts` turning Better Auth's
  thrown `APIError` into one sentence, with a generic fallback so an unknown
  failure never renders an object or a stack. *Done when:* `pnpm test` covers
  `authErrorMessage` for a duplicate email, invalid credentials, a short
  password, an error with no message, and a non-error value; signing up in the
  browser lands on the editor **signed in**, proven by a session cookie and a row
  in `session`; a duplicate email re-renders the form with "already exists"
  rather than a stack; a short password is refused with a message naming the
  minimum; the fields the user typed survive the failed submit; and the console
  is clean.

- [x] **Step 3 - Sign in, and the way in** - `/sign-in` in the same shape, using
  `auth.api.signInEmail`; a `Sign in` link in the app bar's actions slot; and a
  link between the two pages in both directions. Both loaders redirect to the
  editor when a session already exists, so a signed in person cannot sit on a
  sign in form. *Done when:* signing in with the right password lands on the
  editor with a session; a wrong password re-renders with "Invalid email or
  password" and the same message for an unknown email, so neither reveals which
  emails exist; visiting either page while signed in redirects to the editor;
  the app bar link reaches `/sign-in`; both pages are keyboard operable with
  labelled fields; and they read cleanly at 360px.

## Files / areas

- `vite.config.ts` - the pinned dev port
- `.dev.vars`, `.dev.vars.example` - `BETTER_AUTH_URL` matching it
- `app/lib/auth-errors.ts`, `app/lib/auth-errors.test.ts` - new
- `app/routes/sign-up.tsx`, `app/routes/sign-in.tsx` - new
- `app/routes.ts` - registers both
- `app/components/AppBar.tsx` - only if the link needs a home beside `actions`
- `app/routes/editor.tsx` - passes the link into the app bar

## Data / contracts

```ts
// app/lib/auth-errors.ts
export function authErrorMessage(error: unknown): string;

// POST /sign-up   name, email, password  -> 302 to / with Set-Cookie
// POST /sign-in   email, password        -> 302 to / with Set-Cookie
// Either, on refusal: the form re-rendered with a message
```

Rules this feature must hold to:

- **The cookie from Better Auth is forwarded or nothing is signed in.** The
  action takes `headers.getSetCookie()` from the auth call and puts it on the
  redirect. A redirect without it looks like success and leaves the user
  anonymous.
- **The session is never trusted from the client.** These pages create it; every
  later reader resolves it server side from the request.
- **Both refusals say the same thing.** A wrong password and an unknown email
  both answer "Invalid email or password", so the form cannot be used to discover
  which addresses have accounts.
- **The auth instance is still built per request**, through `createAuth(env)`
  from the context. Nothing caches it at module scope.
- **The anonymous tier is untouched.** The editor and the PDF endpoint keep
  working with no session, and the draft in `sessionStorage` is not read, moved,
  or cleared by signing up.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic: `authErrorMessage` (step 2), the one pure function here, and
worth testing because it stands between a thrown library error and what a user
reads.

Steps 1 and 3 are configuration and pages, and ride on browser evidence plus the
database, as their done-whens describe.

Verify by hand at the end:

- Sign up, then confirm the row in `user` and the row in `session` locally
- Sign up with an address that already exists and read the message
- Sign up with a five character password and read the message
- Sign in with the right password, then with the wrong one, then with an email
  that does not exist, and confirm the last two say the same thing
- Visit `/sign-in` while signed in and confirm the redirect
- Fill the editor with a draft, sign up, and confirm the draft is still there
- Tab through both forms and submit with the keyboard alone
- Narrow to 360px and confirm both pages still read

## Notes for the AI

- **`auth.api.*` throws on refusal.** Wrap each call, and let
  `authErrorMessage` decide what the user sees. Never render the error object.
- `headers.getSetCookie()` returns an array. Set every entry on the redirect, not
  just the first.
- Bindings reach the action through `context.get(cloudflareContext)`, and the
  auth instance through `createAuth(env)`.
- Use `data(..., { status })` for a re-rendered form with an error, and `redirect`
  for success, per `coding-standards.md`.
- Keep the fields the user typed on a failed submit. Retyping an email because
  the password was short is the kind of small insult that makes a form feel
  broken.
- Better Auth's default minimum password length is 8. Do not restate it in the
  form's own validation without also saying it in the label, or the user meets a
  rule nobody told them about.
- These are pages, not resource routes: they export a component as well as a
  loader and action.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.
