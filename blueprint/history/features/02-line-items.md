# Feature: Line items

**From build-plan:** feature 2
**Status:** complete

## Goal

Add, edit, remove, reorder, and total the line items on an invoice draft. This
is the half of the editor that produces a number, so it is where money enters
the product and where the minor-units rule stops being theoretical.

Feature 3 (live preview) renders these items, and features 5 (PDF) and 7
(persistence) carry them onward, so the parsing and rounding decided here are
the ones every later feature inherits.

## Design reference

`blueprint/reference/editor-mockup.html`, the feature 1 mockup, recovered from
commit `a3ac123` because `/complete` deleted `prototypes/` after feature 1.
`blueprint/reference/theme.css` sits beside it for the token values, but it is
reference only: `app/app.css` is the source of truth now and no step ports
anything from it.

The line items card is the `.items-editor` block. What it pins down:

- A card headed **Line items** with an **Add item** button in the header
- A header row and item rows on the same 5 column grid:
  `1fr 78px 110px 104px 32px` (text, qty, rate, amount, remove)
- Everything except the first column right-aligned, tabular figures throughout
- Amount is computed text, not an input
- A `×` remove button per row, red-tinted on hover
  (`--status-overdue-bg` / `--status-overdue-fg`)
- A **Total** line below the rows, right-aligned above a top border

Two deliberate departures from the mockup, both flagged for the review gate:

1. **The mockup has no reorder affordance**, but the build-plan line and the
   `position` field both call for one. Step 6 adds a drag handle per row, which
   is what invoicing tools do and what the user asked for. It costs a
   dependency: see Data / contracts.
2. **The mockup's first column header reads "Description"**, and it stays that
   way, because a single Description column is the convention across invoicing
   tools. It binds to `LineItem.name`, the type's required text field.
   `description` stays an empty string this feature; a second detail line is the
   natural place for it if one is ever wanted.

## In scope

- `app/lib/money.ts`: parse a typed decimal into integer minor units, and format
  minor units back for display
- Line item helpers on the draft: add, update, remove, move, with `position`
  kept contiguous
- The line items card: header, rows, add, remove, reorder
- Per-row amount, computed and stored on the item as `total`
- An invoice total line, derived at render time
- Empty state when there are no items
- Tests for all of the above logic, since the gate is on

## Out of scope

- **Tax, discounts, and adjusted totals** (feature 19). `discountTotal` and
  `taxTotal` do not exist on the draft and are not being added.
- **The preview column** (feature 3). It stays the empty reserved box; this
  feature does not render an invoice, only the editor card.
- **Per-item description** as a second visible field. The type keeps
  `description`; no UI writes it yet.
- **Currencies with other than 2 decimal places.** The five in the picker are
  all 2 decimal currencies; see Data / contracts for the flag this leaves.
- Saving, PDF, or anything that touches a server.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Money parsing and formatting** - `app/lib/money.ts` with
  `parseMoneyInput(raw: string): number | null` (decimal string to integer minor
  units, `null` for anything unparseable) and `formatMinorUnits(minor: number):
  string` (minor units to a `1,234.56` display string). No UI, no currency
  symbols. **Parse the digits as text, never `parseFloat(raw) * 100`** - see
  Data / contracts for why that is wrong on the exact inputs an invoice uses.
  *Done when:* `pnpm test` covers empty string (`null`), whitespace, `"12"`
  (`1200`), `"12.5"` (`1250`), `"12.345"` (`1235`, the case float math gets
  wrong), `"0.005"` (`1`), `"1,250.00"` with a thousands separator (`125000`),
  a leading `$`, `"-5"` (`null`, negatives are rejected), `"1.2.3"` (`null`),
  and `"abc"` (`null`); and `formatMinorUnits` round-trips every parseable
  case.

- [x] **Step 2 - Quantity parsing and the line total rule** - add
  `parseQuantity(raw: string): number | null` to `money.ts` and
  `lineItemTotal(quantity: number, rate: number): number` returning
  `Math.round(quantity * rate)`. *Done when:* `pnpm test` proves
  `lineItemTotal(3, 1000) === 3000`, `lineItemTotal(0.5, 999) === 500` (half up
  at exactly .5), `lineItemTotal(1.005, 10000) === 10050`, and that quantity
  rejects negatives and non-numerics while accepting `"1.5"` and `"0"`.

- [x] **Step 3 - Draft line item helpers** - in `app/lib/invoice-draft.ts`:
  `addLineItem(draft)`, `updateLineItem(draft, id, patch)`,
  `removeLineItem(draft, id)`, `reorderLineItems(draft, fromId, toId)`, and
  `invoiceSubtotal(draft)`. Each returns a new `lineItems` array with
  `position` renumbered `0..n-1`, and `updateLineItem` recomputes `total`
  whenever `quantity` or `rate` changes. Ids come from `crypto.randomUUID()`.
  No UI. *Done when:* `pnpm test` proves positions stay contiguous after an
  add, a remove from the middle, a drag from top to bottom, a drag from bottom
  to top, and a drop onto itself (a no-op); that an unknown id leaves the list
  unchanged rather than throwing; that `updateLineItem` recomputes `total`; and
  that `invoiceSubtotal` sums line totals and returns `0` for an empty draft.

- [x] **Step 4 - The card, with add and remove** - `LineItemsCard.tsx`
  rendering the header row, one row per item bound to `name`, the `×` remove
  button, the **Add item** button, and the empty state. Quantity, rate, and
  amount render as static text from the stored values this step; step 5 turns
  the first two into inputs. Mounted in `editor.tsx` below Invoice details.
  *Done when:* adding appends an empty row, removing drops the right one, the
  empty state shows with zero items and no total line, the grid matches the
  mockup's column widths at desktop, every control has an accessible name that
  identifies its row (the remove button included), and a refresh restores the
  rows from `sessionStorage`.

- [x] **Step 5 - Editable quantity and rate, amount, and total** - swap qty and
  rate to inputs wired through the step 1 and 2 parsers, render each row's
  amount from the stored `total`, and add the invoice total line. The input
  holds what the user is typing; only a successful parse reaches the draft.
  **An empty field means zero** (a deliberate clear), while any other
  unparseable input leaves the draft's last good value untouched.
  *Done when:* typing `18` and `145.00` shows `2,610.00` on that row, the total
  line sums every row, clearing the rate field shows `0.00` for that row while
  the field stays empty for typing, typing `1x` mid-edit leaves the amount on
  its last good value rather than zeroing or crashing, `1.005 x 100.00` shows
  `100.50`, and each input has an accessible name naming its column and row.

- [x] **Step 6 - Drag to reorder** - install `@dnd-kit/core`,
  `@dnd-kit/sortable`, and `@dnd-kit/modifiers`; add a drag handle at the left
  of each row and wire `onDragEnd` to `reorderLineItems`. Restrict dragging to
  the vertical axis. The handle is a real button so the keyboard sensor can
  reach it. *Done when:* dragging a row to a new position reorders it and
  `position` follows in the stored draft; the same reorder is achievable by
  keyboard alone (tab to a handle, space to lift, arrows to move, space to
  drop); dragging does not steal focus or text selection from the row's inputs;
  a drop in the original position changes nothing; and `pnpm build` passes with
  the new dependencies.

- [x] **Repair F-10 - A decimal comma must not multiply the rate by 100** -
  decide the decimal separator from the string instead of assuming the comma is
  always a thousands separator. A dot, when it is the last separator, is the
  decimal point; a comma is the decimal point unless exactly three digits follow
  it. Reject a number whose grouping is not consistent rather than guessing.
  *Done when:* `pnpm test` proves `"12,50"` is `1250`, `"1.234,56"` is `123456`,
  `"1,234,567"` is `123456700`, `"1.2.3"` is still `null`, and every case from
  step 1 still holds; and typing `12,50` into a rate in the browser shows
  `12.50`, not `1,250.00`.

- [x] **Repair F-14 - The quantity parser must read separators the same way** -
  route `parseQuantity` through the same `splitAtDecimal` and `WHOLE_PART` that
  `parseMoneyInput` uses, so one rule covers both fields. *Done when:* `pnpm
  test` proves `"1,5"` is `1.5`, `"1,000"` is still `1000`, `"1.5"` is still
  `1.5`, and the existing rejections (`"-2"`, `"$5"`, `"2x"`, `"1.2.3"`) still
  hold; and typing `1,5` against a rate of `100.00` in the browser shows
  `150.00`, not `1,500.00`.

## Files / areas

- `app/lib/money.ts` - new, parsing and formatting, the load-bearing logic
- `app/lib/money.test.ts` - new
- `app/lib/invoice-draft.ts` - line item helpers added
- `app/lib/invoice-draft.test.ts` - helper coverage added
- `app/components/invoice/LineItemsCard.tsx` - new
- `app/components/invoice/LineItemRow.tsx` - new in step 6, when the row needs
  its own `useSortable` hook; fold it out of the card then, not before
- `app/routes/editor.tsx` - mounts the card
- `package.json` - three `@dnd-kit` packages, step 6 only
- `blueprint/reference/editor-mockup.html`, `theme.css` - recovered reference,
  read-only

## Data / contracts

`LineItem` is already defined in `app/types/invoice.ts` and does not change:

```ts
type LineItem = {
  id: string; position: number; name: string; description: string;
  quantity: number; rate: number; total: number;   // rate/total in minor units
};
```

Decisions this feature locks, that features 3, 5, and 7 inherit:

- **`total` is stored on the item, the invoice total is derived.** The overview
  requires a stored line total so a saved invoice never recomputes to a
  different number. It says nothing about the draft carrying an invoice
  subtotal, and `InvoiceDraft` has no such field, so `invoiceSubtotal(draft)`
  computes at render. Feature 7 maps it onto `Invoice.subtotal` at save time.
  Adding a stored draft total would create a second source of truth that can go
  stale between keystrokes.
- **`quantity` is a float, `rate` and `total` are integer minor units.** The
  only multiplication in the app is `round(quantity * rate)`, and it happens in
  exactly one function so there is one place to be wrong.
- **Rounding is half away from zero**, matching `Math.round` for positive
  values, which are the only ones the parsers accept.
- **`parseMoneyInput` splits the string, it does not multiply a float.**
  `Math.round(parseFloat("12.345") * 100)` returns `1234`, not `1235`, because
  `12.345 * 100` is `1234.4999999999998` in IEEE 754. The whole point of storing
  minor units is to keep float error out of money, and computing them through a
  float puts it back. Strip separators and currency symbols, match
  `^\d+(\.\d*)?$`, then read the digits: integer part times 100, plus the first
  two decimal digits, rounded using the third. `lineItemTotal` may use
  `Math.round` because its float multiply is unavoidable (quantity is genuinely
  fractional) and its inputs are already exact integers on the money side.
- **Parsers return `null`, never throw and never a partial number.** An empty
  field is a deliberate clear and means zero; any other unparseable input leaves
  the draft's last good value alone, because overwriting what the user typed is
  the kind of silent data loss feature 1's audit caught twice.
- **Drag and drop costs three small dependencies.** `@dnd-kit/core`,
  `@dnd-kit/sortable`, and `@dnd-kit/modifiers` go into `dependencies` (they
  ship in the client bundle, unlike the CSS-only packages F-06 flags). The
  standards say not to add a dependency for what a few lines of Tailwind
  handle, and this is the opposite case: correct pointer, touch, and keyboard
  dragging with live-region announcements is a lot of code to get wrong.
  `reorderLineItems` stays our own pure function so the ordering logic is
  testable without a DOM, and dnd-kit only reports which row moved where.
- **2 decimal places is assumed** by both the parser and the formatter. The five
  currencies in the picker all have 2. A currency with 0 (JPY) or 3 (KWD) breaks
  this, so whenever feature 22 widens the currency list, the minor-unit exponent
  has to become a function of the currency, not a constant. Flagged here rather
  than solved, since no currency in the product today needs it.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**. Steps 1, 2, and 3
are pure logic and each must ship its tests in the same diff. Steps 4, 5, and 6
are UI and ride on browser evidence and `pnpm build`.

In-scope logic, by step:

- `parseMoneyInput`, `formatMinorUnits` (step 1)
- `parseQuantity`, `lineItemTotal` (step 2)
- `addLineItem`, `updateLineItem`, `removeLineItem`, `reorderLineItems`,
  `invoiceSubtotal` (step 3)

Verify by hand at the end:

- Add four items matching the mockup (`18 x 145.00`, `24 x 145.00`,
  `12 x 145.00`, `1 x 850.00`) and confirm the total reads `8,680.00`
- Remove a middle row, confirm the total drops by exactly that row's amount
- Drag the last row to the top with the mouse, then do the same reorder using
  only the keyboard
- Refresh, confirm every row, its order, and the total survive
- Compare the card against `blueprint/reference/editor-mockup.html` side by side
- Console clean on load and while typing

## Notes for the AI

- **Ids are generated in event handlers only.** `crypto.randomUUID()` during
  render would produce different ids on the Worker and in the browser and break
  hydration, the same class of bug feature 1 hit with dates.
- The draft is client state held in `editor.tsx`. Helpers are pure functions
  that take a draft and return new `lineItems`; they never mutate and never
  touch storage. Persistence already works and needs no changes.
- **Keep the parse boundary at the input.** The draft holds numbers, never
  strings. What the user is typing lives in the input's own value; only a
  successful parse is written to the draft. That means a row needs local state
  for the qty and rate text, so `12.` and `12.50` are both typeable without the
  draft flickering through a half-parsed value.
- Every input, remove button, and reorder button needs an accessible name that
  identifies its row. The card is a CSS grid, not a table, so a screen reader
  gets no row and column context for free, and "Rate" alone is ambiguous with
  ten rows on screen.
- Do not add a form library, a table library, or a money library. The arithmetic
  here is one multiply and one round. dnd-kit in step 6 is the one dependency
  this feature adds, and it is confined to the card: no other component imports
  it, and the reordering logic itself stays a pure function in
  `invoice-draft.ts`.
- The drag handle and the row inputs compete for pointer events. Attach dnd-kit's
  listeners to the handle only, never the row, or selecting text in the
  description field starts a drag.
- Reuse the existing shadcn primitives and the `Field` component where they fit.
  Reach for `table` only if the grid genuinely needs it; the mockup uses a plain
  CSS grid and so should this.
- Apply tabular figures to every number, matching feature 1.
- Follow `coding-standards.md`: strict TypeScript, no `any`, functional
  components, Tailwind classes only, tabs for indentation.
- Comment the why, not the what. The rounding rule and the last-good-value rule
  earn comments; a labeled input does not.
- No em dashes in code, comments, or commit messages.
- `blueprint/reference/` is read-only reference. Do not import from it. Unlike
  `prototypes/`, it is not deleted at `/complete`: it is the only surviving copy
  of the mockup.

## Findings

Resolved findings from this feature, archived at their final status. IDs are
prefixed with the archive name so they stay unique across the project. F-09 was
raised against feature 1 and carried forward; it archives with the item that
resolved it.

### 02/F-09 [P3] closed - Spec describes an Invoices nav item the app bar does not render

**File:** app/components/AppBar.tsx:10
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Step 4 of `current-feature.md` describes the app bar as
"brand mark, Editor and Invoices nav"; the built app bar has only Editor. The code
is right and the spec is stale: `/invoices` does not exist until feature 9, and
rendering a link to it would be exactly the dead control the spec's Out of scope
section forbids. The mismatch matters only because `/complete` archives this spec
as the record of what shipped, so the archive would misdescribe the app bar.
**Suggested fix:** reword step 4 to "brand mark and Editor nav; Invoices arrives
with feature 9" before `/complete` archives it. Documentation only, no code
change.
**Resolution:** Fixed 2026-08-14 by /implement. Step 4 of `current-feature.md`
now describes the app bar as it was actually built and records why Invoices is
absent. No code change; the app bar was already right.

Re-reviewed 2026-08-14 by /audit (scope: current). The corrected wording made it
into the archive: `blueprint/history/features/01-invoice-editor.md:103` reads
"Editor nav item, nothing else yet; Invoices arrives with feature 9", and
`AppBar.tsx` still contains no Invoices link. Spec and code agree. **Closed.**

### 02/F-10 [P1] closed - A decimal comma is read as a thousands separator, multiplying the rate by 100

**File:** app/lib/money.ts:14
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `parseMoneyInput` strips commas as thousands separators
before parsing, so `"12,50"` becomes `1250` and then `125000` minor units.
Reproduced in the running app: typing `12,50` into a rate shows an amount of
`1,250.00`. The comma is the decimal separator across most of the eurozone, and
EUR is one of the five currencies in the picker, so this is a plausible thing for
a target user to type. The result is an invoice for a hundred times the intended
amount. It is not silent (the Amount column updates immediately), but it is the
sort of thing a hurried user misses, and money is exactly where this app promised
to be careful.
**Suggested fix:** decide the separator from the string rather than assuming.
When the last comma sits two digits from the end and there is no dot, treat it as
a decimal separator; when both appear, the rightmost one is the decimal. The
smaller alternative is to reject any input containing a comma that is not in a
thousands position, so the user is told rather than silently charged. Either way,
the case needs a test.
**Resolution:** Fixed 2026-08-14 by /implement. `parseMoneyInput` no longer
strips commas; a new `splitAtDecimal` decides the decimal separator from the
string. The last separator is the decimal point unless it repeats (so
`1.234.567` and `1,234,567` are grouped thousands) or it is a comma with exactly
three digits after it and the number does not start with zero. Inconsistent
grouping such as `1,23,456` is rejected by a backreferenced pattern rather than
guessed at.

Two of my first attempt's assumptions were wrong and the tests caught both:
`0,005` read as grouping and became `5.00` (hence the leading-zero exception),
and `1.234.567` read as a decimal and became `1234.567` (hence the repeated
separator rule). Verified in the browser afterwards: `12,50` shows `12.50`,
`1.234,56` and `1,234.56` both show `1,234.56`, `145.00` still shows `145.00`,
and `1,23,456` leaves the previous amount standing. 73 tests pass.

Remaining and unfixable from the string alone: `1,250` is 1250 to an American
and 1.25 to a German. It resolves as grouping, matching the app's own
formatting, and is recorded in the code comment and a test.

Re-reviewed 2026-08-14 by /audit (scope: current). Walked the new
`splitAtDecimal` across both separators, repeated separators, leading zeros,
trailing separators, and empty whole parts; re-ran the original repro in the
browser (`12,50` now shows `12.50`). The defect this entry describes is gone
from `parseMoneyInput` and the repair introduced nothing new. **Closed.** The
same defect turned out to be sitting untouched in `parseQuantity`, which this
entry never covered and the first audit failed to check; it is recorded as F-14
rather than kept here, because it is a separate function with its own repair.

### 02/F-14 [P1] closed - parseQuantity still strips a decimal comma, multiplying the quantity by 10

**File:** app/lib/money.ts:80
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** This is F-10 in the sibling parser. `parseQuantity` strips
all commas before validating, so `"1,5"` becomes `15`. Reproduced in the running
app: quantity `1,5` at a rate of `100.00` shows an amount of `1,500.00` instead
of `150.00`. Anyone who writes decimals with a comma is billed ten times the
hours they entered, and the fix to F-10 did not touch this function. The first
audit raised F-10 against `parseMoneyInput` alone and did not check whether the
same mistake existed next door, which is why this surfaced only after the repair.
**Suggested fix:** route `parseQuantity` through the same `splitAtDecimal` that
`parseMoneyInput` now uses, then rebuild the number from the whole and fraction
parts. The existing test `["1,000", 1000]` encodes the current behaviour and has
to change with it: under the shared rule a comma with exactly three digits after
it stays grouping, so that case keeps its value, but `"1,5"` must become `1.5`.
**Resolution:** Fixed 2026-08-14 by /implement. `parseQuantity` now runs through
the same `splitAtDecimal` and `WHOLE_PART` as `parseMoneyInput`, so one rule
covers both fields in a row. Currency symbols are deliberately still rejected
here rather than stripped: a `$` in the quantity column is a mistake, not
decoration. The `["1,000", 1000]` case needed no change, since a comma with three
digits after it remains grouping under the shared rule.

Verified in the browser at a rate of `100.00`: quantity `1,5` now shows `150.00`
(was `1,500.00`), `1.5` shows `150.00`, `1,000` shows `100,000.00`, and `2x`
leaves the previous amount standing. Quantity `1,5` with rate `12,50` gives
`18.75`, which is the point of the repair: both fields now read a comma the same
way. 74 tests pass.

Re-reviewed 2026-08-14 by /audit (scope: current). Drove nine separator forms
through the quantity field at a rate of `100.00`, independently of the repair
pass: `1,5` and `1,50` give `1.5`, `0,5` gives `0.5`, `1,000` gives `1000`,
`2,5000` gives `2.5`, `1.` gives `1`, and `.5` and `1.2.3` are rejected with the
previous value left standing. The defect is gone and the repair introduced
nothing new. Also enumerated every parser in the feature surface this time
rather than one function: `parseMoneyInput` and `parseQuantity` are the only two,
and they now share `splitAtDecimal`, so the class of bug has one home instead of
two. **Closed.**
