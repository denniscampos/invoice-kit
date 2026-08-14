import { describe, expect, it } from "vitest";
import { formatInvoiceDate } from "./format";

describe("formatInvoiceDate", () => {
	it("renders an ISO date the way the invoice shows it", () => {
		expect(formatInvoiceDate("2026-08-13")).toBe("13 Aug 2026");
		expect(formatInvoiceDate("2026-01-01")).toBe("1 Jan 2026");
		expect(formatInvoiceDate("2026-12-31")).toBe("31 Dec 2026");
	});

	/* The draft holds empty dates between the server render and the effect that
	   fills them in, so the document has to render in that window. */
	it("returns an empty string for an empty date", () => {
		expect(formatInvoiceDate("")).toBe("");
		expect(formatInvoiceDate("   ")).toBe("");
	});

	it.each([
		["not-a-date", "letters"],
		["2026-13-01", "month 13"],
		["2026-00-10", "month 0"],
		["2026-02-32", "day 32"],
		["2026-02-00", "day 0"],
		["26-08-13", "a two digit year"],
		["2026-8-13", "an unpadded month"],
	])("returns an empty string rather than Invalid Date for %s (%s)", (iso) => {
		expect(formatInvoiceDate(iso)).toBe("");
	});

	/* new Date("2026-08-13") is midnight UTC, which is 13 Aug only east of
	   Greenwich. Reading the parts keeps the date the user picked. */
	it("does not shift the date by timezone", () => {
		expect(formatInvoiceDate("2026-08-13")).toBe("13 Aug 2026");
		expect(formatInvoiceDate("2026-01-01")).not.toContain("Dec");
	});
});
