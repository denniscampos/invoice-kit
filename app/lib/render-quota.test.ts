import { describe, expect, it } from "vitest";
import {
	DAILY_RENDER_LIMIT,
	dayKey,
	secondsUntilNextDay,
} from "./render-quota.server";

describe("dayKey", () => {
	it("is the UTC calendar date", () => {
		expect(dayKey(new Date("2026-08-15T12:00:00Z"))).toBe("2026-08-15");
	});

	/* The key has to follow Cloudflare's clock rather than the caller's, or
	   someone west of Greenwich gets a fresh allowance while the real quota is
	   still spent. These two moments are one second apart. */
	it("changes at UTC midnight, not local midnight", () => {
		expect(dayKey(new Date("2026-08-15T23:59:59Z"))).toBe("2026-08-15");
		expect(dayKey(new Date("2026-08-16T00:00:00Z"))).toBe("2026-08-16");
	});

	it("is the same key all through a day", () => {
		const morning = dayKey(new Date("2026-08-15T00:00:00Z"));
		const evening = dayKey(new Date("2026-08-15T23:59:58Z"));

		expect(morning).toBe(evening);
	});

	/* A moment that is one date locally and another in UTC. Whatever the machine
	   running this thinks the date is, the key follows UTC. */
	it("ignores the running machine's timezone", () => {
		const lateInTheUsEarlyInUtc = new Date("2026-08-16T03:30:00Z");

		expect(dayKey(lateInTheUsEarlyInUtc)).toBe("2026-08-16");
	});

	it("keeps the sortable date shape the table's key expects", () => {
		expect(dayKey(new Date("2026-01-05T08:00:00Z"))).toBe("2026-01-05");
		expect(dayKey(new Date("2026-12-31T08:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("DAILY_RENDER_LIMIT", () => {
	/* Ten minutes of browser time a day at three to four seconds a render is
	   roughly a hundred and fifty, so the app's own cap has to sit under it or it
	   protects nothing. */
	it("leaves headroom under the free plan's own ceiling", () => {
		expect(DAILY_RENDER_LIMIT).toBeLessThan(150);
		expect(DAILY_RENDER_LIMIT).toBeGreaterThan(0);
	});
});

describe("secondsUntilNextDay", () => {
	it("counts to the next UTC midnight", () => {
		expect(secondsUntilNextDay(new Date("2026-08-15T23:59:00Z"))).toBe(60);
		expect(secondsUntilNextDay(new Date("2026-08-15T00:00:00Z"))).toBe(86400);
	});

	it("is always a positive whole number of seconds", () => {
		for (const iso of [
			"2026-08-15T00:00:01Z",
			"2026-08-15T12:34:56Z",
			"2026-08-15T23:59:59Z",
			"2026-12-31T23:00:00Z",
		]) {
			const seconds = secondsUntilNextDay(new Date(iso));

			expect(Number.isInteger(seconds)).toBe(true);
			expect(seconds).toBeGreaterThan(0);
			expect(seconds).toBeLessThanOrEqual(86400);
		}
	});

	// The reset the caller is told about is the same one dayKey follows.
	it("lands exactly when the day key changes", () => {
		const before = new Date("2026-08-15T23:59:59Z");
		const after = new Date(before.getTime() + secondsUntilNextDay(before) * 1000);

		expect(dayKey(before)).toBe("2026-08-15");
		expect(dayKey(after)).toBe("2026-08-16");
	});
});
