import { describe, expect, it } from "vitest";
import { displayStatus } from "./invoice-status";

/* Local noon, so the assertions are about the date and not about which side of
   midnight a timezone offset lands on. `toIsoDate` reads local calendar fields,
   which is the behaviour being pinned. */
const TODAY = new Date(2026, 7, 16, 12, 0, 0);

describe("displayStatus", () => {
	it("shows a sent invoice past its due date as overdue", () => {
		expect(displayStatus("sent", "2026-08-15", TODAY)).toBe("overdue");
	});

	// The boundary: due today is due, not late. Yesterday is late.
	it("does not call a sent invoice due today overdue", () => {
		expect(displayStatus("sent", "2026-08-16", TODAY)).toBe("sent");
	});

	it("does not call a sent invoice due tomorrow overdue", () => {
		expect(displayStatus("sent", "2026-08-17", TODAY)).toBe("sent");
	});

	/* The case that proves overdue does not outrank a settled invoice. Money that
	   arrived late is still money that arrived. */
	it("leaves a paid invoice paid however far past its due date", () => {
		expect(displayStatus("paid", "2020-01-01", TODAY)).toBe("paid");
	});

	it("leaves a void invoice void past its due date", () => {
		expect(displayStatus("void", "2020-01-01", TODAY)).toBe("void");
	});

	/* A draft was never sent, so nobody is late on it. Drafts sitting past their
	   due date are the normal state of an invoice someone started and left. */
	it("leaves a draft a draft past its due date", () => {
		expect(displayStatus("draft", "2020-01-01", TODAY)).toBe("draft");
	});

	it("leaves a sent invoice with no due date alone", () => {
		expect(displayStatus("sent", "", TODAY)).toBe("sent");
		expect(displayStatus("sent", "   ", TODAY)).toBe("sent");
	});

	/* Accusing someone of being late on a value we cannot read is worse than
	   saying nothing. */
	it("leaves a sent invoice alone when the due date is unreadable", () => {
		expect(displayStatus("sent", "not-a-date", TODAY)).toBe("sent");
	});

	it("crosses a year boundary", () => {
		expect(displayStatus("sent", "2025-12-31", new Date(2026, 0, 1, 12))).toBe(
			"overdue",
		);
		expect(displayStatus("sent", "2026-01-01", new Date(2026, 0, 1, 12))).toBe(
			"sent",
		);
	});
});
