# Feature: Invoice editor

**From build-plan:** feature 1
**Status:** complete

## Goal

The form half of the invoice editor: bill from, bill to, invoice details,
payment terms, and notes, held in a client-side draft that survives a refresh.
No account, no server storage.

This is the front door of the product and the feature that defines
`InvoiceDraft`, the shape every later feature reads or writes. Features 2 (line
items), 3 (live preview), 4 (templates), 5 (PDF), 7 (persistence), and 8 (draft
handoff) all build on what this locks down. It also ports the prototype theme
into the app, so every later feature inherits the look instead of re-deciding it.

## Design reference

Built from the approved mockups in `prototypes/`, not from prose:

- **`prototypes/editor.html`** - the primary reference. Copy its app bar, card
  grouping, field layout, label style, and two-column split.
- **`prototypes/theme.css`** - the source of truth for color, type, spacing, and
  radius. Step 2 ports it; after that the app stylesheet is canonical and the
  prototype is read-only reference.
- **`prototypes/invoice.html`** - not built here, but it shows what the reserved
  right column will eventually hold, which is why the column is sized the way it
  is.

The mockups show later features too. Build only what this spec's scope lists; see
Out of scope for the specific things in `editor.html` that must not be built yet.

## In scope

- shadcn/ui installed with the primitives this feature needs
- The prototype theme ported into `app/app.css` under Tailwind v4 `@theme`
- The `InvoiceDraft` type and its empty-draft factory (load-bearing)
- App bar and editor route at `/`, replacing the starter welcome screen
- Bill from and bill to sections, including optional tax/business ID
- Invoice details: number, issue date, due date, currency, payment terms
- Notes
- Draft persistence to `sessionStorage` so a refresh does not wipe the form

## Out of scope

Deferred, even though `prototypes/editor.html` shows them:

- **The line items card** (feature 2). `lineItems` stays an empty array.
- **Everything inside the preview column** (feature 3). Step 4 reserves the
  column; it stays empty.
- **The template switcher** (feature 4). `templateId` is fixed to `"minimal"`.
- **Save and Download PDF buttons** (features 7 and 5). Do not render dead
  controls; they arrive with the features that make them work.
- **The "not signed in, create an account" banner** and the Sign in button
  (feature 6).
- Server-side validation and Zod. Nothing reaches the server here.
- Money math and formatting helpers (feature 2).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Install shadcn/ui** - run its init against this React Router 8 +
  Tailwind v4 project, then add only the primitives this feature needs: `button`,
  `input`, `label`, `textarea`, `select`, `card`. Accept whatever tokens init
  writes into `app.css` for now; step 2 replaces their values. *Done when:*
  `components.json` exists, `app/components/ui/` holds those files, the path alias
  resolves, `pnpm typecheck` and `pnpm build` pass, and a temporary `<Button>` on
  `/` renders with its styles.

- [x] **Step 2 - Port the theme** - move `prototypes/theme.css` into
  `app/app.css`, reconciled with what shadcn wrote: keep shadcn's variable names
  so its components work unmodified, but set their values from the prototype, and
  add `@theme` entries for what shadcn has no name for (paper, status colors,
  the tabular-figure helper). Name them so Tailwind generates utilities
  (`--color-surface` gives `bg-surface`, not `--surface`). *Done when:* a page
  rendering a shadcn Button, Input, and a status pill matches the prototype's
  colors side by side in the browser, `bg-paper` and `text-muted` style
  utilities resolve, and `pnpm build` passes. Screenshot against
  `prototypes/editor.html`.

- [x] **Step 3 - Lock the draft contract** (also deleted `app/welcome/` early, at
  the user's request) - define `InvoiceDraft`, `Party`, and
  `LineItem` in `app/types/invoice.ts`, plus `createEmptyDraft()` in
  `app/lib/invoice-draft.ts`. No UI. *Done when:* `pnpm typecheck` passes and
  `createEmptyDraft()` returns `issueDate` = today, `dueDate` = today + 30 days,
  `invoiceNumber` = `INV-0001`, `currency` = `USD`, `templateId` = `"minimal"`,
  `status` = `"draft"`, `lineItems` = `[]`, and both parties present with empty
  strings.

- [x] **Step 4 - App shell and editor route** - the app bar (brand mark and the
  Editor nav item, nothing else yet; Invoices arrives with feature 9, since a
  link to a route that does not exist is the dead control this spec's Out of
  scope section rules out) and the editor at `/`, with the form column
  left and an empty reserved column right. Replace `app/routes/home.tsx` with
  `app/routes/editor.tsx` (`app/welcome/` is already gone). Draft state lives
  here via `useState(createEmptyDraft)`.
  *Done when:* `/` renders the shell matching `prototypes/editor.html`'s chrome,
  no console errors, the right column is visibly reserved and empty, and the
  layout stacks to one column below 1080px. Screenshot both widths.

- [x] **Step 5 - Party sections** - one shared `PartyFields` component rendered
  twice, for bill from and bill to: name, email, address, phone, city, region,
  postal code, country, tax/business ID, in the grid arrangement
  `editor.html` uses. Every field labeled and wired to draft state. *Done when:*
  both cards render, each input is labeled and reachable by keyboard in a sensible
  tab order, typing updates the draft, and the layout matches the mockup.
  Screenshot a filled form. The diff stays small because the fields come from one
  component, not eighteen hand-written blocks.

- [x] **Step 6 - Invoice details, terms, and notes** - invoice number (editable,
  defaulted), issue date, due date, currency select (USD, EUR, GBP, CAD, AUD),
  payment terms, notes textarea. Changing the issue date shifts the due date by
  the same 30 day offset until the user edits the due date directly, after which
  it stays put. *Done when:* all fields render and update the draft, and the
  issue-date-shifts-due-date behavior works and stops once the due date is
  touched.

- [x] **Step 7 - Draft persistence** - write the draft to `sessionStorage` under
  `invoice-kit:draft:v1` (debounced), and restore it on mount. Reads happen in an
  effect, never during render. Writes and reads wrapped in try/catch. *Done when:*
  filling the form and refreshing keeps every value; opening `/` in a new tab
  shows an empty form; closing and reopening the tab shows an empty form; a stored
  draft with a different version is discarded without throwing; and nothing breaks
  with storage unavailable (test in a private window).

- [x] **Repair F-01 - Pinned due date must survive a refresh** - derive the pinned
  state from the draft (`dueDate !== addDays(issueDate, 30)`) instead of holding
  it in component state that resets on mount. *Done when:* setting the due date,
  reloading, and then changing the issue date leaves the due date untouched, and
  the within-session behavior from step 6 still holds. Proven in the browser, not
  by inspection.

- [x] **Repair F-03 - Ignore browser test artifacts** - add `.playwright-mcp/` to
  `.gitignore`. *Done when:* `git check-ignore` confirms the path is ignored and
  `git status` stays clean after a browser run.

- [x] **Repair F-07 - Clearing the issue date must not drop the pin** - compare
  the due date against a default that is empty when there is no issue date,
  instead of short-circuiting on `Boolean(draft.issueDate)`. Keep the derivation
  total by clearing an unpinned due date when the issue date is cleared, so
  "no issue date, no due date" stays the only unpinned blank state. *Done when:*
  setting a due date, clearing the issue date, and retyping it leaves the due
  date untouched; on an untouched draft, clearing and retyping the issue date
  still moves the due date with it; and the F-01 refresh case still holds.
  Proven in the browser.

- [x] **Step 8 - Make the due-date pin rule testable** - move the derivation out
  of `InvoiceDetailsFields.tsx` into `isDueDatePinned(draft)` and
  `nextDueDate(draft, issueDate)` in `app/lib/invoice-draft.ts`, and cover the
  four issue/due states with unit tests. No behavior change: the rule has
  produced three findings (F-01, F-07, F-08) and is the only logic in this
  feature that nothing mechanically guards. *Done when:* `pnpm test` covers
  fresh, pinned, blank-issue, and blank-both; the component holds no date math;
  and the browser behavior from step 6 and the F-07 repair is unchanged.

## Files / areas

- `components.json` - new, shadcn config
- `app/components/ui/*` - new, shadcn primitives, owned in repo
- `app/app.css` - theme tokens ported from `prototypes/theme.css`
- `app/types/invoice.ts` - new, the load-bearing types
- `app/lib/invoice-draft.ts` - new, `createEmptyDraft`, serialize, deserialize
- `app/routes/editor.tsx` - new, replaces `app/routes/home.tsx`
- `app/routes.ts` - `index()` points at the editor
- `app/components/AppBar.tsx` - new
- `app/components/invoice/PartyFields.tsx`, `InvoiceDetailsFields.tsx` - new
- `app/routes/home.tsx`, `app/welcome/` - deleted

## Data / contracts

**`InvoiceDraft` is load-bearing.** It mirrors the `Invoice` + `LineItem` schema
in `project-overview.md` closely enough that feature 7 can save it with a
straight mapping, and feature 8 can restore it after sign-up. Fields carried now
but unused until later features (`lineItems`, `templateId`, `status`) exist so
those features extend the shape instead of reshaping it.

```ts
type Party = {
  name: string; address: string; city: string; region: string;
  postalCode: string; country: string; email: string; phone: string;
  taxId: string;
};

type LineItem = {
  id: string; position: number; name: string; description: string;
  quantity: number; rate: number; total: number;   // rate/total in minor units
};

type InvoiceDraft = {
  version: 1;
  invoiceNumber: string;
  status: "draft";
  templateId: string;
  issueDate: string;   // ISO YYYY-MM-DD
  dueDate: string;     // ISO YYYY-MM-DD
  currency: string;    // ISO 4217
  billFrom: Party;
  billTo: Party;
  paymentTerms: string;
  notes: string;
  lineItems: LineItem[];
};
```

Rules that later features depend on:

- Money is integer minor units. No money field is populated in this feature, but
  `rate` and `total` are typed now so feature 2 cannot quietly introduce floats.
- Dates are ISO `YYYY-MM-DD` strings, never `Date` objects in the draft, so
  serialization is lossless.
- `version` gates deserialization: a stored draft whose version does not match is
  discarded, not migrated.
- The ported theme tokens are a contract too. Later features style against
  `app.css`, and `prototypes/` is deleted at `/complete`, so anything the app
  still needs from `theme.css` must be in `app.css` by the end of step 2.

## Testing

`AGENTS.md` declares no `test` command, so **the test gate is off** and no step
is required to ship a test. Evidence is `pnpm build`, `pnpm typecheck`, and
screenshots compared against the mockups.

Verify by hand:

- Open `prototypes/editor.html` beside `/` and compare chrome, spacing, and
  field layout
- Fill every field, screenshot at desktop and below 1080px
- Change the issue date, confirm the due date follows, edit the due date, change
  the issue date again, confirm it now stays put
- Refresh, confirm values survive; new tab, confirm empty
- Open in a private window, confirm no crash if storage is restricted
- Browser console clean on load and while typing

If you later run `/tests`, the in-scope logic here is: `createEmptyDraft` date
math, the due-date offset rule, and draft serialize/deserialize including the
version mismatch path. Those are pure functions with real edge cases. The form
components are not unit test material.

## Notes for the AI

- **SSR gotcha, the likeliest way to break this:** the app renders on a Worker,
  where `sessionStorage` and `window` do not exist. Never touch storage during
  render or module initialization. Read it in an effect after mount, and expect
  the first render to be the empty draft on both server and client so hydration
  matches.
- Storage can throw. Private browsing and full quotas both fail on write, so
  wrap access in try/catch and treat failure as "no draft", never as an error the
  user sees.
- **Tailwind v4 token naming matters.** `@theme` only generates utilities for
  recognized namespaces, so port as `--color-surface`, `--color-paper`,
  `--radius-lg`, and so on. A bare `--surface` compiles but gives no `bg-surface`
  utility, and the mismatch will not be obvious until a later feature reaches for
  one.
- Keep shadcn's own variable names intact and change their values. Renaming them
  means editing every primitive, and future `shadcn add` runs will not match.
- Apply tabular figures to every number in the UI, not just money: dates, phone,
  postal code, tax id. The prototype's `.num` helper shows the intent.
- This is client state, not loader data. The route needs no loader in this
  feature; do not invent one.
- Follow `coding-standards.md`: strict TypeScript, no `any`, functional
  components, Tailwind classes only, shadcn primitives edited in place rather
  than wrapped.
- Match the existing file style: tabs for indentation, as in `vite.config.ts`.
- Comment the why, not the what. The due-date offset rule earns a comment; a
  labeled input does not.
- No em dashes in code, comments, or commit messages.
- Do not add Zod, a form library, or a state manager. `useState` plus a typed
  draft is enough here, and feature 2 needs to be able to reshape line item state
  without fighting a library choice made early.
- shadcn's init may need manual adjustment for React Router 8 and Tailwind v4.
  Adjust `components.json` paths and the alias to match this repo rather than
  restructuring the repo to match it.
- `prototypes/` is reference, not code. Do not import from it, and do not delete
  it; `/complete` handles that at the end of this feature.

## Findings

Resolved findings from this feature, archived at their final status. IDs are
prefixed with the archive name so they stay unique across the project.

### 01/F-01 [P1] closed - Pinned due date is silently overwritten after a refresh

**File:** app/components/invoice/InvoiceDetailsFields.tsx:33
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `dueDatePinned` is component state, so it resets to `false` on
every mount. The draft itself survives a refresh, but the fact that the user took
the due date over does not. Reproduced in the browser: set due date to
`2027-03-15`, reload, change the issue date to `2026-08-20`, and the due date is
silently rewritten to `2026-09-19`. A date the user deliberately entered is lost
with no indication, on the field that decides when an invoice is overdue.
**Suggested fix:** derive the pinned state from the draft instead of storing it
separately: the due date is pinned when `dueDate !== addDays(issueDate, 30)`. A
fresh draft is never pinned, and a due date deliberately set to exactly +30 days
behaves identically either way, so no extra field has to be persisted.
**Resolution:** Fixed 2026-08-13 by /implement. `dueDatePinned` is now derived
from the draft in `InvoiceDetailsFields.tsx`; the `useState` is gone. Re-ran the
original repro in the browser: due date `2027-03-15` held after a reload and an
issue-date change to `2026-08-20` (previously became `2026-09-19`). The
within-session rule still holds: on a fresh draft, issue `2026-11-05` moved due
to `2026-12-05`.

Re-reviewed 2026-08-13 by /audit (scope: current). The original defect is gone:
the repro no longer reproduces. **Held at `fixed` rather than closed** because
the repair introduced a narrower version of the same data loss, recorded as
F-07. Closing this entry requires a repair that leaves no new defect behind.

Re-reviewed again 2026-08-14 by /audit (scope: current), after F-07 was
repaired. Verified independently in the browser rather than on the implement
pass's evidence: due date `2026-11-30` written to sessionStorage, page reloaded,
issue date changed to `2026-09-09`, due date held at `2026-11-30`. The
derivation is now total across all four issue/due states. **Closed.**

### 01/F-03 [P3] closed - Browser test artifacts are not ignored by git

**File:** .gitignore:203
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** Playwright MCP writes `.playwright-mcp/` (page snapshots and
console logs) and screenshot PNGs into the project root. Neither is ignored, and
`/complete` stages everything on the branch, so a browser check run shortly
before completing would commit throwaway artifacts into the feature commit.
**Suggested fix:** add `.playwright-mcp/` to `.gitignore`, and direct screenshots
to that folder or the scratchpad rather than the repo root.
**Resolution:** Fixed 2026-08-13 by /implement. `.playwright-mcp/` added to
`.gitignore`; `git check-ignore -v` confirms the rule matches at line 206.
Screenshots are written to the scratchpad instead of the repo root.

Re-reviewed 2026-08-13 by /audit (scope: current): rule verified against a probe
file, `git status` clean of artifacts after several browser runs. Closed.
Residual, not a defect: a screenshot requested with a bare filename still lands
in the repo root, since only the `.playwright-mcp/` directory is ignored. The
mitigation is to keep writing screenshots to the scratchpad.

### 01/F-07 [P2] closed - Clearing the issue date drops the pinned due date

**File:** app/components/invoice/InvoiceDetailsFields.tsx:31
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** Introduced by the F-01 repair. `dueDatePinned` is guarded by
`Boolean(draft.issueDate)`, so an empty issue date reads as unpinned no matter
what the due date holds. Reproduced in the browser: set due date to `2027-03-15`,
clear the issue date, retype it as `2026-08-20`, and the due date is silently
rewritten to `2026-09-19`. Same class of silent data loss as F-01, on a narrower
path: the previous component-state version preserved the pin across this
sequence, so this is a regression rather than a leftover.
**Suggested fix:** compare against a default that is empty when there is no issue
date, instead of short-circuiting on it:
`const defaultDueDate = draft.issueDate ? addDays(draft.issueDate, DUE_DATE_OFFSET_DAYS) : "";`
then `const dueDatePinned = draft.dueDate !== defaultDueDate;`. That keeps the pin
when the issue date is blank but a due date is set, and still reads as unpinned
during the pre-hydration window when both are blank.
**Resolution:** Fixed 2026-08-14 by /implement. `dueDatePinned` now compares
against a `defaultDueDate` that is the empty string when there is no issue date,
so no case short-circuits the comparison. `handleIssueDate` clears an unpinned
due date when the issue date is cleared, which keeps "both blank" the only
unpinned blank state; without that, clearing the issue date on an untouched
draft would have left a stale default behind that then read as pinned. Verified
in the browser: pinned due `2027-03-15` survived clearing and retyping the issue
date, an untouched draft still cleared and re-derived its due date, and the F-01
refresh case still holds (reload, issue date to `2026-12-01`, due stayed
`2027-03-15`). Console clean, no hydration warnings.

Re-reviewed 2026-08-14 by /audit (scope: current). Replayed the repro
independently on a cleared session: issue `2026-08-14`, due `2027-03-15`, issue
cleared, issue retyped `2026-08-20`, due held `2027-03-15`. Walked all four
issue/due states against the new derivation and found no path where a
user-entered due date is rewritten by a later action. **Closed.** The repair does
carry one residual tradeoff, recorded separately as F-08; it is a different and
much smaller defect, not a survival of this one.
