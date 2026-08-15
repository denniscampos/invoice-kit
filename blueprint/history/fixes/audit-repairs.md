

## Findings

The findings this fix repaired, archived at their final status. IDs are
prefixed with the archive name so they stay unique across the project.

### audit-repairs/F-05 [P3] closed - A tampered draft with a partial party object breaks its inputs

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
**Resolution:** Fixed 2026-08-14 by /implement, during feature 5a. `isStoredDraft`
is gone, replaced by `parseDraft`, which checks all nine string fields of both
party objects and discards the draft when any is missing rather than merging
defaults into it. Discarding beat merging because a half-real invoice that looks
complete is worse than an empty editor.

Verified in the browser with the finding's own repro, a stored draft whose
`billFrom` is `{ name: "Acme Studio" }`: the editor opens on a clean empty draft,
every input is controlled, and the console is silent.

Re-reviewed 2026-08-14 by /audit (scope: full). Read the replacement: `parseParty`
walks a `PARTY_FIELDS` list and returns null on the first non-string, so a partial
party cannot pass. Reproduced independently against the running endpoint with the
finding's own payload: 400, refused before the renderer. `isStoredDraft` has no
remaining references in `app/`. **Closed.**

### audit-repairs/F-12 [P3] closed - Stored line items are not validated field by field

**File:** app/lib/invoice-draft.ts:62
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `isStoredDraft` checks only that `lineItems` is an array, so
a stored draft whose items lack `total` or `rate` passes the guard.
`formatMinorUnits(undefined)` then renders `NaN.NaN` in the Amount column, and
`invoiceSubtotal` returns `NaN` for the whole invoice. This is the same tampering
path as F-05 and needs the same answer; it is recorded separately because it is a
new surface that feature 2 introduced, not a restatement of the party-object gap.
**Suggested fix:** whatever fixes F-05 should cover line items too: validate the
numeric fields per item and drop the stored draft when they do not hold, rather
than merging defaults into a half-real invoice.
**Resolution:** Fixed 2026-08-14 by /implement, during feature 5a. `parseDraft`
validates every line item field by field: `id`, `name`, and `description` must be
strings, `quantity` finite, and `position`, `rate`, and `total` integers. NaN and
Infinity are rejected explicitly, since both pass a `typeof` check and then print
as `NaN` on the invoice, and a fractional cent is rejected as corruption of the
minor-units rule.

Verified with a stored line item holding only `id`, `position`, and `name`: the
draft is discarded, the document renders no `NaN`, and the console is silent.

Re-reviewed 2026-08-14 by /audit (scope: full). `parseLineItem` requires strings
for `id`, `name`, and `description`, a finite `quantity`, and integers for
`position`, `rate`, and `total`, with `NaN` and `Infinity` rejected explicitly.
Verified independently: a stored item missing `total` is refused with 400 at the
endpoint, and the suite covers the same shape plus a non-numeric total, a NaN
total, an infinite quantity, and a fractional cent. **Closed.**

### audit-repairs/F-24 [P3] closed - An unrecognized templateId survives in the stored draft

**File:** app/lib/invoice-draft.ts:153
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `resolveTemplateId` protects rendering, so a garbage
`templateId` shows the default template with the default segment pressed, which
was verified in the browser with `"nope"`. The stored value itself is left alone,
though: `isStoredDraft` does not look at `templateId`, and the draft is written
back verbatim. It is harmless while the draft only lives in `sessionStorage`, but
feature 7 maps this draft onto the D1 `Invoice` row, so today's tampered value is
tomorrow's stored column, and feature 5 posts the same draft to the PDF endpoint.
**Suggested fix:** normalize on the way in rather than only at render, by running
`resolveTemplateId` over the parsed draft inside `readStoredDraft`. That keeps one
rule in one place and pairs naturally with the same fix for F-05 and F-12, which
are the other two halves of validating a stored draft field by field.

**Resolution:** Fixed 2026-08-14 by /implement, during feature 5a, by the route
the finding recommended: `parseDraft` runs `resolveTemplateId` over the incoming
value, so normalization happens on the way in rather than only at render, and
`readStoredDraft` now returns a draft whose `templateId` is always renderable.
It is the one field normalized rather than rejected, because the registry already
answers for it.

Verified with `templateId: "nope"` in sessionStorage: the restored draft carries
`minimal`, the Minimal segment is pressed, and a later write cannot persist the
tampered value back.

Re-reviewed 2026-08-14 by /audit (scope: full). `parseDraft` runs
`resolveTemplateId` on the way in, so the normalization is no longer only at
render time and `readStoredDraft` cannot return an unrenderable id. Verified at
the endpoint: `templateId: "nope"` returns 200 and the markup is byte-identical
to Minimal's. **Closed.** The comment on `resolveTemplateId` still describes the
old arrangement; that is recorded separately as F-29 rather than left inside this
entry.

### audit-repairs/F-25 [P3] closed - Classic's table head asks for ink and silently renders muted

**File:** app/components/invoice/templates/ClassicTemplate.tsx:88
**Found:** 2026-08-14 by /audit (scope: current)
**Why it matters:** `HEAD_CELL` is built as `${LABEL} px-2 py-2.5 text-paper-ink`,
and `LABEL` already ends in `text-paper-muted`. Two utilities set the same
property, so the winner is decided by their order in the generated stylesheet,
not by their order in the class attribute, and muted wins. Measured on the
rendered document: the head cell computes to `rgb(92, 102, 114)` (paper-muted)
while the paper's ink is `rgb(20, 24, 29)`. The spec asks for a `paper-rule` band
with ink text, so the band is lower contrast than intended against its own grey
background, and the `text-paper-ink` in the source is a no-op that reads as
working. Predates the F-21 repair, which changed the face in `LABEL` and not the
colour. The `${CELL} text-paper-muted` strings in all three templates are the
benign version of the same shape: `CELL` carries no colour, so nothing is
shadowed there.
**Suggested fix:** stop composing a colour into a constant that already sets one.
Drop `text-paper-muted` from `LABEL` and let each site state its own colour, which
also makes the muted default explicit at the four places that want it. A
`twMerge`-style helper would fix the precedence too, but the project has no such
wrapper today and one utility conflict does not justify introducing one.

**Resolution:** Fixed 2026-08-14 by /implement. `LABEL` no longer carries a
colour, so nothing is being overridden: the head cell keeps `text-paper-ink` and
the four muted uses state `text-paper-muted` themselves. The comment on the
constant now records why composing a colour in and overriding it at a use site
cannot work.

Verified by computed style in the running app: the table head reads
`rgb(20, 24, 29)`, the same as the paper's ink, while the party heading, meta
label, and footer heading all still read `rgb(92, 102, 114)`. The face is
`ui-serif` throughout, so F-21's decision is intact. Screenshotted: the head band
now reads at full strength against its grey.

Re-reviewed 2026-08-14 by /audit (scope: current). Read the change: `LABEL` now
sets type only, the head cell keeps `text-paper-ink`, and each of the three muted
uses states `text-paper-muted` itself, so nothing is being overridden anywhere.
Confirmed independently by computed style in the running app: the table head is
`rgb(20, 24, 29)` while the party heading, meta label, and footer heading are all
`rgb(92, 102, 114)`, and every one of them is still `ui-serif`, so the F-21
decision survived the repair. **Closed.**

### audit-repairs/F-26 [P2] closed - The render endpoint buffers the whole body before it checks the size

**File:** app/routes/invoice.pdf.tsx:44
**Found:** 2026-08-14 by /audit (scope: full)
**Why it matters:** The cheap guard reads `content-length` and refuses anything
over `MAX_DRAFT_BYTES`, but a request can simply omit that header. The real
measurement happens after `await request.text()`, which has already pulled the
entire body into memory as a string. Confirmed against the running Worker with an
8MB payload sent chunked with no `content-length`: the response is a correct 413,
but it takes roughly twice as long as the header-rejected case, which is the body
being read before the refusal. 8MB is harmless; the ceiling is not ours to pick,
since Cloudflare accepts request bodies up to 100MB while a Worker isolate has
128MB of memory, and a JS string is UTF-16. This is the one unauthenticated route
in the app, and feature 15's rate limiting does not exist yet, so the same
request can be repeated. The overview names this risk directly: the endpoint
"must not accept an invoice large enough to be a denial-of-service payload".
**Suggested fix:** read `request.body` through a reader with a running byte count
and abandon the request the moment it passes `MAX_DRAFT_BYTES`, rather than
calling `.text()` and measuring afterwards. Roughly ten lines, and it keeps the
existing 413 and its message. Worth doing before feature 5b puts Browser
Rendering behind this route, and before feature 17 deploys it.

**Resolution:** Fixed 2026-08-14 by /implement. `readBoundedText` in the new
`app/lib/request.server.ts` reads `request.body` through its reader, counts bytes
as they arrive, and cancels the stream the moment the total passes the cap, so an
oversized body is refused without ever being held. The route calls it in place of
`request.text()` and the measurement that followed. `MAX_DRAFT_BYTES`, the 413,
its message, and the guard order are unchanged.

Proved by unit test rather than by timing: a body offering fifty 1KB chunks
against a 4KB limit stops after fewer than ten, which is the cancellation doing
its job. Also covered: exactly at the limit, one byte over, no body, ninety
accented characters refused against a 100 byte limit because they are 180 bytes,
and an emoji split across two chunks decoding intact.

Verified at the endpoint: an 8MB body returns 413 both with and without
`content-length`, and the chunked case dropped from about 18ms to about 9ms,
matching the header-rejected case rather than doubling it. A draft carrying
`Åkersberga Ångpanneföreningen` and an emoji still renders both correctly.

Re-reviewed 2026-08-14 by /audit (scope: current). Read `readBoundedText` line by
line. The running total is added before the limit test and the chunk is only kept
after it passes, so the buffer can never exceed the limit; `cancel()` is awaited
rather than the loop being broken; and the decode happens once over the joined
bytes rather than per chunk. The route's `content-length` check, the 413, its
message, and the guard order are all unchanged, which is what feature 5b builds
on.

Independent evidence: the suite proves a fifty chunk body against a 4KB limit
stops after fewer than ten reads, which is the cancellation, and that ninety
accented characters are refused against a 100 byte limit because they are 180
bytes. At the endpoint an 8MB body returns 413 with and without `content-length`,
a normal draft still returns 200, and a draft carrying Nordic characters and an
emoji round trips intact. **Closed.**

### audit-repairs/F-28 [P3] closed - The font origins are told apart by array position

**File:** app/lib/fonts.ts:12
**Found:** 2026-08-14 by /audit (scope: full)
**Why it matters:** `FONT_ORIGINS` is a two element array, and `root.tsx` puts
`crossOrigin: "anonymous"` on `FONT_ORIGINS[1]` because that one happens to be
the `gstatic` host. The distinction is real, it is required, and it is recorded
nowhere except the order of the array. Reordering the constant would quietly move
`crossorigin` onto the wrong origin, which degrades the preconnect rather than
breaking it, so nothing would fail loudly.
**Suggested fix:** export the two origins under their own names, so the one that
needs `crossorigin` says so.

**Resolution:** Fixed 2026-08-14 by /implement. `FONT_ORIGINS` is gone, replaced
by `FONT_CSS_ORIGIN` and `FONT_FILE_ORIGIN`, and the comment on the second says
why it is the one that takes `crossorigin`. `root.tsx` and the print document
both use the names.

Verified in the running app: two preconnects, `fonts.googleapis.com` with no
`crossOrigin` and `fonts.gstatic.com` with `anonymous`.

Re-reviewed 2026-08-14 by /audit (scope: current). `FONT_ORIGINS` has no
remaining references in `app/`. The two origins are separate named exports, and
the one that needs `crossorigin` carries a comment saying why. Verified in both
consumers rather than only the source: the app's rendered head and the print
document each emit `fonts.googleapis.com` bare and `fonts.gstatic.com` with
`crossorigin`. **Closed.**

### audit-repairs/F-29 [P3] closed - resolveTemplateId's comment describes an arrangement that no longer exists

**File:** app/lib/invoice-templates.ts:22
**Found:** 2026-08-14 by /audit (scope: full)
**Why it matters:** The comment says "isStoredDraft does not check templateId at
all, so this is the only thing standing between a tampered draft and a render".
`isStoredDraft` was deleted in feature 5a, and `parseDraft` now calls
`resolveTemplateId` on the way in, so neither half of that sentence is true. It
is the only reference to `isStoredDraft` left in `app/`, and it describes the
function as a last line of defence when it is now one of two. A comment that
explains a design that was replaced is worse than no comment, because it is read
as current.
**Suggested fix:** say that the id is normalized wherever an untrusted draft
enters, `parseDraft` on the way in and the registry at render, and that both call
this.

**Resolution:** Fixed 2026-08-14 by /implement. The comment now describes the
arrangement that exists: `parseDraft` normalizes on the way in and the registry
normalizes again at render, two callers sharing one rule, neither trusting the
other. `grep -rn isStoredDraft app/` returns nothing.

Re-reviewed 2026-08-14 by /audit (scope: current). The comment now describes both
callers and claims nothing about `isStoredDraft`, which has no references left in
`app/`. **Closed.**
