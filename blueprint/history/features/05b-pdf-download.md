# Feature: PDF download

**From build-plan:** feature 5b
**Status:** complete

## Goal

Turn the document 5a already builds into a PDF the user downloads, with no
account. This is the end of the free path: open the app, fill in an invoice, pick
a template, press a button, get a file worth sending to a client.

5a left exactly one line to change on the server. The rest of this feature is the
browser binding, the download itself, and the states around a call that takes a
second or two and can fail.

## In scope

- `@cloudflare/puppeteer` and the `browser` binding in `wrangler.json`
- Rendering the print document to a PDF inside the Worker and streaming it back
- `POST /invoice/pdf` returning `application/pdf` instead of `text/html`, with
  the same route, guards, and status codes 5a set
- A download filename derived from the invoice number, and safe to put in a
  header
- A Download PDF button in the editor, with its pending and error states
- Closing the browser session on every path, including failure

## Out of scope

- **Rate limiting** (feature 15). See the warning below: this is the feature that
  makes that gap expensive, and shipping this to production without it is a
  decision worth making deliberately.
- **Saved invoices** (features 7 and 11). No `/invoices/:id/pdf`, no storage.
  This endpoint stays anonymous and stateless.
- **Caching a rendered PDF.** The overview defers this until render cost is a
  real problem, and it needs a stored invoice with an `updatedAt` to key on.
- **Headers, footers, page numbers, and multi-page tuning.** Whatever the browser
  does by default is what ships; controlling it needs its own feature.
- **Emailing the invoice.** Nothing sends anything; the user downloads a file.
- **A print stylesheet beyond what 5a already wrote.** The `@page` rule and the
  letter sized wrapper exist.

## The warning worth reading before building

Browser Rendering is the only expensive call this app makes, and after this
feature an anonymous request reaches it. On the free tier that is **10 minutes of
browser time a day, 3 concurrent sessions, and 6 requests a minute**. A render
takes roughly one to three seconds, so a few hundred requests exhaust the daily
quota, and the app is already deployed at a public URL.

The overview calls rate limiting a deploy blocker for exactly this. Two honest
options, and this feature does not decide between them:

1. Build 5b, and do not deploy until feature 15 lands.
2. Build 5b and feature 15 back to back, deploying after both.

Either way, the spec keeps the guards in front of the browser call so that
nothing malformed, oversized, or repeated by mistake gets that far.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The binding, and nothing else** - add `@cloudflare/puppeteer` as
  a dependency, add `"browser": { "binding": "BROWSER" }` to `wrangler.json`, and
  run `pnpm cf-typegen`. No route change yet. *Done when:*
  `worker-configuration.d.ts` declares `BROWSER` on `Env`, `pnpm typecheck` and
  `pnpm build` pass, and `pnpm check`'s dry run lists the browser binding
  alongside the existing var.

- [x] **Step 2 - The filename** - `pdfFilename(invoiceNumber: string): string` in
  `app/lib/print-document.server.ts`, returning something like `INV-0007.pdf`.
  The invoice number is user input that arrives in a request body and is about to
  be interpolated into a `Content-Disposition` header, so it is sanitized: keep
  letters, digits, dash, underscore, and dot; collapse everything else; fall back
  to `invoice.pdf` when nothing usable survives. *Done when:* `pnpm test` covers
  a normal number, one with spaces, one with a slash, one with a quote or newline
  (the header injection case), an empty string, a very long number being
  truncated, and one made only of punctuation.

- [x] **Step 3 - Render the PDF** - in the route, replace the HTML response with
  a Browser Rendering call: launch from
  `context.get(cloudflareContext).env.BROWSER`, open a page, set the document 5a
  builds as its content, and take `page.pdf({ format: "Letter", printBackground:
  true })`. Close the browser in a `finally` so a thrown render never leaves a
  session open. A render failure returns 502 with a short message, never a stack.
  *Done when:* against a remote Worker, posting a draft returns
  `application/pdf` whose bytes start with `%PDF-`; the file opens; all three
  templates render with their backgrounds and the right faces; the guards still
  return 400, 405, and 413 without reaching the browser; and `puppeteer.sessions()`
  shows no session left open after a failed render.

- [x] **Step 4 - The Download button** - a `DownloadPdfButton` in the app bar,
  where `blueprint/reference/editor-mockup.html` draws it as the primary action
  beside the later Sign in and Save. It posts the current draft to the endpoint,
  turns the response into a file, and takes the name from the response's
  `Content-Disposition` rather than importing `pdfFilename`, which lives in a
  server only module: one sanitizer, on the server, not a second copy shipped to
  the browser. It is disabled with a pending label while the
  render runs, and shows a short inline error when the endpoint refuses.
  *Done when:* clicking it downloads a PDF of what the preview shows; the button
  reads as busy for the whole render and cannot be pressed twice; a forced
  failure shows the message rather than a silent nothing; the file is named from
  the invoice number; the console is clean; and it is reachable and operable by
  keyboard.

## Files / areas

- `package.json` - `@cloudflare/puppeteer`
- `wrangler.json` - the `browser` binding
- `worker-configuration.d.ts` - regenerated, not hand edited
- `app/lib/print-document.server.ts` - `pdfFilename`
- `app/lib/print-document.test.ts` - its coverage
- `app/routes/invoice.pdf.tsx` - the render call and the PDF response
- `app/components/invoice/DownloadPdfButton.tsx` - new
- `app/routes/editor.tsx` - mounts the button

## Data / contracts

```ts
// app/lib/print-document.server.ts
export function pdfFilename(invoiceNumber: string): string;

// POST /invoice/pdf
// body: the InvoiceDraft as JSON, unchanged from 5a
// 200 application/pdf, Content-Disposition: attachment; filename="INV-0007.pdf"
// 400 invalid draft | 413 too large | 405 wrong method
// 502 render failed | 503 out of browser quota, with Retry-After
```

Rules this feature must hold to:

- **The guards keep their order and their meaning.** Size, then parse, then
  validate, then render. The browser call is last because it is the expensive
  one, and 502 is new precisely because it means "we got that far".
- **Running out of quota is not a crash.** The free tier allows one new browser
  every twenty seconds and ten minutes of browser time a day, and step 3 hit that
  ceiling during testing. Cloudflare answers with a 429, and the endpoint turns
  it into a 503 with `Retry-After` and a message that says to try again shortly,
  because "something went wrong" is the wrong thing to tell someone who only has
  to wait. Every other render failure stays a 502.
- **The browser session is closed on every path.** A `finally`, not a happy path
  close. A leaked session counts against three concurrent on the free tier and
  expires only after ten minutes.
- **`buildPrintDocument` does not change.** Its output is the input to the
  renderer. If the PDF looks wrong, the fix is here or in a template, not in a
  second document builder.
- **The endpoint returns a PDF or an error, never HTML.** No debug format
  parameter on a public route.
- **Nothing is stored.** No R2, no D1, no cache. The PDF is generated per request
  and streamed, which is what the overview decided.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic: `pdfFilename` (step 2), which is the only pure function this
feature adds, and it is worth testing because it guards a response header.

Steps 1, 3, and 4 are configuration, an external service call, and UI. They ride
on the dry run, remote evidence, and screenshots, per the scope rule in
`coding-standards.md`.

**Verification uses a remote binding, not a deploy.** Step 1 found that the
browser binding takes `"remote": true`, which points the local dev server at the
real service, so renders are provable on localhost after all. They are real
renders against the account's quota: the free tier allows six a minute, and
testing hit that ceiling during step 3.

Verify by hand at the end:

- Download from a filled invoice in each of the three templates and open all
  three files
- Confirm Classic's filled table header band survives, which is what
  `printBackground` is for
- Download from an empty draft and confirm a readable one page document
- Confirm the file name follows the invoice number, then set the number to
  `../../etc/passwd` and confirm the download is still named sanely
- Add thirty line items and confirm the PDF runs to a second page without a row
  sliced in half
- Force a failure and confirm the button recovers rather than staying stuck
- Watch the quota: `puppeteer.limits()` before and after a few renders

## Notes for the AI

- **`page.setContent` is the intended call, and it is not in the Cloudflare docs
  I could reach.** Every published example uses `page.goto(url)`. Prove
  `setContent` works in step 3 before building step 4 on it. If it does not, the
  documented fallback is the REST `/pdf` endpoint, which accepts raw `html` and
  `addStyleTag`; it costs an API token and an account id as secrets, which the
  self-hosting story would rather avoid, so it is the contingency and not the
  plan.
- Wait for the document to settle before taking the PDF. It links a webfont, so
  the render should not fire the moment the content is set or the file may be
  set in a fallback face.
- Bindings reach the route through `context.get(cloudflareContext)`, never a
  module level global.
- One browser, one page, per request. Do not launch twice, and do not hold a
  session open between requests without a reason to.
- The button is client state: pending and error live in the component, not in the
  draft. Nothing about a download belongs in `InvoiceDraft`.
- `pnpm cf-typegen` regenerates `worker-configuration.d.ts`. Never hand edit it.
- Follow `coding-standards.md`: strict TypeScript, no `any`, thrown `Response` or
  `data(..., { status })` for errors, tabs, comment the why.
- No em dashes in code, comments, or commit messages.
