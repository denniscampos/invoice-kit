# Feature: Invoice detail view

**From build-plan:** feature 11
**Status:** complete

## Goal

Give every saved invoice its own URL at `/invoices/:id`, where it opens in the
editor, can be changed, saved again, and downloaded.

This is the step where the editor stops guessing. Today it works on one unnamed
draft and infers which stored invoice that draft is by comparing invoice numbers
against a reference in `sessionStorage`. The overview calls that a stand-in
rather than the model, and it has already produced one destroyed invoice (F-41,
fixed by making the guess more conservative rather than by removing it). After
this feature the identity of an invoice is the id in the URL, checked against the
session in SQL, and the guess is deleted.

It also closes the loop feature 9 opened: the dashboard lists invoices, and now a
row leads somewhere.

## Design reference

**No new visual target.** The screen is the editor that already exists, at a
different URL, with a small header above it naming which invoice is open. The
list at `/invoices` and the editor at `/` are the two surfaces this has to look
like it belongs to, and both are already built.

The one new piece of layout is the detail header: a back link to `/invoices`, the
invoice number, and the status badge feature 9 already built. Match the page
rhythm of `app/routes/invoices.tsx` (a header row, then content), not a new one.

## In scope

- `/invoices/:id`, signed-in only, 404 for an id that is not this user's
- The saved invoice loaded into the editor's form and preview
- Saving an edit in place, against the id in the URL
- Renaming an invoice: changing the number updates that invoice rather than
  producing a second one
- Downloading the PDF of what is on screen, using the endpoint that already exists
- Rows in `/invoices` becoming links
- Extracting the editor's two panes so `/` and `/invoices/:id` share them
- Retiring the `sessionStorage` saved-invoice reference and the invoice-number
  comparison built on it
- Saving a new invoice at `/` handing off to its own URL

## Out of scope

- **Changing status.** Marking an invoice draft, sent, or paid is feature 10.
  This screen displays the status an invoice already has, the way the list does.
  The overview lists "change status" under the detail view; that is a description
  of the finished screen across features 10 and 11, not of this one.
- **Delete and void.** Feature 12.
- **`/invoices/:id/pdf`.** The overview's route list names it. Not building it,
  deliberately: the detail page holds the draft the user is looking at, and the
  overview's own principle is that what you see is what downloads. A route that
  renders the *stored* invoice would quietly disagree with the screen whenever
  there are unsaved edits. The existing `POST /invoice/pdf` takes the on-screen
  draft and already does the right thing. If a download-without-opening ever
  appears on the list, that is when the route earns its place.
- **F-45 and F-46.** Both are open P2 findings deferred to "feature 11", and
  neither one's fix is in the code this feature writes: F-45 lives in `AppBar`
  and feature 5's Download button, F-46 entirely in `app/routes/invoice.pdf.tsx`.
  They get a `/fix` of their own straight after this merges, F-45 first. This
  revises what the last audit report suggested; the reason is that dropping them
  into this branch would mix three unrelated diffs, not that they stopped
  mattering. F-45 in particular gets worse with this feature: see Testing.
- **Warning about unsaved edits** when navigating away. A real feature (a
  beforeunload guard plus a dirty check) and not this one.
- **Two tabs editing one invoice.** Last write wins, as it does today.
- **Restoring an in-progress edit of a saved invoice** across a refresh. `/`
  keeps its `sessionStorage` draft because an anonymous invoice has nowhere else
  to live. A saved invoice has D1, and giving the detail page its own storage
  would mean deciding which copy is real on the next visit.
- **Draft handoff at sign-up.** Feature 8.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Extract the editor's two panes** - move the `<main>` of
  `app/routes/editor.tsx` into `app/components/invoice/InvoiceEditorPanes.tsx`,
  taking `{ draft, onChange, notice }`. State, `sessionStorage`, and the app bar
  stay in the route. Pure refactor, no behaviour change. *Done when:* `pnpm
  typecheck` and `pnpm build` pass, and `/` still restores a stored draft,
  updates the preview as fields are typed, saves, and downloads exactly as before.

- [x] **Step 2 - The invoice at its own URL, read and download** - add
  `app/routes/invoices.$id.tsx` registered as `invoices/:id`. The loader calls
  `requireUser` then `getInvoice`, throws a 404 `Response` when it returns null,
  and derives the display status from one `new Date()` the way the list does.
  Render the app bar with `DownloadPdfButton`, a header (back link to
  `/invoices`, invoice number, status badge), and `InvoiceEditorPanes` seeded from
  the saved draft. Add a route `ErrorBoundary` that keeps the app bar and offers
  the way back. Wrap the number cell in `app/routes/invoices.tsx` in a `Link` to
  the row's id, and drop `end` from the app bar's Invoices `NavItem` so the
  detail page marks its own section current instead of nothing. *Done when:*
  clicking a row on `/invoices` opens that invoice with
  its number, dates, parties, line items, totals, and template as saved; the
  preview matches what the editor showed when it was saved; Download PDF returns
  that invoice; a random uuid and another account's invoice id both render the
  not-found state with a link back, not a stack trace and not a 403; signed out,
  the URL redirects to `/sign-in` and returns after signing in; no sideways
  scroll at 320px; the browser tab names the invoice rather than saying "Invoice
  Kit"; and on the detail page the app bar's Invoices entry is marked current.

- [x] **Step 3 - Saving the edit** - add the action to `invoices.$id.tsx`, taking
  the id from `params` and never from the form. Add `saveDraftEdit` to
  `app/lib/invoice-save.server.ts`: update-only, returning `null` when the
  invoice is not this user's so the route can 404 rather than silently creating a
  second invoice at an id the URL no longer describes. Give `SaveButton` an
  `invoiceId` prop; when it is set, the button neither reads nor writes the
  `sessionStorage` reference and sends only the draft. *Done when:* editing a
  field and pressing Save stores it (reload shows the change and `/invoices`
  shows the new total); the id count in the database is unchanged by a save;
  changing the invoice number renames the invoice in place rather than creating a
  second one; changing it to a number already used shows the duplicate message
  beside the form and stores nothing; a save against an invoice deleted from the
  database in another window answers 404 rather than creating one.

  **Found during the build: a hydration mismatch this step exposed.** dnd-kit
  names its screen reader description element from a counter in module scope, so
  the server handed out `DndDescribedBy-2, -3, -4, -5` across four consecutive
  requests (a Worker isolate serves many, and the counter never resets) while the
  browser always starts at `-0`. It could never match. Only reachable now,
  because this is the first screen that server-renders line items: at `/` the
  draft arrives after mount, so the server had never drawn a row. Fixed inside
  this step with a fixed `id="line-items"` on the `DndContext` in
  `LineItemsCard.tsx`, which makes dnd-kit skip the counter. Console clean after.

- [x] **Step 4 - `/` hands off, and the guess is deleted** - a successful save at
  `/` now clears the stored draft and navigates to `/invoices/:id`. Reduce
  `saveDraft` to create-only (drop `knownId` and the fall-through to create), drop
  the `invoiceId` form field from the editor's action, and delete
  `SavedInvoiceRef`, `readSavedInvoiceRef`, `writeSavedInvoiceRef`, and their
  storage key from `app/lib/invoice-draft.ts`, adding `clearStoredDraft`. *Done
  when:* saving a new invoice at `/` lands on that invoice's URL with the same
  content; returning to `/` afterwards shows a fresh invoice at the next number
  in the sequence rather than the one just saved; `rg savedInvoiceRef` and `rg
  invoice-kit:saved-invoice` find nothing; and F-41's exact sequence (save an
  invoice, change its number, save again) can no longer be performed from `/` at
  all, because the first save leaves that screen.

  **Found during the build: the handoff silently did nothing at first.** The
  first attempt changed the URL and left the editor on screen: no header strip,
  the old title, the Save button reading "Saved". A hard load of the same URL
  rendered the detail route correctly, so routing was healthy. The cause is that
  `fetcher.data` arrives the moment the action returns, while the router is still
  revalidating the editor's own loader, and a `navigate()` started inside that
  window is dropped. Gating the effect on `fetcher.state === "idle"` fixes it.
  Worth recording because checking `location.pathname` alone would have called
  this step done: the URL was right and the page was wrong.

## Files / areas

| File | Why |
| --- | --- |
| `app/components/invoice/InvoiceEditorPanes.tsx` | new: the form column and preview, shared by both editors |
| `app/routes/editor.tsx` | uses the extracted panes; loses the id it used to post |
| `app/routes/invoices.$id.tsx` | new: the detail route, its action, and its error boundary |
| `app/routes.ts` | register `invoices/:id` |
| `app/routes/invoices.tsx` | the number cell becomes a link |
| `app/components/AppBar.tsx` | the Invoices entry stops being `end`-matched, so it covers its own section |
| `app/lib/invoice-save.server.ts` | new `saveDraftEdit`; `saveDraft` becomes create-only |
| `app/lib/invoice-draft.ts` | the saved-invoice reference goes, `clearStoredDraft` arrives |
| `app/components/invoice/SaveButton.tsx` | takes the invoice id; navigates after a create |
| `app/components/invoice/LineItemsCard.tsx` | a fixed `DndContext` id, for the hydration mismatch step 3 exposed |

## Data / contracts

**The URL is the identity.** `/invoices/:id` is load-bearing: features 10 and 12
add their actions to this route, and both need an invoice that is already
identified. After step 4 no invoice id travels in a form body anywhere in the
app.

This does not change who is trusted. The id in the URL is as client-supplied as
the one in the form was; what makes it safe is unchanged and non-negotiable:
`getInvoice`, `updateInvoice`, and `saveDraftEdit` all put `userId` from the
session into the SQL, and someone else's invoice is indistinguishable from one
that does not exist. What the URL buys is that there is now exactly one place the
app looks to answer "which invoice is this", instead of two that can disagree.

**The 404, not a 403.** An id that is not this user's renders the same not-found
state as an id nobody owns. The standards require it: a 403 confirms the invoice
exists.

**`saveDraftEdit` returns `SaveResult | null`.** `null` means no such invoice for
this user. The route turns that into a 404. It must not fall through to a create,
which is what `saveDraft` does today and is correct only for a `knownId` that was
a hint from `sessionStorage`. Once the id comes from the URL, creating on a miss
would leave the browser on a dead address holding a "Saved" label.

**Status is read, never written, here.** `updateInvoice` already preserves the
stored status so editing a sent invoice cannot quietly un-send it. `rowsToDraft`
reports `status: "draft"` inside the draft because the draft type only describes
editing; the real status comes from `SavedInvoice.status` beside it. Both already
behave this way; nothing in this feature should change either.

**Display status is derived in the loader**, from one `new Date()`, exactly as
`app/routes/invoices.tsx` does. The Worker is UTC and the browser is local, and
deriving it during render would let the two disagree about what day it is.

**`InvoiceEditorPanes` does not persist anything.** Storage stays in the route.
`/` writes to `invoice-kit:draft:v1` because an anonymous invoice has nowhere
else to live; the detail route writes nothing, or editing a saved invoice would
overwrite the draft someone left in another tab.

## Testing

The gate is **on** (`AGENTS.md` declares `pnpm test`), and this feature adds no
in-scope logic, so every step rides on browser and build evidence.

Being precise about that rather than waving at it: the four steps deliver a
component extraction, a route loader, a route action, and a navigation. The one
piece with a decision in it is `saveDraftEdit`, and it is a D1 query, which is
the integration side of the scope rule. This matches what is already here:
`invoice-store.test.ts` tests the pure mapping functions and leaves every query
to real runs against the local database, and `saveDraft` has no unit test today
for the same reason. If a step turns up logic this spec did not foresee, it ships
a test with that step.

**Manual pass, against the local D1**, with at least two saved invoices and a
second account holding one of its own:

1. `/invoices`, click a row: the invoice opens at its own URL, matching what was
   saved.
2. Edit the client name, Save, reload: the change is there. Back on `/invoices`,
   the row shows it.
3. Change the invoice number to a free one and Save: the same invoice is renamed.
   Confirm in the database that the row count did not change.
4. Change it to the other invoice's number: the duplicate message appears beside
   the form and nothing is written.
5. Sign in as the second account and open the first account's invoice URL: the
   not-found state, with a link back.
6. Signed out, open the URL: sign-in, then back to the invoice.
7. From `/`, fill in a new invoice and Save: it lands on its own URL. Go back to
   `/`: a fresh invoice at the next number.
8. Download PDF from the detail page, and check it is the invoice on screen.
9. 320px on both the detail page and the list: no sideways scroll.

**A known gap this feature widens, not a step to fix here.** Step 2 makes the
list the front door to every saved invoice, and F-45 means a phone cannot reach
the list. The detail page's own back link works at every width, so the trip out
is fine; it is the trip in that a phone still cannot make. Expect the 320px check
to pass and the route still to be unreachable, and do not paper over that in the
step's evidence. F-45 is next.

**F-46 will show up during step 8 above** if you download more than twice in a
minute, signed in or not. It is pre-existing, it is filed, and it is not this
feature's to fix.

## Notes for the AI

- **The editor's state stays where it is.** `/` has a restore-from-storage dance,
  a hydration-safe blank date window, and a suggested number; the detail route
  has none of that and seeds straight from loader data with a plain `useState`.
  Do not fold them into one hook with flags. The panes are shared because the
  markup is identical; the state is not shared because it genuinely differs.
- **Step 3 leaves `SaveButton` briefly serving two worlds** (the ref at `/`, the
  URL id on the detail page). That is deliberate, so each step is reviewable.
  Step 4 deletes the first branch. Do not try to do both at once.
- **Route module naming** follows the existing files: `invoices.$id.tsx`, path
  `invoices/:id`, registered in `app/routes.ts` with the generated
  `./+types/invoices.$id` types like every other route.
- **Throw a `Response` for the 404**, per the standards, and let the route's own
  `ErrorBoundary` render it with `isRouteErrorResponse`. The root boundary would
  render a bare page with no app bar.
- **Reuse the formatters and the badge.** `formatMoney`, `formatInvoiceDate`,
  `displayStatus`, and `StatusBadge` all exist and are tested. Nothing new here.
- **Do not add row actions to the list.** The row's link is the only thing this
  feature adds there. Menus, checkboxes, and status controls belong to 10 and 12.
- **A stale `invoice-kit:saved-invoice:v1` key** will sit in the sessionStorage of
  a tab that is open across the deploy. Nothing reads it after step 4 and it dies
  with the tab, so leave it; do not write migration code for a key that is
  already garbage.
- **`clearStoredDraft` runs only after `ok: true`.** The draft is the user's only
  copy until the save succeeds, and clearing it on any other path loses their
  work.

## Findings

Resolved findings carried into this archive. All four were raised and
repaired before this feature started; they reached `closed` at the audit
that followed, which is why they archive here. Their **Found** lines record
where each came from.

### 11/F-40 [P3] closed - The starter template's sample variable is still deployed

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

**Closed 2026-08-16 by /audit (scope: full).** The repo is clean of it and so is
production now: the deploy of version `b102473a` printed four bindings (DB,
BROWSER, PDF_LIMITER, PDF_GLOBAL_LIMITER) and no environment variable, so the
note above is discharged rather than outstanding.

### 11/F-44 [P3] closed - The editor can suggest an invoice number it will then refuse

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

**Closed 2026-08-16 by /audit (scope: full).** Re-read the repaired query and
pushed on it rather than re-running the case that was already known to pass.

Every row the query now returns is one `nextInvoiceNumber` can parse, which is
what the finding was really about, so letter-bearing numbers can no longer take
the window. The query plan is unchanged by the repair (see F-49), so nothing was
traded away for it.

One residual, recorded rather than left as an open finding. `cast(... as
integer)` saturates at INT64_MAX, so `INV-99999999999999999999` sorts to the top
with a key of 9223372036854775807. `nextInvoiceNumber` then rejects it anyway,
because `Number.isSafeInteger` is false past 2^53, so the outcome is correct; but
ten such numbers could still crowd the ten-row window the way INV-12AB did.
Reaching that needs ten invoice numbers of nineteen or more digits, which is not
a naming scheme, it is deliberate abuse of one's own account, whereas INV-12AB
was something a person might plausibly type. The class shrank from "any letters"
to "digits beyond 2^53", and that is small enough to stop tracking. If it ever
shows up in real data it earns a fresh finding with fresh evidence.

Also confirmed unchanged: `INV-10000` outranks `INV-9999` numerically, and
`INV-000000000000000000001` sorts last with a key of 1 while still carrying its
padding width, which is `nextInvoiceNumber`'s documented behaviour and not
something this repair altered.

### 11/F-47 [P3] closed - The invoice list types its row from the loader instead of the generated types

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

**Closed 2026-08-16 by /audit (scope: full).** Re-read app/routes/invoices.tsx:100:
`Route.ComponentProps["loaderData"]["invoices"][number]`, and `rg` finds no
remaining `Awaited<ReturnType<typeof loader>>` in any route. `tsc -b` exits 0
with no output, measured without a pipe.

### 11/F-48 [P3] closed - The list cap says "most recent" but sorts by issue date

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

**Closed 2026-08-16 by /audit (scope: full).** Re-read app/routes/invoices.tsx:74-82.
The sentence now says "newest invoices by issue date", which is what
`order by issueDate desc, createdAt desc` actually does, and a comment above the
block records why the distinction is worth keeping. Closing on a read of the
source rather than a render is the right standard for a string literal: there is
no behaviour between the two to get wrong, and the surrounding conditional is
unchanged.
