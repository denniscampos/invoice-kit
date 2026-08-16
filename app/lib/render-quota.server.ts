/* The day's remaining capacity for rendering PDFs.

   The rate limiter in front of the endpoint stops one caller looping, but its
   window is at most sixty seconds and its counters are per Cloudflare location.
   The resource actually at risk is a daily one: ten minutes of browser time on
   the free plan, which at three or four seconds a render is roughly a hundred
   and fifty. A crowd spread across locations can drain that without tripping any
   window, so the count has to live somewhere shared and survive the day. */

/* Below the platform's own ceiling on purpose. Being turned away by this app
   with an explanation beats being turned away by Cloudflare with a quota error,
   and the headroom leaves room for a signed in user's renders once features 7
   and 11 exist. */
export const DAILY_RENDER_LIMIT = 120;

/* UTC, not local time. The allowance being protected resets on Cloudflare's
   clock, and a key that shifted with the caller's timezone would give some of
   them two days' worth. */
export function dayKey(now: Date): string {
	return now.toISOString().slice(0, 10);
}

export type QuotaResult = { allowed: boolean; used: number };

/* How long until the allowance resets, for the Retry-After header. Every other
   refusal this endpoint makes says when to come back, and "tomorrow" is only
   useful if it is the real tomorrow rather than the caller's. */
export function secondsUntilNextDay(now: Date = new Date()): number {
	const nextMidnightUtc = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1,
	);

	return Math.ceil((nextMidnightUtc - now.getTime()) / 1000);
}

/* Takes one render's worth of the day's capacity, or refuses.

   One statement, deliberately. A read followed by a write is a race, and two
   renders arriving together would both see the same number, which is the exact
   defect this function exists to fix. The `where` on the conflict clause is what
   makes the refusal atomic too: past the limit the update does not happen, so
   nothing is returned and the count stops growing rather than climbing forever
   under a flood. */
export async function consumeRenderQuota(
	db: D1Database,
	now: Date = new Date(),
): Promise<QuotaResult> {
	const row = await db
		.prepare(
			`insert into render_quota (day, renders) values (?1, 1)
			 on conflict(day) do update set renders = renders + 1
			 where renders < ?2
			 returning renders`,
		)
		.bind(dayKey(now), DAILY_RENDER_LIMIT)
		.first<{ renders: number }>();

	return row
		? { allowed: true, used: row.renders }
		: { allowed: false, used: DAILY_RENDER_LIMIT };
}

/* Gives back a slot that bought nothing.

   The counter is taken before the browser call, so a render that never started
   has already been charged for browser time it did not use. That is the right
   order (a malformed request must not be able to make us pay first and ask
   questions later), which leaves the refund as the correction.

   Only for a failure before the browser opened. Refunding every failure would
   let a caller who can reliably break the renderer download all day for free,
   because each attempt would hand its slot straight back.

   `renders > 0` because a refund for a day with no row, or a row already at
   zero, is a no-op rather than a negative count. */
export async function releaseRenderQuota(
	db: D1Database,
	now: Date = new Date(),
): Promise<void> {
	await db
		.prepare(
			`update render_quota set renders = renders - 1
			 where day = ?1 and renders > 0`,
		)
		.bind(dayKey(now))
		.run();
}
