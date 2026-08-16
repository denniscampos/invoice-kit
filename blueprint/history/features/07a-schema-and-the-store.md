# Feature: Schema and the store

**From build-plan:** feature 7a
**Status:** complete

## Goal

The tables an invoice lives in, and the one module that reads and writes them.
Everything a signed-in user eventually does with a saved invoice, the list (9),
the status (10), the detail view (11), delete and void (12), goes through what
this sub-feature defines. It ships with no UI at all: 7b adds the Save button.

This is where `requireUser` finally has a caller, and where the rule that every
user-owned query filters by the session's user id stops being a paragraph in
`coding-standards.md` and becomes code.

## Design reference

None needed. Nothing here renders.

## The shape of it, decided up front

**The client's arithmetic is never stored.** The draft that arrives carries a
`total` on every line item and the preview shows a subtotal, and none of it is
trusted: `parseDraft` proves the numbers are integers, not that they are the
right integers. The store recomputes `total = round(quantity * rate)` per item
and `subtotal` as their sum, from `quantity` and `rate` alone. A caller who posts
`{quantity: 1, rate: 500, total: 1}` gets an invoice that says 500.

This is not paranoia about attackers so much as about drift: the day a rounding
rule changes in one place and not the other, the stored invoice should be the one
the server computed.

**Money stays integer minor units end to end**, per the locked decision in the
overview. `quantity` is the only real number in the schema.

**Every query is scoped by `userId` in the SQL itself**, never filtered after the
fact, and the id always comes from the session. A row that belongs to someone
else is indistinguishable from a row that does not exist: `getInvoice` returns
null for both, so 7b and feature 11 can answer 404 without confirming that
someone else's invoice exists.

**Columns are camelCase, tables are snake_case.** The columns match the field
names the overview's data model already uses and the shape Better Auth's own
tables use, which keeps the row to object mapping a copy rather than a rename.
The table names match `render_quota`, the only table this project wrote by hand
so far. The mixture is deliberate and worth one sentence in the migration.

**The status column accepts all four values now**, `draft | sent | paid | void`,
even though this sub-feature only ever writes `draft`. A constraint that has to
be migrated the moment feature 10 arrives is a constraint written twice.

## In scope

- Migration `0004`: the `invoice` and `line_item` tables, their foreign keys,
  their indexes, and the uniqueness rule on an invoice number per user
- The pure mapping between an `InvoiceDraft` and the stored rows, both ways,
  including the server-side recomputation of every money field
- `createInvoice`, `getInvoice`, `updateInvoice` in
  `app/lib/invoice-store.server.ts`, each scoped by the session user's id
- Tests for the mapping and the recomputation

## Out of scope

- **Every piece of UI** (7b). No Save button, no saved state, nothing in the app
  changes appearance. This sub-feature is provably invisible.
- **Invoice numbering** (7b). The column and its uniqueness rule land here; the
  per-user `INV-0001` sequence that picks the next one is 7b's, where it is
  first needed.
- **The invoice list** (9), **status changes** (10), **the detail view** (11),
  **delete and void** (12), **logo uploads** (13). `deleteInvoice` is not written
  here: feature 12 decides what deleting a draft and voiding a sent invoice
  actually mean, and writing it now would be guessing at that.
- **Carrying an anonymous draft through sign up** (8). The store takes a user id;
  where the draft came from is not its problem.
- **Tax, discount, and custom fields.** Their columns land here as zeroes and
  null because the overview's model says so and because adding a column later is
  a migration nobody needs, but nothing reads or writes them until 18 and 19.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The tables** - `migrations/0004_invoice_and_line_items.sql`:
  `invoice` and `line_item`, both cascading from their parent, with an index on
  `invoice.userId`, an index on `line_item.invoiceId`, and a unique index on
  `(userId, invoiceNumber)`. Applied locally only.

  *Done when:* `wrangler d1 migrations list --local` shows 0004 applied and the
  remote list is untouched; inserting two invoices with the same number for the
  same user is refused while the same number under two different users is
  allowed, both proven by running the statements; deleting a user removes their
  invoices and deleting an invoice removes its line items, proven the same way;
  and every money column is an integer while `quantity` is real.

- [x] **Step 2 - The mapping, and the money the server computes** - in
  `app/lib/invoice-store.server.ts`: `draftToRow(draft, userId, id, now)` and
  `rowsToDraft(invoice, lineItems)`, plus the recomputation that makes a line
  item's total and the invoice's subtotal follow from `quantity` and `rate`
  rather than from what the client sent. Pure functions, no database.

  *Done when:* `pnpm test` covers a full round trip (draft to rows to draft
  returning an equal draft), a line item whose posted `total` disagrees with
  `quantity * rate` being stored as the computed value, a fractional cent
  rounding the way `money.ts` already rounds, an empty invoice giving a subtotal
  of zero, `total` equalling `subtotal` while discount and tax are zero, and
  `position` following the array order rather than the posted `position`; and
  `pnpm typecheck` and `pnpm build` are clean.

- [x] **Step 3 - The store** - `createInvoice`, `getInvoice`, and
  `updateInvoice`, each taking the user id and scoping its SQL by it. Writing an
  invoice and its line items is one batch, and updating replaces the line items
  rather than diffing them.

  *Done when:* creating an invoice as user A and reading it back returns an equal
  draft; reading that same id as user B returns null rather than throwing or
  leaking; updating as user B changes nothing, proven by reading the row back
  afterwards; an update leaves no half-written state, proven by forcing a failure
  mid-batch and confirming the invoice and its items are as they were; the line
  items come back in `position` order; and every command ran with `--local`.

## Files / areas

- `migrations/0004_invoice_and_line_items.sql` - new
- `app/lib/invoice-store.server.ts` - new
- `app/lib/invoice-store.test.ts` - new, the mapping and the recomputation
- Nothing else. No route, no component, no change to any existing file.

## Data / contracts

```ts
// app/lib/invoice-store.server.ts
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type SavedInvoice = {
	id: string;
	userId: string;
	status: InvoiceStatus;
	createdAt: string;   // ISO 8601 UTC
	updatedAt: string;
	draft: InvoiceDraft; // everything the editor round trips
};

export function createInvoice(db, userId, draft): Promise<SavedInvoice>;
export function getInvoice(db, userId, id): Promise<SavedInvoice | null>;
export function updateInvoice(db, userId, id, draft): Promise<SavedInvoice | null>;
```

`SavedInvoice` is **load-bearing**: features 9, 10, 11, and 12 all read it. It
deliberately keeps the editable body as an `InvoiceDraft` rather than flattening
forty columns into one object, so the editor and the store speak the same
language and the mapping stays in one file.

Schema, following the overview's data model:

```sql
create table invoice (
  id text not null primary key,
  userId text not null references "user"("id") on delete cascade,
  invoiceNumber text not null,
  status text not null default 'draft',   -- draft | sent | paid | void
  templateId text not null,
  issueDate text not null,                -- YYYY-MM-DD
  dueDate text not null,
  currency text not null,                 -- ISO 4217
  logoAssetId text,                       -- feature 13
  billFrom* / billTo*  text not null,     -- nine columns each, copied not referenced
  paymentTerms text,
  notes text,
  subtotal integer not null,              -- minor units, computed server side
  discountTotal integer not null default 0,
  taxTotal integer not null default 0,
  total integer not null,
  customFields text,                      -- feature 18
  createdAt text not null,
  updatedAt text not null
);

create table line_item (
  id text not null primary key,
  invoiceId text not null references invoice(id) on delete cascade,
  position integer not null,
  name text not null,
  description text,
  quantity real not null,
  rate integer not null,                  -- minor units
  total integer not null                  -- round(quantity * rate), stored
);
```

Rules this sub-feature must hold to:

- **The user id comes from the session, never from a request.** Every function
  takes it as an argument and every statement filters on it.
- **Money is recomputed, never accepted.** See above.
- **Party details are copied onto the invoice**, not referenced, so a saved
  invoice keeps the address it was sent with. Feature 21 adds a record to copy
  *from*; it does not turn these into foreign keys.
- **Overdue is derived, never stored.** There is no overdue column and there will
  not be one.
- **A write is one batch.** An invoice without its line items, or line items
  without their invoice, is not a state this app should be able to reach.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic, all in step 2:

- **`draftToRow` / `rowsToDraft`** - the round trip, and that a stored invoice
  read back equals what was saved
- **The money recomputation** - the whole reason to have a seam here: a posted
  total that disagrees with `quantity * rate` must lose

Steps 1 and 3 are a migration and database calls. Neither is unit tested, for the
reason already settled in `coding-standards.md` and repeated by `render-quota`:
`vitest.config.ts` runs in `node` with no Cloudflare plugin, so a real binding is
not available. They are proven against the local database instead, as their
done-whens describe.

Verify by hand at the end:

- Insert a duplicate invoice number for one user and read the refusal
- Insert the same number for two different users and confirm both are allowed
- Delete a user and confirm their invoices went with them
- Save an invoice whose posted totals are wrong and read back the corrected ones
- Read an invoice as the wrong user and get null

## Notes for the AI

- **Local only.** Every D1 command carries `--local`. The remote migration goes
  with the next deploy, as 0002 and 0003 did.
- **Do not write `deleteInvoice`.** Feature 12 owns what deleting and voiding
  mean, and a delete written now is a guess that a later feature has to unpick.
- **Foreign keys are not enforced in D1 unless they are turned on.** Prove the
  cascade actually cascades rather than assuming the `references` clause did it;
  if it does not, say so in the step rather than quietly dropping the claim.
- `crypto.randomUUID()` for ids, which the Workers runtime provides.
- Timestamps are ISO 8601 UTC strings; dates stay `YYYY-MM-DD` strings. Neither
  is ever a `Date` in the database.
- Use `db.batch()` so an invoice and its line items land together.
- `round` for a line item's total should be the project's existing rounding, not
  a fresh `Math.round` next to it; check `money.ts` before writing one.
- The functions take a `D1Database`, not an `Env`. The route hands it in, which
  keeps the store honest about what it touches.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.

## Findings

### 07a/F-37 [P2] closed - A render that never happens still spends the day's quota

**File:** app/routes/invoice.pdf.tsx:136
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** The slot is taken before `puppeteer.launch`, and nothing gives
it back when the launch fails. The comment above it says the capacity "is spent
only by a request that was going to be rendered", and a request that could not
get a browser was not rendered: it used no browser time at all.

This is the failure the route itself expects most. `isOutOfBrowserQuota` exists
because the free tier allows one new browser every twenty seconds, so a handful
of people pressing Download at once produces 429s by design. Each of those still
increments `render_quota`. Enough of them in a day and the app serves "try again
tomorrow" while Cloudflare's actual allowance is barely touched, which is the
mirror image of the problem F-33 was raised to fix.

It errs toward refusing rather than over-spending, which is why this is P2 and
not higher.
**Suggested fix:** release the slot when the failure happened before any real
rendering. A compensating `update render_quota set renders = renders - 1 where
day = ?1 and renders > 0` in the `isOutOfBrowserQuota` branch is the smallest
version. Moving the consume after a successful launch is the alternative, but it
reopens the race that the single-statement increment exists to close.

**Resolution:** Fixed 2026-08-15 by /implement. `releaseRenderQuota` gives the
slot back, but only when `browser` is still undefined in the catch, which is
exactly the case where the launch failed and no browser time was spent. A failure
after the browser opened keeps its cost, so a caller who can reliably break the
renderer cannot download all day for free. The decrement carries `renders > 0`,
so a refund against a missing or already-zero row is a no-op rather than a
negative count, and a failure to refund is logged and swallowed so it cannot
replace the caller's real error with a database one.

Proven against the running app with the browser binding genuinely absent
(`puppeteer.launch(undefined)`, confirmed in the Worker log as `TypeError:
Cannot read properties of undefined (reading 'fetch')`): four failed launches
left the count at 0, and with the binding restored a successful download took it
0 to 1. The first attempt at this test was invalid, because the dev server had
failed to restart on the new config and an older process answered; it was rerun
after freeing the port.

Not proven empirically: that a failure after launch still consumes its slot.
There is no way to force `page.pdf` to fail from outside the app, so that rests
on the single `if (!browser)` guard.

**Re-reviewed 2026-08-16 by /audit (scope: full): closed.** Both
`render-quota.server.ts` and the call site in `invoice.pdf.tsx` were in this
pass's reviewed set. The guard is on `browser` still being undefined, and that
variable is only ever assigned from a resolved `puppeteer.launch`, so a failure
at `newPage`, `setContent`, or `page.pdf` keeps its cost exactly as intended.

Traced for double-refund and over-refund under concurrency: A consumes 5 to 6, B
consumes 6 to 7, A releases 7 to 6, leaving B's slot held. At the cap the consume
returns without incrementing, so no release runs against it. `renders > 0` holds
the floor at zero. No new defect found in the repair.

### 07a/F-38 [P3] closed - The product name has no screen-reader text on a phone

**File:** app/components/AppBar.tsx:14
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Introduced by the F-35 repair. Below `sm` the wordmark is
`hidden`, which removes it from the accessibility tree as well as from the
screen, and the `IK` mark beside it carries no label. A screen-reader user on a
phone hears "IK" where a sighted user sees a logo they recognise. It is P3
because the app is still perfectly usable and the name is in the page title, but
it is a regression this repair caused rather than a pre-existing gap.
**Suggested fix:** one class. `sr-only sm:not-sr-only sm:inline` keeps the text
for assistive technology at every width while staying invisible below `sm`.

**Resolution:** Fixed 2026-08-15 by /implement. `sr-only sm:not-sr-only` in
place of `hidden sm:inline`, so the wordmark stays in the accessibility tree at
every width while remaining invisible below `sm`.

Measured from the rendered page rather than the source: at 320px the brand's
accessible name is "IK Invoice Kit" while the span computes to `position:
absolute`, 1x1, `clip-path: inset(50%)`. Because it is out of flow it costs no
width, so F-35 does not return: 305/305 at 320px both signed in and signed out,
and the wordmark is visibly back at 640px.

**Re-reviewed 2026-08-16 by /audit (scope: full): closed.** `AppBar.tsx` was in
this pass's reviewed set. `sr-only sm:not-sr-only` restores the name to the
accessibility tree at every width and was measured back to visible at 640px, and
because `sr-only` takes the element out of flow the 320px figure that F-35 was
raised over is unchanged. No new defect.

### 07a/F-39 [P3] invalid - Every page may now depend on D1 being reachable

**File:** app/root.tsx:24
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** A lead, not a confirmed defect. The root loader calls
`getUser` on every navigation, so if Better Auth queries D1 whenever a session
cookie is present, an unreachable database would throw in the root loader and
take down every page, including the editor that the anonymous tier is supposed
to run without touching storage at all. Before 6c the editor rendered with no
database involvement whatsoever.

The likely reality is narrower: a visitor with no cookie should never reach a
query, so the anonymous tier is probably unaffected and only signed-in visitors
would see the outage. That is the part this pass could not prove.
**Suggested fix:** see the evidence below; the anonymous half of this needs no
fix at all.

**Evidence gathered 2026-08-15 by /implement (fix: audit findings 37-39).** The
binding was pointed at a database id that does not exist, the dev server was
restarted and confirmed to have started on that config rather than an older one,
and `/` was loaded twice. Both `wrangler.json` restores were verified by checksum
afterwards.

| Request | Result |
|---|---|
| `GET /` with no session cookie | **200**, editor renders in full, bar reads "Sign in" |
| `GET /` with a valid session cookie | **500** |
| `POST /sign-in` (control, proving the database really was gone) | 400 |

**The specific risk this finding names is disproven.** It claimed an unreachable
database would take down "every page, including the editor that the anonymous
tier is supposed to run without touching storage". The anonymous editor is
untouched: a visitor with no cookie never reaches a query, so the free path
survives a total D1 outage exactly as the tier line promises.

What is left is narrower and arguably correct: a signed-in visitor gets a 500 on
every route while D1 is down. Every signed-in capability from feature 7 onward
needs that database, so there is little for the app to usefully show them. The
alternative, degrading to a signed-out bar, would let a signed-in user keep using
the editor during an outage, but it would also tell them they are signed out when
they are not, and mask the outage rather than report it. That is a product call,
not a defect, and no code was changed for it.

Left `unverified` for `/audit` to rule on, since `/implement` does not set
`invalid`.

**Resolution:**

**Re-examined 2026-08-16 by /audit (scope: full): invalid.** The finding was
written as a lead and the experiment recorded above disproves the risk it names.
It claimed an unreachable database would take down "every page, including the
editor that the anonymous tier is supposed to run without touching storage". A
cookie-less request returned 200 with the editor rendered in full against a
database that did not exist, so the anonymous tier never reaches a query and the
free path survives an outage exactly as the tier line promises.

The residual, a signed-in visitor seeing a 500 during a D1 outage, is not filed
as a defect: every signed-in capability from feature 7 onward needs that
database, so there is little the app could usefully show. Making the editor
degrade to a signed-out bar instead is a product change someone may still want,
and it belongs in `/fix` as a request rather than here as a fault.

