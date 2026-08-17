import { describe, expect, it } from "vitest";
import {
	displayStatus,
	invoicePermissions,
	parseSettableStatus,
} from "./invoice-status";

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

describe("parseSettableStatus", () => {
	it("accepts the three a user may choose", () => {
		expect(parseSettableStatus("draft")).toBe("draft");
		expect(parseSettableStatus("sent")).toBe("sent");
		expect(parseSettableStatus("paid")).toBe("paid");
	});

	/* The case worth having. `void` is a real InvoiceStatus, so an implementation
	   that checked membership in that type instead would take it, and the status
	   control would quietly own a decision feature 12 has not made yet. */
	it("refuses void, which is a real status but not one this hands out", () => {
		expect(parseSettableStatus("void")).toBeNull();
	});

	it("refuses overdue, which is derived and has no column", () => {
		expect(parseSettableStatus("overdue")).toBeNull();
	});

	it("refuses anything that is not one of the three", () => {
		expect(parseSettableStatus("")).toBeNull();
		expect(parseSettableStatus("DRAFT")).toBeNull();
		expect(parseSettableStatus("sent ")).toBeNull();
		expect(parseSettableStatus("deleted")).toBeNull();
	});

	// It reads a form field, so every one of these is a value it can be handed.
	it("refuses values that are not strings at all", () => {
		expect(parseSettableStatus(null)).toBeNull();
		expect(parseSettableStatus(undefined)).toBeNull();
		expect(parseSettableStatus(0)).toBeNull();
		expect(parseSettableStatus(["sent"])).toBeNull();
		expect(parseSettableStatus({ status: "sent" })).toBeNull();
	});
});

describe("invoicePermissions", () => {
	/* A case per status, all three flags each, so the matrix is pinned rather than
	   sampled. Every one of these is a rule some later feature could quietly
	   loosen. */
	it("lets a draft be deleted but not voided", () => {
		expect(invoicePermissions("draft")).toEqual({
			canEdit: true,
			canSetStatus: true,
			canVoid: false,
			canDelete: true,
		});
	});

	/* The number is already with a client, so the record stays and the invoice is
	   voided instead of removed. */
	it("lets a sent invoice be voided but not deleted", () => {
		expect(invoicePermissions("sent")).toEqual({
			canEdit: true,
			canSetStatus: true,
			canVoid: true,
			canDelete: false,
		});
	});

	/* Paid keeps editing and nothing else. Being paid and being cancelled
	   contradict each other, and the way out is feature 10's status control. */
	it("lets a paid invoice be edited and nothing else", () => {
		expect(invoicePermissions("paid")).toEqual({
			canEdit: true,
			canSetStatus: true,
			canVoid: false,
			canDelete: false,
		});
	});

	/* The row that matters. A void invoice permits nothing at all, and it is the
	   only status in the app that denies anything: a record that can be rewritten,
	   or moved back out of void, is not the kept record voiding exists to leave
	   behind. `canSetStatus` is here because it was missing in practice, not in
	   theory: the status intent could un-void an invoice until F-54. */
	it("permits nothing at all on a void invoice", () => {
		expect(invoicePermissions("void")).toEqual({
			canEdit: false,
			canSetStatus: false,
			canVoid: false,
			canDelete: false,
		});
	});

	it("freezes a void invoice against both writes at once", () => {
		const frozen = (["draft", "sent", "paid", "void"] as const).filter(
			(status) => !invoicePermissions(status).canSetStatus,
		);

		expect(frozen).toEqual(["void"]);
		expect(invoicePermissions("void").canEdit).toBe(false);
	});

	it("denies editing for void and only for void", () => {
		const editable = (["draft", "sent", "paid", "void"] as const).filter(
			(status) => invoicePermissions(status).canEdit,
		);

		expect(editable).toEqual(["draft", "sent", "paid"]);
	});
});
