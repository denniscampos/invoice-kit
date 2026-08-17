# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-08 [P3] open - Clearing the issue date wipes a due date typed to exactly the default

**File:** app/components/invoice/InvoiceDetailsFields.tsx:41
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The F-07 repair clears an unpinned due date when the issue
date is cleared, which is what keeps the pin derivation total. A due date the
user typed by hand to exactly `issueDate + 30` is indistinguishable from one that
was merely following along, so clearing the issue date discards it. Reproduced in
the browser: issue `2026-08-14`, due typed as `2026-09-13`, clear the issue date,
and the due date empties. This is the residual cost of deriving the pin instead of
storing it, and it is much smaller than F-01 and F-07: the value disappears
immediately and visibly in response to the user's own edit of the adjacent field,
rather than being silently rewritten later by an unrelated action. The user can
retype it.
**Suggested fix:** accept it, or make the pin explicit by adding a persisted
`dueDatePinned` boolean to `InvoiceDraft`. That removes the ambiguity completely,
at the cost of putting a piece of UI state into a type that otherwise mirrors the
D1 schema, so it is a deliberate contract change rather than a quick patch. Not
worth doing on its own; worth doing if feature 18 or 19 adds more derived date
behavior.
**Resolution:**

### F-11 [P3] open - An out-of-range line total silently renders as zero

**File:** app/lib/money.ts:60
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `lineItemTotal` returns `0` when the product leaves safe
integer range, so a quantity of `99999999999999` at `1000.00` shows an amount of
`0.00` rather than refusing the input. Reproduced in the running app. Zero is a
worse answer than the last good value, because it silently changes the invoice
total. Only reachable with an absurd quantity, hence P3.
**Suggested fix:** have `lineItemTotal` return `null` for the out-of-range case
and let the caller keep the previous total, matching how the parsers already
treat input they cannot represent. Alternatively bound `parseQuantity` to a
sensible maximum so the product can never overflow.
**Resolution:**

### F-15 [P3] open - A European thousands dot reads as a decimal point

**File:** app/lib/money.ts:16
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The mirror of the ambiguity F-10 accepted. A single dot is
always the decimal point, so `"1.234"` typed by someone who means one thousand
two hundred and thirty four parses as `1.23`. Reproduced in the running app. It
is the same unsolvable-from-the-string problem as `1,250`, resolved the other way
because each separator follows the en-US convention, and the error runs in the
safer direction (an undercharge the user is likely to notice) but is a thousand
fold rather than a hundred fold.
**Suggested fix:** nothing local will settle it, because the string genuinely
carries both readings. The durable answer is a number format that follows the
selected currency or an explicit locale setting (feature 22), at which point
both this and the `1,250` case become deterministic. Until then it is a
documented limitation, not a bug to patch.

Updated 2026-08-14 by /audit: since the F-14 repair, `parseQuantity` shares the
same helper, so this limitation now applies to the quantity column as well as
the rate. That is the right trade, since the two fields agreeing matters more
than either one guessing differently, but it widens what a locale setting would
have to fix.
**Resolution:**

### F-18 [P3] open - A very wide amount overflows its fixed column into the page margin

**File:** app/components/invoice/InvoiceTemplate.tsx:61
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The F-16 repair gave the numeric columns fixed widths
(`w-16`, `w-24`, `w-28`), which is what stops a long word widening the document.
The trade is that a number too wide for its column no longer widens it either: it
overflows. Reproduced at 99999 x 999999.99, where the amount `€99,998,999,000.01`
needs 142px in a 112px cell and its text runs 30px past the column, eating into
the paper's right margin. Nothing is clipped or hidden today and the document
does not stretch, so this is cosmetic at the preview stage, but feature 5 renders
this same component to a fixed page where the margin is real.
Ten-figure invoices are not the realistic trigger. Widening the currency picker
is: 20,000,000 IDR or VND is an ordinary amount, and those codes plus grouping
reach the same width at everyday values.
**Suggested fix:** leave it until feature 22 widens the currency list, then size
the amount column from the currency rather than a constant, or let the numeric
cells wrap when they must (dropping `whitespace-nowrap` on the amount column
only). Both are cheap; neither is worth doing while the picker holds five
similar currencies.
**Resolution:**

### F-23 [P3] open - The three templates each keep their own copy of the document's rules

**File:** app/components/invoice/templates/CompactTemplate.tsx:1
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Minimal, Classic, and Compact each carry their own
`ItemsTable`, `Totals`, `InvoiceFooter`, and `PartyBlock`, roughly 700 lines
across the three. Different markup per template is the point of having templates,
and the shared data shaping was correctly extracted to `partyAddressLines`. What
is duplicated is the small print of the rules: the `No items yet` empty row, the
footer that disappears when both blocks are empty, the muted placeholder when a
party has no name, and the subtotal plus total pair. Feature 19 adds tax and
discount rows to all three, and feature 13 adds a logo, so each is three edits
that must agree. `templates.test.ts` is the current guard: it asserts field
parity across every registered template, so a missed copy fails the suite rather
than shipping.
**Suggested fix:** leave it for now and revisit at feature 19, when a second
whole-document change either proves the duplication cheap or expensive. If it
needs solving, share the predicates (an `isEmptyFooter` style helper) rather than
a layout component parameterized by props, which would defeat the point of
separate templates.

**Resolution:**

### F-49 [P3] open - The number suggestion still sorts every INV- row the user owns

**File:** app/lib/invoice-store.server.ts:441
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** F-43 closed on the grounds that `listInvoiceNumbers` is
bounded, and it is: ten rows cross to the Worker instead of the whole column.
The database work is not bounded, and closing F-43 slightly overstated what had
been won.

`explain query plan` on the current query, and on the pre-repair one for
comparison, are identical:

    SEARCH invoice USING COVERING INDEX invoice_userId_invoiceNumber_idx
      (userId=? AND invoiceNumber>? AND invoiceNumber<?)
    USE TEMP B-TREE FOR ORDER BY

So SQLite folds the `INV-` prefix into an index range, which is good, then
builds a temporary b-tree over every matching entry to satisfy the order before
`limit 10` takes its slice. The scan and the sort both grow with the number of
invoices a user has, on a query that runs on every editor load and again after
every save. D1 bills rows read, and a covering index entry is still a row read.

Nothing is wrong today: production holds one invoice. This is filed because the
shape grows, which is the same reason F-43 was filed, and because the record
should not claim a cost was removed when it was moved.
**Suggested fix:** nothing yet, deliberately. The honest options each cost more
than the problem currently justifies: store the sequence as an integer column
beside `invoiceNumber` so an index can serve the order directly, or keep a
per-user counter and stop deriving the suggestion from a scan. Revisit if a real
account passes a few thousand invoices, or fold it into feature 22 if settings
ever let a user define their own numbering, since that would rework this code
anyway.
**Resolution:**

### F-51 [P3] open - The save actions accept an unbounded request body

**File:** app/routes/editor.tsx:52
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** `/invoice/pdf` is careful about this: it refuses a declared
`content-length` over `MAX_DRAFT_BYTES` (128 KB), then measures the real bytes
with `readBoundedText` and abandons the request the moment it passes, because "it
must not accept an invoice large enough to be a denial-of-service payload".

The two save actions do `await request.formData()` with no bound at all, at
`editor.tsx:52` and `invoices.$id.tsx:63`, and so do the two auth forms
(`sign-up.tsx:33`, `sign-in.tsx:30`). A posted body is buffered whole before
anything can object.

The asymmetry is the interesting part, and it runs the wrong way round for
comfort: the guarded route is the anonymous one, and the unguarded ones sit
behind a session that anybody can obtain, since sign-up needs no email
verification by design. The standards say to validate every external input on
both tiers and are explicit that no login does not mean no untrusted input.

P3 rather than higher because the ceiling is low. The damage is memory in one
isolate during buffering, Cloudflare caps request bodies well below what would
matter, D1 refuses an oversized row anyway, and nothing expensive sits
downstream the way Browser Rendering does behind the render endpoint. Nothing is
lost or corrupted. Pre-existing since features 6b and 7b; not introduced by
recent work.
**Suggested fix:** reject on `content-length` over a documented ceiling at the top
of each action, which is one line and catches every honest client. A full fix
would read the body with `readBoundedText` and parse the form from the bounded
text, which is more work because `request.formData()` cannot be fed a string;
worth doing only if this ever looks like a real target.
**Resolution:**

### F-52 [unverified] [P3] - Production refuses far fewer requests than the configured 2 per minute

**File:** wrangler.json:31
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** A lead, not a defect, and recorded so it is not lost.

`PDF_LIMITER` is configured at 2 requests per 60 seconds per caller. Against the
deployed Worker (version `1707e71f`), twelve rapid anonymous POSTs with a body
that fails validation returned

    400 400 400 400 429 400 400 400 400 400 400 400

so the limiter does fire, but it let eleven of twelve through in a few seconds.
Locally the same probe refuses every request once the bucket is full, which is
the behaviour the config reads like.

The likely explanation is that Cloudflare's rate limiting binding is approximate
and enforced per location rather than as a strict shared counter, which would
make this expected rather than broken. The overview calls rate limiting on this
endpoint a deploy blocker, so the gap between "2 per minute" as written and what
production does is worth pinning down either way.

Not attributable to the F-46 repair: an anonymous request takes the same path it
always did, and the local behaviour is unchanged.
**Suggested fix:** nothing yet. Confirm against Cloudflare's documented semantics
for the binding before changing any number, and if the enforcement really is
per-colo, say so in the `wrangler.json` comment, which currently reads as though
the limit is exact. Probing production harder costs real render quota, so this
needs a deliberate session rather than a drive-by.
**Resolution:**

### F-53 [P3] open - toSavedInvoice is exported to nobody and covered by nothing

**File:** app/lib/invoice-store.server.ts:231
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** `toSavedInvoice` is `export`ed but every caller is inside its
own module (`createInvoice`, `getInvoice`, `updateInvoice`); no other file imports
it. It is also untested, while the archived feature 9 spec states that
`invoice-store.test.ts` "tests the pure mapping functions (`draftToRows`,
`rowsToDraft`, `toSavedInvoice`)". The test file imports two of those three, so
that sentence has been wrong since it was written.

It is genuinely in-scope logic by the standards' own rule, a pure function with
assertable inputs and outputs, and it is on the read path for every saved invoice
the detail view opens. What it does beyond the tested `rowsToDraft` is copy five
fields, which is why nothing has gone wrong.

Marginal, and worth saying so: keeping a store module's mapper exported is
defensible even with no consumer today, and feature 12 may well import it.
**Suggested fix:** either drop the `export` until something outside the module
needs it, or add the handful of assertions that make the archived claim true.
Not both, and neither is urgent.
**Resolution:**

### F-57 [P3] open - A render that is merely queued is reported as a render that failed

**File:** app/routes/invoice.pdf.tsx:96
**Found:** 2026-08-17 by /audit (scope: full)
**Why it matters:** `isOutOfBrowserQuota` decides between two very different
messages by matching the error text: `message.includes("429") || /rate limit/i`.
When it matches, the caller is told "Too many invoices are being generated right
now. Try again in a moment", which is true and actionable. When it does not, they
get 502 "The invoice could not be rendered right now", which reads like the
document is broken.

Observed during feature 12: a download returned 502, a retry on the same invoice
seconds later returned a 90KB PDF, and the day's render count was 6 out of a cap
under 150, so neither the app's quota nor the invoice was the problem. The
transient nature is confirmed. What is inferred, and worth saying plainly, is the
cause: most likely the free tier's one-browser-every-twenty-seconds cadence
arriving with wording this predicate does not recognise. The error text itself was
not captured, because the dev server's console output was not being collected at
the time.

The cost is a user who waits twenty seconds being told to go away instead. Third
time a text-matched Cloudflare error has needed a special case in this file, the
other two being the quota check itself and the duplicate-number match in
`invoice-save.server.ts`.
**Suggested fix:** capture the real message first, from `wrangler tail` or a
local log, before widening the predicate; guessing at more strings to match is how
this stays fragile. If the wording turns out to be unstable, the honest fallback
is to soften the 502 sentence so it suggests retrying, since a render failure is
far more often transient than permanent in this app.
**Resolution:**

### F-58 [P3] open - Two different things decide whether the status control renders

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
**Resolution:**

### F-59 [P3] open - The detail route's action is 129 lines across four intents

**File:** app/routes/invoices.$id.tsx:85
**Found:** 2026-08-17 by /audit (scope: current)
**Why it matters:** The coding standards ask for functions under 50 lines when
possible. Measured: `action` is 129, `loader` 36, `SavedInvoiceEditor` 80,
`ErrorBoundary` 24, in a 329 line file.

The action grew a branch per feature: feature 11 wrote the save, feature 10 added
`status`, feature 12 added `delete` and `void`, and today's fix added a status read
and a raced-write answer to each. No single step was unreasonable, which is how it
got here without anyone deciding it should.

It still reads linearly and each branch is independently comprehensible, so this
is a size observation rather than a defect. The trigger to act is the next intent,
and the shape of all four is now identical enough to make the extraction obvious:
read the status, ask `invoicePermissions`, write, report a raced write.

`SavedInvoiceEditor` at 80 lines was considered and is not filed: it is nearly all
JSX, where the 50 line guide reads as being about logic.
**Suggested fix:** when a fifth intent arrives, give each one a small named
function taking `(db, userId, id, form)` and returning its result, leaving the
action as a dispatch. Not worth doing for its own sake today.
**Resolution:**

### F-60 [P3] open - updateInvoice trusts its caller to refuse a void invoice

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
**Resolution:**
