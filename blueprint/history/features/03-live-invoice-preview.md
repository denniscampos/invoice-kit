# Feature: Live invoice preview

**From build-plan:** feature 3
**Status:** complete

## Goal

Fill the reserved right column with the invoice itself, rendered from the draft
and updating as the user types. This is the payoff for features 1 and 2: the
two-pane editor only makes sense once the second pane shows the document.

It also builds the artifact feature 5 turns into a PDF. What renders here is
what downloads, so the template component this feature defines is load-bearing:
feature 4 swaps between several of them, and feature 5 renders one to HTML on
the Worker.

## Design reference

Recovered from the feature 1 prototypes, which `/complete` deleted:

- **`blueprint/reference/invoice-mockup.html`** - the invoice document itself,
  at full page size. The primary target: header block, party columns, item
  table, totals, footer.
- **`blueprint/reference/editor-mockup.html`** - how the document sits in the
  editor's right column: a bordered frame, a "Live preview" bar with a status
  dot, and a scrolling area with a sunken background.
- **`blueprint/reference/theme.css`** - the original `.paper*` rules. Reference
  only. `app/app.css` already carries the tokens (`--color-paper`,
  `--color-paper-ink`, `--color-paper-muted`, `--color-paper-rule`), and no step
  ports anything further from it.

What the mockups pin down:

- The paper is white with its own ink colors regardless of the app around it,
  because it is the document, not the UI
- Header: logo square, "Invoice" title, number under it; issue date, due date,
  and terms right-aligned opposite
- Two party columns, `From` and `Bill to`, under small uppercase headings
- Item table: `Description | Qty | Rate | Amount`, everything but the first
  column right-aligned, tabular figures throughout
- Totals block right-aligned: `Subtotal`, then a heavier `Total due` carrying
  the currency code
- Footer: payment terms and notes side by side
- The preview bar reads "Live preview" with a green dot

**The template switcher in the preview bar is feature 4.** Do not build it; the
bar shows the label and dot only.

## In scope

- `InvoiceTemplate`, a pure component rendering an `InvoiceDraft` as the
  document, usable unchanged by feature 5 on the Worker
- The preview column: frame, bar, scrolling paper, sticky on desktop
- Date and money formatting for display, including the currency symbol
- Placeholder text so an empty draft still reads as an invoice rather than a
  broken one
- Fixing F-13 in both places at once: amounts carry their currency

## Out of scope

- **The template switcher and any second template** (feature 4). This feature
  builds one template and renders it directly; feature 4 introduces the registry
  that picks between them.
- **PDF generation** (feature 5). No Browser Rendering, no download button, no
  print stylesheet beyond what the template already needs.
- **Logo upload** (feature 13). The header's logo square shows the first letter
  of the sender's name, never an image.
- **Per-item description in the table.** `description` is still unwritten by any
  UI (feature 2 decided this); the template renders it when present so the shape
  is honoured, but nothing populates it yet.
- **Tax and discount rows** (feature 19). Subtotal and total are the same number
  until then, and the template shows both anyway because the mockup does.
- F-11, F-12, and F-15 from the ledger. They touch this feature's neighbourhood
  but none is a preview concern; leave them recorded.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Display formatters** - in `app/lib/money.ts`, add
  `currencySymbol(code: string): string` (via `Intl.NumberFormat` parts, so no
  hand-written symbol table) and `formatMoney(minor: number, currency: string)`
  returning `$8,680.00`. In a new `app/lib/format.ts`, add
  `formatInvoiceDate(iso: string): string` returning `13 Aug 2026`, and `""` for
  an empty string. *Done when:* `pnpm test` proves `formatMoney(868000, "USD")`
  is `$8,680.00`, `formatMoney(0, "EUR")` starts with the euro sign,
  `currencySymbol` falls back to the code itself for an unknown code,
  `formatInvoiceDate("2026-08-13")` is `13 Aug 2026`, `formatInvoiceDate("")` is
  `""`, and a malformed date returns `""` rather than `Invalid Date`.

- [x] **Step 2 - Preview pane, live, with the document header and parties** -
  `PreviewPane.tsx` (frame, "Live preview" bar with its green dot, scroll area
  on the sunken background) and `InvoiceTemplate.tsx` rendering the top of the
  paper: logo square with the sender's initial, "Invoice" title, number, the
  issue/due/terms block, and the two party columns. Mounted in `editor.tsx` in
  place of the reserved box straight away, so every later step is visible while
  it is built rather than behind temporary scaffolding. *Done when:* typing a
  business name, a number, or a date updates the paper as you type; the header
  and party blocks match the mockup side by side; and `pnpm build` passes.
  Screenshot against `blueprint/reference/invoice-mockup.html`.

- [x] **Step 3 - Items table, totals, and footer** - the rest of the document:
  the four column table with its rules, `Subtotal` and a heavier `Total due`
  carrying both symbol and currency code (`$8,680.00 USD`, as the mockup shows),
  and the payment terms and notes footer. *Done when:* the four mockup line
  items render with matching alignment and figures, the total reads
  `$8,680.00 USD`, adding or reordering an item updates the table immediately,
  and the block-by-block comparison against the mockup holds. Screenshot.

- [x] **Step 4 - Empty and partial drafts** - placeholders so a blank draft
  still reads as a document: a muted "Your business" / "Client name" where a
  party name is missing, a neutral mark in the logo square when there is no
  name to take an initial from, address lines omitted rather than left as blank
  rows or stray commas, a single muted "No items yet" row in the table, and
  dates simply absent while the draft has none (the pre-hydration state feature
  1 created). *Done when:* rendering `createEmptyDraft()` produces no
  `undefined`, no `NaN`, no `Invalid Date`, no stray punctuation, and no console
  warnings; screenshot of the empty state beside a filled one.

- [x] **Step 5 - Fit, scroll, and stick** - the pane holds its own height, the
  paper scrolls inside it, the column sticks below the app bar on desktop and
  goes static below the `editor` breakpoint. *Done when:* with twenty line items
  the paper scrolls inside the frame and the page itself does not grow, the
  column stays put while the form scrolls on desktop, the preview stacks under
  the form below 1080px, and the console is clean. Screenshot at both widths.

- [x] **Repair F-13 - Amounts carry their currency** - apply `formatMoney` to
  the line items card too, so the editor and the document agree. *Done when:*
  switching the currency select changes the symbol in both panes at once, and
  the total line in the card reads `$8,680.00`.

- [x] **Repair F-16 - Long unbroken text must not stretch the document** - allow
  mid-word breaking where free text lands: the party name and address lines, the
  table's description cell, the invoice number, and the footer paragraphs. Leave
  the numeric cells on one line. *Done when:* a 94 character unbroken string in
  an email field and in a line item description leaves the paper at its natural
  width with no horizontal overflow, and the four mockup rows still render
  unchanged.

- [x] **Repair F-17 - Address lines must not be keyed by their own text** - key
  the party's address lines by position rather than content. *Done when:*
  setting a party's address, city, and country all to the same word logs no
  React key warning, and the lines still render in order.

## Files / areas

- `app/lib/money.ts` - `currencySymbol`, `formatMoney` added
- `app/lib/money.test.ts` - their coverage
- `app/lib/format.ts`, `app/lib/format.test.ts` - new, date display
- `app/components/invoice/InvoiceTemplate.tsx` - new, load-bearing
- `app/components/invoice/PreviewPane.tsx` - new, the frame and bar
- `app/components/invoice/LineItemsCard.tsx` - F-13
- `app/routes/editor.tsx` - mounts the preview
- `blueprint/reference/invoice-mockup.html` - recovered this feature

## Data / contracts

**`InvoiceTemplate` is the contract this feature exists to set.** Feature 4
picks between templates and feature 5 renders one to a PDF on the Worker, so:

```ts
type InvoiceTemplateProps = {
  draft: InvoiceDraft;
};
```

Rules those features depend on:

- **The template is pure and SSR-safe.** No `useState`, no effects, no
  `window`, no `sessionStorage`, no event handlers, no dates read from the
  clock. Everything it renders comes from the draft it is handed. Feature 5
  renders it with `renderToString` inside a Worker, where anything else breaks.
- **It renders the document only**, never the frame, bar, or scaling. Those
  belong to `PreviewPane`, which is editor chrome and does not travel to the
  PDF.
- **Page geometry belongs to the container, not the template.** The mockup makes
  this split already: `.paper` carries the content and its inner padding, while
  `.page .paper` overrides the size for a full sheet. So the preview renders the
  paper at its natural width inside a scroll area, with no transform scaling,
  and feature 5 wraps the same component in a letter-sized page instead. A
  template that hard-coded 816px would force the preview to scale it back down,
  which is how a document ends up with blurry text at one size and wrong margins
  at the other.
- **Totals are computed at render** with `invoiceSubtotal`, never stored on the
  draft, matching what feature 2 decided.
- **Money is formatted, never re-derived.** The template calls `formatMoney`; it
  does no arithmetic beyond the subtotal helper.
- `currencySymbol` falls back to the currency code when `Intl` has no symbol,
  so an unfamiliar code degrades to `USD 8,680.00` rather than throwing.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**. Step 1 is pure
logic and ships its tests in the same diff. Steps 2, 3, and 4 are rendering, and
ride on screenshots against the mockup plus `pnpm build`, per the scope rule in
`coding-standards.md`.

In-scope logic: `currencySymbol`, `formatMoney`, `formatInvoiceDate` (step 1).

Verify by hand at the end:

- Open `blueprint/reference/invoice-mockup.html` beside `/` and compare the
  document block by block
- Fill the whole form and watch the paper follow each keystroke
- Empty every field and confirm the paper still reads as an invoice
- Switch the currency and confirm both panes change together
- Add ten line items and confirm the paper scrolls inside its frame
- Below 1080px, confirm the preview stacks under the form
- Console clean on load and while typing

## Notes for the AI

- **The SSR trap from feature 1 still applies.** Dates are blank on the first
  render and filled by an effect, so the template must render an empty date
  without printing `Invalid Date`. Step 1's formatter returning `""` is what
  makes that safe.
- **`formatInvoiceDate` must not parse an ISO string with `new Date(iso)`.**
  That parses as UTC and renders the previous day west of Greenwich, the same
  bug `toIsoDate` already avoids. Split the string and build the date from
  parts.
- Build the date's text from an explicit month table rather than
  `toLocaleDateString`, for the same reason `formatMinorUnits` pins `en-US`: the
  document must read identically in the preview, in a test, and on the Worker
  that renders the PDF, and a locale-sensitive formatter makes that depend on
  where the code happens to run.
- `Intl.NumberFormat` exists on the Worker as well as the browser, so
  `currencySymbol` is safe in both. Resolve the symbol through `formatToParts`
  rather than formatting a number and slicing, and keep the exact digits from
  `formatMinorUnits` rather than dividing by 100.
- Do not reach for a print stylesheet, `@page`, or a PDF library. Feature 5 owns
  all of that.
- The paper keeps its own colors in both color schemes. It is a document, not a
  surface, so no `dark:` variants on anything inside the template.
- Tabular figures on every number in the document, as in the mockup.
- Follow `coding-standards.md`: strict TypeScript, no `any`, functional
  components, Tailwind classes only, tabs for indentation, comment the why.
- No em dashes in code, comments, or commit messages.
- `blueprint/reference/` is read-only and is not deleted at `/complete`; it is
  the only surviving copy of the mockups.

## Findings

Resolved findings from this feature, archived at their final status. IDs are
prefixed with the archive name so they stay unique across the project.

### 03/F-13 [P3] closed - The amount and total columns show no currency

**File:** app/components/invoice/LineItemsCard.tsx:99
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The mockup's total line reads `$8,680.00`; the built card
reads `8,680.00`. The invoice carries a currency the user can change in the field
directly above, and nothing on the card reflects it, so a EUR invoice and a USD
invoice look identical. Cosmetic today because feature 3's preview will show the
currency, which is why this is P3 rather than a contract problem.
**Suggested fix:** render the currency code beside the total (`USD 8,680.00`)
rather than a symbol, since the symbol table is exactly the per-currency
knowledge `money.ts` deliberately does not carry yet. Decide it with feature 3 so
the card and the preview agree.
**Resolution:** Fixed 2026-08-14 by /implement, during feature 3. The symbol
turned out to be affordable after all: `currencySymbol` reads it from
`Intl.NumberFormat` parts, so `money.ts` still carries no per-currency table and
an unknown code falls back to itself. `formatMoney` applies it in the line items
card and the document alike.

Two deliberate limits. The rate input keeps plain digits, because a symbol
inside a field the user types into is noise to edit around, and the parser would
only have to strip it again. And the currency code appears only on the
document's `Total due`, matching the mockup, rather than on every amount.

Verified in the browser: with the currency on USD the card row reads `$100.00`,
its total `$100.00`-based `$2,000.00`, and the paper `$2,000.00 USD`. Switching
the select to EUR moved all of them to `€` in the same render, and the rate
input still held `100.00`.

Re-reviewed 2026-08-14 by /audit (scope: current). Confirmed independently with
the currency select on EUR: the card's row amount reads `€100.00`, both totals
read `€2,000.00`, and the document's grand total carries the code as
`€2,000.00 EUR`. The rate input is still plain digits. The two panes agree and
the repair introduced nothing new. **Closed.**

### 03/F-16 [P2] closed - A long unbroken string stretches the document past its frame

**File:** app/components/invoice/InvoiceTemplate.tsx:88
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Nothing in the paper wraps a word that has no spaces in it, so
one long token widens the whole document. Reproduced in the running app: a 94
character reference string in an email field took the paper from 644px wide to a
1420px scroll width, pushing the totals and the right hand column out of the
frame. A URL in the notes, a long reference number, or a pasted tracking code all
produce it, and this is the component feature 5 renders to PDF, so the same input
would produce a broken document rather than just a scruffy preview.
**Suggested fix:** allow mid-word breaking where free text lands: the address
lines, the table's description cell, and the footer paragraphs. Tailwind's
`break-words` (`overflow-wrap: break-word`) is enough for the common case, and
`break-all` is the heavier hammer if a single token still overflows a narrow
column. Do not put it on the numeric cells, which should stay on one line.
**Resolution:** Fixed 2026-08-14 by /implement. break-words added to the party
name and address lines, the table description cell, the invoice number, and the
footer paragraphs, with the numeric cells left alone.

That alone did not fix it. The paper narrowed from a 1420px scroll width to
1044px but still overflowed, because a table with auto layout sizes a column to
at least its longest unbreakable word no matter what wrapping the cell allows.
The table is now table-fixed with explicit widths on the three numeric columns
(w-16, w-24, w-28), which sizes the columns from the layout rather than the
content. Verified: with a 94 character token in both an email field and a line
item description, the paper stays at 644px with no horizontal overflow, and the
four mockup rows still render with their original figures and alignment.

Re-reviewed 2026-08-14 by /audit (scope: current). Confirmed independently: with
the 94 character token still in place the paper sits at 644px with no horizontal
overflow, at 900px the paper is 803px wide and the description column simply
takes the slack (443px), and a realistic invoice at 1234.5 x 9,999.99 renders
€12,344,987.66 inside its column uncliped. **Closed.** The fixed widths do
introduce a narrower trade, recorded separately as F-18: a number too wide for
its column now overflows rather than widening the table. That is the intended
shape of the fix, not a survival of this defect.

### 03/F-17 [P3] closed - Address lines are keyed by their own text

**File:** app/components/invoice/InvoiceTemplate.tsx:113
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `PartyBlock` renders its address lines with `key={line}`, so
two identical lines collide. Reproduced by setting a party's address, city, and
country all to "London": React logs "Encountered two children with the same key"
three times. It is a warning rather than a visible break today, since the lines
are static text, but React explicitly calls the behaviour unsupported, and a
repeated line is a plausible thing to type (a city that matches the company name,
or a country that matches the city as in Singapore or Luxembourg).
**Suggested fix:** key by position instead. The list is derived fresh on every
render and never reordered, so the index is a stable identity here, unlike the
line items where reordering is the whole point.
**Resolution:** Fixed 2026-08-14 by /implement. The two address arrays are now
one list of {text, numeric} entries keyed by index. Merging them mattered as
much as the key change: they rendered into the same parent, so two separate
index-keyed maps would have collided at 0 and 1. Verified with address, city,
and country all set to "London": zero React key warnings, lines still in order.

Re-reviewed 2026-08-14 by /audit (scope: current). Read the merged list back:
one array, one map, one key sequence, and the numeric flag carries the
tabular-nums class that the second array used to carry. Repeated-line repro run
again with a clean console. **Closed.**
