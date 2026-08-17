# Fix: printing drops the backgrounds the PDF keeps

**Type:** Fix
**Fixes:** F-61

## The problem

`app/app.css:170`. Browsers do not print background colours unless the user ticks
"Background graphics", and Chrome leaves it unchecked. The PDF endpoint never had
that problem because it forces the setting, `page.pdf({ printBackground: true })`,
and the comment beside it says why:

> printBackground because the paper and Classic's filled table head are
> backgrounds, and a print defaults to dropping them.

Feature 23 added a print path that never answered the same question, so the two
outputs disagree on the browser's default setting.

Confirmed by rendering the same Classic invoice both ways and comparing the
images: with backgrounds on, the table header sits on its grey band; with them
off, the band is gone and the header floats on white. The PDF operator counts
differ by exactly one filled rectangle, 17 against 16.

The parity is the whole point of the feature. The overview promises the preview,
the PDF, and now the print are the same document, and for one of three templates
they are visibly not.

Two smaller things share the cause. Every template's `bg-paper` fill is dropped
too, invisible today only because `--color-paper` is `#ffffff` and the sheet under
it is white; change that token to an off-white and the PDF and the print stop
matching. And the app page has no `.page` box, so nothing paints the paper colour
below a short invoice the way the PDF does.

## The fix

**`print-color-adjust: exact` on the invoice document, under `@media print`.**
That is the property that tells a browser to keep backgrounds regardless of the
checkbox. It is inherited, so setting it on the document covers the Classic table
head and anything else a template fills.

Scoped to the document rather than to the page, deliberately: the claim being made
is that the invoice must print faithfully, not that every surface in the app
should. Printing the dashboard is still the browser's business.

The selector is `article`, which is what all three templates use for their root
and the only one this app renders, in the preview and inside the PDF document
alike. The alternative is a class on each template, which is three edits that must
agree, and F-23 is the standing record of how that goes.

Include the `-webkit-` prefix beside the standard property, since older WebKit
still wants it.

This rule ships inside the PDF as well, because `PRINT_STYLES` inlines the whole
stylesheet, and that is harmless: the PDF already forces the same behaviour
through Puppeteer, so the rule agrees with what is already happening rather than
changing it.

Must not break: the PDF stays exactly as it is, the screen is untouched because
the rule is behind `@media print`, and printing with backgrounds already enabled
looks the same as it does now.

## Build steps

- [x] **Step 1 - keep the invoice's backgrounds on paper** - add the declaration
  under `@media print` in `app/app.css`. *Done when:* the Classic template printed
  from the browser **with backgrounds off** keeps its filled table header, checked
  by rendering to PDF and comparing against the same render with backgrounds on,
  which is the exact comparison that found this, inverted; both renders show the
  same number of filled rectangles; and a real PDF render from `/invoice/pdf` is
  unchanged, still one page, Letter, same extracted text.

## Verify

1. Render the Classic template from the app page to PDF twice, once with
   background graphics on and once off. The filled header band survives both.
2. Render the same invoice through `/invoice/pdf`. Unchanged: one page, Letter.
3. On screen at any width, nothing has moved, because the rule is print-only.

Then `pnpm typecheck`, `pnpm build`, and `pnpm test`, the fallback gate while no
Verify command is declared in `AGENTS.md`.

## Findings

Resolved findings carried into this archive. Both were repaired by the fix
before this one and reached `closed` at the audit that followed feature 23,
which is why they archive here rather than with the work that made them. Their
**Found** lines record where each came from. F-61, the finding this fix
repaired, stays in the ledger as `fixed` until an audit re-reviews it.

### print-keeps-backgrounds/F-58 [P3] closed - Two different things decide whether the status control renders

**File:** app/routes/invoices.$id.tsx:272
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** The loader now sends both `settableStatus` (the stored status
narrowed to the three a user may choose, or null) and `permissions.canSetStatus`.
The component gates the control on the first: `{invoice.settableStatus ? <StatusControl .../> : null}`.
The action gates the write on the second.

They agree today, because both reduce to "is this invoice void". That is one rule
answered in two places, which is the exact shape that produced F-54: a decision
made outside `invoicePermissions` drifting from the one inside it.

Nothing misbehaves now. What would misbehave is the next change to the rule.
Freeze status changes on paid invoices, say, and `canSetStatus` goes false while
`parseSettableStatus("paid")` still returns `"paid"`, so the control renders and
the action refuses it: a dropdown that does nothing.
**Suggested fix:** gate on the permission and let `settableStatus` do only the job
its name implies, supplying the control's current value:
`{invoice.permissions.canSetStatus && invoice.settableStatus ? ...}`, or better,
have the loader send the value only when the permission allows it so there is one
decision rather than two that must agree.

**Resolution:** Fixed 2026-08-17 by /implement, the second way. A new
`settableStatusOf` in `invoice-status.ts` asks `invoicePermissions` first and
narrows second, and the loader calls it instead of `parseSettableStatus`. The
component is untouched: `{invoice.settableStatus ? ... : null}` reads exactly as
before, except that field's nullability is now the permission by construction
rather than by coincidence.

The two checks inside it are not the duplication this removed. One is the rule and
one is the narrowing that satisfies the type, and the order is what matters: if
they ever disagree the permission wins and the answer is null, which fails safe.

The test that matters asserts no particular answer. It loops all four statuses and
asserts `settableStatusOf(status) === null` exactly when `!canSetStatus`, so the
two cannot drift apart without a failure, which is the defect this finding
described rather than any of its symptoms.

Confirmed in the browser across all four states: draft, sent, and paid each show
the control with their own value and keep Save; void shows no control and no Save.

**Closed 2026-08-17 by /audit (scope: full).** Re-read `invoice-status.ts:120-124`
and `invoices.$id.tsx:77`. The loader takes its value from `settableStatusOf`, so
the control's existence and the action's permission now come from one function.
`parseSettableStatus` is still imported by the route, and correctly: it parses the
status out of a form body at line 108, which is a different job from deriving one
from a stored value. No second gate survives.

### print-keeps-backgrounds/F-60 [P3] closed - updateInvoice trusts its caller to refuse a void invoice

**File:** app/lib/invoice-store.server.ts:492
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** After today's fix, three of the four status-touching writes
carry their rule in their own `where`: `setInvoiceStatus` refuses a void invoice,
`voidInvoice` requires a sent one, `deleteInvoice` requires a draft.
`updateInvoice` is the exception. Its guard lives entirely in `saveDraftEdit`,
which checks `canEdit` before calling it.

That is safe today because `saveDraftEdit` is the only caller and it does check.
It is also the arrangement F-54 was: a rule held by the caller rather than by the
write. A second caller that forgets makes a void invoice rewritable, and the body
is the part voiding exists to freeze.

`updateInvoice` cannot simply take a `where` condition, which is worth recording
so nobody tries: it deletes the row and re-inserts it in one batch, so a delete
that matched nothing would be followed by an insert of an id that still exists,
turning a silent refusal into a primary key violation.

It does not need one. It already reads the status for a different reason,
`select createdAt, status`, and that value is in hand three lines before the write.
**Suggested fix:** have `updateInvoice` refuse when
`!invoicePermissions(existing.status).canEdit`. Returning `null` would collapse it
with "no such invoice", which `saveDraftEdit` turns into a 404, so it wants a
distinguishable result; the smallest honest version is to keep the caller's message
and treat this as the backstop that makes the rule true rather than merely
enforced.

**Resolution:** Fixed 2026-08-17 by /implement, exactly that. `updateInvoice`
returns null when `invoicePermissions(existing.status).canEdit` is false, using the
status it already selects for `createdAt`. The comment records why it cannot carry
a `where` clause instead, so nobody tries and hits the primary key violation.

Proving a guard nothing can reach took a deliberate detour, and the method is worth
keeping in mind. `saveDraftEdit` checks first, so the normal path answers with its
sentence and never enters the new code. So `saveDraftEdit`'s check was temporarily
neutered with `if (false && ...)`, the same save replayed, and the backstop
observed taking over: 404 instead of the sentence, with the row still `Void Co` and
`void` even though the posted draft carried `billTo: "REWRITTEN BY A SAVE"`. The
edit was then reverted, confirmed by an empty `git diff --stat` for that file and by
the sentence coming back on a repeat post.

Real D1 through the real stack, which is better evidence than a fake database, and
it is why no unit test was added: testing this properly would need a D1 fake, and
introducing that pattern is a decision for the standards rather than something to
slip into a P3 repair.

Also checked that the guard did not break the path every edit takes: saving an
edit to a draft still returns ok and the row reads back with the new client,
terms, total, and line item.

**Closed 2026-08-17 by /audit (scope: full).** Re-read
`invoice-store.server.ts:516`: the check sits between the `existing` read and the
write, using the status already in hand. Every statement that can change an
invoice now carries or asks its own rule, which was the point.
