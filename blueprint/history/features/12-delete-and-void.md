# Feature: Delete and void

**From build-plan:** feature 12
**Status:** complete

## Goal

Let a signed-in user get rid of an invoice, in the one of two ways that fits it:
**delete** a draft outright, or **void** a sent one so the record survives with
its number.

This is the last of the four items that make up the dashboard (9, 11, 10, then
this), and the one that finishes the account path: until now nothing can be
removed, so a mistyped invoice is permanent clutter.

## Design reference

**No new visual target.** Two buttons in the detail page's header strip, beside
the status control that landed with feature 10, and one confirmation dialog.
`StatusBadge` already renders Void.

## In scope

- `invoicePermissions`, one place that answers what may be done to an invoice
- `getInvoiceStatus`, so the server can check the stored status rather than trust
  a request
- `deleteInvoice` and `voidInvoice`, both user-scoped
- Two more intents on the detail route, each refusing what its permission denies
- The buttons, and a confirmation before either acts
- A void invoice becoming read-only, enforced on the server
- Redirecting to `/invoices` after a delete, because the page loses its subject

## Out of scope

- **Un-voiding.** Void is terminal here: no status control renders on a void
  invoice (feature 10 already sends `settableStatus: null` for one), and nothing
  this feature adds walks it back. The row is untouched, so a later feature can
  revive one if a real need turns up; guessing at that rule now would be
  inventing a workflow nobody has asked for.
- **Deleting a sent or paid invoice.** The overview locks this: the number was
  given to a client and a gap in the sequence is what an accountant asks about.
- **Voiding a paid invoice.** Being paid and being cancelled are contradictory,
  and the honest instrument for it is a credit note, which is not in the plans.
  Feature 10 already provides the way round: set it back to sent, then void.
- **Row actions in the list.** Feature 9 shipped none and feature 11 made the
  row a link to the place where this is done. A delete button next to a row is
  also the easiest one to hit by accident.
- **Bulk delete, an archive, a trash, or undo.** A deleted draft is gone. Nothing
  in the plans asks for a recovery path, and a fake one is worse than none.
- **Restoring line items.** They go with the invoice, by cascade (see Data).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - what may be done to an invoice** - add `invoicePermissions` to
  `app/lib/invoice-status.ts` (client-safe), returning `canEdit`, `canVoid`, and
  `canDelete` for a stored status. No UI, no queries. *Done when:* `pnpm test`
  passes with a case per status asserting all three flags, so the whole matrix in
  Data below is pinned, including that a void invoice permits nothing and that
  `canEdit` is the only flag `paid` keeps; and `pnpm typecheck` passes.

- [x] **Step 2 - the writes, and the server refusing what is not allowed** - add
  `getInvoiceStatus`, `deleteInvoice`, and `voidInvoice` to
  `app/lib/invoice-store.server.ts`, all scoped by `userId` in the SQL. Add the
  `delete` and `void` intents to `app/routes/invoices.$id.tsx`, each reading the
  stored status and refusing when the permission says no. Make `saveDraftEdit`
  refuse a void invoice. No UI yet. *Done when:* posting `intent=delete` to a
  draft removes the invoice and its line items and answers a redirect to
  `/invoices`; posting it to a sent or paid invoice changes nothing and returns a
  refusal; posting `intent=void` to a sent invoice sets `void`; posting it to a
  draft or paid invoice changes nothing and returns a refusal; posting
  `intent=save` to a void invoice changes nothing and returns a refusal; and
  every one of those against another account's invoice id answers 404. Proven
  with `.data` posts and by reading rows back from local D1.

- [x] **Step 3 - the buttons and the confirmation** - add the `alert-dialog`
  primitive with the shadcn CLI, then the Delete and Void buttons in the header
  strip, each shown only when its permission allows and each confirming first.
  Hide Save on a void invoice and say why in the notice slot. *Done when:* a
  draft shows Delete and no Void; a sent invoice shows Void and no Delete; a paid
  invoice shows neither; deleting asks first, and cancelling leaves the invoice
  in place; confirming a delete lands on `/invoices` with the row gone from the
  table; confirming a void keeps you on the page with the badge reading Void, no
  status control, no Save button, and a line explaining the invoice is a kept
  record; and no page scrolls sideways at 320px.

## Files / areas

| File | Why |
| --- | --- |
| `app/lib/invoice-status.ts` | new `invoicePermissions` |
| `app/lib/invoice-status.test.ts` | the gate for step 1 |
| `app/lib/invoice-store.server.ts` | new `getInvoiceStatus`, `deleteInvoice`, `voidInvoice` |
| `app/lib/invoice-save.server.ts` | `saveDraftEdit` refuses a void invoice |
| `app/routes/invoices.$id.tsx` | two more intents, permissions in loader data, Save hidden |
| `app/components/invoice/InvoiceActions.tsx` | new: the two buttons and their confirmation |
| `app/components/ui/alert-dialog.tsx` | new: shadcn primitive, generated, 0 npm deps (`radix-ui` is already a dependency) |

## Data / contracts

**No schema change.** Deleting is a real `delete`; voiding writes `void` to the
`status` column that has held it since feature 7a.

**The permission matrix, which is the contract this feature adds:**

| Stored status | canEdit | canVoid | canDelete |
| --- | --- | --- | --- |
| `draft` | yes | no | **yes** |
| `sent` | yes | **yes** | no |
| `paid` | yes | no | no |
| `void` | **no** | no | no |

Load-bearing: every later feature that shows an action on an invoice should ask
this rather than test a status inline, or the rules drift apart.

**This is the first time a status gates anything, and it needs the argument
feature 10 asked for.** That spec recorded that status gates nothing and that
anything wanting to change it must justify itself. The justification is narrow:
voiding exists so a cancelled invoice is *kept*, and an editable record is not
kept. So `canEdit` is false for `void` and nothing else. The other three rows
gate only which of the two removal paths applies, which is the feature itself.

**`void` is still absent from `SETTABLE_STATUSES`.** Voiding goes through its own
action, not the status select, because it is not a note about what happened to a
document; it is the end of the document. That also keeps a mis-click out of a
dropdown a user pulls open for ordinary reasons.

**Deleting and voiding confirm; changing status does not.** Not a contradiction
with feature 10's "no confirmation" decision but the reason for it: a wrong
status costs one click to fix, while a delete destroys rows and a void cannot be
walked back. The confirmation is proportional to what cannot be undone.

**The guard is about the current recorded state, and a determined user can walk
around it.** Setting a sent invoice back to draft and then deleting it is
allowed, and that does put a gap in the number sequence. Feature 10 made status
freely settable on purpose, so this is the user's call, the same way marking
something paid is. Worth writing down so nobody later mistakes the rule for an
airtight one.

**Line items go with the invoice by cascade.** `line_item.invoiceId references
invoice (id) on delete cascade`, and D1 enforces it: verified against the local
database by inserting an invoice with two line items, deleting the invoice, and
counting zero line items left. `deleteInvoice` therefore deletes one row and does
not need a batch, unlike `updateInvoice`, which clears line items itself because
it is replacing them rather than removing their parent.

**Every query is scoped by `userId` in the SQL**, and a row that does not match
gives the same 404 as everywhere else. A permission is checked against the status
read from the database, never against anything the request said.

**After a delete the route redirects to `/invoices`**, because the page it was on
no longer has a subject. A delete that matched nothing redirects too: the user
asked for the invoice to be gone and it is gone, so a 404 would be pedantic about
a state they already wanted.

## Testing

The gate is **on** (`AGENTS.md` declares `pnpm test`).

**Needs a test (step 1).** `invoicePermissions` is pure, total over four inputs,
and is the single statement of the rules, so the whole matrix gets pinned. The
case that matters most is `void`, because it is the only row that denies editing
and the only status no other feature can produce yet.

**Rides on `.data` posts, D1 reads, and the browser (steps 2 and 3).** The writes
are D1 queries and the buttons are a render surface, matching how features 9, 10,
and 11 were each verified. Step 2 is deliberately provable before any UI exists:
every refusal can be posted directly, which is also the only way to check that
the server does not trust the client about permissions.

**Manual pass for step 3**, against the local D1:

1. A draft: Delete offered, Void not. Cancel the dialog, invoice still there.
2. Confirm the delete: lands on `/invoices`, row gone, and its line items gone.
3. A sent invoice: Void offered, Delete not. Void it: badge reads Void, the
   status control and Save button are gone, and the notice explains why.
4. A paid invoice: neither button.
5. The void invoice from step 3: still readable, still downloads a PDF, still
   listed on the dashboard.
6. 320px on the detail page in each state: no sideways scroll.

## Notes for the AI

- **Check permissions on the server against the stored status.** The buttons are
  a convenience; the route reads the status from D1 and refuses on its own. A
  hidden button is not a guard.
- **Do not add `void` to `SETTABLE_STATUSES`** and do not route voiding through
  `setInvoiceStatus`, whose signature deliberately takes `SettableStatus`. Void
  gets its own function so the type keeps saying what it means.
- **`invoicePermissions` lives in `invoice-status.ts`**, which is imported by
  client code and must stay free of server-only imports.
- **Reuse `getInvoiceStatus` for all three paths** rather than reaching for
  `getInvoice`, which also reads every line item to answer a question about one
  column.
- **The confirmation is a real dialog**, not a `window.confirm`: the app owns its
  chrome everywhere else, and `alert-dialog` brings focus handling and escape for
  free. It is generated by the CLI and lands unmodified; the code to read is the
  component that composes it.
- **A void invoice keeps everything except writing.** It renders, it downloads,
  it stays in the list. Only Save goes, and the server refuses a save even if
  something posts one anyway.
- **Delete is a fetcher submit, then a redirect from the action**, not a
  client-side navigation. There is no local state to preserve on a page that is
  about to stop existing, which is the opposite of the handoff at `/` in feature
  11.
