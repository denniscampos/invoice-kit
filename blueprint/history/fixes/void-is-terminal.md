# Fix: a void invoice could be un-voided through the status intent

**Type:** Fix
**Fixes:** F-54, F-55, F-56

Three findings from the audit that followed feature 12, all in the same action, so
they are repaired together. F-54 is the P1 and the reason this exists; the other
two are a stale comment and a check-then-write race in the code the same diff
touches.

## The problem

### F-54 [P1] - void is not terminal after all

`app/routes/invoices.$id.tsx:96`. Feature 12 shipped on the premise that voiding
an invoice is the end of it: un-voiding is out of scope, and `canEdit` is false
for `void` so the record cannot be rewritten.

The `status` intent predates that permission matrix and never asks it. Where
`delete` and `void` each read the stored status and check `invoicePermissions`,
`status` goes from `parseSettableStatus` straight to `setInvoiceStatus`, whose SQL
filters on `id` and `userId` and nothing else. So the invoice's own owner, posting

    intent=status&status=paid

to a void invoice, moves it out of void. Reproduced against local D1: the row
went from `void` to `paid` and answered `{"ok":true,"status":"paid"}`.

The follow-on is worse than the first-order bug. `canEdit` is derived from the
stored status, so an un-voided invoice is editable again: the read-only guarantee
is two posts away from gone, rather than a property of the data.

The status select is correctly hidden on a void invoice, and that was the only
thing standing in the way, which is the exact failure feature 12's own notes
warned about: a button that is not on screen is not a guard.

### F-55 [P3] - a comment that miscounts its own branches

`app/routes/invoices.$id.tsx:91` reads "Two things post here now". There are four:
`status`, `delete`, `void`, and `save`.

### F-56 [P3] - the permission check and the write are two statements

`app/routes/invoices.$id.tsx:118`. Both removal paths read the status, decide, and
then write, with nothing holding the row in between. A draft that becomes sent
between the two is still deleted. It needs two tabs racing inside milliseconds, so
this is theory, but the fix is shorter than the explanation.

## The fix

**One rule, asked by all three intents, and enforced in the SQL as well.**

`invoicePermissions` gains `canSetStatus`, false for `void` and true otherwise.
It has the same body as `canEdit` today, and rather than leave a reader wondering
why there are two identical lines, both are derived from one named fact: a void
invoice is frozen. They stay separate flags because they answer separate questions
(may the body be rewritten, may the recorded status move) and a later feature
could freeze one without the other; they agree today because `void` is the only
terminal state.

Then each of the three writes carries its own condition:

| Function | Condition in the SQL |
| --- | --- |
| `setInvoiceStatus` | `and status != 'void'` |
| `voidInvoice` | `and status = 'sent'` |
| `deleteInvoice` | `and status = 'draft'` |

That is F-56: the check and the act become one statement, so no race can slip
between them. The route still reads the status first, because a bare "no rows
changed" cannot tell a user whether the invoice was missing or in the wrong state,
and the sentences are the point. When a write returns false *after* a passing
read, that is the race actually happening, and the answer is to say the invoice
changed rather than to report success.

**`writeStatus` gets retired.** It was added yesterday so `setInvoiceStatus` and
`voidInvoice` could share one `update`. Their where clauses now differ
meaningfully, and a helper parameterised by a SQL fragment would be harder to read
than the two statements it saved. Undoing a day-old decision because the reason
for it expired.

Must not break: the three intents keep their current messages for the cases they
already refused, `saveDraftEdit` keeps refusing a void invoice, and the status
control on a non-void invoice keeps working exactly as it does now, including its
optimistic value.

## Build steps

- [x] **Step 1 - one rule, and the writes that enforce it** - add `canSetStatus`
  to `invoicePermissions`, both it and `canEdit` derived from one `frozen` fact.
  Give each of the three writes its condition, and retire `writeStatus`. No route
  changes. *Done when:* `pnpm test` passes with the four matrix cases extended to
  assert `canSetStatus`; and posting `intent=status&status=paid` to a void invoice
  leaves the row `void`, which closes F-54 in this step, before any message is
  improved.

- [x] **Step 2 - the intents ask, and say what happened** - have the `status`
  intent read the stored status and refuse when `canSetStatus` is false, with a
  sentence rather than a 404. Have all three treat a write that returns false
  after a passing check as the invoice having changed underneath them. Rewrite the
  `intent` comment to say what the field is for instead of how many callers it
  has. *Done when:* posting `intent=status` to a void invoice returns a refusal
  naming the reason and the row stays `void`; the same post to a draft, sent, or
  paid invoice still works; voiding a sent invoice and deleting a draft both still
  work end to end from the buttons; posting any of the three at another account's
  invoice still answers 404; and the status control still shows its optimistic
  value while saving.

## Verify

Against the local D1, with the `f12-*` fixtures (`f12-void` void, `f12-paid`
paid, and a fresh sent and draft invoice):

1. `intent=status&status=paid` at `f12-void`: refused, row still `void`.
2. The same at `f12-paid`: succeeds, row `paid`.
3. Void a sent invoice from the button, then try `intent=status` at it: refused.
4. Delete a draft from the button: gone, with its line items.
5. All three intents at another account's invoice: 404, nothing written.
6. In the browser, the status dropdown on a draft still works and still shows the
   new value immediately.

Then `pnpm typecheck`, `pnpm build`, and `pnpm test`, the fallback gate while no
Verify command is declared in `AGENTS.md`.

## Findings

Resolved findings carried into this archive. F-54, F-55, and F-56 are the
three this fix repaired. F-50 was repaired by the fix before it and reached
`closed` at the audit that followed feature 12, which is why it archives here;
its **Found** line records where it came from.

### void-is-terminal/F-50 [P3] closed - The download button's spoken name disagrees with its visible text while rendering

**File:** app/components/invoice/DownloadPdfButton.tsx:97
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** Introduced by the F-45 repair. The button now carries a fixed
`aria-label="Download PDF"` so the short "PDF" label below `sm` still reads
properly. That works while the button is idle, where the accessible name contains
the visible text and WCAG's Label in Name is satisfied.

It stops being true during a render. The visible text becomes "Preparing PDF..."
or "PDF..." while the accessible name stays "Download PDF", so a speech-input
user saying what they see no longer matches the control, and a screen reader user
is told the button is "Download PDF, busy" rather than that it is preparing
something. The comment above the button claims the WCAG property without the
qualifier, which is the part that would mislead the next reader.

Small: `aria-busy` still conveys the state, and the pending window is a few
seconds. Filed because the repair introduced it and because the comment
overclaims.
**Suggested fix:** move the label into the element rather than duplicating it, for
example drop `aria-label` and give the short variant an `sr-only` companion
("Download"), so the accessible name is built from what is on screen in both
states. Alternatively swap `aria-label` for the pending wording while pending.

**Resolution:** Fixed 2026-08-17 by /implement, the first way. `aria-label` is
gone and the short variant carries an `sr-only` "Download " companion, so the
name is computed from the content and cannot drift from it. The comment above the
button now describes all four states rather than asserting a property that held
in two of them.

Proven by reading the accessibility tree, not the markup, which is the only thing
that answers what a screen reader says:

| Width | State | Visible | Accessible name |
| --- | --- | --- | --- |
| 320 | idle | `PDF` | `button "Download PDF"` |
| 320 | rendering | `PDF...` | `button "Download PDF..." [disabled]` |
| 1440 | idle | `Download PDF` | `button "Download PDF"` |
| 1440 | rendering | `Preparing PDF...` | `button "Preparing PDF..." [disabled]` |

Every name now contains its own visible text. Also confirmed: the button has no
`aria-label` attribute, the `sr-only` span computes to `position: absolute` and
so takes no width, 320px still measures 305/305 with no sideways scroll, and a
screenshot shows only "PDF" painted in the bar.

Note on how the pending state was captured, because it took three attempts and
the technique is reusable: clicking through Playwright waits for the download to
finish, so the pending window is already over, and dispatching the click from JS
still lost the race. Overriding `window.fetch` with a promise that never settles
holds the button in its pending state indefinitely, and starts no render, so both
widths were inspected at zero Browser Rendering cost against the two slots this
was expected to spend.

**Closed 2026-08-17 by /audit (scope: full).** Re-read
`DownloadPdfButton.tsx:89-112`: no `aria-label` attribute survives, the short
variant carries its `sr-only` companion, and the accessibility tree on a live
page reads `button "Download PDF"` with the name assembled from the content. The
file has not changed since the repair, and features 10 and 12 did not touch it
even though both added to the bar around it.

### void-is-terminal/F-54 [P1] closed - A void invoice can be un-voided, and edited again, through the status intent

**File:** app/routes/invoices.$id.tsx:96
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** Feature 12 shipped today on the premise that void is
terminal: its spec puts un-voiding out of scope, its archive says "nothing this
feature adds walks it back", and `canEdit` is false for `void` so a voided
invoice cannot be rewritten. The status intent, written by feature 10 before that
permission matrix existed, never consults it.

The `delete` and `void` branches each read the stored status and check
`invoicePermissions` before writing. The `status` branch goes straight from
`parseSettableStatus` to `setInvoiceStatus`, whose SQL filters on `id` and
`userId` and nothing else. So a signed-in owner posting

    intent=status&status=paid

to a void invoice moves it out of void. Reproduced against the local database:
`f12-void` was `void`, the post answered `{"ok":true,"status":"paid"}`, and the
row read `paid` afterwards. It was restored to `void` by hand.

Two consequences, and the second is the worse one. Void stops being terminal, so
the record voiding exists to preserve can be revived. And because `canEdit` is
derived from the stored status, an un-voided invoice is editable again, so the
read-only guarantee is bypassable in two posts rather than being a property of
the data.

This is exactly the mistake feature 12's own notes warn about, in the one intent
that predates the rule: "a button that is not on screen is not a guard". The
status select is correctly hidden for a void invoice, and that is all that was
protecting this.

P1 rather than P0: the owner can only do it to their own invoice, nothing is
destroyed, and reaching it takes a crafted request rather than a click. It is a
documented contract broken by a reachable path, which is what P1 is for.
**Suggested fix:** give the status intent the same shape as the other two. Read
the stored status with `getInvoiceStatus`, refuse when it is `void`, then write.
The cleanest expression is to add the question to the matrix itself, for example
a `canSetStatus` flag that is false for `void`, so all three intents ask
`invoicePermissions` and no intent is left deciding for itself. Note that
`setInvoiceStatus` cannot express the rule alone; adding `and status != 'void'`
to its SQL would silently answer "not found" instead of saying why.

**Resolution:** Fixed 2026-08-17 by /implement, in two steps so the hole shut
before the wording improved.

`invoicePermissions` gained `canSetStatus`, and both it and `canEdit` are now
derived from one named fact rather than two identical comparisons: a void invoice
is frozen. They stay separate flags because they answer separate questions, and a
later feature could freeze one without the other.

Both halves of the suggested fix were taken, not one. The status intent now reads
the stored status and refuses with a sentence, and `setInvoiceStatus` also carries
`and status != 'void'` in its SQL. The note above was right that the SQL alone
would answer "not found" instead of saying why, but wrong to treat that as a
reason to leave it out: the route's read supplies the sentence, and the clause is
what makes the rule true even if a caller forgets to ask (and it closes F-56's
race in the same stroke).

Proven by replaying the exact post that reproduced this. Before: `f12-void` went
from `void` to `paid` answering `{"ok":true,"status":"paid"}`. After step 1: 404,
row still `void`. After step 2: "This invoice is void. Its status is part of the
record and cannot be changed", row still `void`. Fired again from inside a page
that had just been voided through the button, with the same refusal.

The paths that had to keep working were checked in the same pass: `status` still
moves a draft, sent, or paid invoice; the dropdown still works in the browser and
swapped Delete for Void as the permissions recomputed; voiding and deleting still
work end to end from the buttons; and all three intents still answer 404 at
another account's invoice, whose row is untouched.

**Closed 2026-08-17 by /audit (scope: current).** Re-read the repaired branch at
`invoices.$id.tsx:112-146` and `setInvoiceStatus` at `invoice-store.server.ts:546`,
then went wider than the original reproduction rather than repeating it: every
settable value (`draft`, `sent`, `paid`) posted at both void invoices in the local
database, six attempts, all six answered with the refusal and both rows still
`void` afterwards.

Also enumerated every statement in the codebase that can write the `status`
column, which is the question behind the finding rather than the one post that
exposed it. There are four, and each is accounted for: `setInvoiceStatus`
(`and status != 'void'`), `voidInvoice` (`and status = 'sent'`), the insert in
`createInvoice` (hard-coded `draft`), and the re-insert inside `updateInvoice`,
which copies the status it read and so cannot move one. Nothing else touches it.

The repair introduced no new defect in this file. Two adjacent P3s were opened
instead of holding this one open: F-58, because the status control is still gated
by something other than the flag added here, and F-59, because the action reached
129 lines.

### void-is-terminal/F-55 [P3] closed - The action's comment says two intents when there are four

**File:** app/routes/invoices.$id.tsx:91
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** "Two things post here now, so each says which it is" was true
when feature 10 added the intent field. Features 12 brought the count to four:
`status`, `delete`, `void`, and `save`. A comment that miscounts the branches
directly below it is the kind that makes a reader distrust the rest, and the
standards are explicit that a stale comment is worse than none.

Small, and worth fixing in the same diff as F-54, which is going to rewrite that
branch anyway.
**Suggested fix:** say what the field is for rather than how many callers it has,
so the sentence stops going stale every time an intent is added.

**Resolution:** Fixed 2026-08-17 by /implement, as suggested. The comment now
describes what the field is for and says an unrecognised intent is refused rather
than counting the branches, so a fifth intent will not make it wrong again.

**Closed 2026-08-17 by /audit (scope: current).** Re-read `invoices.$id.tsx:91`.
The sentence no longer carries a count, and the claim it does make (an
unrecognised intent is refused) is true of the code below it, checked by posting
`intent=demolish` and getting "That request was not understood."

### void-is-terminal/F-56 [P3] closed - Delete and void check the status in one statement and write in the next

**File:** app/routes/invoices.$id.tsx:118
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** Both removal paths call `getInvoiceStatus`, decide from the
answer, and then call `deleteInvoice` or `voidInvoice`. Nothing holds the row
between the two, so a status that changes in between is acted on with a stale
permission: an invoice that is a draft when checked and sent a moment later is
still deleted, which is the outcome the rule exists to prevent.

Reaching it needs two sessions, or two tabs, racing inside the few milliseconds
between two D1 statements, so this is theory rather than something a user will
hit. Filed because the fix is smaller than the explanation and because the same
shape is already documented as a known race for invoice numbers, where the unique
index is what actually guarantees the rule.

**Suggested fix:** put the condition in the write. `delete from invoice where id
= ?1 and userId = ?2 and status = 'draft'` makes the check and the act one
statement, and `voidInvoice` can take `and status = 'sent'` the same way. Keep the
read for the message, because a bare "no rows changed" cannot tell a user whether
the invoice was missing or the wrong status, and the sentences are the point.

**Resolution:** Fixed 2026-08-17 by /implement, exactly that, and extended to all
three writes rather than the two named: `setInvoiceStatus` carries
`and status != 'void'` for the same reason (see F-54).

The read stays for the message, and a write that matches nothing *after* a passing
read is now reported as what it is: "This invoice changed while you were looking
at it. Reload and try again." The delete path returns that rather than redirecting,
because answering "gone" when nothing was deleted would be a lie.

`writeStatus`, the private helper added the day before so the two status writes
could share one `update`, is gone. Its whole purpose was one copy of the SQL and
the clauses now differ on purpose.

Proven by aiming the guarded delete at a sent invoice directly in SQL: nothing was
removed and the row survives, where the unguarded version would have taken it. The
real race needs two statements to interleave inside milliseconds, which is not
reproducible on demand, so the evidence is that the condition is in the statement
rather than a staged collision.

**Closed 2026-08-17 by /audit (scope: current).** Read all three statements: the
conditions are present and correct at `invoice-store.server.ts:556`, `580`, and
`624`. Confirmed the one remaining write that does not carry its rule in SQL,
`updateInvoice`, cannot be given one without breaking its delete-and-reinsert
shape; that is filed as F-60 rather than left inside this entry, because it is a
different function and a different rule.

The honest limit on this closure, restated because it matters more than the code
read: a real interleaving was never staged. What is verified is that each rule now
lives inside the statement that acts on it, plus one direct check that a delete
carrying `and status = 'draft'` refuses a sent invoice.
