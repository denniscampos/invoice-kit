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

### F-40 [P3] open - The starter template's sample variable is still deployed

**File:** wrangler.json:57
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** `VALUE_FROM_CLOUDFLARE` came with the React Router starter and
no code has ever read it. It is bound on every deploy and printed in the binding
list beside D1, Browser Rendering, and the two rate limiters, so the one line in
that list that means nothing sits next to four that matter. Config nobody reads is
the same maintenance problem as code nobody calls: the next person has to work out
whether it is load-bearing before touching it.
**Suggested fix:** delete the `vars` block. `pnpm cf-typegen` afterwards, so
`worker-configuration.d.ts` stops declaring it too.

**Resolution:**

### F-43 [P3] fixed - Every page load reads all of a user's invoice numbers

**File:** app/routes/editor.tsx:45
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** The editor's loader calls `listInvoiceNumbers`, which selects
every invoice number the user has, on every navigation and again after every
save, to compute one suggestion. The suggestion is then usually discarded,
because a restored draft keeps its own number and only a brand new invoice uses
it. The cost grows with the number of invoices a user has, which is the number
this app exists to grow, and it is paid on the app's busiest route.

Nothing is wrong today, with one invoice in the database. It is filed now because
the shape is unbounded rather than because it currently hurts.
**Suggested fix:** ask the database for the answer instead of the raw material:
`select invoiceNumber from invoice where userId = ?1 and invoiceNumber like
'INV-%' order by length(invoiceNumber) desc, invoiceNumber desc limit 1`, and
hand that one value to `nextInvoiceNumber`. The function already accepts a list,
so it needs no change.

**Resolution:** Fixed 2026-08-16 by /implement. `listInvoiceNumbers` now asks for
the single highest `INV-` number rather than the whole column, ordered by length
then value so a longer number wins once the sequence outgrows its padding.

Proven against the local database: with INV-0001, INV-0002, INV-9999, INV-10000,
and 2026-04 present, the query returns INV-10000 and the editor suggests
INV-10001. With only 2026-04 present the query returns nothing and the editor
suggests INV-0001, so a user numbering invoices their own way still starts the
sequence correctly.

**Re-reviewed 2026-08-16 by /audit (scope: current): still `fixed`, not closed.**
The unbounded read is genuinely gone, but the repair introduced F-44 below, so
the two want re-reviewing together once that is dealt with.

### F-44 [P2] fixed - The editor can suggest an invoice number it will then refuse

**File:** app/lib/invoice-store.server.ts:110
**Found:** 2026-08-16 by /audit (scope: current)
**Why it matters:** Introduced by the F-43 repair. Narrowing the query to one row
means the row it picks has to be a sequence number, and `like 'INV-%'` does not
promise that. Sorting is by length then string, so any `INV-` value made of
letters outranks the real numbers at the same width: `INV-DRAFT` beats
`INV-0002`. `nextInvoiceNumber` then cannot parse what it was handed, falls back
to `INV-0001`, and hands the user a number they already have.

Reproduced against the local database and then in the browser. A user holding
`INV-0001`, `INV-0002`, and `INV-DRAFT` is shown `INV-0001` in a fresh editor,
and pressing Save answers "You already have an invoice numbered INV-0001. Change
the number and save again." The fresh editor is unusable until they retype the
number by hand.

Nothing is lost and nothing is overwritten, which is why this is P2 rather than
higher. But it is the primary flow, and it triggers on an invoice number a user
is perfectly entitled to type: the overview says the number stays editable and
the sequence is only a suggestion.

Before F-43 this could not happen, because every number was passed to
`nextInvoiceNumber` and the unparseable ones were skipped.
**Suggested fix:** stop asking the database for exactly one candidate. Narrowing
with `glob 'INV-[0-9]*'` removes the obvious cases but not `INV-12AB`, so pair it
with a small `limit` (ten is plenty) and let `nextInvoiceNumber` do the filtering
it already does. The query stays bounded, which is all F-43 asked for.

**Resolution:** Fixed 2026-08-16 by /implement, in the same fix that caused it.
The query now matches with `glob 'INV-[0-9]*'`, which keeps out anything with no
digit after the dash, and takes ten rows rather than one so `nextInvoiceNumber`
can skip whatever the glob cannot express, like INV-12AB. It stays bounded, which
is all F-43 asked for.

Proven against the local database and then in the browser. A user holding
INV-0001, INV-0002, and INV-DRAFT now gets INV-0002 and INV-0001 from the query,
is suggested INV-0003 in a fresh editor, and saving it succeeds with no error.
INV-10000 still outranks INV-9999, and a user whose only invoice is 2026-04 still
starts at INV-0001.

