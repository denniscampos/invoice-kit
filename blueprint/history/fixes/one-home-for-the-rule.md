# Fix: one home for the rule about what may be done to an invoice

**Type:** Fix
**Fixes:** F-58, F-60

Both findings are the same shape, and it is the shape that produced F-54: a rule
about an invoice's state enforced somewhere other than `invoicePermissions`,
where it agrees today and is free to drift tomorrow. Two small diffs in two files.

F-60 is included because it is three lines and the same class; drop step 2 if you
would rather it went separately.

## The problem

### F-58 [P3] - two things decide whether the status control renders

`app/routes/invoices.$id.tsx:272`. The loader sends both `settableStatus` (the
stored status narrowed to the three a user may choose, or null) and
`permissions.canSetStatus`. The component gates the control on the first; the
action gates the write on the second.

They agree today because both reduce to "is this invoice void", and they are
computed independently:

```ts
settableStatus: parseSettableStatus(invoice.status),
permissions: invoicePermissions(invoice.status),
```

Nothing misbehaves now. The next change to the rule is what misbehaves: freeze
status changes on paid invoices and `canSetStatus` goes false while
`parseSettableStatus("paid")` still returns `"paid"`, so the control renders and
the action refuses it. A dropdown that does nothing.

### F-60 [P3] - `updateInvoice` trusts its caller to refuse a void invoice

`app/lib/invoice-store.server.ts:492`. After the last fix, three of the four
writes that touch an invoice's state carry their rule in their own `where`.
`updateInvoice` is the exception: its guard lives entirely in `saveDraftEdit`,
which checks `canEdit` before calling it.

Safe today, because that is the only caller and it does check. A second caller
that forgets makes a void invoice rewritable, and the body is the part voiding
exists to freeze.

It cannot take a `where` condition, which is worth recording so nobody tries: it
deletes the row and re-inserts it in one batch, so a delete that matched nothing
would be followed by an insert of an id that still exists, turning a silent
refusal into a primary key violation.

## The fix

**F-58: derive the value from the permission, in one function.**

Add `settableStatusOf` to `app/lib/invoice-status.ts`: the value a status control
should show, or null when there should be no control. It asks
`invoicePermissions` first and narrows second, so the permission is upstream of
the value rather than beside it.

```ts
export function settableStatusOf(status: InvoiceStatus): SettableStatus | null {
	if (!invoicePermissions(status).canSetStatus) return null;
	return parseSettableStatus(status);
}
```

The two checks are not the duplication being removed; they are a rule followed by
a type narrowing, and the order matters. If the two ever disagree the permission
wins and the answer is null, which is the safe direction.

The loader calls it instead of `parseSettableStatus`, and the component does not
change: `{invoice.settableStatus ? ... : null}` stays exactly as it reads, except
that field's nullability is now the permission by construction rather than by
coincidence. The name was always right; the derivation was the problem.

**F-60: `updateInvoice` asks the same question, using the status it already has.**

It already runs `select createdAt, status` before writing, so the value is in hand
three lines above. Refuse there by returning `null`.

`null` collapses with "no such invoice", which `saveDraftEdit` turns into a 404,
and that is the right trade rather than a new result type: the sentence a user
sees still comes from `saveDraftEdit`, which checks first and says why. This path
is only reached by a caller that did not ask, and a 404 is a safe answer for one
of those. It is a guard unreachable through today's only caller, which is what a
backstop is, not dead code.

Must not break: a void invoice still refuses a save with its sentence rather than
a 404, editing a draft, sent, or paid invoice still saves, and the status control
still renders with the right value and its optimistic update on every non-void
invoice.

## Build steps

- [x] **Step 1 - F-58: the control's value comes from the permission** - add
  `settableStatusOf` to `app/lib/invoice-status.ts` and have the detail loader
  call it. *Done when:* `pnpm test` passes with a case per status asserting the
  value and one asserting it is null exactly when `canSetStatus` is false; and in
  the browser a draft, sent, and paid invoice each still show the control with the
  right value while a void invoice still shows none.

- [x] **Step 2 - F-60: the write refuses what its caller should have** - have
  `updateInvoice` return `null` when the invoice it read is not editable. *Done
  when:* posting `intent=save` at a void invoice still answers "This invoice is
  void. It is kept as a record and cannot be changed" rather than a 404, proving
  `saveDraftEdit` still refuses first; saving an edit to a draft still works and
  the row shows the change; and the new guard is shown to actually fire when
  `updateInvoice` is reached with a void invoice, rather than left as an assertion
  about code nobody ran.

## Verify

Against the local D1, with a void invoice and a draft:

1. Open a draft, a sent, and a paid invoice: each shows the status dropdown with
   its own value, and changing it still works.
2. Open a void invoice: no dropdown, no Save, the notice still explains why.
3. Post `intent=save` at the void invoice: the sentence, not a 404.
4. Edit a draft and save: the change is stored.

Then `pnpm typecheck`, `pnpm build`, and `pnpm test`, the fallback gate while no
Verify command is declared in `AGENTS.md`.
