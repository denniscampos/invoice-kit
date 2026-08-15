# Fix: Clear the actionable audit findings

**Type:** Fix
**Fixes:** F-34, F-31, F-27, F-19, F-02, F-04, F-06, F-32
**Status:** complete

## The problem

Eight findings from the ledger that are clear enough to repair without deciding
anything new. Grouped because most are one or two lines and none of them
interact.

| ID | Where | What is wrong |
| --- | --- | --- |
| F-34 [P3] | `app/routes/invoice.pdf.tsx:81` | The rate limiter call sits outside every try/catch: a rejection becomes a bare 500 with nothing in the log, and the fail open or closed choice is made by accident |
| F-31 [P3] | `DownloadPdfButton.tsx:32` | The download's object URL is revoked in the same tick as the click, on an anchor never added to the document. Works in Chromium, fragile elsewhere |
| F-27 [P3] | `app/lib/print-styles.ts:11` | Nothing detects an unstyled print document: if the stylesheet import ever came back empty the endpoint would keep returning a perfect, styleless PDF |
| F-19 [P2] | `LineItemsCard.tsx:31` | The line item grid's fixed tracks total 396px before the description column, so the editor scrolls sideways on a phone |
| F-02 [P2] | `app/app.css:20` | Four theme tokens duplicate shadcn's with identical values, and all four are unreferenced |
| F-04 [P3] | `app/lib/invoice-draft.ts:3` | Five exports have no caller anywhere, tests included |
| F-06 [P3] | `package.json:17` | `shadcn` and `tw-animate-css` are build time only but sit in runtime dependencies |
| F-32 [P3] | `ClassicTemplate.tsx:27` | Classic's system serif resolves to Liberation Serif on the Linux render box, so the PDF is set in a different face than the preview |

## The fix

Mostly mechanical. Three carry a judgment call, recorded here so the diff is not
where you first meet them:

- **F-34** picks **fail closed**: a limiter that cannot answer returns 503 rather
  than waving traffic through. The thing being protected is a quota that cannot
  be refilled, and a download that fails for a minute is cheaper than a day with
  no renders. Logged like the render failure, so the Worker log says why.
- **F-32** takes the **accept and document** path rather than adding a webfont.
  Feature 4 chose a system stack deliberately so the document makes no network
  request it does not need, and the substitute is a respectable Times-like serif.
  The comment records it so the next reader does not treat it as a bug. Changing
  it is a design decision, not a repair.
- **F-04** keeps `toIsoDate` exported, because three tests import it, and drops
  the export from the five with no caller at all. Verified by grep rather than
  assumed.

Nothing here may change what the endpoint accepts, what any template contains,
or any behaviour a passing test already pins.

## Build steps

- [x] **Step 1 - The two on the download path (F-34, F-31)** - wrap the limiter
  calls, log a failure the way the render failure is logged, and refuse with 503;
  in the button, append the anchor before clicking, remove it after, and revoke
  the object URL on a later turn rather than the same one. *Done when:* a normal
  download still works end to end in the browser; the throttle still returns 429
  on the third request in a minute; `pnpm test` and `pnpm build` pass.

- [x] **Step 2 - The narrow screen (F-19)** - give the line item row a stacked
  or shrinkable layout below the `editor` breakpoint so its fixed tracks stop
  setting the page's minimum width. *Done when:* at a 360px viewport the document
  scroll width equals the viewport width, with no horizontal scrollbar; the row
  is still usable, with every input reachable and labelled; the desktop layout at
  1440px is unchanged; screenshots at both widths.

- [x] **Step 3 - The tidy ups (F-02, F-04, F-06, F-32)** - delete the four
  duplicated theme tokens; drop `export` from the five uncalled draft constants
  and helpers; move `shadcn` and `tw-animate-css` to `devDependencies`; add the
  comment recording Classic's serif substitution. *Done when:* `pnpm build`
  passes after the dependency move, which is what proves they were build time
  only; the app renders unchanged at both widths; `grep` finds no remaining use
  of the deleted tokens; and `pnpm test` passes.

- [x] **Step 4 - The unstyled document guard (F-27)** - make an empty stylesheet
  loud instead of silent: the print document refuses to render without styles
  rather than returning a styleless PDF. *Done when:* `pnpm test` covers the
  empty styles case; a real download still succeeds; and the failure path returns
  the endpoint's existing error shape rather than a stack.

## Verify

- Download a PDF from the running app and open it
- Press Download three times in a minute and confirm the 429 message
- Narrow the browser to 360px and confirm the page does not scroll sideways
- Load the editor and confirm the fonts and colours are unchanged
- `pnpm build` after the dependency move, since that is the real test of it

## Notes for the AI

- F-19 is the only one with real layout risk. Change the row's own breakpoint
  behaviour; do not touch the two column editor grid, which is already correct.
- Do not remove `--color-faint`: it is unreferenced but has no shadcn equivalent,
  which is the distinction the finding drew.
- `toIsoDate` stays exported. Three tests import it.
- The 503 in F-34 reuses the existing `fail` helper and its plain text shape.
- Follow `coding-standards.md`: strict TypeScript, no `any`, tabs, comment the
  why. No em dashes.

## Findings

Resolved findings archived with this work item at their final status. IDs are
prefixed with the archive name so they stay unique across the project. F-30 was
raised against the deployed endpoint and repaired by feature 15; it was still
`fixed` when that feature completed, so it archives here with the item that was
in flight when the review closed it.

### audit-cleanup/F-30 [P2] closed - The deployed render endpoint has no throttle in front of it

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

3. Added 2026-08-15 after testing the deployed Worker, and the most important of
   the three. The binding is enforced **per Cloudflare location**, not globally:
   the documentation calls it "permissive, eventually consistent, and
   intentionally designed to not be used as an accurate accounting system", and
   each location keeps its own asynchronously updated count. Observed live: eight
   rapid posts from one client returned `400 400 400 400 429 429 400 429` rather
   than refusing everything past the second. So the per caller limit is a
   guideline rather than a ceiling, and `PDF_GLOBAL_LIMITER` is weaker than its
   name suggests, since five a minute is five a minute *per location* rather than
   five worldwide. It still cuts a flood down hard, which is the job, but it
   cannot be the thing that guarantees the daily quota survives.

Leaving this `fixed` rather than closed is the point: an /audit pass should look
at the remaining exposure and decide whether it deserves its own entry.

Re-reviewed 2026-08-15 by /audit (scope: full). The defect this entry describes,
an endpoint with nothing in front of it, is gone: `isThrottled` runs on every
POST before the body is read, both limiters are bound and visible in the deploy
output, and the live endpoint returns 429s under a burst. Read the repair for new
problems and found one, recorded separately as F-34; it does not keep this entry
open. The three residual gaps written above are a different exposure from the one
this entry names, and they now have their own entry as F-33 rather than living
inside a closed finding where nobody would look for them. **Closed.**
