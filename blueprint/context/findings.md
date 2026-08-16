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

### F-37 [P2] fixed - A render that never happens still spends the day's quota

**File:** app/routes/invoice.pdf.tsx:136
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** The slot is taken before `puppeteer.launch`, and nothing gives
it back when the launch fails. The comment above it says the capacity "is spent
only by a request that was going to be rendered", and a request that could not
get a browser was not rendered: it used no browser time at all.

This is the failure the route itself expects most. `isOutOfBrowserQuota` exists
because the free tier allows one new browser every twenty seconds, so a handful
of people pressing Download at once produces 429s by design. Each of those still
increments `render_quota`. Enough of them in a day and the app serves "try again
tomorrow" while Cloudflare's actual allowance is barely touched, which is the
mirror image of the problem F-33 was raised to fix.

It errs toward refusing rather than over-spending, which is why this is P2 and
not higher.
**Suggested fix:** release the slot when the failure happened before any real
rendering. A compensating `update render_quota set renders = renders - 1 where
day = ?1 and renders > 0` in the `isOutOfBrowserQuota` branch is the smallest
version. Moving the consume after a successful launch is the alternative, but it
reopens the race that the single-statement increment exists to close.

**Resolution:** Fixed 2026-08-15 by /implement. `releaseRenderQuota` gives the
slot back, but only when `browser` is still undefined in the catch, which is
exactly the case where the launch failed and no browser time was spent. A failure
after the browser opened keeps its cost, so a caller who can reliably break the
renderer cannot download all day for free. The decrement carries `renders > 0`,
so a refund against a missing or already-zero row is a no-op rather than a
negative count, and a failure to refund is logged and swallowed so it cannot
replace the caller's real error with a database one.

Proven against the running app with the browser binding genuinely absent
(`puppeteer.launch(undefined)`, confirmed in the Worker log as `TypeError:
Cannot read properties of undefined (reading 'fetch')`): four failed launches
left the count at 0, and with the binding restored a successful download took it
0 to 1. The first attempt at this test was invalid, because the dev server had
failed to restart on the new config and an older process answered; it was rerun
after freeing the port.

Not proven empirically: that a failure after launch still consumes its slot.
There is no way to force `page.pdf` to fail from outside the app, so that rests
on the single `if (!browser)` guard.

### F-38 [P3] fixed - The product name has no screen-reader text on a phone

**File:** app/components/AppBar.tsx:14
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Introduced by the F-35 repair. Below `sm` the wordmark is
`hidden`, which removes it from the accessibility tree as well as from the
screen, and the `IK` mark beside it carries no label. A screen-reader user on a
phone hears "IK" where a sighted user sees a logo they recognise. It is P3
because the app is still perfectly usable and the name is in the page title, but
it is a regression this repair caused rather than a pre-existing gap.
**Suggested fix:** one class. `sr-only sm:not-sr-only sm:inline` keeps the text
for assistive technology at every width while staying invisible below `sm`.

**Resolution:** Fixed 2026-08-15 by /implement. `sr-only sm:not-sr-only` in
place of `hidden sm:inline`, so the wordmark stays in the accessibility tree at
every width while remaining invisible below `sm`.

Measured from the rendered page rather than the source: at 320px the brand's
accessible name is "IK Invoice Kit" while the span computes to `position:
absolute`, 1x1, `clip-path: inset(50%)`. Because it is out of flow it costs no
width, so F-35 does not return: 305/305 at 320px both signed in and signed out,
and the wordmark is visibly back at 640px.

### F-39 [unverified] [P3] - Every page may now depend on D1 being reachable

**File:** app/root.tsx:24
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** A lead, not a confirmed defect. The root loader calls
`getUser` on every navigation, so if Better Auth queries D1 whenever a session
cookie is present, an unreachable database would throw in the root loader and
take down every page, including the editor that the anonymous tier is supposed
to run without touching storage at all. Before 6c the editor rendered with no
database involvement whatsoever.

The likely reality is narrower: a visitor with no cookie should never reach a
query, so the anonymous tier is probably unaffected and only signed-in visitors
would see the outage. That is the part this pass could not prove.
**Suggested fix:** see the evidence below; the anonymous half of this needs no
fix at all.

**Evidence gathered 2026-08-15 by /implement (fix: audit findings 37-39).** The
binding was pointed at a database id that does not exist, the dev server was
restarted and confirmed to have started on that config rather than an older one,
and `/` was loaded twice. Both `wrangler.json` restores were verified by checksum
afterwards.

| Request | Result |
|---|---|
| `GET /` with no session cookie | **200**, editor renders in full, bar reads "Sign in" |
| `GET /` with a valid session cookie | **500** |
| `POST /sign-in` (control, proving the database really was gone) | 400 |

**The specific risk this finding names is disproven.** It claimed an unreachable
database would take down "every page, including the editor that the anonymous
tier is supposed to run without touching storage". The anonymous editor is
untouched: a visitor with no cookie never reaches a query, so the free path
survives a total D1 outage exactly as the tier line promises.

What is left is narrower and arguably correct: a signed-in visitor gets a 500 on
every route while D1 is down. Every signed-in capability from feature 7 onward
needs that database, so there is little for the app to usefully show them. The
alternative, degrading to a signed-out bar, would let a signed-in user keep using
the editor during an outage, but it would also tell them they are signed out when
they are not, and mask the outage rather than report it. That is a product call,
not a defect, and no code was changed for it.

Left `unverified` for `/audit` to rule on, since `/implement` does not set
`invalid`.

**Resolution:**
