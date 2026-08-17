# Feature: Print

**From build-plan:** feature 23
**Status:** complete

## Goal

Let anyone print the invoice from the browser, on both tiers, so reaching paper
never spends a Browser Rendering call.

This finishes the free path that items 1 through 5 started. The overview's promise
is that a one-off user fills in the form, presses Print or Download, and leaves;
today only Download exists, so paper costs the account's most expensive and most
rationed call, and stops working entirely once the day's render budget is spent.

## Design reference

**No new visual target on screen.** The printed page is the target, and it already
exists: the PDF is what the invoice is supposed to look like on paper. Printing
should produce the same document, so the reference is
`app/lib/print-document.server.ts` and the three templates it renders.

The one new piece of screen UI is a Print button beside Download PDF, matching it.

## In scope

- One home for the page geometry, so Print and Download cannot drift apart
- Print styles that reduce the app page to the invoice document alone
- A Print button in the app bar, on the editor and the detail page, both tiers
- Long invoices printing every page rather than the part that was on screen

## Out of scope

- **A print route or any server work.** The overview is explicit: printing is the
  browser's own dialog over the current page, needs no route, and costs nothing
  per use. Nothing here touches the Worker.
- **Printing the dashboard.** `/invoices` has no invoice document on it, so it
  keeps the browser's default behaviour. A print stylesheet for a table of
  invoices is a different feature nobody has asked for.
- **Page numbers, headers, or footers.** Browsers add their own from the print
  dialog and the user controls them there. The PDF has none either, so adding them
  only to print would break the parity this feature exists to keep.
- **Choosing paper size.** Letter, as the PDF already fixes. A4 belongs with the
  locale work in feature 22, where F-15 and F-18 also wait, and it should change
  both outputs at once.
- **Print preview inside the app.** The preview pane already shows the document
  and the browser's dialog shows the paged version.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - find out whether the PDF sees `@media print`, and put the page
  geometry in one place** - `app.css` is inlined into the PDF document by
  `PRINT_STYLES`, so every rule this feature adds there reaches the PDF as well.
  Establish which media the PDF renders under before writing any of them. Then move
  `@page` and the break-avoidance rules out of `PAGE_STYLES` and into an
  `@media print` block in `app.css`, leaving `.page` behind as the document's own
  wrapper. *Done when:* a real PDF render still comes back Letter-sized, one page
  for a short invoice, visually unchanged against a render taken before the move;
  and if it turns out the PDF does not apply print media, the move is reverted and
  the duplication kept with a comment saying why, which is a valid outcome of this
  step rather than a failure.

  **Settled during the build: the PDF renderer does apply print media.** A
  temporary `@media print { body::before { content: "MEDIA-PRINT-ACTIVE" } }` rule
  appeared in the extracted text of a rendered PDF, so the move went ahead and the
  geometry now has one home. The PDF is unchanged by it: 1 page, MediaBox
  `0 0 612 792`, identical extracted text, identical byte count (95,221) before and
  after. A unit test in `print-document.test.ts` failed on the move and was
  rewritten rather than deleted: it now asserts the paper box, which is still this
  module's, and records that the page size is proven by a real render because
  `PRINT_STYLES` is empty under Vitest.

- [x] **Step 2 - the app page prints as the invoice alone** - add the print rules:
  hide the app bar, the form column, the preview's chrome bar and template
  switcher, and the detail page's header strip; neutralise the preview frame's
  border, rounding, shadow, background, padding, and its scroll container's height
  cap; give the document the paper box. *Done when:* with print media emulated on
  `/`, the app bar, form, and preview chrome are all absent and the invoice
  document is the only thing on the page; printing to PDF from the browser
  produces a Letter page that matches the server-rendered PDF of the same invoice;
  an invoice with enough line items to run past one page prints every page with
  nothing clipped by the preview's scroll area; and the same holds on
  `/invoices/:id`.

- [x] **Step 3 - the Print button** - add it beside Download PDF on both the
  editor and the detail page, calling `window.print()`. *Done when:* the button
  appears for a signed-out visitor and a signed-in user on both pages, opens the
  browser's print dialog, and is itself absent from the printed output; and the bar
  still does not scroll sideways at 320px, measured, with the fallback below if it
  does not fit.

  **Measured during the build: it does not fit.** With Print in the bar, both `/`
  and `/invoices/:id` came to 336px inside a 320px screen and scrolled sideways.
  The fallback was applied, so Print is visible from `sm` up and hidden below,
  which is the rule the nav already follows. Back to 305/305 on both pages.

## Files / areas

| File | Why |
| --- | --- |
| `app/app.css` | the `@media print` rules and the page geometry |
| `app/lib/print-document.server.ts` | `PAGE_STYLES` loses what moved, keeps `.page` |
| `app/components/invoice/PreviewPane.tsx` | chrome marked as not printing, frame neutralised |
| `app/components/invoice/PrintButton.tsx` | new: the button |
| `app/routes/editor.tsx` | the button in the bar |
| `app/routes/invoices.$id.tsx` | the button in the bar, header strip not printing |
| `app/components/AppBar.tsx` | the bar does not print |

## Data / contracts

**Nothing stored, nothing posted, no route.** This feature adds no server code at
all, which is the point of it.

**The page geometry becomes a shared contract.** Today `@page { size: Letter;
margin: 0 }` and the break rules live in `PAGE_STYLES`, a string the PDF document
carries. After step 1 they live in `app.css` and both outputs read them from
there. That is the whole reason step 1 exists: two copies of "what a printed
invoice page is" would let Print and Download disagree, and the overview's promise
is that what you see is what downloads, which now extends to what prints.

**The `.page` wrapper stays in the document builder**, because only the PDF
document has one. On the app page the same box has to be produced by print rules
against markup that was laid out for the screen.

**`@media print` in `app.css` is not app-only.** `PRINT_STYLES` inlines the
compiled stylesheet into the PDF document, so anything added under that media
query is also present in the PDF's `<style>`. Step 1 settles what that means
before step 2 writes rules that assume an answer. If the PDF does render under
print media, then step 2's chrome-hiding rules will also be live inside it,
harmlessly, because the PDF document contains no app bar or form to hide; the
layout resets are the ones to keep an eye on.

**If the button does not fit at 320px**, it follows the rule the nav already
follows: visible from `sm` up, hidden below, recorded as a known gap rather than
squeezed. F-45 measured that bar as exactly full at 320px, and this adds to it.
Printing from a phone is the least likely path to paper, so it is the right thing
to drop first, and saying so is better than discovering it in an audit.

## Testing

The gate is **on** (`AGENTS.md` declares `pnpm test`), and this feature adds no
in-scope logic: it is a stylesheet, a one-line click handler, and a constant
moving between two files. There is nothing with an assertable input and output, so
every step rides on browser evidence and the build, which is the documented
exemption rather than a gap.

**The evidence has to be real print output, not a reading of the CSS.** Print
rules are exactly the kind of thing that looks right and behaves differently, and
`display: none` on the wrong ancestor produces a blank page rather than an error.
So: emulate print media for the DOM checks, and print the page to PDF through
Chromium for the paged ones, comparing against a server-rendered PDF of the same
invoice.

**Step 1 costs one Browser Rendering call** for the before-and-after comparison,
and step 2 costs one more for the parity check. Both are worth it; that is four or
five of the day's slots at most, and the alternative is asserting parity without
looking.

**Manual pass**, at the end:

1. On `/` as a signed-out visitor, fill in an invoice and press Print: the dialog
   shows the invoice alone, on Letter paper.
2. Add line items until the document runs past one page: the dialog shows both
   pages, complete.
3. Sign in, open a saved invoice, press Print: the same, with no header strip.
4. Print `/invoices`: unchanged browser default, because that is out of scope.

## Notes for the AI

- **Do not add a route, an action, or any server code.** If a step seems to need
  one, stop: the feature has been misread.
- **Do not touch the templates.** They already render the document the PDF proves
  correct, and F-23 is standing evidence that a change to one has to be made to
  three. The print rules act on the containers around them.
- **Establish the PDF's media before writing print rules**, not after. It is the
  one thing in this feature that could break something expensive and already
  working.
- **Prefer Tailwind's `print:` variant** on the components that own their markup,
  and keep `app.css` for the page geometry and anything that has to reach across
  the document. Do not scatter the geometry into components.
- **Check the scroll container specifically.** `PreviewPane` caps the document's
  height with `editor:max-h-[calc(100vh-11rem)] overflow-auto`, which on paper
  would clip a long invoice at whatever was visible. This is the most likely bug
  in the feature and the least visible one.
- The button is client-side and trivial: `window.print()`. It needs no fetcher, no
  state, and no pending label, because the browser takes over the moment it is
  pressed.
