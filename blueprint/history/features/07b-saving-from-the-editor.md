# Feature: Saving from the editor

**From build-plan:** feature 7b
**Status:** complete

## Goal

The Save button, and everything behind it: a per-user invoice number that
suggests itself, an action that writes through 7a's store, and an editor that
knows whether what is on screen has been saved. With this, feature 7 is done and
a signed-in user can keep an invoice.

## Design reference

`blueprint/reference/editor-mockup.html`, which draws two things this
sub-feature finally makes true:

- **The `Save` button** in the app bar (line 217), between the session actions
  and `Download PDF`.
- **The save note** above the form (line 222): "Not signed in. Your invoice stays
  in this tab. Create an account to save it." Deferred twice, because until now
  it promised a button nobody could press. It is honest as of this sub-feature,
  so it lands here.

## The shape of it, decided up front

**The number is a suggestion, the uniqueness is a rule.** The overview says an
invoice number defaults to the next in a per-user `INV-0001` sequence and stays
editable. Both halves matter: a signed-in user opening a fresh editor sees their
next number already filled in, and can type over it. If what they type collides
with one of their own invoices, the save is refused with a readable message
rather than silently renumbering, because the number is theirs to choose and a
number that changed itself is worse than one that was rejected.

**A failed update falls back to creating.** The editor remembers the id of what
it saved so pressing Save twice updates rather than duplicates. That id outlives
a sign out in the same tab, so it can arrive belonging to nobody. `updateInvoice`
already answers null for an invoice that is not yours, and this treats that as
"then make a new one" rather than an error. The store's scoping is what makes
that safe: there is no path where falling back overwrites someone else's row.

**Saving is a `useFetcher`, not a navigation.** The editor is client state and
the invoice is on screen; saving must not reload the page or lose focus. The
draft is posted as JSON in a form field, validated server side by the same
`parseDraft` the PDF endpoint uses, and written by 7a's store.

**Anonymous stays anonymous.** Pressing Save with no session sends the user to
sign in, and their draft is still in `sessionStorage` when they come back, so
they can press Save again. That is a manual path, not feature 8: 8 is the
automatic handoff at sign up.

## In scope

- `nextInvoiceNumber(existing)`, the per-user sequence, and the query that feeds
  it
- An editor loader that prefills a signed-in user's next number on a fresh draft
- An editor action: validate, then create or update through 7a's store
- The `Save` button, its saved and saving states, and a readable refusal when a
  number collides
- The save note for anonymous users, from the mockup
- Remembering the saved id in the tab so a second Save updates

## Out of scope

- **The invoice list** (9), **status changes** (10), **the detail view** (11),
  **delete and void** (12). Nothing here opens a saved invoice by URL; that is
  11's job, and until it exists a saved invoice is retrievable through the store
  but not through the app.
- **The automatic draft handoff at sign up** (8).
- **Tax, discount, custom fields** (18, 19), and **logo upload** (13).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The next number** - `nextInvoiceNumber(existing: string[])` in
  `app/lib/invoice-number.ts`, pure, plus `listInvoiceNumbers(db, userId)` in the
  store.

  *Done when:* `pnpm test` covers no invoices giving `INV-0001`, `INV-0007`
  giving `INV-0008`, `INV-0009` giving `INV-0010`, four digits rolling to five at
  `INV-9999`, padding preserved from the widest existing number, numbers that do
  not match the pattern being ignored rather than crashing, a user whose only
  invoice is `2026-04` still getting `INV-0001`, and the highest number winning
  regardless of array order.

- [x] **Step 2 - The save action** - an `action` on the editor route:
  `requireUser`, `parseDraft` on the posted JSON, then create or update through
  the store, answering `{ ok, id, invoiceNumber, error }`. A duplicate number
  comes back as a sentence, not a constraint error. An update that returns null
  falls back to a create.

  *Done when:* posting a valid draft while signed in creates a row and returns
  its id; posting again with that id updates the same row rather than making a
  second; posting with a number another of your invoices already uses is refused
  with a message naming the number; posting while signed out redirects to sign in
  rather than saving; posting a malformed draft is refused without touching the
  database; and the row's totals are the server's, not the client's.

- [x] **Step 3 - The button and the note** - `Save` in the app bar for a
  signed-in user, with saving and saved states and the refusal shown near the
  form; the mockup's save note for everyone else; and the loader prefilling the
  next number on a fresh draft.

  *Done when:* signed in, a fresh editor shows the next number in the sequence;
  pressing Save shows a saving state then a saved one; pressing it again updates
  and the invoice count does not grow; a collision shows the message; signed out,
  the note appears and `Save` is not shown; the anonymous editor and the PDF
  download still work with no session; 320px still has no sideways scroll; and
  the console is clean.

## Files / areas

- `app/lib/invoice-number.ts`, `app/lib/invoice-number.test.ts` - new
- `app/lib/invoice-store.server.ts` - `listInvoiceNumbers`, and the duplicate
  detection the action needs
- `app/routes/editor.tsx` - loader, action, Save wiring
- `app/components/invoice/SaveButton.tsx`, `SaveNote.tsx` - new
- `app/lib/invoice-draft.ts` - the saved id in the tab, beside the draft

## Data / contracts

```ts
// app/lib/invoice-number.ts
export function nextInvoiceNumber(existing: string[]): string;

// editor action
type SaveResult =
	| { ok: true; id: string; invoiceNumber: string; savedAt: string }
	| { ok: false; error: string };
```

Rules this sub-feature must hold to:

- **The session decides the user, always.** The action calls `requireUser` and
  hands that id to the store; no id comes from the form.
- **The posted draft is validated before it is stored**, by the same `parseDraft`
  the anonymous PDF endpoint uses.
- **Money is still the server's.** 7a recomputes it; nothing here bypasses that.
- **The anonymous tier is untouched.** No session means no write, and the editor,
  preview, templates, and PDF all keep working.

## Testing

The gate is on. In-scope logic: **`nextInvoiceNumber`** (step 1), pure with real
edge cases. The action and the components ride on browser and database evidence,
as their done-whens describe.

## Notes for the AI

- **Local only.** Migration 0004 is already applied locally and still owed
  remotely at the next deploy.
- `useFetcher`, not `<Form>`: saving must not navigate.
- The collision check is a real query against that user's numbers, but the unique
  index is still the thing that guarantees it. Catch the constraint error too
  rather than trusting the check to win a race.
- Do not touch `InvoiceDraft`. The saved id lives beside the draft in
  `sessionStorage`, not inside it, because feature 8 reads that shape.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.
