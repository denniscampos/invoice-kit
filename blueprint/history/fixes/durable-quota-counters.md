# Fix: Durable counters for the two quota guards

**Type:** Fix
**Fixes:** F-33, F-36
**Status:** complete

## The problem

Two findings, one cause. Both guards count in a place that is not shared, so
neither enforces the rule it appears to.

**F-33 [P2]** - the PDF endpoint's throttle is Cloudflare's rate limiting
binding, whose window is 10 or 60 seconds and whose counters are **per
location**. It stops one caller looping, which is what it was built for, but the
resource actually at risk is a daily one: ten minutes of browser time a day on
the free plan, roughly a hundred and fifty renders. No arrangement of 60 second
windows adds up to a day, and a crowd spread across locations drains it without
tripping anything.

**F-36 [P2]** - Better Auth does rate limit sign in by default in production,
three requests per ten seconds, which is the right rule. Its counter defaults to
**in memory**, which its own documentation calls unsuitable for serverless, so on
Workers the allowance is three per ten seconds *per isolate*.

Both were going to be fixed with a durable counter, and both were blocked on the
same sentence in `coding-standards.md`: "No anonymous write reaches D1 or R2."

## The decision this fix records

**That rule means no anonymous user content, not no anonymous writes.** Its
stated reasoning is entirely about content: an anonymous invoice lives in
`sessionStorage`, an anonymous logo is a client side data URL, so nobody's
billing details reach the database before they have an account. A quota counter
holds a date and a number. A rate limit row holds a key and a count. Neither is
anyone's invoice.

The rule is amended to say so, because leaving it absolute while writing counters
anyway would make the document lie.

## The fix

**F-36** sets `rateLimit.storage: "database"` in the auth options, so Better
Auth's existing rule is enforced against one shared count instead of one per
isolate. The library generates the table it needs; that becomes a second
migration. Rate limiting is also switched on in development, because a protection
nobody can see locally is one nobody will notice breaking.

**F-33** adds a day keyed counter in D1, read and incremented immediately before
the browser call and only for a request that has already passed every other
guard, so a malformed body never spends a day's allowance. Past the cap the
endpoint answers 503 with a message that says to come back tomorrow rather than
in a minute, because that is the truth.

The cap is deliberately below the platform's own: at roughly four seconds a
render, ten minutes a day is about a hundred and fifty, so the app stops at
**120** and leaves headroom. Being refused by us with an honest explanation beats
being refused by Cloudflare with a quota error.

Neither change may alter what the endpoints accept, what the templates contain,
or the anonymous tier's ability to build an invoice and download it.

## Build steps

- [x] **Step 1 - The rule, and Better Auth's counter (F-36)** - amend the
  anonymous write rule in `coding-standards.md` to say what it means; set
  `rateLimit: { storage: "database", enabled: true }` in `app/lib/auth.server.ts`;
  regenerate Better Auth's schema and apply the difference as
  `migrations/0002_*.sql`, locally only. *Done when:* the new table exists in the
  local database and `wrangler d1 migrations list --local` shows both migrations
  applied; four rapid sign in attempts with a wrong password are refused by the
  rate limiter rather than all reaching the password check, proven by the
  response and a row in the rate limit table; a normal sign in still works; and
  nothing ran with `--remote`.

- [x] **Step 2 - The daily counter (F-33)** - a `render_quota` table, one row per
  day, plus `dayKey(date)` and the increment in `app/lib/render-quota.server.ts`.
  The increment is a single statement using `on conflict do update` with
  `returning`, so two simultaneous renders cannot both read the same number.
  *Done when:* `pnpm test` covers `dayKey` for a normal date, a UTC boundary
  either side of midnight, and that it is stable within a day; the migration is
  applied locally; and calling the helper twice in a row returns 1 then 2.

- [x] **Step 3 - Wire it in, and prove the refusal** - the PDF route consults the
  counter after validation and before `puppeteer.launch`, answering 503 with a
  "tomorrow" message past the cap. *Done when:* a normal download still returns a
  PDF and increments the count by exactly one; a refused request (bad draft,
  oversized, throttled) does **not** increment it; setting the day's count past
  the cap by hand makes the next request 503 without reaching Browser Rendering,
  proven by the absence of a render in the Worker log; and the message names
  tomorrow rather than a minute.

## Verify

- Sign in wrongly four times in a row and confirm the fourth is throttled, then
  confirm a correct sign in still works after the window
- Download a PDF and watch `render_quota` go up by one
- Post a malformed draft and confirm the count does not move
- Set today's count to the cap by hand, try to download, and read the message
- Confirm the editor still builds an invoice with no account

## Notes for the AI

- **Local only.** Every D1 command carries `--local`; the remote migration goes
  with the next deploy, as it did for 6a.
- The counter is consumed **after** validation and the existing throttle, never
  before. Order is the whole point: junk must not cost a day's capacity.
- One statement for the increment. A read then a write is a race, and two renders
  landing together would both see the same count.
- Do not log or store anything about who asked. The counter holds a date and a
  number; that is the whole reason writing it anonymously is defensible.
- Better Auth generates its own rate limit table. Do not hand write it; generate,
  read the SQL, and commit it as a new migration rather than editing 0001.
- Follow `coding-standards.md`: strict TypeScript, no `any`, server only code in
  `.server.ts`, tabs, comment the why. No em dashes.
