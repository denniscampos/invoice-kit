import { describe, expect, it } from "vitest";
import {
	addDays,
	createEmptyDraft,
	isDueDatePinned,
	nextDueDate,
	toIsoDate,
} from "./invoice-draft";

describe("toIsoDate", () => {
	it("uses the local calendar date, not UTC", () => {
		// Late evening is when toISOString() would roll the date backwards for
		// anyone west of Greenwich.
		expect(toIsoDate(new Date(2026, 7, 14, 23, 30))).toBe("2026-08-14");
	});
});

describe("addDays", () => {
	it("crosses months and years", () => {
		expect(addDays("2026-08-14", 30)).toBe("2026-09-13");
		expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
	});

	it("handles a leap day", () => {
		expect(addDays("2028-02-27", 2)).toBe("2028-02-29");
	});
});

/* The rule that produced F-01, F-07, and F-08. All four issue/due states are
   here so the next change to it fails loudly instead of in someone's invoice. */
describe("isDueDatePinned", () => {
	it.each([
		["both blank, before the client fills the dates in", "", "", false],
		["due date is the default offset", "2026-08-14", "2026-09-13", false],
		["due date the user took over", "2026-08-14", "2027-03-15", true],
		["issue date cleared, due date still set", "", "2027-03-15", true],
		["due date cleared deliberately", "2026-08-14", "", true],
	])("%s", (_name, issueDate, dueDate, expected) => {
		expect(isDueDatePinned({ issueDate, dueDate })).toBe(expected);
	});
});

describe("nextDueDate", () => {
	it("follows the issue date while unpinned", () => {
		const draft = { issueDate: "2026-08-14", dueDate: "2026-09-13" };

		expect(nextDueDate(draft, "2026-11-05")).toBe("2026-12-05");
	});

	it("holds a pinned due date, including across a cleared issue date", () => {
		const pinned = { issueDate: "2026-08-14", dueDate: "2027-03-15" };

		expect(nextDueDate(pinned, "2026-11-05")).toBe("2027-03-15");
		expect(nextDueDate({ issueDate: "", dueDate: "2027-03-15" }, "2026-08-20")).toBe(
			"2027-03-15",
		);
	});

	it("clears an unpinned due date when the issue date is cleared", () => {
		const draft = { issueDate: "2026-08-14", dueDate: "2026-09-13" };

		expect(nextDueDate(draft, "")).toBe("");
	});
});

describe("createEmptyDraft", () => {
	it("defaults the due date to 30 days after the issue date", () => {
		const draft = createEmptyDraft(new Date(2026, 7, 14));

		expect(draft.issueDate).toBe("2026-08-14");
		expect(draft.dueDate).toBe("2026-09-13");
	});

	it("starts on the contract every later feature reads", () => {
		const draft = createEmptyDraft(new Date(2026, 7, 14));

		expect(draft).toMatchObject({
			version: 1,
			invoiceNumber: "INV-0001",
			status: "draft",
			templateId: "minimal",
			currency: "USD",
			lineItems: [],
		});
		expect(draft.billFrom.name).toBe("");
		expect(draft.billTo.taxId).toBe("");
	});
});
