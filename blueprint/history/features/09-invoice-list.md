# Feature: Invoice list

**From build-plan:** feature 9
**Status:** complete

## Goal

Give a signed-in user a dashboard at `/invoices` that lists the invoices they
have saved, with client, invoice number, total, issue and due dates, and status.

Feature 7 made saving possible but nothing reads an invoice back, so a saved
invoice is unreachable the moment the tab closes and the only proof a save worked
is the word "Saved" on a button. This feature is what makes saving mean anything,
and it is the first half of the account path the whole project is built around.

## Design reference

**`blueprint/reference/shadcn-dashboard-01.png`** - shadcn's `dashboard-01`
block, captured at 1440px. This is the visual target for layout and density, not
a component to install.

**Take from it:**

- the data table: muted column headers, generous row height, one status pill per
  row sitting in its own cell, numerics right aligned
- the page rhythm: a header row, then content in a card, on a neutral page
- the status pill treatment (small, filled, low-contrast background with a
  readable foreground), which is exactly what the `--color-status-*` tokens
  already in `app/app.css` were defined for

**Do not install the block.** `dashboard-01` pulls in `@tanstack/react-table`,
`recharts@3.8.0` (via its `chart` dependency), and `zod`, plus 19 registry
components against the 6 this project owns today, and 11 block files including a
30KB data table and a 10.7KB interactive chart. What arrives with it that this
app has no use for: a left sidebar (this app uses a top `AppBar`), an area chart
of a time series that does not exist, drag-to-reorder rows (invoices have a
canonical order), and row-selection checkboxes with nothing to bulk-act on.

**Install only the two primitives it is built from**, both of which have zero npm
dependencies:

```
pnpm dlx shadcn@latest add table badge
```

`table` ships its own `overflow-x-auto` container, which is what satisfies the
320px done-when rather than a hand-rolled wrapper.

**The four stat tiles at the top of the reference are not this feature.**
"Outstanding / Overdue / Paid" is a genuinely good fit for this dashboard, but
every number in it is derived from status, so it belongs with feature 10. Leave
room for it above the table; do not build it.

Also still relevant: `blueprint/reference/editor-mockup.html` and `theme.css`
hold the app's existing visual language, and the new screen should look like it
belongs to the same product as the editor.

## In scope

- `listInvoices`, a bounded, user-scoped summary query
- The `InvoiceSummary` type, which features 10, 11, and 12 also read
- Deriving overdue from status plus due date, at read time
- The `/invoices` route: signed-in only, table of saved invoices
- The empty state for a user who has saved nothing yet
- A status badge covering all five display states
- Navigation to and from the dashboard in the app bar

## Out of scope

- **Opening an invoice.** Rows are not links yet. `/invoices/:id` is feature 11,
  and a row linking to a route that does not exist would 404. Feature 11 turns
  the row into a link; that is a small diff on top of this one.
- **Changing status.** Feature 10 owns marking an invoice draft, sent, or paid.
  This feature only displays the status an invoice already has.
- **Delete and void.** Feature 12. No row actions of any kind here.
- **Pagination, search, sorting, filtering.** See the bound in Data/contracts.
- **Line items.** A list row never needs them, and not reading them is the point
  of a separate summary query.
- **A phone route to the dashboard.** Accepted as F-45 during step 3; the bar has
  no room for it without changing feature 5's Download button.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The summary query and the overdue rule** - add `InvoiceSummary`
  and `listInvoices` to `app/lib/invoice-store.server.ts`, selecting named
  columns only, scoped by `userId` in the SQL, ordered newest first and bounded.
  Add `app/lib/invoice-status.ts` with the pure display derivation
  (`draft | sent | paid | void | overdue`) taking the current date as an
  argument. No UI. *Done when:* `pnpm test` passes with new cases in
  `app/lib/invoice-status.test.ts` covering a sent invoice due yesterday
  (overdue), due today (not overdue), due tomorrow (not overdue), a paid invoice
  past its due date (paid, never overdue), a void invoice past its due date
  (void), a draft past its due date (draft), and an empty due date; and
  `pnpm typecheck` passes.

- [x] **Step 2 - The `/invoices` screen** - add the `table` and `badge`
  primitives with the shadcn CLI, then `app/components/invoice/StatusBadge.tsx`
  over the existing `--color-status-*` tokens, then `app/routes/invoices.tsx`
  registered in `app/routes.ts`. The loader calls `requireUser` then
  `listInvoices`. Render a table of invoice number, client, issue date, due date,
  total, and status, following the reference image. Include the empty state for a
  user with nothing saved. *Done when:* signed in at `/invoices`, every invoice
  saved from the editor appears with its number, client name, dates, total in
  that invoice's own currency, and status; a user with no invoices sees the empty
  state with a link back to the editor and no table headers; signed out,
  `/invoices` redirects to `/sign-in` and returns to `/invoices` after signing
  in; the page does not scroll sideways at 320px.

  *Reviewing this diff:* `app/components/ui/table.tsx` and `ui/badge.tsx` are
  generated by the shadcn CLI and land unmodified. The code to actually read is
  the route, the badge, and the row rendering.

- [x] **Step 3 - Reaching it from the app bar** - turn the hardcoded "Editor"
  pill in `app/components/AppBar.tsx` into real navigation with Editor and
  Invoices, marking the current page. Invoices appears only for a signed-in
  user. *Done when:* signed in, the bar shows both entries on the editor and the
  dashboard, each marks itself `aria-current="page"` on its own page, and each
  navigates to the other; signed out, only Editor is shown and no link to
  `/invoices` is present anywhere; the bar still fits 320px without sideways
  scroll.

  **Amended during the build.** The last two clauses turned out to be mutually
  exclusive, and the measurement is in F-45: with the nav removed the editor's
  bar is already exactly full at 320px (305 of 305), so a nav item of any width
  scrolls the page sideways. Delivered instead: the nav shows both entries from
  `sm` up, where it fits, and stays hidden below `sm`, where the old pill was
  hidden too. The brand mark became a link to `/`, which costs no width and is
  the phone's way back to the editor. The gap that leaves, no route to the
  dashboard from a phone, is filed as **F-45 [P2]** and accepted by the user for
  now rather than paid for out of feature 5's Download button.

## Files / areas

| File | Why |
| --- | --- |
| `app/lib/invoice-store.server.ts` | new `InvoiceSummary` type and `listInvoices` query |
| `app/lib/invoice-status.ts` | new: pure overdue/display-status derivation, needed on both client and server so it cannot be `.server.ts` |
| `app/lib/invoice-status.test.ts` | new: the gate for step 1 |
| `app/routes/invoices.tsx` | new: the dashboard route |
| `app/routes.ts` | register `/invoices` |
| `app/components/ui/table.tsx` | new: shadcn primitive, generated, 0 npm deps |
| `app/components/ui/badge.tsx` | new: shadcn primitive, generated, 0 npm deps |
| `app/components/invoice/StatusBadge.tsx` | new: the five display states over existing tokens |
| `app/components/AppBar.tsx` | nav becomes real links, current page marked |
| `app/routes/editor.tsx` | tell the bar which page is current |

## Data / contracts

**`InvoiceSummary` is load-bearing.** Features 10, 11, and 12 read it. Define it
now:

```ts
export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;   // stored: draft | sent | paid | void
  billToName: string;
  issueDate: string;       // ISO YYYY-MM-DD
  dueDate: string;
  currency: string;        // ISO 4217, per invoice
  total: number;           // integer minor units
  updatedAt: string;       // ISO 8601 UTC
};
```

**Display status is derived, never stored.** `overdue` is not an
`InvoiceStatus`; it is what a `sent` invoice past its `dueDate` renders as. The
overview locks this: a stored overdue flag would need a scheduled job to flip it
and would be wrong for every invoice the job missed. The derivation takes the
current date as an argument rather than calling `new Date()` inside, matching
`createEmptyDraft(today)` and the standards' preference for passing a clock in.

**The query reads named columns, never `select *`, and never line items.** A list
row has no use for line items, and F-43 is the standing lesson about reading more
than the answer needs on a route that runs constantly.

**The result is bounded.** `listInvoices` takes a limit, defaulting to 50, and
the screen says so when the cap is hit. An unbounded "every invoice this user has
ever made" query is F-43's exact shape on the one screen guaranteed to grow.
Real pagination is deliberately deferred: 50 is far past what the deployed
database holds, and paging UI built before anyone has 50 invoices is guesswork.
Flagged here so it is a known limit rather than an audit finding later.

**Ordering:** `issueDate desc, createdAt desc`. Invoices are dated documents and
users look for them by date; `createdAt` breaks ties so the order is stable
rather than whatever SQLite returns.

**Every query filters by `userId` in the SQL**, from the session, never from the
request. Same rule as `getInvoice` and `updateInvoice` already follow.

## Testing

The gate is **on**: `AGENTS.md` declares `pnpm test`.

**Needs a test (step 1).** `app/lib/invoice-status.ts` is exactly the in-scope
shape: a pure function, assertable inputs and outputs, real edge cases at the
boundary. The due-date comparison is the whole risk in this feature. Cases are
enumerated in step 1's done-when; the boundary ones (due today versus due
yesterday) are the ones that matter, and paid-past-due is the case that proves
overdue does not outrank a terminal status.

**Rides on browser and build evidence.** `listInvoices` is a D1 query and
`routes/invoices.tsx` is a render surface, both integration-level. This matches
existing practice: `invoice-store.test.ts` tests the pure mapping functions
(`draftToRows`, `rowsToDraft`, `toSavedInvoice`) and leaves the queries to real
runs against the local database.

**Manual pass for step 2**, against the local D1:

1. Sign in, save two invoices from the editor with different clients, currencies,
   and due dates, one due in the past.
2. Visit `/invoices`. Both appear, newest issue date first, each total in its own
   currency, the past-due one showing nothing unusual yet because it is still a
   draft.
3. Set one to `sent` directly in the local database and reload: it renders
   overdue.
4. Sign out and visit `/invoices`: redirected to sign-in, and returned to
   `/invoices` after signing in.
5. Sign in as a second account with no invoices: the empty state.
6. At 320px, no sideways scroll on either state.

## Notes for the AI

- **Reuse the formatters.** `formatMoney(total, currency)` and
  `formatInvoiceDate(iso)` already exist and are already tested. Do not write new
  ones, and format money **per row** from that row's own currency; two invoices
  in a list can be in different currencies and a single symbol in a column header
  would be wrong.
- **An empty client name is expected.** `billToName` can legitimately be `""`,
  because the editor saves whatever is typed. Render a muted placeholder, the way
  the invoice templates already do for a party with no name, not an empty cell.
- **Handle `void` in the badge now**, even though nothing can produce it until
  feature 12. The token already exists and a status the badge cannot render is a
  broken screen later for no saving today.
- **Do not add row actions, links, or menus.** They belong to features 10, 11,
  and 12, and adding them here is the scope creep this spec exists to prevent.
  The reference image shows a row menu and selection checkboxes; both are part of
  what this feature deliberately leaves out.
- **No "Invoices" link for anonymous users.** The overview is explicit that there
  is no sign-up wall and the account prompt appears only when the user reaches
  for something needing an account. A nav entry that exists only to bounce a
  visitor to sign-in is that wall in miniature.
- **Server vs client.** The loader resolves the session and runs the query on the
  Worker; the route component is presentational. `invoice-status.ts` is imported
  by both, so it must not be `.server.ts` and must not import anything that is.
- The route is a normal page module, not a resource route: `loader` plus a
  default export, using the generated `./+types/invoices` types like every other
  route here.
