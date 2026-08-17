# Fix: the download button's spoken name during a render

**Type:** Fix
**Fixes:** F-50

## The problem

`app/components/invoice/DownloadPdfButton.tsx:94-106`. The F-45 repair gave the
button a fixed `aria-label="Download PDF"` so the short "PDF" label below `sm`
would still read properly to a screen reader. `aria-label` overrides the
element's content entirely, and the content changes while a render is in flight,
so the two disagree in exactly the state the label was added to help:

| Width | State | Visible | Spoken | Visible text contained? |
| --- | --- | --- | --- | --- |
| < `sm` | idle | `PDF` | Download PDF | yes |
| < `sm` | rendering | `PDF...` | Download PDF | **no** |
| `sm`+ | idle | `Download PDF` | Download PDF | yes |
| `sm`+ | rendering | `Preparing PDF...` | Download PDF | **no** |

Two costs, both small. A speech-input user saying the words they can see does not
match the control while it is working, which is what WCAG's Label in Name exists
to prevent. And a screen reader user is told the button is "Download PDF, busy"
rather than that it is preparing something, losing the wording the sighted user
gets.

The comment above the button is the part worth removing soonest. It claims the
accessible name "contains the visible text, which is what WCAG's Label in Name
asks for" with no qualifier, so the next reader has no reason to check the
pending state.

## The fix

**Delete `aria-label` and let the name come from the content**, which is the more
robust pattern anyway: a name built from what is on screen cannot drift from it.
The short variant gets an `sr-only` "Download" companion so it still reads as a
full instruction below `sm`.

That makes the name track the state in all four cells above: `Download PDF`,
`Download PDF...`, `Download PDF`, `Preparing PDF...`. Every one contains its own
visible text.

Must not break: the visible labels stay exactly as they are at both widths, the
button keeps `aria-busy` while rendering, and the bar must still not scroll
sideways at 320px, since `sr-only` is absolutely positioned and takes no width.

Rewrite the comment to say what is actually true, including the pending state.

## Build steps

- [x] **Step 1 - build the name from the content** - drop `aria-label`, add the
  `sr-only` companion to the short variant, and correct the comment. *Done when:*
  the button's computed accessible name is "Download PDF" idle and "Download
  PDF..." while rendering at 320px, and "Download PDF" idle and "Preparing
  PDF..." while rendering at 1440px, each read from the accessibility tree rather
  than from the markup; the visible labels are unchanged at both widths; and
  `document.documentElement.scrollWidth` still equals `clientWidth` at 320px.

## Verify

At http://localhost:5180, signed in:

1. At 1440px, read the button from the accessibility tree, click it, and read it
   again during the few seconds it renders.
2. Repeat at 320px.
3. Confirm no sideways scroll at 320px.

One click per width is one real Browser Rendering call each, so this costs two of
the day's slots.

Then `pnpm typecheck`, `pnpm build`, and `pnpm test`, the fallback gate while no
Verify command is declared in `AGENTS.md`.

## Findings

Resolved findings carried into this archive. Both were raised against earlier
work and repaired by the fix that preceded this one; they reached `closed` at
the audit that followed, which is why they archive here. Their **Found** lines
record where each came from. F-50, repaired by this fix, stays in the ledger
as `fixed` until an audit re-reviews it.

### download-button-name/F-45 [P2] closed - The dashboard cannot be reached from a phone

**File:** app/components/AppBar.tsx:47
**Found:** 2026-08-16 by /implement (feature 9, step 3)
**Why it matters:** The nav is hidden below `sm`, so a signed-in user on a phone
has no link to `/invoices` from anywhere in the app. They can still get there by
typing the URL, and the page itself works fine at 320px, but nothing on screen
leads to it. Feature 9's whole point is that a saved invoice can be found again,
and on a phone it can only be found by someone who already knows the address.

Measured rather than guessed. With the nav removed, the editor's bar is
`scrollWidth` 305 in a `clientWidth` of 305: exactly full, no spare pixels. Save
(52px) and Download PDF (112px) take 164px of it. The two nav items need 146px
between them, which puts the header at 451px and scrolls the page sideways, which
is F-35 returning. So this is not a styling slip; the row has no room, and
something has to leave it before anything can join.

The brand mark was made a link to `/` in the same step, which costs no width, so
the reverse trip (dashboard back to editor) does work on a phone. Only the
outbound one is missing.
**Suggested fix:** free the width first, then spend it. Shortening Download PDF
to "PDF" below `sm` returns about 62px, which is enough for an icon-only Invoices
link (~32px). Both are one line behind a breakpoint. The alternative is to stop
treating the bar as a single row on a phone and give the app a real mobile nav,
which is worth doing once feature 11 adds the detail view and there is more than
one destination to reach.

**Accepted for now by the user (2026-08-16):** desktop is the working surface
today, and the fix reaches into feature 5's Download button, which is outside
feature 9's spec. Revisit at feature 11.

**Resolution:** Fixed 2026-08-17 by /implement, after feature 11 landed and made
it matter more: the dashboard became the front door to every saved invoice, and
the detail page inherited the same completely full bar.

Re-measured rather than working from the numbers above, because the bar changed.
At 320px the actions block is 252px on both `/` and `/invoices/:id` (Sign out 72,
Save ~52, Download PDF ~112), and `/invoices` has ~248px spare. Shortening
Download PDF to "PDF" below `sm` returns about 60px, which buys one icon-sized
link and not two text ones, so the nav now shows Editor from `sm` up and Invoices
at every width, icon-only below `sm`. One entry is enough because the brand mark
is already a link to `/`: the return trip worked and only the outbound one was
missing.

Proven in the browser at 320px: the Invoices link is present and 32px wide on all
three pages, clicking it reaches the dashboard, and
`document.documentElement.scrollWidth` still equals `clientWidth` everywhere (`/`
305/305, `/invoices/:id` 305/305, `/invoices` 320/320). The accessibility tree
reads `link "Invoices"` rather than an unnamed icon, and the download button
keeps `button "Download PDF"` while showing "PDF", which is what WCAG's Label in
Name asks for. At 1440px nothing moved: Editor 68px, Invoices 87px, icon hidden,
full label. Signed out, `curl` finds no `href="/invoices"` anywhere in the page.

**Closed 2026-08-17 by /audit (scope: full).** Re-read `AppBar.tsx:46-70` and
`DownloadPdfButton.tsx:89-106` against the new code. The gap is gone and the
mechanism is sound rather than lucky: `cn` runs tailwind-merge, and `className`
is passed last, so the Editor entry's `hidden sm:block` wins over the base
`flex` and the entry really is absent below `sm`. The `sr-only sm:not-sr-only`
pairing is the same one the brand wordmark already used, so the link keeps its
name at every width.

The repair did introduce one small thing, filed separately as F-50 rather than
held against this one: the button's `aria-label` is fixed while its visible text
changes during a render.

Also confirmed the deployed build carries it (version `1707e71f`): the production
editor page serves `aria-label="Download PDF"` with both label spans, and no
`/invoices` link for a signed-out visitor.

### download-button-name/F-46 [P2] closed - A signed-in user's PDF download is throttled as if anonymous

**File:** app/routes/invoice.pdf.tsx:87
**Found:** 2026-08-16 by /audit (scope: full)
**Why it matters:** The overview's access tier table reads "Download the PDF -
anonymous: yes, rate limited; signed in: yes". The route does not implement that
split. There is no `getUser` call anywhere in the file, so every caller passes
through `PDF_LIMITER` at two requests a minute per IP, the shared
`PDF_GLOBAL_LIMITER` at five a minute for everyone together, and the 120-render
daily quota. `DownloadPdfButton` posts here for both tiers, so a signed-in user
downloading a third invoice inside a minute is told "Too many invoice downloads
from here. Try again in a minute."

The daily quota being shared is deliberate and documented at
render-quota.server.ts:12. The per-IP burst limit applying to accounts is not
mentioned anywhere, and it is the one a real user meets first: sending three
invoices in one sitting is ordinary work, not abuse.

Worse in an office than at home. The limiter keys on `CF-Connecting-IP`, so
everyone behind one NAT shares the two-per-minute bucket regardless of who is
signed in as whom.
**Suggested fix:** resolve the session at the top of the action and skip the two
limiters when it exists, keeping the daily quota for everyone so an account
cannot drain the day's browser time either. Feature 11 adds `/invoices/:id/pdf`
for saved invoices and is the natural place to settle which guards belong to
which tier; the anonymous route keeps every guard it has today.

**Resolution:** Fixed 2026-08-17 by /implement, as suggested. An `isSignedIn`
helper resolves the session at the top of the action and the two limiters run
only when there is none. The daily quota stays for everyone, and the size guards,
parsing, validation, ordering, and every status code are untouched. Feature 11
did not add `/invoices/:id/pdf` after all, and deliberately (see that archive), so
this landed as its own repair rather than alongside a new route.

A failed session lookup answers "not signed in", so an unreadable session costs
the caller the anonymous tier's throttle rather than handing anyone the
unthrottled path, matching the fail-closed choice the other two guards make.

Proven against the running app. The clearest evidence is the same body sent twice
in the same second, with the limiter bucket already exhausted: anonymous gets 429
"Too many invoice downloads from here" with `retry-after: 60`, and signed in gets
400 "That is not a valid invoice draft", which also shows the later guards still
run for it. Three signed-in renders inside one 60 second window (t+0s, t+29s,
t+59s) all returned real PDFs, where the third would previously have been a 429.
`render_quota` went 1 to 5 across four successful renders and three failed browser
launches, so a signed-in render still spends exactly one daily slot and a failed
launch still releases its own.

Worth recording as a limit of the repair rather than a defect in it: three
back-to-back signed-in downloads still fail, with 503 "Too many invoices are being
generated right now", because the free tier starts one browser roughly every
twenty seconds. That is Cloudflare's cadence and not this app's throttle, and it
is already documented in `wrangler.json`. The app no longer refuses a signed-in
user; the plan still will.

**Closed 2026-08-17 by /audit (scope: full).** Re-read `invoice.pdf.tsx:59-125`.
The anonymous path is unchanged in both order and outcome: `isSignedIn` returns
false without a cookie, so `isThrottled` runs exactly where it always did, and
every later guard, status code, and sentence is untouched.

The one claim in the repair worth checking rather than trusting was its own
comment, that Better Auth answers a cookie-less request without touching the
database. It is true, and now has a source: `better-auth/dist/api/routes/session.mjs:44-45`
reads the signed cookie and does `if (!sessionCookieToken) return null;` before
any query. So putting the session lookup ahead of the throttle does not weaken
the door against a flood, which was the only real risk in the change.

The failure path is right too: a thrown lookup is caught and answered "not
signed in", so the fallback is the more restrictive tier rather than the
unthrottled one.

Separately filed as F-52, not held against this: production refused only one of
twelve rapid anonymous requests, which is looser than 2 per 60 seconds reads. It
is a question about the limiter itself and predates this change.
