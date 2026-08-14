# Feature: Print-ready invoice HTML

**From build-plan:** feature 5a
**Status:** complete

## Goal

Turn a draft that arrived over the wire into the exact HTML document that becomes
the PDF: validated, rendered through the template registry, sized to a letter
page, and carrying its own styles.

This is the half of feature 5 that can be proved without Cloudflare. Browser
Rendering only runs against a remote Worker, so building the document and the
rendering call together would put most of the feature behind evidence we cannot
gather locally. 5a ends with an endpoint that returns HTML you can open in a
browser and compare to the preview; 5b keeps the route, the validation, and the
errors exactly as they are and swaps the response body for a PDF.

## In scope

- `parseDraft(value: unknown): InvoiceDraft | null`, field by field, for a draft
  that arrived in a request body
- Reusing that same validation for the stored draft, which closes F-05, F-12,
  and F-24
- The app's compiled stylesheet, reachable from Worker code
- `buildPrintDocument(draft): string`: one standalone HTML document, letter page
  geometry, styles inlined, the chosen template rendered through
  `InvoiceDocument`
- `POST /invoice/pdf`: the route, its body size guard, its validation, and its
  error responses, returning `text/html` until 5b makes it a PDF
- Deciding, and recording, where the document's typeface comes from

## Out of scope

- **Browser Rendering, `@cloudflare/puppeteer`, and the `browser` binding**
  (5b). This feature adds no Cloudflare dependency and no wrangler binding.
- **The Download button** (5b). Nothing in the editor changes; the endpoint is
  reached with `curl` or the browser's address bar until 5b wires the UI.
- **Rate limiting** (feature 15). The size guard here is a payload guard, not a
  quota. 5b's notes should carry the quota warning to feature 15.
- **Saved invoices** (features 7 and 11). No `/invoices/:id/pdf`, no storage, no
  session. This endpoint is anonymous and stateless by design.
- **Headers, footers, and page numbers on the printed page.** Multi-page
  behavior is whatever the browser does by default; controlling it is 5b's
  business at the earliest, and more likely a later feature.
- **Logo images** (feature 13). The document stays free of `<img>`.

## The document

One file, no network dependencies except the typeface (below), no scripts.

```
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Invoice INV-0001</title>
    <style>  compiled app CSS, then the print rules  </style>
  </head>
  <body>
    <div class="page">  InvoiceDocument, resolved from draft.templateId  </div>
  </body>
</html>
```

**Page geometry.** `@page { size: Letter; margin: 0 }`, and the `.page` wrapper
is `8.5in` wide with `min-height: 11in`. The templates already carry their own
padding, which becomes the printed margin, so the PDF matches the preview
exactly rather than adding a second margin around it. The cost is recorded
rather than discovered later: Compact's `px-8 py-7` is about a 0.3in margin, and
a PDF printed on a physical printer could clip inside its non-printable area.
That is acceptable for a document meant to be emailed, and it is the same trade
the preview already makes on screen.

**The typeface is a real decision, not a detail.** The app loads Inter from
Google Fonts through `root.tsx`, not through `app.css`, so a document that
inlines only the compiled stylesheet would render in whatever sans the headless
browser falls back to, and the PDF would silently not match the preview. This
feature includes the same Google Fonts `<link>` in the document, which means the
render depends on fonts.googleapis.com being reachable. The hardening option, if
that dependency ever bites, is to embed Inter as base64 `woff2` in the inlined
CSS; it is recorded here and deliberately not done now, because it adds a font
file to the repo and roughly 100KB to every document. Classic's serif needs
nothing either way: it is a system stack on purpose.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Validate a draft from anywhere** - `parseDraft(value: unknown):
  InvoiceDraft | null` in `app/lib/invoice-draft.ts`, checking every field the
  type declares: `version`, the string fields, both party objects with their
  nine string fields, `lineItems` with real numbers in `quantity`, `rate`, and
  `total`, and `templateId` through `resolveTemplateId`. It returns `null` for
  anything it cannot vouch for rather than repairing it. Then `readStoredDraft`
  calls it instead of `isStoredDraft`, so the browser and the Worker share one
  rule. *Done when:* `pnpm test` covers a valid draft, a missing version, a
  party object missing fields (F-05), a line item with a missing or non-numeric
  `total` (F-12), an unregistered `templateId` normalizing to the default
  (F-24), a null, an array, a string, and a draft with extra unknown keys; and
  the editor still restores a normal draft after a refresh.

- [x] **Step 2 - The compiled stylesheet, from Worker code** - a module that
  exposes the app's built CSS as a string, via `import css from "~/app.css?inline"`.
  *Done when:* the imported string contains a compiled utility such as
  `.bg-paper{`, does **not** contain the source directive `@import "tailwindcss"`,
  and `pnpm build` passes. If `?inline` yields the unprocessed source, fall back
  to importing the built asset's URL (`?url`) and fetching it once per isolate,
  and record which path was taken and why.

- [x] **Step 3 - The print document** - `buildPrintDocument(draft, styles =
  PRINT_STYLES): string` in `app/lib/print-document.server.ts`. The styles are a
  defaulted argument because step 2 found `PRINT_STYLES` is empty under Vitest,
  which has no Tailwind plugin; tests pass their own string, matching the
  standards' preference for passing a dependency in over faking it. It builds: the shell above, the `@page` rule, the
  `.page` wrapper, the font link, and `renderToStaticMarkup(<InvoiceDocument
  draft={draft} />)`. *Done when:* `pnpm test` proves the output starts with
  `<!doctype html>`, carries `@page` with `Letter`, contains the invoice number
  and a line item's name, places the styles it was given inside the
  `<style>` tag, contains no `<script`, and changes with `templateId`; and writing the output to a file and opening it in
  a browser shows a document that matches the preview pane. Screenshot beside
  the editor.

- [x] **Step 4 - The endpoint** - `POST /invoice/pdf` as a resource route in
  `app/routes/invoice.pdf.tsx`, added to `app/routes.ts`. It reads the JSON
  body, refuses anything over `MAX_DRAFT_BYTES`, validates with `parseDraft`,
  and returns `buildPrintDocument`'s string as `text/html; charset=utf-8`.
  Anything else returns a status and a short message, never an internal error or
  a stack. *Done when:* posting a real draft returns HTML that opens and matches
  the preview; a malformed body, a valid JSON non-draft, and a draft with a
  tampered `templateId` each return 400 without reaching the renderer; a body
  over the cap returns 413; a `GET` returns 405; and the Worker log carries no
  unhandled error for any of them.

## Files / areas

- `app/lib/invoice-draft.ts` - `parseDraft`, and `readStoredDraft` using it
- `app/lib/invoice-draft.test.ts` - its coverage
- `app/lib/print-styles.ts` - the compiled CSS as a string
- `app/lib/print-document.server.ts` - new, `buildPrintDocument`
- `app/lib/print-document.test.ts` - new
- `app/routes/invoice.pdf.tsx` - new, the resource route
- `app/routes.ts` - registers it

## Data / contracts

**5b builds directly on these three.** It replaces one line inside the route and
nothing else.

```ts
// app/lib/invoice-draft.ts
export function parseDraft(value: unknown): InvoiceDraft | null;

// app/lib/print-document.server.ts
export function buildPrintDocument(draft: InvoiceDraft): string;
export const MAX_DRAFT_BYTES: number;

// POST /invoice/pdf
// body: the InvoiceDraft as JSON, nothing wrapping it
// 200 text/html (5a) -> 200 application/pdf (5b)
// 400 invalid draft | 413 too large | 405 wrong method
```

Rules 5b and later features depend on:

- **`parseDraft` takes `unknown`, never throws, and never repairs.** A draft it
  cannot vouch for is `null`, because a half-valid invoice is worse than no
  invoice. It is the only validation between an untrusted body and a render, and
  the same function guards `sessionStorage`.
- **The document is self-contained apart from the font link.** No scripts, no
  images, no stylesheet requests beyond the one this feature deliberately
  accepts. 5b feeds this string straight to a headless browser.
- **`buildPrintDocument` is pure and synchronous.** Same rule the templates
  already follow, for the same reason.
- **The route stays the route.** 5b keeps the path, the method, the body shape,
  the size guard, and the error codes; only the success body changes.
- **The size guard runs before validation, and validation before rendering.** An
  oversized or malformed body must never reach `renderToStaticMarkup`, and in 5b
  must never reach Browser Rendering, which is the expensive call the overview
  calls out.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic, each shipping its tests in the same diff:

- `parseDraft` (step 1) - the full list in that step's done-when
- `buildPrintDocument` (step 3) - shell, page rule, inlined CSS, template
  selection, absence of `<script`

Step 2 is a build-time import proved by an assertion on the string. Step 4 is an
integration surface and rides on real requests plus browser evidence, per the
scope rule in `coding-standards.md`.

Verify by hand at the end:

- Post a filled draft and open the returned HTML beside the editor preview
- Do it for all three templates and confirm each matches its preview
- Post an empty draft and confirm the document still reads as an invoice
- Post `{}`, `[]`, `"nope"`, and a truncated JSON string, and confirm each is a
  400 with no stack
- Post a draft padded past the cap and confirm 413
- Open the returned HTML with the network throttled to offline and note what the
  missing font does, so the risk is seen once rather than assumed

## Notes for the AI

- **Browser Rendering is not part of this feature.** If a step reaches for
  `@cloudflare/puppeteer` or a `browser` binding, it belongs to 5b.
- **This endpoint is anonymous and stateless.** No session, no D1, no R2, per the
  tier line in `coding-standards.md`.
- `renderToStaticMarkup`, not `renderToString`: the document is never hydrated,
  and static markup leaves out React's comment markers.
- The `.server.ts` suffix on the document builder keeps it out of the client
  bundle; the CSS string it inlines is large and the browser already has it.
- `parseDraft` replaces `isStoredDraft`, which should go rather than linger
  beside it as a second, weaker rule.
- Follow `coding-standards.md`: strict TypeScript, no `any`, thrown `Response`
  or `data(..., { status })` for error cases, tabs for indentation, comment the
  why.
- No em dashes in code, comments, or commit messages.
