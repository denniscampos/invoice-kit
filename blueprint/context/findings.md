# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-08 [P3] open - Clearing the issue date wipes a due date typed to exactly the default

**File:** app/components/invoice/InvoiceDetailsFields.tsx:41
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The F-07 repair clears an unpinned due date when the issue
date is cleared, which is what keeps the pin derivation total. A due date the
user typed by hand to exactly `issueDate + 30` is indistinguishable from one that
was merely following along, so clearing the issue date discards it. Reproduced in
the browser: issue `2026-08-14`, due typed as `2026-09-13`, clear the issue date,
and the due date empties. This is the residual cost of deriving the pin instead of
storing it, and it is much smaller than F-01 and F-07: the value disappears
immediately and visibly in response to the user's own edit of the adjacent field,
rather than being silently rewritten later by an unrelated action. The user can
retype it.
**Suggested fix:** accept it, or make the pin explicit by adding a persisted
`dueDatePinned` boolean to `InvoiceDraft`. That removes the ambiguity completely,
at the cost of putting a piece of UI state into a type that otherwise mirrors the
D1 schema, so it is a deliberate contract change rather than a quick patch. Not
worth doing on its own; worth doing if feature 18 or 19 adds more derived date
behavior.
**Resolution:**

### F-11 [P3] open - An out-of-range line total silently renders as zero

**File:** app/lib/money.ts:60
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `lineItemTotal` returns `0` when the product leaves safe
integer range, so a quantity of `99999999999999` at `1000.00` shows an amount of
`0.00` rather than refusing the input. Reproduced in the running app. Zero is a
worse answer than the last good value, because it silently changes the invoice
total. Only reachable with an absurd quantity, hence P3.
**Suggested fix:** have `lineItemTotal` return `null` for the out-of-range case
and let the caller keep the previous total, matching how the parsers already
treat input they cannot represent. Alternatively bound `parseQuantity` to a
sensible maximum so the product can never overflow.
**Resolution:**

### F-15 [P3] open - A European thousands dot reads as a decimal point

**File:** app/lib/money.ts:16
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The mirror of the ambiguity F-10 accepted. A single dot is
always the decimal point, so `"1.234"` typed by someone who means one thousand
two hundred and thirty four parses as `1.23`. Reproduced in the running app. It
is the same unsolvable-from-the-string problem as `1,250`, resolved the other way
because each separator follows the en-US convention, and the error runs in the
safer direction (an undercharge the user is likely to notice) but is a thousand
fold rather than a hundred fold.
**Suggested fix:** nothing local will settle it, because the string genuinely
carries both readings. The durable answer is a number format that follows the
selected currency or an explicit locale setting (feature 22), at which point
both this and the `1,250` case become deterministic. Until then it is a
documented limitation, not a bug to patch.

Updated 2026-08-14 by /audit: since the F-14 repair, `parseQuantity` shares the
same helper, so this limitation now applies to the quantity column as well as
the rate. That is the right trade, since the two fields agreeing matters more
than either one guessing differently, but it widens what a locale setting would
have to fix.
**Resolution:**

### F-18 [P3] open - A very wide amount overflows its fixed column into the page margin

**File:** app/components/invoice/InvoiceTemplate.tsx:61
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The F-16 repair gave the numeric columns fixed widths
(`w-16`, `w-24`, `w-28`), which is what stops a long word widening the document.
The trade is that a number too wide for its column no longer widens it either: it
overflows. Reproduced at 99999 x 999999.99, where the amount `€99,998,999,000.01`
needs 142px in a 112px cell and its text runs 30px past the column, eating into
the paper's right margin. Nothing is clipped or hidden today and the document
does not stretch, so this is cosmetic at the preview stage, but feature 5 renders
this same component to a fixed page where the margin is real.
Ten-figure invoices are not the realistic trigger. Widening the currency picker
is: 20,000,000 IDR or VND is an ordinary amount, and those codes plus grouping
reach the same width at everyday values.
**Suggested fix:** leave it until feature 22 widens the currency list, then size
the amount column from the currency rather than a constant, or let the numeric
cells wrap when they must (dropping `whitespace-nowrap` on the amount column
only). Both are cheap; neither is worth doing while the picker holds five
similar currencies.
**Resolution:**

### F-23 [P3] open - The three templates each keep their own copy of the document's rules

**File:** app/components/invoice/templates/CompactTemplate.tsx:1
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Minimal, Classic, and Compact each carry their own
`ItemsTable`, `Totals`, `InvoiceFooter`, and `PartyBlock`, roughly 700 lines
across the three. Different markup per template is the point of having templates,
and the shared data shaping was correctly extracted to `partyAddressLines`. What
is duplicated is the small print of the rules: the `No items yet` empty row, the
footer that disappears when both blocks are empty, the muted placeholder when a
party has no name, and the subtotal plus total pair. Feature 19 adds tax and
discount rows to all three, and feature 13 adds a logo, so each is three edits
that must agree. `templates.test.ts` is the current guard: it asserts field
parity across every registered template, so a missed copy fails the suite rather
than shipping.
**Suggested fix:** leave it for now and revisit at feature 19, when a second
whole-document change either proves the duplication cheap or expensive. If it
needs solving, share the predicates (an `isEmptyFooter` style helper) rather than
a layout component parameterized by props, which would defeat the point of
separate templates.

**Resolution:**

### F-33 [P2] fixed - The throttle cannot protect the daily browser quota

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

### F-35 [P3] open - The app bar does not fit a 320px screen

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

**Resolution:**

### F-36 [P2] fixed - Auth rate limiting is on by default but stores its counters per isolate

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
