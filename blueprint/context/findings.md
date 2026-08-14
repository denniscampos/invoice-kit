# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P2] open - Ported theme tokens duplicate shadcn tokens with the same values

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
**Resolution:**

### F-04 [P3] open - Unused exports in the draft module

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
**Resolution:** Still open, list revised 2026-08-14 by /audit (scope: current).
Feature 4 moved `DEFAULT_TEMPLATE_ID` to `app/lib/invoice-templates.ts`, where
`invoice-draft.ts` now imports it, so it leaves this list with a real cross-module
caller. The remaining six are unchanged. Feature 4 also added one new instance of
the same pattern: `PartyAddressLine` in `app/lib/format.ts:47` is exported with no
importer, since the templates infer the type from the function's return. Same
judgment call, same fix. Updated again the same day: the F-20 repair gave
`PartyAddressLine` a real importer in `CompactTemplate.tsx`, so it leaves this
list too. The original six from feature 1 and 2 are what remain.

### F-05 [P3] open - A tampered draft with a partial party object breaks its inputs

**File:** app/lib/invoice-draft.ts:52
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `isStoredDraft` checks that `billFrom` and `billTo` are
objects but not that they hold the nine expected string fields. A stored draft
whose party object is missing keys passes the guard, and `value[field]` then
returns `undefined`, which flips a controlled input to uncontrolled and logs a
React warning. Only reachable by editing sessionStorage by hand, since the app
always writes whole drafts, so the risk is low.
**Suggested fix:** merge the parsed draft over `createEmptyDraft()` (including
both party objects) before returning it, so missing keys fall back to empty
strings.
**Resolution:**

### F-06 [P3] open - CSS-only packages sit in runtime dependencies

**File:** package.json:17
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `shadcn` and `tw-animate-css` are reached only through
`@import` in `app/app.css`, which is build-time input, yet they sit in
`dependencies` while `tailwindcss`, imported the same way, sits in
`devDependencies`. `shadcn` in particular pulls the whole CLI tree into a
production install, which works against the clone-and-run self-hosting story.
**Suggested fix:** move both to `devDependencies` to match how `tailwindcss` is
already treated, then confirm `pnpm build` still passes.
**Resolution:**

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

### F-12 [P3] open - Stored line items are not validated field by field

**File:** app/lib/invoice-draft.ts:62
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `isStoredDraft` checks only that `lineItems` is an array, so
a stored draft whose items lack `total` or `rate` passes the guard.
`formatMinorUnits(undefined)` then renders `NaN.NaN` in the Amount column, and
`invoiceSubtotal` returns `NaN` for the whole invoice. This is the same tampering
path as F-05 and needs the same answer; it is recorded separately because it is a
new surface that feature 2 introduced, not a restatement of the party-object gap.
**Suggested fix:** whatever fixes F-05 should cover line items too: validate the
numeric fields per item and drop the stored draft when they do not hold, rather
than merging defaults into a half-real invoice.
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

### F-19 [P2] open - The editor scrolls sideways on a phone-width screen

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
**Suggested fix:** find the child that will not go below ~500px (the line item
row's fixed track widths in `LineItemsCard` are the first candidate) and let it
collapse or scroll below the `editor` breakpoint. `min-w-0` on the grid items is
usually the missing half of the fix, since grid children default to
`min-width: auto` and refuse to shrink past their content.

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

### F-24 [P3] open - An unrecognized templateId survives in the stored draft

**File:** app/lib/invoice-draft.ts:153
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `resolveTemplateId` protects rendering, so a garbage
`templateId` shows the default template with the default segment pressed, which
was verified in the browser with `"nope"`. The stored value itself is left alone,
though: `isStoredDraft` does not look at `templateId`, and the draft is written
back verbatim. It is harmless while the draft only lives in `sessionStorage`, but
feature 7 maps this draft onto the D1 `Invoice` row, so today's tampered value is
tomorrow's stored column, and feature 5 posts the same draft to the PDF endpoint.
**Suggested fix:** normalize on the way in rather than only at render, by running
`resolveTemplateId` over the parsed draft inside `readStoredDraft`. That keeps one
rule in one place and pairs naturally with the same fix for F-05 and F-12, which
are the other two halves of validating a stored draft field by field.

**Resolution:**

### F-25 [P3] open - Classic's table head asks for ink and silently renders muted

**File:** app/components/invoice/templates/ClassicTemplate.tsx:88
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `HEAD_CELL` is built as `${LABEL} px-2 py-2.5 text-paper-ink`,
and `LABEL` already ends in `text-paper-muted`. Two utilities set the same
property, so the winner is decided by their order in the generated stylesheet,
not by their order in the class attribute, and muted wins. Measured on the
rendered document: the head cell computes to `rgb(92, 102, 114)` (paper-muted)
while the paper's ink is `rgb(20, 24, 29)`. The spec asks for a `paper-rule` band
with ink text, so the band is lower contrast than intended against its own grey
background, and the `text-paper-ink` in the source is a no-op that reads as
working. Predates the F-21 repair, which changed the face in `LABEL` and not the
colour. The `${CELL} text-paper-muted` strings in all three templates are the
benign version of the same shape: `CELL` carries no colour, so nothing is
shadowed there.
**Suggested fix:** stop composing a colour into a constant that already sets one.
Drop `text-paper-muted` from `LABEL` and let each site state its own colour, which
also makes the muted default explicit at the four places that want it. A
`twMerge`-style helper would fix the precedence too, but the project has no such
wrapper today and one utility conflict does not justify introducing one.

**Resolution:**
