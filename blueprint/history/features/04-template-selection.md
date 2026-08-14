# Feature: Template selection

**From build-plan:** feature 4
**Status:** complete

## Goal

Give the invoice more than one look. The user picks a template from the preview
bar, the paper re-renders in it immediately, and the choice rides along in the
draft so a refresh keeps it.

It also turns the single component feature 3 built into a **registry**: an id to
component map with a resolution rule. Feature 5 needs exactly that, because the
anonymous PDF endpoint receives a draft over the wire and has to pick a template
from an untrusted string on the Worker.

## Design reference

- **`blueprint/reference/editor-mockup.html`** - the switcher is already in the
  mockup, in the preview bar: `.template-switch`, a segmented control of three
  buttons using `aria-pressed`, right-aligned after a spacer next to the "Live
  preview" label. It names the three templates: **Minimal**, **Classic**,
  **Compact**.
- **`blueprint/reference/invoice-mockup.html`** - the Minimal paper, already
  built in feature 3 and unchanged by this feature.

What the mockup pins down for the switcher:

- Sits in the existing preview bar, after `Live preview` and its green dot
- A track with a sunken background, 2px padding, 2px gaps, small radius
- The active segment is a raised white pill: surface background, full-strength
  ink, medium weight, small shadow; the rest are muted text on transparent
- `text-xs` throughout, `3px 10px` padding per segment

**Classic and Compact have no mockup**, so the next section specifies them
instead. That is defensible here and would not be for feature 1: these are not
replications of an existing design, they are two new arrangements of a document
whose content, tokens, and type scale are already fixed by Minimal. The
constraint is tight enough that prose pins them down.

## The three templates

They differ by what the user needs the document to do, not by decoration. One
default, one that reads as conventional, one that saves paper.

| | Minimal | Classic | Compact |
| --- | --- | --- | --- |
| For | the default; design-literate freelancers | clients and accountants who expect a formal invoice | long item lists that should stay on one page |
| Face | sans | serif for text, sans for figures | sans |
| Base size | 14px | 14px | 11px |
| Header | initial square, left-aligned title, meta opposite | centered `INVOICE`, no square, meta below the parties | one line: sender name left, number and dates right |
| Table | hairline rules | filled header band, ruled rows | header underline only |
| Total | single rule | double rule | single rule |

**Minimal** is what feature 3 built and this feature does not touch it beyond
the party lines extraction. It stays the default: it is what anonymous drafts
open in and what every screenshot so far shows.

**Classic** is the traditional business document.

- `--font-serif` on the paper's text: title, headings, party blocks, body,
  footer
- `INVOICE` centered in caps with letterspacing, the invoice number centered
  beneath it in muted text, no initial square
- A 2px `paper-ink` rule under the header, full width
- Parties side by side under `From` and `Bill to` as now, then the issue date,
  due date, and terms below them as a labelled row across the width rather than
  in the header
- Table header on a `paper-rule` band with ink text instead of a hairline
  underline; every row keeps its rule
- Totals block right-aligned as now, with a double rule above `Total due`
- Footer unchanged in content, serif in face

**Compact** is the dense one. Same content, less paper.

- 11px base, headings at 9px, `Total due` at 15px rather than 18px
- Paper padding `px-8 py-7`, row padding `py-[6px]`, section gap `gap-5`
- One header line: sender's name at the left, `Invoice INV-0001` and the issue
  and due dates inline at the right. No initial square, no stacked meta block
- Parties as two short paragraphs side by side, address lines run together with
  separators rather than one per line
- Rules under the table header and above the total only
- Payment terms and notes on one footer line each, not a two column block

Nothing is dropped to save space. If a field is populated it appears in all
three, which is the rule that makes switching safe.

## In scope

- A template registry: id, label, and component, with one resolution rule
- `InvoiceDocument`, the single component the preview and later the PDF render;
  it resolves `draft.templateId` and renders the right template
- Two new templates, **Classic** and **Compact**, alongside the existing
  **Minimal**
- The segmented switcher in the preview bar, writing `draft.templateId`
- Falling back to the default template for an unknown, missing, or non-string
  `templateId`, since a stored or posted draft can carry anything
- Extracting the party address line derivation once a second template needs it

## Out of scope

- **PDF generation** (feature 5). This feature hands feature 5 a registry it can
  call on the Worker; it renders nothing to PDF and adds no route.
- **Per-template color, font, or branding options.** Three fixed templates, no
  customization surface.
- **Template thumbnails or a preview gallery.** The switcher is text segments,
  as the mockup draws it.
- **A default template setting** (feature 22) and **user-authored templates**
  (not planned). The default stays the constant in code.
- **Logo image** (feature 13). Every template keeps the initial square or its
  own equivalent; none renders an `<img>`.
- **Tax and discount rows** (feature 19). Each template shows subtotal and total,
  which are still the same number.
- **Full draft validation.** F-05 and F-12 (party and line item fields are not
  validated field by field) stay open. This feature validates `templateId` only,
  because that is the field it introduces a consumer for.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The registry, with one template in it** - new
  `app/lib/invoice-templates.ts` holding the `InvoiceTemplateId` union, the
  `INVOICE_TEMPLATES` list of `{ id, label }` in switcher order,
  `DEFAULT_TEMPLATE_ID` (moved here from `invoice-draft.ts`, which imports it
  back so there is one source of truth), and
  `resolveTemplateId(value: unknown): InvoiceTemplateId`. Move
  `InvoiceTemplate.tsx` to `templates/MinimalTemplate.tsx` with its markup
  untouched, add `templates/index.tsx` mapping id to component and exporting
  `InvoiceDocument`, and point `PreviewPane` at `InvoiceDocument`. Register
  Minimal only; Classic and Compact land in later steps. *Done when:* `pnpm test`
  proves `resolveTemplateId` returns the id for each registered id and the
  default for `undefined`, `null`, `""`, `"nope"`, a number, and an object; the
  editor renders exactly as before with no visual change; and `pnpm build`
  passes.

- [x] **Step 2 - Classic** - extract the party address line derivation out of
  `MinimalTemplate` into `partyAddressLines(party: Party)` in `app/lib/format.ts`
  (returning the `{ text, numeric }` list feature 3 built, minus the name) and
  have Minimal use it, then add `templates/ClassicTemplate.tsx` and register it,
  built to the Classic spec above. *Done when:* `pnpm test` covers
  `partyAddressLines` (all fields, none, city without region, region without
  city, postal code alone); Minimal renders identically to before the extraction;
  and setting `templateId` to `"classic"` in sessionStorage and reloading renders
  the classic document with every field the filled draft holds. Screenshot beside
  Minimal.

- [x] **Step 3 - The switcher** - `TemplateSwitcher.tsx` rendering
  `INVOICE_TEMPLATES` as the mockup's segmented control, mounted in the preview
  bar, calling back into the editor's `patchDraft` with the chosen id. Pressed
  state compares against `resolveTemplateId(draft.templateId)`, not the raw
  value, so a garbage id still shows the default segment pressed rather than
  none. *Done when:* clicking a segment re-renders the paper in that template
  immediately; the pressed segment matches the mockup's raised pill; the choice
  survives a page refresh; a fully filled invoice keeps every field across a
  switch in both directions; the group is reachable and operable by keyboard with
  a visible focus ring and announces as "Invoice template"; the bar still reads
  cleanly at 360px wide; and the console is clean. Screenshot against
  `blueprint/reference/editor-mockup.html`.

- [x] **Step 4 - Compact** - `templates/CompactTemplate.tsx`, registered, built
  to the Compact spec above. *Done when:* it appears in the switcher without
  touching `TemplateSwitcher` (this is the registry proving itself); the same
  eight line item draft renders at least a third shorter than in Minimal,
  measured on the paper's rendered height; every populated field is still
  present; the empty draft still reads as a document with no `undefined`, `NaN`,
  or `Invalid Date`; and `pnpm build` passes. Screenshot of all three side by
  side.

- [x] **Repair F-21 - Classic's labels go serif** - drop `font-sans` from
  Classic's `LABEL` so the small caps headings match the spec's serif rule,
  leaving `FIGURES` as the one deliberate sans exception. *Done when:* the
  computed face on `From`, the meta labels, the table head, and the footer
  headings is the serif stack, the money column is still sans, and the document
  is screenshotted.

- [x] **Repair F-20 and F-22 - Compact's separators and its repeated name** -
  the separator glyph keeps real spaces around it outside the `aria-hidden` span,
  and Compact's `From` block drops the name the header already carries, rendering
  its address lines alone and disappearing when there are none. *Done when:* the
  accessible text of the address reads with spaces between the fields, the
  sender's name appears exactly once in both the filled and empty states, every
  populated field is still present, and `pnpm test` stays green.

## Files / areas

- `app/lib/invoice-templates.ts` - new, the registry's data and resolution
- `app/lib/invoice-templates.test.ts` - new, `resolveTemplateId`
- `app/lib/invoice-draft.ts` - imports `DEFAULT_TEMPLATE_ID` instead of owning it
- `app/lib/format.ts`, `app/lib/format.test.ts` - `partyAddressLines`
- `app/components/invoice/templates/index.tsx` - new, id to component,
  `InvoiceDocument`
- `app/components/invoice/templates/MinimalTemplate.tsx` - moved from
  `InvoiceTemplate.tsx`
- `app/components/invoice/templates/ClassicTemplate.tsx` - new
- `app/components/invoice/templates/CompactTemplate.tsx` - new
- `app/components/invoice/TemplateSwitcher.tsx` - new
- `app/components/invoice/PreviewPane.tsx` - renders `InvoiceDocument`, hosts the
  switcher
- `app/app.css` - `--font-serif` token for Classic
- `app/routes/editor.tsx` - unchanged if `PreviewPane` keeps taking the draft and
  an `onChange`; pass `patchDraft` through

## Data / contracts

**This is the contract feature 5 builds on.** It renders the chosen template to a
string inside the Worker, from a draft that arrived in a request body.

```ts
// app/lib/invoice-templates.ts
export type InvoiceTemplateId = "minimal" | "classic" | "compact";

export const INVOICE_TEMPLATES: { id: InvoiceTemplateId; label: string }[];
export const DEFAULT_TEMPLATE_ID: InvoiceTemplateId;
export function resolveTemplateId(value: unknown): InvoiceTemplateId;

// app/components/invoice/templates/index.tsx
export function InvoiceDocument({ draft }: { draft: InvoiceDraft }): ReactElement;
```

Rules those features depend on:

- **`resolveTemplateId` takes `unknown` and never throws.** Its input is a
  sessionStorage value today and a request body tomorrow. `isStoredDraft` does
  not check `templateId` at all, so this function is the only thing standing
  between a tampered draft and a render.
- **`draft.templateId` stays `string`, not the union.** It mirrors a D1 text
  column and holds untrusted input; narrowing happens at resolution, not in the
  stored shape.
- **The registry is a plain synchronous module.** No `lazy`, no dynamic
  `import()`, no browser-only imports anywhere in it or the templates it maps, or
  the Worker cannot render a template by id.
- **Every template obeys feature 3's template contract**: pure, SSR safe, no
  state, no effects, no `window`, no clock, no event handlers, page geometry left
  to the container, money through `formatMoney`, totals through
  `invoiceSubtotal`, no `dark:` variants inside the paper.
- **No template may drop a field the draft holds.** The templates differ in
  arrangement and weight, never in content, so switching cannot lose information
  and the PDF always shows what the preview showed.
- **Labels live in the registry only.** Nothing hardcodes a template name in
  JSX, which is what makes step 4 a registration rather than an edit.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic, each shipping its test in the same diff:

- `resolveTemplateId` (step 1) - every registered id, plus `undefined`, `null`,
  `""`, an unregistered string, a number, and an object
- `partyAddressLines` (step 2) - all fields, none, city without region, region
  without city, postal code alone, so the comma and space joining is pinned

Steps 3 and 4 are UI and ride on screenshots plus `pnpm build`, per the scope
rule in `coding-standards.md`.

Verify by hand at the end:

- Fill the whole form, then switch through all three templates and confirm every
  field you typed is present in each one
- Refresh after switching and confirm the template held
- Switch templates with an empty draft and confirm each still reads as an invoice
- Set `templateId` to `"nope"` in sessionStorage, reload, and confirm the paper
  renders Minimal with the Minimal segment pressed
- Tab to the switcher and operate it from the keyboard
- Compare the bar against `blueprint/reference/editor-mockup.html`
- Narrow to 360px and confirm the bar is still usable
- Console clean on load and while switching

## Notes for the AI

- **Move `InvoiceTemplate.tsx`, do not copy it.** Step 1 is a rename plus a
  registry; if the diff shows markup changes inside Minimal, the step went wrong.
- **Extract the shared party lines at step 2, not step 1.** The second consumer
  is what justifies the helper. Do not go looking for more to extract: the three
  templates are meant to have different markup, and a shared layout component
  parameterized by six props would defeat the point of having templates.
- Classic's serif is a system stack (`ui-serif, Georgia, "Times New Roman",
  serif`) behind a `--font-serif` theme token. No webfont, no network request in
  the document, because feature 5 renders it in a headless browser.
- **Keep Classic's figures in the sans face.** Georgia ships old style figures,
  which sit at different heights and do not align in a money column even with
  `tabular-nums`. Serif goes on the text; the rate, amount, total, and date
  values keep `--font-sans` with tabular figures. Mixing them is deliberate, not
  an oversight to tidy up later.
- Compact's density has to come from the type scale and padding, not from
  hiding fields or truncating text. The address lines still wrap; they are just
  set tighter.
- The green dot and "Live preview" label stay exactly as they are; the switcher
  is added beside them, and the bar gets `flex-wrap` so the segments drop to a
  second line rather than crushing the label on a narrow screen.
- Hydration: `templateId` starts at the default on the server and is replaced by
  the stored draft in the existing mount effect, the same path the dates take.
  Do not read sessionStorage during render.
- Keep the switcher a `role="group"` of `aria-pressed` buttons as the mockup
  draws it, rather than a `Select`. It is a two to three item choice that should
  be visible at a glance next to the thing it changes.
- Follow `coding-standards.md`: strict TypeScript, no `any`, functional
  components, Tailwind classes only, tabs for indentation, comment the why.
- No em dashes in code, comments, or commit messages.
- `blueprint/reference/` is read-only and survives `/complete`.

## Findings

Resolved findings from this feature, archived at their final status. IDs are
prefixed with the archive name so they stay unique across the project.

### 04/F-20 [P3] closed - Compact's separators leave the address as run-on text for a screen reader

**File:** app/components/invoice/templates/CompactTemplate.tsx:200
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** Compact sets the address as running text with `|` separators
in `aria-hidden` spans, and there is no whitespace outside those spans. Assistive
technology drops the separator and gets the fields with nothing between them.
Read out of the running app: the visible text is
`Acme Studio|118 Fremont Street|San Francisco, CA 94105|...` while the accessible
text is `Acme Studio118 Fremont StreetSan Francisco, CA 94105United States...`.
The same pattern is in the header's dates and the line item description cell.
Minimal and Classic are unaffected; their lines are block elements.
**Suggested fix:** keep the glyph hidden but leave a real space in the accessible
text, either by emitting `{" "}` outside the `aria-hidden` span or by moving the
separator into a `before:` pseudo-element so it never enters the DOM's text at
all. The second also removes the character from any text extracted from the PDF
in feature 5.

**Resolution:** Fixed 2026-08-14 by /implement. The separator is now a single
`Separator` component used by all three sites (the header dates, the address
lines, the item description), and the spaces around the glyph are real text nodes
outside the `aria-hidden` span rather than CSS margins. The pseudo-element option
was rejected: Chrome exposes `content` text in the accessibility tree, so it would
have put the glyph straight back.

Verified in the running app by stripping every `aria-hidden` node from a clone and
reading the text back: `118 Fremont Street San Francisco, CA 94105 United States
billing@acmestudio.co +1 415 555 0132 EIN 84-2910773`, and the item cell reads
`Brand identity system Logo, type scale, and colour`. One measurement artifact
worth recording so nobody chases it: `textContent` shows the header as
`Acme StudioInvoice INV-0007`, but the name and the meta are separate block
elements, and reading it back through `innerText` after layout gives
`Acme Studio | Invoice INV-0007 Issued 13 Aug 2026 Due 12 Sep 2026`. No defect
there.

Re-reviewed 2026-08-14 by /audit (scope: current). Read the repaired code and
confirmed the separator is one component with the spaces outside the hidden span,
used at all three sites with no fourth site left on the old pattern. Reproduced
independently in the running app: both addresses and the item cell read with
spaces between every field, and a jammed-word scan over the accessible text of
the address blocks came back clean. **Closed.**

### 04/F-21 [P3] closed - Classic's small caps labels are sans, against the spec's serif rule

**File:** app/components/invoice/templates/ClassicTemplate.tsx:23
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The approved spec puts `--font-serif` on the paper's text
including headings. The built `LABEL` constant carries `font-sans`, so `From`,
`Bill to`, the meta band labels, the table head, and the footer headings are all
set in Inter while the body around them is serif. It was a deliberate call during
the build (10px letterspaced uppercase is cleaner in a sans face) but it was not
recorded, so the code and the spec disagree and the next person cannot tell which
one is wrong.
**Suggested fix:** decide it either way and make the two agree. Keeping sans
means one line in the spec's Classic description; going serif means dropping
`font-sans` from `LABEL` and leaving it only on `FIGURES`, which is a separate
and better justified exception.

**Resolution:** Fixed 2026-08-14 by /implement. `font-sans` dropped from
Classic's `LABEL`, so the code now follows the spec rather than the spec being
edited to match the code. `FIGURES` keeps the sans face as the single exception,
which is the one with a technical reason behind it.

Verified by reading the computed face off the rendered document: `From`, the meta
labels, the table head, the description cell, and the footer are all `ui-serif`,
while the meta values and the amount column stay `Inter`. Screenshotted; the
small caps read better in Georgia than they did in Inter, so this was worth more
than consistency alone.

Re-reviewed 2026-08-14 by /audit (scope: current). Computed faces read back off
the document: party heading, meta label, table head, description cell, and footer
all `ui-serif`; meta value and amount cell `Inter`. The repair did introduce a
separate problem in the same constant, recorded as F-25: `HEAD_CELL` appends
`text-paper-ink` after `LABEL`'s `text-paper-muted` and loses. That is a colour
defect that predates this repair, not a survival of the font defect. **Closed.**

### 04/F-22 [P3] closed - Compact prints the sender's name twice

**File:** app/components/invoice/templates/CompactTemplate.tsx:47
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** The header line opens with the sender's name and the `From`
block below repeats it, so on a filled invoice `Acme Studio` appears twice within
about 40px, and on an empty draft the placeholder `Your business` does the same.
It follows the spec as written, which asks for both the one line header and the
two party paragraphs, so this is a design question the spec did not notice rather
than a coding mistake.
**Suggested fix:** drop the name from the `From` block and let the header carry
it, keeping the address lines under the heading. The field stays on the page, so
the no dropped field rule still holds. Confirm against the other two templates
first, since it makes Compact's `From` block structurally different from theirs.

**Resolution:** Fixed 2026-08-14 by /implement. Compact's `From` block no longer
prints the name the header line already carries: it renders the address lines
alone, and disappears entirely when the sender has no address, since a heading
with nothing under it is worse than no heading. `Bill to` keeps its name, which
appears nowhere else. `PartyBlock` split into `SenderBlock` and `ClientBlock`
rather than growing a boolean prop, and both share a new `AddressLines`.

Verified in the running app: the sender's name occurs exactly once on the filled
invoice, and the empty draft now reads `Your business` as the letterhead with
`Bill to / Client name` below, instead of `Your business` twice. Field parity
still holds (214 tests green, including the empty draft placeholders for all
three templates). Note this deviates from the spec's Compact description, which
asked for two party paragraphs; the spec did not anticipate the repetition.

Re-reviewed 2026-08-14 by /audit (scope: current). Counted independently in the
running app: `Acme Studio` once, `Northwind Trading` once, and none of the seven
sampled fields missing. Read the new `SenderBlock`, `ClientBlock`, and
`AddressLines`: the split is two small components sharing one helper rather than
a flag on the old one, and the null return when a sender has no address lines is
the only new branch, exercised by the empty draft. **Closed.**
