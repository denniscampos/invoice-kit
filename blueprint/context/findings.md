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
`DEFAULT_TEMPLATE_ID`, `DEFAULT_INVOICE_NUMBER`, `toIsoDate`, and (added by
feature 2) `createLineItem` are exported but used only inside their own module. `coding-standards.md` calls for no unused
exports. Several are plausible API for features 7 and 8, so this is a judgment
call rather than dead code.
**Suggested fix:** drop `export` from the ones nothing outside the module needs,
and re-export them when a caller appears. Leaving them is defensible if you
prefer the module to read as a public API.
**Resolution:** Still open, list revised 2026-08-14 by /audit (scope: current).
Feature 4 moved `DEFAULT_TEMPLATE_ID` to `app/lib/invoice-templates.ts`, where
`invoice-draft.ts` now imports it, so it leaves this list with a real cross-module
caller. The remaining six are unchanged. Feature 4 also added one new instance of
the same pattern: `PartyAddressLine` in `app/lib/format.ts:47` is exported with no
importer, since the templates infer the type from the function's return. Same
judgment call, same fix. Updated again the same day: the F-20 repair gave
`PartyAddressLine` a real importer in `CompactTemplate.tsx`, so it leaves this
list too. The original six from feature 1 and 2 are what remain.

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

### F-19 [P2] open - The editor scrolls sideways on a phone-width screen

**File:** app/routes/editor.tsx:70
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** At a 360px viewport the document is 526px wide, so the whole
page scrolls horizontally and the right edge of every card sits off screen.
Measured in the running app: the form column reports 502px against a 345px
document width. The two-column grid is correctly gated behind the `editor`
breakpoint, so this is a minimum width inside the stacked column, not the grid.
Predates feature 4: the same 526px and 502px were measured with feature 4's work
stashed, with and without the template switcher present, so the switcher is a
passenger rather than the cause.
**Suggested fix:** the cause was located on 2026-08-14 by a later /audit pass:
`LineItemsCard.tsx:31` sets `grid-cols-[32px_1fr_78px_110px_104px_32px]`, whose
five fixed tracks and five 8px gaps come to 396px before the description column
gets anything, and the card and page padding carry it the rest of the way to the
measured 502px. Give the row a narrow-screen layout below the `editor`
breakpoint, or let the fixed tracks shrink there. `min-w-0` on the grid items is
usually the missing half of the fix, since grid children default to
`min-width: auto` and refuse to shrink past their content.

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

### F-27 [P3] open - An unstyled print document would ship silently

**File:** app/lib/print-styles.ts:11
**Found:** 2026-08-14 by /audit (scope: full)
**Why it matters:** `PRINT_STYLES` is whatever `?inline` hands back, and under
Vitest that is an empty string because no Tailwind plugin runs there. The
production build was verified to carry the compiled CSS, so this is correct
today, but nothing checks it: if a config change ever broke the plugin chain, the
endpoint would keep returning 200 with a structurally perfect, completely
unstyled document, and the first person to notice would be whoever opened the
PDF. The failure is silent in exactly the artifact nobody re-reads before sending
it to a client.
**Suggested fix:** assert it once where it is cheap. A build-time check that the
emitted server bundle contains a known compiled utility is the honest version,
since the unit suite cannot see the real string. A runtime guard in the route
that refuses to render with empty styles is the smaller version and still beats
silence.

**Resolution:**

### F-30 [P2] fixed - The deployed render endpoint has no throttle in front of it

**File:** app/routes/invoice.pdf.tsx:56
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** `POST /invoice/pdf` is live at the public URL and reaches
Browser Rendering with no per-caller limit. On the Workers Free plan the account
gets ten minutes of browser time a day and one new browser every twenty seconds,
and a render costs three to four seconds, so roughly a hundred and fifty requests
exhaust the day for everyone. The guards in front of the call are all about the
shape of the request, not how often it arrives: a valid draft posted in a loop is
refused by nothing. `project-overview.md` names this as a deploy blocker in as
many words.

Deployed knowingly: the user chose to stay on the free tier with rate limiting as
the guard rail, and then asked for the deploy before that work landed. This entry
exists so the exposure is recorded rather than living only in the roadmap.
**Suggested fix:** feature 15, which is the next build-plan item. Cloudflare's
rate limiting binding keyed on client IP is the smallest version; a 429 with
`Retry-After` matches what the endpoint already returns for exhausted quota, and
the Download button already renders that message.

**Resolution:** Repaired in part 2026-08-15 by /implement, feature 15. Two rate
limiters now sit in front of the render endpoint: `PDF_LIMITER` at two requests a
minute per caller, keyed on `CF-Connecting-IP`, and `PDF_GLOBAL_LIMITER` at five
a minute across everyone. The check runs after the method test and before the
body is read, so a flood is refused at the door, and it answers 429 with
`Retry-After: 60` and a sentence the Download button already displays.

Verified against the running Worker: a third post inside a minute from one caller
is refused with 429 while a different caller still succeeds; spoofing
`X-Forwarded-For` on every request does not earn a fresh allowance, which is the
mistake this would most easily have made; a request with no `CF-Connecting-IP`
shares one strict bucket rather than skipping the check; and zero renders were
attempted across the whole throttle test, so nothing reached Browser Rendering.
The limits were then tuned down from 5 and 20 because evidence showed the
original numbers sat above the platform's own ceiling and so never fired first.

**In part**, deliberately. Two gaps remain and neither is closed by this work:

1. The binding's window is only 10 or 60 seconds, so this is a burst guard, not a
   daily budget. A slow drip from many addresses could still exhaust the ten
   minutes of browser time a day without tripping any window. Closing that needs
   a counter that survives a day, which means KV or a Durable Object, and that is
   a storage decision worth taking on its own.
2. Cloudflare starts one browser every twenty seconds, which is a spacing rule a
   fixed window cannot express, so two clicks a few seconds apart can still meet
   a 503 from the quota rather than our 429. A short client side cooldown on the
   Download button would close it.

Leaving this `fixed` rather than closed is the point: an /audit pass should look
at the remaining exposure and decide whether it deserves its own entry.

### F-31 [P3] open - The download's object URL is revoked in the same tick as the click

**File:** app/components/invoice/DownloadPdfButton.tsx:32
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** `saveBlob` creates an object URL, clicks a detached anchor,
and revokes the URL on the next line. Chromium starts the download synchronously
inside `click()`, so this works, and it was verified working in Chromium: a real
click produced `INV-0001.pdf` at 92KB. The pattern is known to be fragile
elsewhere, because revoking is what tells the browser the blob can go, and a
browser that begins the transfer after the current task can find the URL already
dead. The anchor also never enters the document, which older Firefox required.
Neither was tested outside Chromium, so this is a portability risk on the app's
one output, not an observed break.
**Suggested fix:** revoke on a later turn rather than immediately, and append the
anchor before clicking and remove it after. Both are one line and neither costs
anything in the browser where it already works.

**Resolution:**

### F-32 [P3] open - Classic's serif is a different face in the PDF than in the preview

**File:** app/components/invoice/templates/ClassicTemplate.tsx:27
**Found:** 2026-08-15 by /audit (scope: full)
**Why it matters:** Classic asks for `ui-serif, Georgia, "Times New Roman",
serif`, deliberately a system stack so the document needs no webfont. The
headless browser that renders the PDF runs on Linux, where none of those exist,
so it resolves to Liberation Serif: confirmed by reading the font table of a
rendered file, which embeds LiberationSerif and LiberationSerif-Bold alongside
Inter. The result is a perfectly respectable Times-like invoice, but a user on a
macOS browser approves a preview set in Georgia and downloads a file set in
something else, which is a dent in the "what you see is what downloads" promise
the preview exists to make. Minimal and Compact are unaffected, because Inter is
a webfont and loads in both places.
**Suggested fix:** either accept it and say so in the Classic template's comment,
so the next person does not treat it as a bug, or give Classic a webfont serif
the way the app already treats Inter, at the cost of a second font request in the
document feature 5a deliberately keeps light. Worth deciding with feature 13,
which is the next time the document's assets are opened.

**Resolution:**
