# Feature: Anonymous abuse protection

**From build-plan:** feature 15
**Status:** complete

## Goal

Put a throttle in front of the one unauthenticated route that reaches Browser
Rendering, so a stranger with a loop cannot spend the account's daily browser
allowance. `project-overview.md` calls this a deploy blocker, the app is already
deployed, and `F-30` records the exposure.

Pulled forward from its plan position because the free path shipped and is live.
Nothing here needs accounts, so it does not depend on features 6 to 14.

## What this can and cannot do

Worth being exact, because "rate limited" reads like "safe" and this is only
part of it.

The rate limiting binding takes a window of **10 or 60 seconds, and nothing
else**. That makes it a burst guard. The resource actually at risk is a **daily**
one: ten minutes of browser time a day on the free plan, roughly a hundred and
fifty renders. No arrangement of 60 second windows adds up to a daily budget.

So:

- **Closed by this feature:** one caller in a loop, which is what a scraper, a
  stuck retry, or an impatient user produces, and what would drain the day in
  minutes.
- **Still open after it:** a slow distributed drip from many addresses, which
  could still exhaust the day without ever tripping a window. Closing that needs
  a counter that survives a day, which means KV or a Durable Object, and that is
  a storage decision this feature deliberately does not make. It gets recorded as
  a follow-up rather than pretended away.

## In scope

- Two rate limiting bindings: one keyed per caller, one global
- A `rateLimitKey(request)` that derives the caller's identity from
  `CF-Connecting-IP`, with a defined fallback when the header is absent
- The check in `POST /invoice/pdf`, placed before any work is done
- **429** with `Retry-After` and a sentence the existing Download button already
  knows how to display
- Recording what remains open, as a finding, instead of closing F-30 with a
  claim the code does not support

## Out of scope

- **Accounts and per-user limits** (feature 6 onward). Signed-in users do not
  exist yet; when they do, they should get their own allowance rather than share
  the anonymous one.
- **A daily budget.** See above: it needs persistent storage, and that is its own
  decision.
- **WAF or zone level rate limiting.** The app is on a `workers.dev` subdomain
  with no zone, so those rules are not available to it.
- **Blocking, banning, or a captcha.** A 429 that clears in a minute is the whole
  response.
- **Rate limiting anything else.** The editor, the assets, and the HTML the app
  serves cost nothing to produce; this is about the browser call.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The bindings** - add two limiters to `wrangler.json`:
  `PDF_LIMITER` keyed per caller (`limit: 5`, `period: 60`) and
  `PDF_GLOBAL_LIMITER` (`limit: 20`, `period: 60`), then `pnpm cf-typegen`. No
  route change yet. *Done when:* `worker-configuration.d.ts` declares both on
  `Env`, `pnpm typecheck` and `pnpm build` pass, and `pnpm check`'s dry run lists
  both beside the browser binding.

- [x] **Step 2 - The key, and the check** - `rateLimitKey(request): string` in
  `app/lib/request.server.ts`, reading `CF-Connecting-IP` and falling back to a
  single shared bucket when it is missing, so an absent header throttles harder
  rather than not at all. The route consults the per-caller limiter and then the
  global one, immediately after the method check and **before it reads the body**,
  and answers 429 with `Retry-After: 60` when either refuses. *Done when:*
  `pnpm test` covers a normal address, a missing header, an empty header, and an
  `X-Forwarded-For` that must be ignored because it is caller-supplied; six posts
  in a minute from one caller produce five successes and a 429; the 429 carries
  `Retry-After`; and a refused request never reaches Browser Rendering, proven by
  the absence of a render entry in the Worker log.

- [x] **Step 3 - What the user sees** - confirm the Download button surfaces the
  429 the same way it already surfaces the 503, and adjust only if it does not.
  *Done when:* clicking Download past the limit shows the throttle message beside
  the button rather than a generic failure, the button re-enables, and the
  console carries nothing but the browser's own note about the 429 response.

- [x] **Step 4 - Tune the limits to sit under the platform's** - step 3's
  evidence showed both configured limits are looser than Cloudflare's own, so our
  throttle almost never fires first: twelve clicks produced one download, then
  four 503s from the browser quota, and only then a 429 from us. Drop
  `PDF_LIMITER` to `limit: 2` and `PDF_GLOBAL_LIMITER` to `limit: 5`, both still
  `period: 60`, so each sits below the roughly three renders a minute the free
  tier's one-browser-per-twenty-seconds rule actually permits. *Done when:*
  `pnpm check`'s dry run reports the new numbers; a third post inside a minute
  from one caller is refused by us with 429 rather than by Cloudflare with 503;
  a single ordinary download still succeeds; and `pnpm build` passes.

## Files / areas

- `wrangler.json` - the two `ratelimits` entries
- `worker-configuration.d.ts` - regenerated, never hand edited
- `app/lib/request.server.ts` - `rateLimitKey`
- `app/lib/request.test.ts` - its coverage
- `app/routes/invoice.pdf.tsx` - the check and the 429
- `app/components/invoice/DownloadPdfButton.tsx` - only if step 3 finds a gap

## Data / contracts

```jsonc
// wrangler.json
"ratelimits": [
  { "name": "PDF_LIMITER",        "namespace_id": "1001", "simple": { "limit": 5,  "period": 60 } },
  { "name": "PDF_GLOBAL_LIMITER", "namespace_id": "1002", "simple": { "limit": 20, "period": 60 } }
]
```

```ts
// app/lib/request.server.ts
export function rateLimitKey(request: Request): string;

// POST /invoice/pdf, added to the existing list
// 429 too many requests, with Retry-After: 60
```

Rules this feature must hold to:

- **The throttle runs before the work, not after it.** After the method check and
  before the body is read, so a flood of large bodies is cut off at the door
  rather than after being measured.
- **The key comes from `CF-Connecting-IP` only.** `X-Forwarded-For` is supplied
  by the caller and trivially spoofed; trusting it would hand every attacker a
  fresh bucket per request. Cloudflare sets `CF-Connecting-IP` itself.
- **A missing key shares one bucket rather than skipping the check.** The failure
  mode of an unknown caller must be stricter, never more permissive.
- **The global limiter is a deliberate trade.** It protects the account's quota
  at the cost of one abuser being able to make everyone else wait a minute. That
  is the better failure: a minute of 429s beats a day with no renders at all.
- **429 is distinct from the existing 503.** 429 means this app throttled you and
  a minute fixes it; 503 means Cloudflare's browser quota is gone and it may not.

## Testing

`AGENTS.md` declares `pnpm test`, so **the test gate is on**.

In-scope logic: `rateLimitKey` (step 2), the only pure function here, and worth
testing because getting it wrong either throttles everyone as one caller or hands
each request its own bucket.

Steps 1 and 3 are configuration and UI, and ride on the dry run, browser
evidence, and the build.

The limiter itself is an external service call: whether it behaves locally is
unknown, since Cloudflare's documentation does not say. If it does not throttle
under `pnpm dev`, step 2's evidence has to come from `wrangler dev --remote` or
the deployed Worker, and the step should say which was used.

Verify by hand at the end:

- Press Download six times inside a minute and watch the sixth be refused, then
  succeed again after the window
- Confirm the refusal names waiting, not breakage
- Confirm a single ordinary download is unaffected, which is the case that
  matters most
- Post to the endpoint with `X-Forwarded-For` set to a different address on each
  request and confirm the limit still applies

## Notes for the AI

- Bindings reach the route through `context.get(cloudflareContext)`, never a
  module level global.
- `period` accepts only 10 or 60. Do not invent a third value; the schema
  rejects it.
- `limit()` returns `{ success }`. A refusal is not an exception.
- Call the per-caller limiter first and the global one second, and do not call
  the global one when the first already refused: a caller who is already being
  throttled should not also spend the shared allowance.
- Do not log the caller's IP address. It is personal data, the log gains nothing
  from it, and the app stores no other identifier.
- The Download button already renders whatever sentence the endpoint returns, so
  step 3 is a check rather than an assumption.
- Follow `coding-standards.md`: strict TypeScript, no `any`, tabs, comment the
  why. No em dashes.
