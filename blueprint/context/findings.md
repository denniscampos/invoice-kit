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

### F-40 [P3] fixed - The starter template's sample variable is still deployed

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

**Resolution:** Fixed 2026-08-16 by /implement. The `vars` block is gone from
`wrangler.json` and `pnpm cf-typegen` regenerated `worker-configuration.d.ts`
without it. `README.md` also described the var as "unused and safe to delete",
which stopped being true once it was deleted, so that sentence went too.

Proven by `pnpm check`, whose deploy dry run now lists four bindings (DB,
BROWSER, PDF_LIMITER, PDF_GLOBAL_LIMITER) and no environment variable. `rg
VALUE_FROM_CLOUDFLARE` across app, workers, config, generated types, and docs
returns nothing.

Note for the next deploy: the variable stays bound on the running Worker until
something is deployed over it. Nothing reads it, so this is untidiness rather
than drift with teeth.

### F-44 [P3] fixed - The editor can suggest an invoice number it will then refuse

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

**Re-reviewed 2026-08-16 by /audit (scope: full): not closed, lowered to P3.**
The repair narrowed this a long way but did not remove it. `glob 'INV-[0-9]*'`
only requires a digit immediately after the dash, so `INV-12AB` still passes, and
ten rows is a window rather than a guarantee. Reproduced read-only against the
local database with a `values` list rather than by writing rows: given
INV-0001, INV-0002, INV-0003 and ten numbers of the form `INV-<digits><letters>`,
the query returns

    INV-23AB INV-22AB INV-19AB INV-18AB INV-17AB
    INV-16AB INV-15AB INV-14AB INV-13AB INV-12AB

and the real sequence never reaches `nextInvoiceNumber`, which skips all ten,
falls back to INV-0001, and hands the user a number they already hold. That is
the original symptom exactly.

P3 rather than P2 now because reaching it went from one oddly-named invoice to
ten of them, all of a shape a user has to construct deliberately. The durable fix
is to stop asking SQL to pick the winner: order by the numeric part
(`cast(substr(invoiceNumber, 5) as integer) desc`) so letters cannot outrank
digits, or drop the window and let `nextInvoiceNumber` filter a bounded page of
candidates it can actually parse.

**Fixed 2026-08-16 by /implement.** The suggested numeric ordering alone would
not have worked: `INV-23AB` casts to 23, which genuinely is greater than
`INV-0003`, so the letter-bearing numbers would still have taken the window. The
ordering was never the cause; the filter was, because the query returned
candidates `nextInvoiceNumber` can only discard.

`listInvoiceNumbers` now pairs the existing glob with `and not invoiceNumber glob
'INV-*[^0-9]*'`, which rejects anything holding a non-digit after the prefix, so
the two globs together mean exactly what the parser's `^INV-(\d+)$` means.
Ordering moved to `cast(substr(invoiceNumber, 5) as integer) desc`, which then
made the `length()` sort unnecessary.

Proven read-only against the local database with the same `values` list that
reproduced the defect, extended with the regression cases. Given INV-0001,
INV-0002, INV-0003, ten INV-<digits><letters> values, INV-9999, INV-10000,
INV-000042, 2026-04, ACME-1, INV- and INV-DRAFT, the query returns only
INV-10000, INV-9999, INV-000042, INV-0003, INV-0002, INV-0001: all ten
letter-bearing values gone, INV-10000 above INV-9999, and INV-000042 still
present so the six-digit padding survives.

Then in the browser: with INV-0001 the only saved invoice, a fresh editor
(sessionStorage cleared, so the suggestion path runs rather than a restored
draft) offers INV-0002.

### F-45 [P2] open - The dashboard cannot be reached from a phone

**File:** app/components/AppBar.tsx:47
**Found:** 2026-08-16 by /implement (feature 9, step 3)
**Why it matters:** The nav is hidden below `sm`, so a signed-in user on a phone
has no link to `/invoices` from anywhere in the app. They can still get there by
typing the URL, and the page itself works fine at 320px, but nothing on screen
leads to it. Feature 9's whole point is that a saved invoice can be found again,
and on a phone it can only be found by someone who already knows the address.

Measured rather than guessed. With the nav removed, the editor's bar is
`scrollWidth` 305 in a `clientWidth` of 305: exactly full, no spare pixels. Save
(52px) and Download PDF (112px) take 164px of it. The two nav items need 146px
between them, which puts the header at 451px and scrolls the page sideways, which
is F-35 returning. So this is not a styling slip; the row has no room, and
something has to leave it before anything can join.

The brand mark was made a link to `/` in the same step, which costs no width, so
the reverse trip (dashboard back to editor) does work on a phone. Only the
outbound one is missing.
**Suggested fix:** free the width first, then spend it. Shortening Download PDF
to "PDF" below `sm` returns about 62px, which is enough for an icon-only Invoices
link (~32px). Both are one line behind a breakpoint. The alternative is to stop
treating the bar as a single row on a phone and give the app a real mobile nav,
which is worth doing once feature 11 adds the detail view and there is more than
one destination to reach.

**Accepted for now by the user (2026-08-16):** desktop is the working surface
today, and the fix reaches into feature 5's Download button, which is outside
feature 9's spec. Revisit at feature 11.
**Resolution:**

### F-46 [P2] open - A signed-in user's PDF download is throttled as if anonymous

**File:** app/routes/invoice.pdf.tsx:87
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** The overview's access tier table reads "Download the PDF -
anonymous: yes, rate limited; signed in: yes". The route does not implement that
split. There is no `getUser` call anywhere in the file, so every caller passes
through `PDF_LIMITER` at two requests a minute per IP, the shared
`PDF_GLOBAL_LIMITER` at five a minute for everyone together, and the 120-render
daily quota. `DownloadPdfButton` posts here for both tiers, so a signed-in user
downloading a third invoice inside a minute is told "Too many invoice downloads
from here. Try again in a minute."

The daily quota being shared is deliberate and documented at
render-quota.server.ts:12. The per-IP burst limit applying to accounts is not
mentioned anywhere, and it is the one a real user meets first: sending three
invoices in one sitting is ordinary work, not abuse.

Worse in an office than at home. The limiter keys on `CF-Connecting-IP`, so
everyone behind one NAT shares the two-per-minute bucket regardless of who is
signed in as whom.
**Suggested fix:** resolve the session at the top of the action and skip the two
limiters when it exists, keeping the daily quota for everyone so an account
cannot drain the day's browser time either. Feature 11 adds `/invoices/:id/pdf`
for saved invoices and is the natural place to settle which guards belong to
which tier; the anonymous route keeps every guard it has today.
**Resolution:**

### F-47 [P3] fixed - The invoice list types its row from the loader instead of the generated types

**File:** app/routes/invoices.tsx:99
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** `type Row = Awaited<ReturnType<typeof loader>>["invoices"][number]`
reaches through the loader's return type by hand. The coding standards say to use
the generated `./+types/<route>` types for `loaderData`, and every other route in
the app does: sign-in, sign-up, editor, and the default export of this very file
all take `Route.ComponentProps`. This is the only place that spells the type out
the long way, three lines below a component that does it the documented way.

Nothing is broken; it resolves to the same type. It is drift, and drift in the
one file a reader will copy when they build the feature 11 detail view.
**Suggested fix:** `type Row = Route.ComponentProps["loaderData"]["invoices"][number]`,
which uses the generated type the standards name and survives the loader being
refactored.
**Resolution:** Fixed 2026-08-16 by /implement, exactly as suggested. The file
now has one way of naming loader data, the generated one, and `tsc -b` exits 0,
which is the real gate for a type-only change.

### F-48 [P3] fixed - The list cap says "most recent" but sorts by issue date

**File:** app/routes/invoices.tsx:67
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** The notice reads "Showing your 50 most recent invoices", and
the query orders by `issueDate desc, createdAt desc`. Those are different
questions. An invoice created today but dated last year sorts near the bottom, so
a user past the cap who back-dates an invoice can save it, be told the save
worked, and then not find it in a list that claims to show their most recent
work.

Only reachable past 50 invoices, which is why it is P3 and not higher, and the
cap itself is a recorded decision rather than an oversight (see the archived
feature 9 spec). The wording is the part that misleads: it describes a sort the
code does not perform.
**Suggested fix:** say what the list actually does, for example "Showing your 50
newest invoices by issue date." When pagination lands, this notice goes away and
the ordering becomes a control rather than a hidden rule.
**Resolution:** Fixed 2026-08-16 by /implement. The notice now reads "Showing
your 50 newest invoices by issue date", with a comment recording why the
distinction matters.

Not observed rendering, and worth being precise about that: the notice only
appears once a user holds more than 50 invoices, and the local database has one.
The cap mechanism itself was proven in the browser during feature 9 step 2 by
seeding 56 rows; this change is the string it prints, covered by typecheck and
build. Re-seeding to re-read one literal was not worth mutating the database for.

