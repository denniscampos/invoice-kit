# Fix: Saving a second invoice destroys the first

**Type:** Fix
**Fixes:** F-41, F-42, F-43, F-44
**Status:** complete

## The problem

**F-41 [P1]** is the real one. The editor remembers the id of what it last saved
so that pressing Save twice updates one invoice rather than creating two.
Nothing ever clears that id, so it is not "the invoice I am editing", it is "the
first invoice I ever saved in this tab", and every later save is aimed at it.

Reproduced against the local database: from a fresh tab, press Save (creates
`INV-0001`), change the number to `INV-0002` the way anyone would to start their
next invoice, press Save. One row remains, numbered `INV-0002`. The first invoice
is gone, with its line items, its dates, and its client. The button said `Saved`
both times.

**F-42 [P3]** - `invoiceSubtotalOf` was exported in 7a and is called from
nowhere, including its own file. It also sits one letter from `invoiceSubtotal`
in `invoice-draft.ts`, which is used three times and computes something
different.

**F-43 [P3]** - the editor's loader selects every invoice number a user has, on
every navigation and again after every save, to produce one suggestion that a
restored draft then discards.

## The fix

**The saved id is only reused while the invoice number matches.** The editor
remembers the number it saved under, beside the id. When the posted number is the
same, that is the same invoice and it updates. When it differs, the user is
working on a different invoice and it creates.

**The trade this makes, deliberately:** someone correcting the number of an
existing invoice (`INV-0001` should have been `INV-0007`) gets a second invoice
rather than a renamed one. That is a duplicate the user can see and delete once
feature 12 exists. The current behaviour destroys an invoice with no warning and
no way back. An unnecessary row is recoverable; a deleted invoice is not.

**This is not the whole answer, and should not pretend to be.** The real cure is
an invoice having a URL, which is feature 11, with feature 9's list to reach it
from. This fix stops the destructive path in the meantime.

**F-42** is a deletion. **F-43** asks the database for the highest number rather
than for every number; `nextInvoiceNumber` already takes a list, so it needs no
change.

None of this may alter what the editor renders, what the PDF endpoint accepts, or
the anonymous tier's ability to build an invoice and download it.

## Build steps

- [x] **Step 1 - Aim the save at the right invoice (F-41)** - store the invoice
  number alongside the saved id in `sessionStorage`, and send the id only when
  the draft's number still matches it. `saveDraft` needs no change: it already
  creates when it is handed no id.

  *Done when:* from a fresh tab, saving `INV-0001` then changing the number to
  `INV-0002` and saving again leaves **two** invoices, both readable, with their
  own line items; saving twice without touching the number still leaves one, with
  `updatedAt` moved; a save that only edits the client name still updates rather
  than duplicating; the anonymous editor and the PDF download are unaffected; and
  `pnpm test`, `pnpm typecheck`, and `pnpm build` are clean.

- [x] **Step 2 - Delete the dead function (F-42)** - remove `invoiceSubtotalOf`
  from `invoice-store.server.ts`.

  *Done when:* the symbol appears nowhere in `app/`; `pnpm typecheck` and
  `pnpm build` are clean; and `pnpm test` still passes, proving nothing depended
  on it.

- [x] **Step 3 - Ask for one number, not all of them (F-43)** - replace
  `listInvoiceNumbers` with a query that returns the highest `INV-` number for
  the user, ordered by length then value so `INV-10000` beats `INV-9999`.

  *Done when:* a fresh editor still suggests `INV-0001` for a user with no
  invoices and the next number for a user with some; a user whose numbers include
  `INV-9999` and `INV-10000` is suggested `INV-10001`, proven against the local
  database; a user whose only invoice is `2026-04` is still suggested `INV-0001`;
  and the loader issues one row-limited query, shown in the code.

- [x] **Repair F-44 - the suggestion the app then refuses** - the F-43 query can
  pick a non-numeric `INV-` value (`INV-DRAFT` outranks `INV-0002`), which
  `nextInvoiceNumber` cannot parse, so it falls back to a number the user already
  has. Narrow the match with `glob 'INV-[0-9]*'` and take a small handful rather
  than exactly one, letting `nextInvoiceNumber` do the filtering it already does.

  *Done when:* a user holding `INV-0001`, `INV-0002`, and `INV-DRAFT` is
  suggested `INV-0003` and saving it succeeds; `INV-10000` still beats
  `INV-9999`; a user whose only invoice is `2026-04` still gets `INV-0001`; the
  query is still bounded, shown in the code; and `pnpm test`, `pnpm typecheck`,
  and `pnpm build` are clean.

## Verify

- Save an invoice, change its number, save again, and confirm both exist
- Save an invoice, edit the client name, save again, and confirm there is still
  only one
- Sign out and back in, then save, and confirm nothing belonging to the earlier
  session was touched
- Confirm the editor still works with no account, and the PDF still downloads

## Notes for the AI

- **Local only.** No schema change, so nothing is owed remotely.
- The saved number lives beside the draft in `sessionStorage`, like the saved id,
  and not inside `InvoiceDraft`, which feature 8 reads and the PDF endpoint
  validates.
- Compare trimmed numbers, the same way the action does before storing one.
- Do not add a New invoice control here. It belongs with feature 9's navigation,
  and this fix is about stopping data loss, not designing the flow that replaces
  it.
- Prove step 1 in the browser, not by reading the code. The bug was invisible in
  the code and obvious the moment the button was pressed twice.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.

## Findings

### second-invoice-overwrite/F-41 [P1] closed - Saving a second invoice overwrites the first

**File:** app/components/invoice/SaveButton.tsx:22
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** The editor remembers the id of what it last saved so that
pressing Save twice updates one invoice instead of creating two. Nothing ever
clears that id: there is no New invoice control, sign out does not reset it, and
it lives in sessionStorage for the life of the tab. So the id is not "the invoice
I am editing", it is "the first invoice I ever saved in this tab", and every
later save is aimed at it.

Reproduced in the browser against the local database. Signed in, from a fresh
tab: press Save, which creates INV-0001. Change the invoice number to INV-0002,
the ordinary way to start the next invoice, and press Save. Afterwards the
database holds **one** row, numbered INV-0002. INV-0001 is gone. Its line items,
its dates, and its client went with it.

This is silent. The button says Saved both times, the number in the form is the
number that was stored, and nothing indicates that the previous invoice was
overwritten rather than kept. The overview promises a user can "save invoices and
retrieve them later"; today a tab can hold exactly one, and the act of starting
the next one destroys the last.

Feature 9 (the list) and feature 11 (the detail view) will give an invoice a URL
and make "which invoice am I editing" explicit, which is the real cure. This
finding is that the gap is destructive in the meantime, not merely missing.
**Suggested fix:** the smallest honest repair is to stop reusing the id once the
invoice number changes: keep the number the id was saved under, and when the
posted number differs, create rather than update. A New invoice control that
clears the draft and the saved id is the other half, and belongs with feature 9's
navigation.

**Resolution:** Fixed 2026-08-16 by /implement. The tab now remembers the invoice
number it saved under alongside the id, and the id is sent only while the draft's
number still matches. A changed number means the user has moved on to their next
invoice, so the save creates instead of aiming at the previous one.

The trade, made deliberately: correcting the number of an existing invoice now
produces a second invoice rather than a renamed one. That duplicate is visible
and deletable once feature 12 exists, where the old behaviour destroyed an
invoice silently and unrecoverably.

Proven in the browser against the local database, running the exact sequence that
lost data before: save INV-0001, change the number to INV-0002, save again. Two
rows now, each with its own id, where there used to be one. Editing the client
name and saving still updates in place rather than duplicating, proven by the id
staying the same and the row count holding at two.

This is not the whole answer and does not claim to be. An invoice getting a URL
(feature 11, reached from feature 9's list) is the real cure; this stops the
destructive path in the meantime.

**Re-reviewed 2026-08-16 by /audit (scope: current): closed.** `SaveButton.tsx`
and `invoice-draft.ts` were both in this pass's reviewed set. The id is now sent
only while the saved number matches the draft's, and the pair is stored together,
so the id can no longer mean "the first invoice this tab ever saved". The
destructive sequence was rerun and produces two invoices rather than one, and an
edit that leaves the number alone still updates in place.

One consequence is worth naming rather than filing: after starting a second
invoice, typing the first invoice's number back in and saving is refused as a
duplicate, so the earlier invoice cannot be reopened in that tab. That is the
gap feature 11 fills by giving an invoice a URL, and being refused is the correct
behaviour in the meantime. It is a limitation, not a defect: nothing is lost.

### second-invoice-overwrite/F-42 [P3] closed - invoiceSubtotalOf is dead on arrival

**File:** app/lib/invoice-store.server.ts:99
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** Exported in 7a and called from nowhere, not even inside its
own file. It also sits one letter away from `invoiceSubtotal` in
`invoice-draft.ts`, which is used in three places and computes a subtly different
thing: the older one sums the totals the client already has, this one recomputes
them from quantity and rate. Two near-identical names with different meanings,
one of them unused, is a trap for whoever reaches for the wrong one first.
**Suggested fix:** delete it. `draftToRows` already does the summing inline, and
nothing else has ever wanted it.

**Resolution:** Fixed 2026-08-16 by /implement. Deleted. `pnpm test` still passes
and the symbol appears nowhere in `app/`, which together show nothing depended on
it.

**Re-reviewed 2026-08-16 by /audit (scope: current): closed.**
`invoice-store.server.ts` was in this pass's reviewed set. The symbol is gone
from `app/` entirely and the suite still passes, so nothing depended on it. The
name collision with `invoiceSubtotal` is gone with it.

