# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P2] closed - Ported theme tokens duplicate shadcn tokens with the same values

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

### F-04 [P3] closed - Unused exports in the draft module

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

### F-06 [P3] closed - CSS-only packages sit in runtime dependencies

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

### F-19 [P2] closed - The editor scrolls sideways on a phone-width screen

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

### F-27 [P3] closed - An unstyled print document would ship silently

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

### F-31 [P3] closed - The download's object URL is revoked in the same tick as the click

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

### F-32 [P3] closed - Classic's serif is a different face in the PDF than in the preview

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

### F-33 [P2] open - The throttle cannot protect the daily browser quota

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

**Resolution:**

### F-34 [P3] closed - A rate limiter failure becomes an unexplained 500

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
