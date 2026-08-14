# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P2] open - Ported theme tokens duplicate shadcn tokens with the same values

**File:** app/app.css:20
**Why it matters:** `--color-surface` (#ffffff), `--color-surface-sunken`
(#f0f2f5), `--color-border-strong` (#cdd2d9), and `--color-accent-wash` (#eff4ff)
repeat the values already held by shadcn's `--card`, `--muted`, `--input`, and
`--accent`. Two names for one color drift apart the first time someone retunes
the palette through one of them, and nothing in the build catches it. The
duplicate set is also currently unreferenced, so nothing would reveal the drift
until a later feature used the stale half.
**Found:** 2026-08-13 by /audit (scope: current)
**Suggested fix:** keep only the tokens shadcn has no equivalent for
(`--color-paper*`, `--color-status-*`, `--color-faint`) and delete the four
duplicates, or define them as aliases such as
`--color-surface: var(--card)` so a single edit moves both.
**Resolution:**

### F-04 [P3] open - Unused exports in the draft module

**File:** app/lib/invoice-draft.ts:3
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `DRAFT_VERSION`, `DRAFT_STORAGE_KEY`, `DEFAULT_CURRENCY`,
`DEFAULT_TEMPLATE_ID`, `DEFAULT_INVOICE_NUMBER`, and `toIsoDate` are exported but
used only inside their own module. `coding-standards.md` calls for no unused
exports. Several are plausible API for features 7 and 8, so this is a judgment
call rather than dead code.
**Suggested fix:** drop `export` from the ones nothing outside the module needs,
and re-export them when a caller appears. Leaving them is defensible if you
prefer the module to read as a public API.
**Resolution:**

### F-05 [P3] open - A tampered draft with a partial party object breaks its inputs

**File:** app/lib/invoice-draft.ts:52
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `isStoredDraft` checks that `billFrom` and `billTo` are
objects but not that they hold the nine expected string fields. A stored draft
whose party object is missing keys passes the guard, and `value[field]` then
returns `undefined`, which flips a controlled input to uncontrolled and logs a
React warning. Only reachable by editing sessionStorage by hand, since the app
always writes whole drafts, so the risk is low.
**Suggested fix:** merge the parsed draft over `createEmptyDraft()` (including
both party objects) before returning it, so missing keys fall back to empty
strings.
**Resolution:**

### F-06 [P3] open - CSS-only packages sit in runtime dependencies

**File:** package.json:17
**Found:** 2026-08-13 by /audit (scope: current)
**Why it matters:** `shadcn` and `tw-animate-css` are reached only through
`@import` in `app/app.css`, which is build-time input, yet they sit in
`dependencies` while `tailwindcss`, imported the same way, sits in
`devDependencies`. `shadcn` in particular pulls the whole CLI tree into a
production install, which works against the clone-and-run self-hosting story.
**Suggested fix:** move both to `devDependencies` to match how `tailwindcss` is
already treated, then confirm `pnpm build` still passes.
**Resolution:**

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

### F-09 [P3] fixed - Spec describes an Invoices nav item the app bar does not render

**File:** app/components/AppBar.tsx:10
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Step 4 of `current-feature.md` describes the app bar as
"brand mark, Editor and Invoices nav"; the built app bar has only Editor. The code
is right and the spec is stale: `/invoices` does not exist until feature 9, and
rendering a link to it would be exactly the dead control the spec's Out of scope
section forbids. The mismatch matters only because `/complete` archives this spec
as the record of what shipped, so the archive would misdescribe the app bar.
**Suggested fix:** reword step 4 to "brand mark and Editor nav; Invoices arrives
with feature 9" before `/complete` archives it. Documentation only, no code
change.
**Resolution:** Fixed 2026-08-14 by /implement. Step 4 of `current-feature.md`
now describes the app bar as it was actually built and records why Invoices is
absent. No code change; the app bar was already right.
