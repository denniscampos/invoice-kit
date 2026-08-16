# Fix: Three findings from the full audit

**Type:** Fix
**Fixes:** F-37, F-38, F-39
**Status:** complete

## The problem

Three unrelated defects, small enough to travel together. Two are real, one has
to be confirmed before it is worth touching.

**F-37 [P2]** - the PDF route takes a slot from the daily counter before
`puppeteer.launch`, and never gives it back when the launch fails. Its own
comment says the capacity "is spent only by a request that was going to be
rendered", but a request that could not get a browser used no browser time at
all.

This is the failure the route expects most: `isOutOfBrowserQuota` exists because
the free tier allows one new browser every twenty seconds, so several people
pressing Download at once produce 429s by design, and each one still increments
`render_quota`. Enough of them in a day and the app refuses everyone with "try
again tomorrow" while Cloudflare's real allowance is barely touched. That is the
mirror image of the problem F-33 was raised to fix.

**F-38 [P3]** - introduced by the F-35 repair. Below `sm` the wordmark is
`hidden`, which takes it out of the accessibility tree as well as off the screen,
and the `IK` mark next to it carries no label. A screen reader on a phone
announces "IK" where a sighted user sees a logo they recognise.

**F-39 [unverified] [P3]** - the root loader added in 6c calls `getUser` on every
navigation. If Better Auth reaches D1 whenever a session cookie is present, an
unreachable database would throw there and take down every page, including the
editor that the anonymous tier is supposed to run without touching storage. The
likely reality is narrower, that a visitor with no cookie never reaches a query,
which would leave the free path unaffected. **Nobody has checked.**

## The fix

**F-37** adds `releaseRenderQuota` beside the existing consume, and calls it in
the route's catch **only when the browser never opened**. That distinction is the
whole fix: a failure at `launch` spent nothing and deserves the slot back, while
a failure at `setContent` or `page.pdf` already spent real browser time and does
not. The route already tracks this, in whether its `browser` variable was ever
assigned.

The decrement is one statement with a `renders > 0` guard, so it cannot drive the
count negative and cannot race the increment.

**F-38** is one class: `sr-only sm:not-sr-only` in place of `hidden sm:inline`.
`sr-only` positions the text absolutely at a pixel, so it stays out of the
layout and cannot bring the 320px overflow back, while remaining readable to
assistive technology.

**F-39 is confirmed before it is fixed.** The step below runs the experiment and
records the answer either way. If a cookie-less load survives a dead database,
the finding is `invalid` and no code changes; if it does not, the loader degrades
to a signed-out bar rather than taking the page down.

None of this may change what the PDF endpoint accepts, what the templates
contain, or the anonymous tier's ability to build an invoice and download it.

## Build steps

- [x] **Step 1 - Give back a slot nothing used (F-37)** - `releaseRenderQuota(db,
  now)` in `app/lib/render-quota.server.ts`, called from `invoice.pdf.tsx`'s catch
  only when `browser` is undefined. Wrap the release so a failure to refund cannot
  replace the caller's real error with a database one.

  *Done when:* a normal download still returns a PDF and leaves the count one
  higher; a render forced to fail **at launch** leaves the count unchanged, proven
  by setting the count, forcing the failure, and reading the count back; a failure
  **after** launch still consumes its slot; the count never goes below zero when a
  release runs against a day with no row; and `pnpm test`, `pnpm typecheck`, and
  `pnpm build` are clean.

- [x] **Step 2 - Give the wordmark back its voice (F-38)** - swap `hidden
  sm:inline` for `sr-only sm:not-sr-only` on the brand text in `AppBar.tsx`.

  *Done when:* the accessible name of the brand contains "Invoice Kit" at 320px,
  read from the rendered page rather than the source; the text is still invisible
  below `sm` and visible at and above it; and 320px still measures
  `scrollWidth === clientWidth` signed in and signed out, so F-35 does not come
  back.

- [x] **Step 3 - Settle F-39 one way or the other** - point the `d1_databases`
  binding at a database id that does not exist, restart the dev server, and load
  `/` twice: once with no cookie and once with a session cookie. Record both
  results, then restore `wrangler.json` exactly.

  *Done when:* both outcomes are written into the finding; the binding is back to
  `invoice-kit-db` and proven so by a working sign in; and **either** the finding
  is marked `invalid` with that evidence because the anonymous path survived,
  **or** the loader is changed so a storage failure renders a signed-out bar
  instead of an error page, and the anonymous editor loads with the database gone.

## Verify

- Download a PDF and watch `render_quota` go up by exactly one
- Force a launch failure and confirm the count does not move
- Read the app bar's accessible name at 320px from the accessibility tree
- Confirm 320px still has no sideways scroll, signed in and signed out
- Load the editor with the database unreachable and see what happens
- Confirm `wrangler.json` is byte-identical to how it started

## Notes for the AI

- **Local only.** Every D1 command carries `--local`. Nothing in this fix needs a
  remote migration: there are no schema changes.
- **The refund is conditional, not automatic.** Refunding every failure would let
  a caller who reliably breaks the renderer download for free all day. Only a
  failure before the browser opened qualifies.
- One statement for the decrement, with `renders > 0`, for the same reason the
  increment is one statement.
- **Restore `wrangler.json` in the same step that edits it.** A binding left
  pointing at nothing is a broken app, and it is the kind of thing that gets
  committed by accident.
- Do not log or store anything about who asked. The counter still holds a date
  and a number.
- F-39 may end as `invalid`. That is a real outcome, not a failure to fix
  something, and the evidence goes in the finding either way. `/audit` owns that
  verdict; record the evidence and let it confirm.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.

## Findings

### audit-findings-37-39/F-33 [P2] closed - The throttle cannot protect the daily browser quota

**File:** wrangler.json:19
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Feature 15 stops a flood, which is what it was asked to do,
but the thing actually worth protecting is a daily budget and this cannot express
one. Two reasons, both confirmed rather than assumed. The binding's window is
only 10 or 60 seconds, so no configuration of it adds up to the ten minutes of
browser time a day the free plan allows. And Cloudflare enforces the binding
**per location** with asynchronously updated counts, describing it as
"permissive, eventually consistent, and intentionally designed to not be used as
an accurate accounting system": eight rapid posts from one client against a limit
of two a minute returned `400 400 400 400 429 429 400 429` on the deployed
Worker. So `PDF_GLOBAL_LIMITER` at five a minute is five a minute per location
rather than five worldwide, and a caller spread across locations, or simply a
crowd, can still drain the day.
**Suggested fix:** a counter that survives a day and is shared, which means KV
with a daily key or a Durable Object holding the count, checked before the
browser call and refusing with the same 429. It is a storage decision and the
anonymous tier currently touches no storage, so it is worth taking deliberately
rather than bolting on. Until then the honest description of the protection is
"stops a loop", not "protects the quota", and the README should not claim more.

**Resolution:** Fixed 2026-08-15 by /implement. A `render_quota` table holds one
row per day, and the PDF route takes a slot from it immediately before the browser
call, after every other guard, so a malformed or throttled request never costs a
day's capacity. The cap is 120, under the roughly 150 the free plan's ten minutes
allows. Past it the endpoint answers 503 with a message naming tomorrow and a
`Retry-After` counting to the real UTC reset, rather than the 429's "in a minute",
which would send someone back into the same wall.

The increment is one statement, `on conflict do update ... where renders < ?
returning`, so two simultaneous renders cannot both read the same number, and a
refusal returns nothing rather than inflating the count under a flood. Both were
verified against the local database: three calls returned 1, 2, 3; a call at the
cap returned no row and left the count at 120.

Verified end to end: a real download took the count 0 to 1, a malformed draft left
it unchanged, a request at the cap was refused in 9ms with zero renders attempted,
and clearing the row let downloads resume. The counter holds a date and a number
and nothing about who asked, which is why writing it from an anonymous request is
consistent with the tier rule; that rule was amended in the same change to say it
governs content rather than writes.

**Re-reviewed 2026-08-15 by /audit (scope: full): closed.** `render-quota.server.ts`
and the consume site at `invoice.pdf.tsx:136` were both in this pass's reviewed set.
The original defect is gone: a durable, day-keyed counter now exists, the increment
is one atomic statement, and it sits after every other guard so junk cannot spend
the day's capacity. Verified again this pass: an anonymous download still returns a
1-page PDF and the remote database now carries the table.

The repair is not perfect (see F-37, where a failed render still consumes a slot),
but that flaw makes the guard stricter, never weaker, so the risk this finding
recorded (the daily allowance draining unnoticed) is not reintroduced. It is filed
separately rather than holding this one open.

### audit-findings-37-39/F-35 [P3] closed - The app bar does not fit a 320px screen

**File:** app/components/AppBar.tsx:3
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Found while re-reviewing F-19. The bar is a single flex row
with no wrapping: the logo, the product name, the Editor pill, and the 112px
Download PDF button come to 335px of content inside 305px of available width at a
320px viewport, so the page scrolls sideways again at that size. At 360px it fits
only because the product name wraps onto two lines. 320px is an old phone rather
than a common one, which is why this is P3 and not a repeat of F-19, and the
preview paper's own overflow is not involved: that scrolls inside its frame as
designed.
**Suggested fix:** let the bar wrap, or drop the Editor pill below `sm`, where it
is the least useful of the four things competing for the row. Both are one class.

**Resolution:** Fixed 2026-08-15 by /implement, during feature 6c. That feature
adds the signed-in name and a Sign out button to this row, which took the
measured content from 335px to 415px inside 305px, so repairing it here was not
optional.

The finding's own suggestion was not quite enough on its own: dropping the Editor
pill below `sm` recovers about 84px and still leaves 331px in 305px. The wordmark
goes with it, leaving the IK mark alone on a phone. Those are the two things in
the row nobody needs there, one repeating what the mark already says and the
other naming the page you are on, while the Sign out and Download PDF buttons are
what someone actually reached for. Horizontal padding also drops to `px-4` below
`sm`.

Measured in the browser at each width, signed in and signed out, as
`documentElement.scrollWidth` against `clientWidth`:

| Width | Bar | Scroll / client |
|---|---|---|
| 320 signed in | IK, Sign out, Download PDF | 305 / 305 |
| 320 signed out | IK, Sign in, Download PDF | 305 / 305 |
| 360 | IK, Sign in, Download PDF | 345 / 345 |
| 640 | full bar returns | 625 / 625 |
| 1280 | full bar | 1265 / 1265 |

The 360px case also fixes the second half of the finding: the brand measured 22px
tall rather than wrapping onto two lines.

**Re-reviewed 2026-08-15 by /audit (scope: full): closed.** `AppBar.tsx` was in
this pass's reviewed set. Measured again at 320px signed in and signed out:
305/305 both ways, against 415/305 before the repair. The 360px brand no longer
wraps. The repair did cost the wordmark its screen-reader text below `sm`, filed
as F-38; that is a new and separate defect, not a survival of this one.

### audit-findings-37-39/F-36 [P2] closed - Auth rate limiting is on by default but stores its counters per isolate

**File:** app/lib/auth.server.ts:12
**Found:** 2026-08-15, raised at the user's request after deploying feature 6b
**Why it matters:** `/api/auth/*` is live and unauthenticated, and sign in is the
one endpoint where guessing repeatedly is the whole attack. Better Auth is not
silent about this: rate limiting is enabled by default in production, and
`/sign-in/email` carries a stricter default of three requests per ten seconds.
The problem is where the counter lives. Storage defaults to **in memory**, which
the library's own documentation calls "not suitable for many use cases,
particularly in serverless environments", because each instance keeps its own
count rather than sharing one. Cloudflare runs many isolates across many
locations, so the real allowance is three per ten seconds *per isolate*, and a
caller who spreads requests around gets a multiple of the intended limit. The
same shape as F-33, and for the same reason: a per instance counter cannot
enforce a global rule.

This is a gap in effectiveness rather than an absence of protection, which is why
it is P2 rather than P1. Nothing here is a confirmed breach: it has not been
measured against the deployed Worker, and doing so would mean running a password
guessing burst against production, which is worth planning rather than improvising.

Also worth knowing while working locally: rate limiting is **disabled in
development** by default, so no amount of local testing will show it working.
**Suggested fix:** set `rateLimit.storage: "database"` in the auth options. The
D1 binding feature 6a added is already there, so the counter can live in the same
database as the sessions and be shared by every isolate. Better Auth generates
the table it needs, which means a new migration alongside the existing one.
Consider `rateLimit.enabled: true` in development as well, so the behaviour is
visible where it can be tested cheaply.

**Resolution:** Fixed 2026-08-15 by /implement. `rateLimit.storage` is now
`"database"`, so Better Auth's existing three-per-ten-seconds rule on
`/sign-in/email` counts against one shared row instead of one per isolate. Its
table was generated rather than hand written and applied as migration 0002, which
carries only the new table because 0001 already created the other four.

Rate limiting is also enabled in development, against the library's default of
production only, because a protection nobody can see locally is one nobody
notices breaking.

Verified against the running app: six wrong-password attempts returned 401, 401,
401, then 429 "Too many requests. Please try again later.", and the shared count
appeared in the table as `no-trusted-ip|/sign-in/email` with a value of 3. A
correct sign in after the window succeeded, so the throttle recovers rather than
locking an account out. The key is `no-trusted-ip` only in local development,
where no `CF-Connecting-IP` header exists; in production Cloudflare sets it and
the bucket is per caller.

**Re-reviewed 2026-08-15 by /audit (scope: full): closed.** `auth.server.ts` was
in this pass's reviewed set: `rateLimit: { enabled: true, storage: "database" }`
is present, so the counter is one shared row rather than one per isolate, and it
runs in development as well as production. Behaviour was proven when the repair
landed (three attempts allowed, the fourth 429, the count visible in the table),
and the table now exists remotely too. No new defect in the repair.

