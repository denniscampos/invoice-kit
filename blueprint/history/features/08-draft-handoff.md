# Feature: Draft handoff

**From build-plan:** feature 8
**Status:** complete

## Goal

Close the seam between the two paths. An anonymous visitor fills in an invoice,
reaches for "save," creates an account (or signs in), and their invoice is
already saved and on screen at its own URL when they land, without pressing Save
a second time. Feature 7b built the manual version of this; feature 8 makes it
automatic.

## Design reference

`blueprint/reference/editor-mockup.html`, lines 223-226: the save note above the
form, "Not signed in. Your invoice stays in this tab. Create an account to save
it." This feature does not change how that note looks; it only makes its
"Create an account" link carry the user's intent to save. No new visual target.

## The shape of it, decided up front

**The handoff is client glue, not a new server path.** The draft already lives in
`sessionStorage` and already survives the same-tab sign-up/sign-in redirect
(6b, 7b both rely on this). The editor already has a create-save action, and
`SaveButton` already turns a successful create-save into `clearStoredDraft()` +
`navigate('/invoices/:id')`. Feature 8 adds one thing: fire that same save
automatically, once, when a user arrives at `/` signed in having just asked to
save. There is **no new server code, no migration, and no second write path.**
The invoice write keeps its one home (`saveDraft` through the store), reached by
the same editor action and validated by the same `parseDraft`/`checkDraft`.

**A single-use intent flag carries "I want this saved" across the auth trip.**
When the anonymous user clicks "Create an account to save it," we set a flag in
`sessionStorage` (`invoice-kit:handoff:v1`), sibling to the draft. Better Auth
redirects them back to `/` signed in with the draft and the flag both still in
storage. The editor reads the flag once, clears it in the same read, and if the
user is signed in with a real draft, submits the save. Read-and-clear plus a ref
guard makes it strictly single-use, so a refresh or React's double-invoked effect
cannot save twice.

**Why a flag and not just "signed in with a draft."** A signed-in user editing a
fresh draft at `/`, or refreshing mid-type, also has a draft in `sessionStorage`.
Auto-saving on the bare presence of a draft would create a junk invoice on every
visit. The flag is the difference between "I typed something" and "I asked to
save this," and only the save prompt sets it.

**Sign-in is covered for free.** The flag persists through the sign-up page's
existing "already have an account? sign in" cross-link (6b), so an existing user
who clicks "Create an account to save it," then switches to sign in, still hands
off on arrival. The visible note stays exactly as the mockup draws it (sign-up
only); sign-in handoff falls out of the flag surviving the same-tab navigation.

**The draft is read from storage at handoff time, not from editor state.** The
editor hydrates its `draft` from `sessionStorage` in a mount effect, so on the
first render its in-memory draft is still empty. The handoff reads
`readStoredDraft()` itself, so it never races the editor's hydration and never
posts an empty draft by mistake.

**A collision degrades to the manual refusal.** If a returning user's draft
number is one their account already uses, the create-save comes back
`{ ok: false, error }`, the existing `SaveError` shows it beside the form, nothing
navigates, and the draft stays. They fix the number and press Save. This matches
7b: a number that renumbers itself is worse than one that is refused. New
accounts have no numbers to collide with, so the sign-up path never hits this.

## In scope

- A single-use `sessionStorage` intent flag: set on the save note's link,
  consumed once on the editor after auth.
- Auto-firing the existing create-save on arrival at `/` when signed in with a
  real, non-empty draft and the intent set; landing on `/invoices/:id` via the
  path `SaveButton` already owns.
- Sign-up **and** sign-in handoff (sign-in via the persisted flag; no new note
  link needed).
- A guard so an empty draft, or a signed-in visit with no intent, saves nothing.
- Pure logic for both decisions (`isDraftEmpty`, `shouldSaveOnHandoff`), tested.

## Out of scope

- **Any server change.** No new route, action, migration, or store function.
  The editor action and `saveDraft` do the write unchanged.
- **Changing the manual Save path (7b).** The button, its action, and its
  clear-and-navigate landing are reused, not rewritten.
- **A visible "or sign in" link in the note.** The mockup shows only "Create an
  account"; sign-in is covered by the persisted flag, so the note is untouched.
  (An explicit sign-in link is a possible later enhancement, not this feature.)
- **Renumbering a colliding invoice on handoff.** It degrades to the manual
  refusal instead.
- **Cross-tab handoff.** The draft and flag are per-tab `sessionStorage`, which is
  correct: the draft only ever lived in that tab.
- **Tax/discount (19), logo (13), password reset (24).**

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The handoff decision, pure and tested** - a new
  `app/lib/draft-handoff.ts` with `isDraftEmpty(draft)` and
  `shouldSaveOnHandoff({ intent, signedIn, draft })`, plus the thin
  `sessionStorage` wrappers `markSaveHandoff()` and `takeSaveHandoff()`
  (read-and-clear), error-swallowing in the style of the draft helpers. Tests in
  `app/lib/draft-handoff.test.ts` for the two pure functions.

  *Done when:* `pnpm test` covers `isDraftEmpty` true for a fresh
  `createEmptyDraft()` and for whitespace-only notes, and false when there is a
  line item, a bill-to name, a bill-from field, payment terms, or notes; and
  `shouldSaveOnHandoff` true only for intent + signed in + a non-empty draft, and
  false when intent is false, when not signed in, when the draft is null, and when
  the draft is empty. The suite is green and nothing else changed behavior.

- [x] **Step 2 - The save prompt carries the intent** - the "Create an account"
  link in `SaveNote.tsx` calls `markSaveHandoff()` on click. Nothing consumes the
  flag yet, so behavior is otherwise unchanged.

  *Done when:* on the anonymous editor, clicking "Create an account" writes
  `invoice-kit:handoff:v1` into `sessionStorage` and navigates to `/sign-up`; the
  stored draft is untouched; the note reads and looks exactly as before, clean at
  320px; console clean.

- [x] **Step 3 - Hand off on arrival** - a new render-null
  `app/components/invoice/DraftHandoff.tsx` taking `signedIn`, mounted in
  `editor.tsx`. On mount, once (ref-guarded), it calls `takeSaveHandoff()`; if the
  flag was set, it reads `readStoredDraft()` and, when `shouldSaveOnHandoff` is
  true, submits `{ intent: "save", draft }` through a `useFetcher` on the shared
  `SAVE_FETCHER_KEY` (exported from `SaveButton.tsx`). `SaveButton`'s existing
  success effect then clears the draft and navigates to `/invoices/:id`.

  *Done when:*
  - Signed out, fill a draft with a line item, click "Create an account,"
    complete sign-up: you land on `/invoices/:id` showing that invoice **without
    pressing Save**; the `invoice-kit:draft:v1` key is gone; returning to `/`
    shows a fresh empty editor, not the just-saved invoice offered again.
  - Existing account, non-colliding number: fill a draft, click "Create an
    account," switch to "sign in," sign in: same landing on `/invoices/:id`.
  - A signed-in user opening `/` with no intent creates no invoice, and repeated
    visits or refreshes do not grow the invoice count.
  - Intent set but the draft is empty (clicked with nothing typed): you land
    signed in on `/` with an empty editor and no invoice is created.
  - Abandon: set the intent, go to `/sign-up`, return to `/` still anonymous: the
    save note shows again, the flag is consumed, and no phantom save fires on a
    later sign-in.
  - Sign-in with a colliding number: the refusal shows beside the form
    (`SaveError`), nothing navigates, the draft stays; renumbering and pressing
    Save works.
  - During the handoff the Save button shows "Saving..." (shared fetcher);
    console clean; 320px has no sideways scroll.

## Files / areas

- `app/lib/draft-handoff.ts` - new: `isDraftEmpty`, `shouldSaveOnHandoff`,
  `markSaveHandoff`, `takeSaveHandoff`
- `app/lib/draft-handoff.test.ts` - new
- `app/components/invoice/DraftHandoff.tsx` - new
- `app/components/invoice/SaveButton.tsx` - export `SAVE_FETCHER_KEY` (currently a
  private const)
- `app/components/invoice/SaveNote.tsx` - the link sets the intent
- `app/routes/editor.tsx` - render `<DraftHandoff signedIn={signedIn} />`

## Data / contracts

No schema change, no server change.

```ts
// app/lib/draft-handoff.ts
export function isDraftEmpty(draft: InvoiceDraft): boolean;
export function shouldSaveOnHandoff(input: {
	intent: boolean;
	signedIn: boolean;
	draft: InvoiceDraft | null;
}): boolean;
export function markSaveHandoff(): void;   // sessionStorage set, error-swallowing
export function takeSaveHandoff(): boolean; // read-and-clear, single-use
```

- `SAVE_FETCHER_KEY` (`"save-invoice"`) becomes a shared export from
  `SaveButton.tsx`, so `DraftHandoff` and `SaveButton` drive the same fetcher and
  the create-save landing keeps its one home.
- `sessionStorage` keys: `invoice-kit:draft:v1` (unchanged) and the new
  `invoice-kit:handoff:v1`. Version in the key, discard-on-mismatch, matching the
  draft's discipline.
- The submitted body is exactly what `SaveButton` posts today:
  `{ intent: "save", draft: JSON.stringify(draft) }`. No id in any form body.

Rules this feature must hold to:

- **The session decides the user, server side.** The editor action still runs
  `requireUser`; the flag and draft are only a client-side prompt to submit, never
  a claim about who the user is.
- **The draft is validated before it is stored**, by the same `parseDraft` the
  manual save and the PDF endpoint use. Handoff adds no new trust surface.
- **Money stays the server's.** The store recomputes totals; nothing here bypasses
  that.
- **One home for the write, and for the landing.** Feature 8 triggers the existing
  create-save and relies on `SaveButton`'s existing clear-and-navigate. The
  invariant that makes the reuse safe: `DraftHandoff` and `SaveButton` are both
  rendered exactly when `signedIn` is true, so the button whose effect performs the
  landing is always present when the handoff fires. Keep them under the same
  condition.
- **Single-use intent.** `takeSaveHandoff()` clears as it reads, and a `useRef`
  guards the effect, so StrictMode's double effect and any remount cannot double
  save.
- **The anonymous tier still touches no server storage.** The flag and draft are
  client-only `sessionStorage`.

## Testing

The gate is on. In-scope logic: `isDraftEmpty` and `shouldSaveOnHandoff` (step 1),
both pure with real edge cases, tested in `draft-handoff.test.ts`. The
`sessionStorage` wrappers and the `DraftHandoff` component ride on browser
evidence, as their done-whens describe, consistent with how the existing draft
storage and Save button are verified.

Verify by hand at the end (local dev, one account plus a fresh sign-up):

- Sign-up handoff: fill a draft, create an account, confirm you land on
  `/invoices/:id` for it and the row exists in D1.
- Sign-in handoff: fill a draft, click "Create an account," switch to sign in,
  sign in, confirm the same landing.
- No-intent signed-in visit: open `/` signed in and confirm no new invoice, on
  repeat.
- Empty-draft intent, abandon, and collision cases, per step 3's done-whens.
- Console clean; narrow to 320px.

## Notes for the AI

- **No migration, no server file.** If a step reaches for one, the step is wrong.
- Export `SAVE_FETCHER_KEY` from `SaveButton.tsx` and import it in `DraftHandoff`;
  do not hardcode the string in two places.
- `DraftHandoff` reads `readStoredDraft()` itself rather than taking the editor's
  `draft` prop, because the editor hydrates its draft in a mount effect and the
  in-memory draft is empty on first render.
- Set the flag only on the save note's link, not on the app bar's generic
  Sign in / Sign up links: the flag means "save this draft," not "authenticate."
- On a collision, do not auto-renumber; let the existing `SaveError` surface the
  refusal, matching 7b.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server-only logic in
  `.server.ts` (none needed here), tabs, comment the why. No em dashes.
