# Feature: Invoice status tracking

**From build-plan:** feature 10
**Status:** complete

## Goal

Let a signed-in user mark a saved invoice **draft**, **sent**, or **paid** from
its own page, so the status the dashboard has been displaying since feature 9
becomes something the user controls rather than a value stuck at `draft` forever.

The build-plan line has two halves and **the second is already built**. "Show
overdue derived from the due date" shipped with feature 9: `displayStatus` is
written and unit tested, `StatusBadge` renders all five faces, and both the list
and the detail page already use them. What is missing is the verb. Every invoice
in the database says `draft` because nothing can write anything else, and the one
`sent` row in local D1 got there by hand-editing SQL.

That makes this a small feature, and the spec is short because most of its
surface was built ahead of it, not because anything is being skipped.

## Design reference

**No new visual target.** The detail page's header strip already carries the
invoice number and the status badge; this adds one control beside them. Match
that strip and the `select` primitive as the currency field already uses it.

## In scope

- `SETTABLE_STATUSES` and a validator, the contract for what a user may set
- `setInvoiceStatus`, a user-scoped write
- The detail route's action learning a second intent
- A status control in the detail page's header strip
- The stored status reaching the component, which the loader does not send today

## Out of scope

- **Void.** Feature 12 owns it, together with delete, because the two are one
  decision: "voiding is a status, deleting is a delete". `void` stays in
  `InvoiceStatus` and `StatusBadge` still renders it; this feature simply refuses
  to set it.
- **The dashboard stat tiles.** Feature 9's spec suggested "Outstanding /
  Overdue / Paid" belonged here and to leave room above the table. Reading the
  plans again, neither `build-plan.md` nor the overview mentions tiles anywhere,
  so building them would be adding scope to a user-owned plan on the strength of
  a note in an archived spec. They are a good idea and should go through
  `/feature` as their own item if wanted. The room above the table is still there.
- **Changing status from the list.** Feature 9 deliberately shipped no row
  actions, and the same reasoning holds: the row is a link to the place where
  this is done. Revisit if the list ever grows a selection model.
- **A workflow.** No transition is forbidden between the three (see Data).
- **Any confirmation, warning, or undo affordance.** Changing the status is one
  interaction and takes effect immediately. The user's call, in their words:
  "the status shouldn't hold much weight, if someone decides to say paid and then
  change it that's on them." Nothing is destroyed by a wrong status and the fix
  is to pick the right one, so an "are you sure" would be friction protecting
  against nothing.
- **Recording when the status changed.** There is no `sentAt` or `paidAt` column,
  and adding one is a schema change no listed feature asks for. `updatedAt` moves,
  which is all that is claimed.
- **Payment tracking.** Amounts, partial payments, and reminders are not in the
  plans at all.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - what may be set, and the write that sets it** - add
  `SETTABLE_STATUSES` and `parseSettableStatus` to `app/lib/invoice-status.ts`
  (client-safe, no server imports), and `setInvoiceStatus` to
  `app/lib/invoice-store.server.ts`, scoped by `userId` in the SQL and returning
  whether a row changed. No UI. *Done when:* `pnpm test` passes with new cases in
  `app/lib/invoice-status.test.ts` covering each of the three accepted values,
  `"void"` refused, and an unknown string, empty string, `null`, `undefined`, and
  a non-string all refused; and `pnpm typecheck` passes.

- [x] **Step 2 - the control on the invoice** - send the stored `status` from the
  detail loader, branch its action on an `intent` field, and add the status
  control to the header strip beside the badge. *Done when:* on `/invoices/:id`,
  changing the control to Sent stores `sent` (confirmed by reading the row) and
  the badge follows without a manual reload; a sent invoice past its due date
  shows the Overdue badge while the control still reads Sent; marking it Paid
  clears the Overdue badge; the control refuses to leave the page dirty, meaning
  unsaved edits in the form survive a status change; a status change on an
  invoice deleted in another window answers 404 rather than silently doing
  nothing; and posting `void` or a junk value with `curl` changes nothing and
  returns a refusal.

## Files / areas

| File | Why |
| --- | --- |
| `app/lib/invoice-status.ts` | new `SETTABLE_STATUSES` and `parseSettableStatus` |
| `app/lib/invoice-status.test.ts` | the gate for step 1 |
| `app/lib/invoice-store.server.ts` | new `setInvoiceStatus` |
| `app/routes/invoices.$id.tsx` | loader sends `status`; action gains an intent; header gains the control |
| `app/components/invoice/StatusControl.tsx` | new: the select, submitting through a fetcher |

## Data / contracts

**No schema change.** The `status` column exists and already holds
`draft | sent | paid | void`. This feature only writes to it.

**What a user may set, which is not the whole type:**

```ts
export const SETTABLE_STATUSES = ["draft", "sent", "paid"] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];
export function parseSettableStatus(value: unknown): SettableStatus | null;
```

`void` is deliberately absent, and it is the reason this is a separate list
rather than a reuse of `InvoiceStatus`. Feature 12 will add its own path to void
an invoice, with its own rules about what may be voided; a select that could set
it would quietly pre-empt that decision.

**Any of the three may follow any other.** The overview is explicit that the app
never sends the invoice and that `sent` is the user recording what they did, so
this is a label on a document, not a workflow with gates. A user who marks
something paid by mistake must be able to put it back, and a cash-in-hand invoice
goes straight from draft to paid. Refusing a transition would invent a rule the
product does not have.

The status is a note to yourself, and the build should keep treating it as one.
It gates nothing: it does not decide whether an invoice can be edited, whether
its PDF renders, or what any other feature is allowed to do with it. The only
thing it changes is what the badge says and, through `displayStatus`, whether a
past-due invoice reads as overdue. Anything later that wants to make a real
decision on the strength of a status needs to justify that on its own.

**`overdue` is still derived and still unsettable.** It has no column and is not
in `SETTABLE_STATUSES`. Marking an invoice paid makes the Overdue badge
disappear on its own, because `displayStatus` only dresses `sent` that way.

**The control and the badge can disagree, and that is correct.** A sent invoice
past its due date shows a badge reading Overdue while the control reads Sent. The
badge is what the invoice *is today*; the control is what was *recorded*. Showing
Overdue as a fourth option would imply the user could choose it.

**Validation happens on the server**, on the value from the form body, before it
reaches SQL. The client select is a convenience, not the guard.

**`setInvoiceStatus` is scoped like every other user-owned write:** `userId` goes
in the `where` clause, and no rows changed means 404, the same answer
`saveDraftEdit` and the loader give.

**`updatedAt` moves on a status change**, because the record changed. The list
orders by `issueDate desc, createdAt desc`, so nothing reorders under the user.

## Testing

The gate is **on** (`AGENTS.md` declares `pnpm test`).

**Needs a test (step 1).** `parseSettableStatus` is exactly the in-scope shape:
a pure validator, assertable, and the boundary that keeps `void` and junk out of
the database. Cases are enumerated in step 1's done-when. The `"void"` case is the
one that matters most, because `void` is a real `InvoiceStatus` and a naive
implementation that checks membership in the wrong list would accept it.

**Rides on browser and database evidence (step 2).** `setInvoiceStatus` is a D1
query and the control is a render surface, both integration-level, which matches
how `listInvoices`, `getInvoice`, and `saveDraftEdit` were all verified.

**Manual pass for step 2**, against the local D1:

1. Open a draft invoice, set the control to Sent, and read the row back.
2. Give it a past due date and reload: badge reads Overdue, control reads Sent.
3. Set it to Paid: the Overdue badge goes, the row says `paid`.
4. Type into a field without saving, then change the status: the typing survives.
5. Delete the row in another window, then change the status: 404.
6. `curl` the action with `status=void` and with junk: nothing changes.

## Notes for the AI

- **Do not touch `displayStatus`, `STATUS_LABELS`, or `StatusBadge`.** They were
  built for this and already handle all five faces. If one needs changing, stop
  and say why rather than editing a tested contract in passing.
- **`invoice-status.ts` is imported by client code**, so it must stay free of
  server-only imports, the way it already is.
- **Two intents, one action.** The route's existing action saves a draft; add an
  `intent` field and branch on it rather than sniffing which fields are present.
  An unknown intent is a refusal, not a fallthrough to the save path.
- **Use a fetcher, not a `Form`.** A navigation would throw away the form state
  the user may be part way through, which is the same reason `SaveButton` uses
  one. The status control must never carry the draft with it.
- **The loader must send the stored `status`**, which it does not today; it sends
  only the derived `display`. The control needs the stored value, and the badge
  keeps using the derived one.
- **`updateInvoice` already preserves status on a draft save** and must keep
  doing so. Saving an edit is not a status change, and the two paths stay
  separate.
- The select primitive is already installed and used by the currency field; reach
  for it rather than adding a dropdown-menu dependency.
