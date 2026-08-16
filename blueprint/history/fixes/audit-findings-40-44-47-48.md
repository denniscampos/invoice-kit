# Fix: four findings from the full audit

**Type:** Fix
**Fixes:** F-44, F-47, F-48, F-40
**Status:** complete

## The problem

Four unrelated findings from the 2026-08-16 full audit, batched because each is a
few lines and none is worth its own branch. Three sit in the code feature 9 just
landed; the fourth has been in `wrangler.json` since the starter template.

**F-44 [P3]** - `app/lib/invoice-store.server.ts:404`. The suggestion query filters
with `glob 'INV-[0-9]*'`, which only requires a digit immediately after the dash,
and sorts by `length(invoiceNumber) desc, invoiceNumber desc`, which is a string
sort. So `INV-12AB` passes the filter and outranks `INV-0002`. Ten such numbers
fill the whole ten-row window, the real sequence never reaches
`nextInvoiceNumber`, it skips all ten as unparseable, falls back to `INV-0001`,
and hands the user a number they already hold. Saving then refuses.

The audit reproduced this read-only against the local database; the query returned
ten `INV-<digits><letters>` rows and none of `INV-0001`, `INV-0002`, `INV-0003`.

**F-47 [P3]** - `app/routes/invoices.tsx:99`. `type Row = Awaited<ReturnType<typeof
loader>>["invoices"][number]` reaches through the loader's return type by hand,
where the standards say to use the generated `./+types/<route>` types. Every
other route in the app uses `Route.ComponentProps`, including the default export
three lines above this.

**F-48 [P3]** - `app/routes/invoices.tsx:67`. The cap notice says "Showing your 50
most recent invoices" while the query orders by `issueDate desc`. Past 50
invoices, a back-dated invoice saves successfully and then does not appear in a
list claiming to show recent work.

**F-40 [P3]** - `wrangler.json:57`. `VALUE_FROM_CLOUDFLARE` came with the React
Router starter, no code has ever read it, and it prints in the binding list on
every deploy beside D1, Browser Rendering, and the two rate limiters.

## The fix

**F-44 - make the SQL filter agree with what `nextInvoiceNumber` can parse.**
The function accepts `^INV-(\d+)$` and nothing else, so the query should not
return candidates it will throw away. Two changes:

- add `and not invoiceNumber glob 'INV-*[^0-9]*'`, which rejects anything holding
  a non-digit after the prefix, so `INV-12AB` never enters the window
- order by `cast(substr(invoiceNumber, 5) as integer) desc`, a numeric sort on
  the sequence part, which makes the `length()` trick unnecessary because 10000
  is simply greater than 9999

Keep `limit 10` rather than dropping to one row. `nextInvoiceNumber` derives the
padding width from every candidate it is given, so a handful lets a user who
moved to six digits keep them.

**Must not break:** `INV-10000` still has to outrank `INV-9999`; a user whose only
number is `2026-04` still has to start at `INV-0001`; padding must not shrink.
These are pinned by the existing `invoice-number.test.ts` and by the checks in
F-43 and F-44's resolutions.

**F-47** - `type Row = Route.ComponentProps["loaderData"]["invoices"][number]`.

**F-48** - reword to "Showing your 50 newest invoices by issue date", which
describes the sort the code performs.

**F-40** - delete the `vars` block from `wrangler.json` and run `pnpm cf-typegen`
so `worker-configuration.d.ts` stops declaring it.

## Build steps

- [x] **Step 1 - F-44, the suggestion query** - change the filter and the ordering
  in `listInvoiceNumbers`, and update the comment above it, which currently
  explains the string-sort reasoning that is being replaced. *Done when:* run
  read-only against the local database with a `values` list, the query given
  `INV-0001`, `INV-0002`, `INV-0003` and ten `INV-<digits><letters>` numbers
  returns the three real ones and none of the ten; `INV-10000` still sorts above
  `INV-9999`; `pnpm test` and `pnpm typecheck` pass.

- [x] **Step 2 - F-47, F-48, and F-40** - the two one-liners in `invoices.tsx` and
  the `wrangler.json` deletion plus `pnpm cf-typegen`. *Done when:* `Route.ComponentProps`
  is the only loader-data typing in the file; the cap notice reads "newest ... by
  issue date"; `rg VALUE_FROM_CLOUDFLARE app workers wrangler.json` returns
  nothing; `pnpm typecheck` and `pnpm build` pass.

## Verify

1. **F-44, against the local database** (read-only, a `values` list rather than
   written rows, the same way the audit reproduced it):

       with candidates(invoiceNumber) as (values
         ('INV-0001'),('INV-0002'),('INV-0003'),
         ('INV-12AB'),('INV-13AB'),('INV-14AB'),('INV-15AB'),('INV-16AB'),
         ('INV-17AB'),('INV-18AB'),('INV-19AB'),('INV-22AB'),('INV-23AB'))

   The three real numbers come back, the ten letter-bearing ones do not.

2. **F-44, in the browser.** The editor still suggests the next number in
   sequence for the account holding `INV-0001`, so a fresh editor offers
   `INV-0002` and saving it succeeds.

3. **F-47 and F-48.** `/invoices` renders unchanged apart from the notice, which
   only appears past the cap. Typecheck is the real gate for the type change.

4. **F-40.** `pnpm check` runs the deploy dry run and the binding list no longer
   prints `env.VALUE_FROM_CLOUDFLARE`.

## Notes for the AI

- `substr(invoiceNumber, 5)` is safe only because the glob guarantees the
  `INV-` prefix. Keep the two together.
- The existing tests cover `nextInvoiceNumber`, not the query. This fix is in
  SQL, so its evidence is the database run above, matching how
  `invoice-store.test.ts` already leaves queries to real runs and tests the pure
  mapping instead. Do not add a test that mocks D1 to manufacture coverage.
- **F-40 leaves the deployed Worker briefly ahead of the repo**: the var stays
  bound in production until the next deploy. Harmless, since nothing reads it,
  but worth saying at `/complete` rather than discovering later.

## Findings

Resolved findings archived with this fix. IDs carry the archive name so they stay unique after the ledger resets and renumbers.

### audit-findings-40-44-47-48/F-43 [P3] closed - Every page load reads all of a user's invoice numbers

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

**Closed 2026-08-16 by /audit (scope: full).** Re-read `listInvoiceNumbers` at
app/lib/invoice-store.server.ts:404 against the current code: the query carries
`limit 10`, so the read is bounded no matter how many invoices a user has, which
is the whole of what this finding asked for. The defect it introduced is tracked
separately as F-44 and is not a reason to hold this one open.
