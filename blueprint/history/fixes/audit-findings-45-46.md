# Fix: the two P2 findings from the full audit

**Type:** Fix
**Fixes:** F-45, F-46

Two open P2 findings, both deferred to "after feature 11", plus one loose end
noticed during that build and never filed. Batched because each is a few lines in
a different file, the way the F-40/44/47/48 fix was.

## The problem

### F-45 [P2] - the dashboard cannot be reached from a phone

`app/components/AppBar.tsx:51`. The nav is hidden below `sm`, so a signed-in user
on a phone has no link to `/invoices` from anywhere. The page works at 320px;
nothing on screen leads to it.

Feature 11 made this worse rather than better. `/invoices` is now the front door
to every saved invoice, and the detail page inherited the same full bar:

| Page at 320px | Header | Actions | Spare |
| --- | --- | --- | --- |
| `/` | 305 / 305 | 252px | 0 |
| `/invoices/:id` | 305 / 305 | 252px | 0 |
| `/invoices` | 320 / 320 | 72px | ~248 |

Measured, not estimated. The 252px is Sign out (72), Save (~52), Download PDF
(~112) and the gaps between them. There is no room, which is why this was
accepted at the time rather than squeezed.

### F-46 [P2] - a signed-in user's PDF download is throttled as if anonymous

`app/routes/invoice.pdf.tsx:87`. The overview's access tier table reads "Download
the PDF - anonymous: yes, rate limited; signed in: yes". The route does not
implement the split: there is no `getUser` call in the file, so every caller
passes through `PDF_LIMITER` (2/min per IP) and `PDF_GLOBAL_LIMITER` (5/min for
everyone). A signed-in user downloading a third invoice inside a minute is told
"Too many invoice downloads from here." Worse behind office NAT, where the limiter
keys on `CF-Connecting-IP` and everyone shares one bucket.

### The loose end - a trailing space slips past the uniqueness check

`app/lib/invoice-save.server.ts`. `checkDraft` trims the invoice number to ask
whether it is taken, then stores the untrimmed one. So `"INV-0003 "` is checked as
`"INV-0003"`, and if that is free it is stored with the space, where the unique
index reads it as a different number from `"INV-0003"`. Pre-existing since feature
7b, unfiled, and small. Drop this step if you would rather it went through
`/audit` first.

## The fix

**F-45: free the width, then spend it.** Two changes that pay for each other:

- `Download PDF` becomes `PDF` below `sm`, returning roughly 60px on both editor
  bars. The full label stays from `sm` up.
- The nav becomes visible at every width, but below `sm` only the Invoices entry
  renders, icon-only with an `aria-label`. About 32px.

One entry is enough because the brand mark is already a link to `/`, which is
documented in `AppBar` as the phone's way back to the editor. The missing half is
outbound only, so that is the half to build. Icon-only rather than text because
"Invoices" needs ~70px and only ~60px is being freed; an `aria-label` keeps it
readable to a screen reader.

Must not break: the bar must still not scroll sideways at 320px on any page, and
nothing changes at `sm` and up.

**F-46: resolve the session first, then throttle only when there is none.** The
daily render quota stays for everyone, signed in or not, because that is the
account's browser time and an account holder can exhaust it just as easily; that
sharing is already deliberate and documented at `render-quota.server.ts:12`.

On the ordering, which is the one thing here worth thinking about: the guards are
in their current order on purpose, throttle before reading the body, so a flood is
turned away at the door. Putting `getUser` in front of that is safe because Better
Auth answers a request carrying no session cookie without touching the database,
which is exactly what a flood looks like. A flood carrying a forged cookie would
cost one indexed lookup per request, which is the same cost any signed-in request
already pays.

Must not break: the anonymous path keeps every guard it has today, in the same
order, with the same status codes and sentences.

**The loose end:** normalize once in `checkDraft` and return the trimmed number on
the draft, so what was checked is what gets stored. Both save paths inherit it.

## Build steps

- [x] **Step 1 - F-45: a phone route to the dashboard** - shorten the Download PDF
  label below `sm` in `app/components/invoice/DownloadPdfButton.tsx`; in
  `app/components/AppBar.tsx` show the nav at all widths, with Editor hidden below
  `sm` and Invoices rendered icon-only there. *Done when:* at 320px, signed in, an
  Invoices link is present and reaches `/invoices` from both `/` and
  `/invoices/:id`; `document.documentElement.scrollWidth` still equals
  `clientWidth` on all three pages; the link carries an accessible name of
  "Invoices"; signed out there is still no Invoices link anywhere; and at 1440px
  the bar is unchanged, with both text entries and the full "Download PDF" label.

- [x] **Step 2 - F-46: signed-in downloads skip the anonymous throttles** - in
  `app/routes/invoice.pdf.tsx`, resolve the session at the top of the action and
  run `isThrottled` only when there is none. Leave the quota, the size guards, the
  parsing, and every status code alone. *Done when:* signed in, three PDF
  downloads inside one minute all succeed; signed out, the third within a minute
  is still refused with 429 and `retry-after: 60`; the anonymous refusal sentence
  is unchanged; and a signed-in request still spends one daily render slot per
  render.

- [x] **Step 3 - the trailing space** - trim the invoice number onto the draft in
  `checkDraft`, so the value checked for uniqueness is the value stored. *Done
  when:* saving `"INV-0501 "` from the editor stores `INV-0501` with no trailing
  space, and saving `"INV-0501 "` again is refused with the duplicate message
  rather than stored as a second row. Verified by reading the row back from local
  D1.

## Verify

Per step, in the browser at http://localhost:5180 with the local D1:

1. **F-45** at 320px on `/`, `/invoices`, and `/invoices/:id`: the Invoices link
   is reachable and no page scrolls sideways. Then at 1440px, nothing moved.
2. **F-46** signed in, download three invoices in a minute. Then sign out and do
   the same anonymously, expecting the third to be refused. Each signed-in render
   is a real Browser Rendering call, so this costs three of the day's slots.
3. **Step 3** by saving a number with a trailing space and reading the row back.

Then `pnpm typecheck`, `pnpm build`, and `pnpm test`, which is the fallback gate
while no Verify command is declared in `AGENTS.md`.
