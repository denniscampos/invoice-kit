# Coding Standards

> Your conventions. Tuned by `/onboard` to the real stack: React Router 8 (SSR)
> + React 19 + TypeScript + Tailwind CSS v4 + Vite, deployed to Cloudflare
> Workers with Wrangler, managed with pnpm. Edit anything that doesn't fit.

## Stack

| Area | Choice |
| --- | --- |
| Framework | React Router 8, framework mode, SSR on (`react-router.config.ts`) |
| Runtime | Cloudflare Workers (`workers/app.ts`, `wrangler.json`) |
| UI | React 19 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Build | Vite 8 |
| Language | TypeScript (strict, project references) |
| Package manager | pnpm |
| Tests | Vitest, `pnpm test`, gate on (see Testing) |

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## React Router

- Routes are declared in `app/routes.ts`; route modules live in `app/routes/`
- Load data in a route `loader`, mutate in a route `action`; both run on the Worker
- Use the generated `./+types/<route>` types for `loaderData`, `actionData`, and params
- Use `<Form>` and `useFetcher` for mutations rather than hand-rolled `fetch`
- Throw `Response` (or `data(..., { status })`) for error and redirect cases
- Cloudflare bindings reach loaders/actions through the app context (`app/context.ts`),
  never through module-level globals
- Keep the Worker entry (`workers/app.ts`) thin; app logic belongs in `app/`

## File Organization

- Route modules: `app/routes/[name].tsx`
- Shared components: `app/components/[feature]/ComponentName.tsx`
- Server-only logic: `app/lib/[feature].server.ts`
- Types: `app/types/[feature].ts`
- Utils: `app/lib/[utility].ts`

These conventions are in force: features 1 through 7 follow them, and the starter's
`app/routes/home.tsx` and `app/welcome/` are long gone.

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Tailwind v4: CSS-first config (`@theme` in `app/app.css`), no `tailwind.config.js`
- No inline styles
- Support both color schemes with Tailwind's `dark:` variants, as the starter does

## UI components

- Use shadcn/ui for primitives (button, input, dialog, select, table, and so on)
- shadcn components are added with its CLI and then owned by this repo; edit them
  in place rather than wrapping them in a second layer
- Generated primitives live in `app/components/ui/`; feature components that
  compose them live in `app/components/[feature]/`
- Reach for a shadcn primitive before hand-rolling one, but do not add a
  dependency for something a few lines of Tailwind already handles

> shadcn/ui is not installed yet. Its `init` runs as the first step of feature 1
> (invoice editor), the feature that first needs the primitives.

## Auth and access

Two tiers. **Anonymous** users can build an invoice and download its PDF.
**Signed-in** users can save, list, edit, track, and upload. The split is not
cosmetic: it is the line between "touches no storage" and "touches storage".

- Better Auth handles sign-up, sign-in, sessions, and password hashing; its
  tables live in the same D1 database
- Never hand-roll password hashing, session tokens, or reset flows
- Resolve the session server side in the loader or action; never trust a user id
  that arrived from the client, in any form
- Every user-owned table carries `userId`, and every query against user-owned
  data filters on it in the query itself, not after the fact
- A signed-in user requesting someone else's record gets a 404, not a 403, so the
  app does not confirm the record exists
- A missing session on a protected route redirects to sign-in

Rules for the anonymous tier:

- **No anonymous user content reaches D1 or R2.** An anonymous invoice lives in
  `sessionStorage` until the user signs up, never `localStorage`: the draft holds
  a third party's billing details and should not outlive the tab. A logo on an
  anonymous invoice is a client-side data URL inlined at render time, never an R2
  object.

  This is a rule about **content**, not about writes. Infrastructure counters may
  be written by anonymous requests, because they hold no one's information: the
  daily render counter is a date and a number, and Better Auth's rate limit rows
  are a key and a count. Both exist so that an anonymous request cannot spend a
  shared resource, which is the same interest the rule above protects. Nothing
  about who asked is recorded either way.
- The PDF endpoint is the only expensive thing an anonymous request can reach.
  It must stay rate limited, and it must not accept an invoice large enough to
  be a denial-of-service payload.
- Validate every external input on both tiers. No login does not mean no
  untrusted input.

## Data

Cloudflare D1 (SQLite) for records, R2 for logos. D1 is wired up and carries auth
(feature 6) and invoices (feature 7). R2 is not bound yet; it lands with the logo
upload, feature 13.

- Schema changes ship as D1 migration files, applied locally and then remotely;
  never edit a table by hand in the dashboard
- R2 holds the bytes, D1 holds the object key and metadata
- Money is stored as integer minor units, never floats
- Store dates as ISO `YYYY-MM-DD` and timestamps as ISO 8601 UTC

- Bindings are declared in `wrangler.json` and typed by `pnpm cf-typegen`
- Reach bindings through the loader/action context, not module scope
- Validate every external input (form data, params, query, webhook bodies) before use
- Scope every user-owned query by the authenticated user id from the session;
  never trust a client-supplied id

## Error Handling

- Use try/catch in loaders and actions; let expected failures surface as thrown
  `Response`s so route `ErrorBoundary`s can render them
- Return `{ success, data, error }` from actions consumed by `useFetcher`
- Never leak internal error text or secrets to the client; log detail to the
  Worker (observability is enabled) and show a user-friendly message

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding for this project: Vitest (the natural fit for a Vite app), with
`vi.mock()` for external dependencies and `vi.useFakeTimers()` for time-dependent
logic. Worker-level code can run under `@cloudflare/vitest-pool-workers` if a
step needs real bindings.

Vitest reads `vitest.config.ts`, deliberately standalone so a test run does not
load the Cloudflare and React Router plugins from `vite.config.ts`. Tests run in
the `node` environment and match `app/**/*.test.ts`. There is no DOM environment
configured, which is consistent with the scope rule above: pure logic is tested,
components are not. `passWithNoTests` is false, so an empty run fails.

Prefer passing a clock in over faking one. `createEmptyDraft(today)` takes a
`Date` for exactly this reason, so its tests need no timer mocking.

**Current gate status: on.** `AGENTS.md` declares `pnpm test` (Vitest), so a step
that adds in-scope logic ships a passing test in the same diff. UI and
integration steps still ride on browser, screenshot, and build evidence.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- If Playwright is already installed, or the Commands section of `AGENTS.md`
  declares a Playwright script, use Playwright for browser checks, screenshots,
  console-error checks, and user-flow verification.
- If Playwright is not installed, do not add it silently in the middle of an
  unrelated feature. Use the available dev server, browser screenshots, build
  output, API output, or manual verification evidence instead.
- Add Playwright only when the user asks for it, or when the current spec is
  explicitly about setting up browser automation.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
