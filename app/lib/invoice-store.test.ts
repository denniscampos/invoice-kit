import { describe, expect, it } from "vitest";
import { draftToRows, rowsToDraft } from "./invoice-store.server";
import type { InvoiceDraft, LineItem, Party } from "~/types/invoice";

const NOW = "2026-08-16T10:00:00.000Z";

function party(overrides: Partial<Party> = {}): Party {
	return {
		name: "Northwind Ltd",
		address: "12 Harbour Road",
		city: "Bristol",
		region: "Avon",
		postalCode: "BS1 4TR",
		country: "United Kingdom",
		email: "accounts@northwind.co.uk",
		phone: "+44 117 496 0000",
		taxId: "GB123456789",
		...overrides,
	};
}

function item(overrides: Partial<LineItem> = {}): LineItem {
	return {
		id: "li-1",
		position: 0,
		name: "Design work",
		description: "Two days",
		quantity: 2,
		rate: 50000,
		total: 100000,
		...overrides,
	};
}

function draft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
	return {
		version: 1,
		invoiceNumber: "INV-0007",
		status: "draft",
		templateId: "minimal",
		issueDate: "2026-08-16",
		dueDate: "2026-09-15",
		currency: "GBP",
		billFrom: party({ name: "My Studio" }),
		billTo: party(),
		paymentTerms: "Net 30",
		notes: "Thanks",
		lineItems: [item()],
		...overrides,
	};
}

describe("draftToRows and rowsToDraft", () => {
	it("round trips a draft unchanged", () => {
		const original = draft();
		const { invoice, lineItems } = draftToRows(original, "u-1", "inv-1", NOW);

		expect(rowsToDraft(invoice, lineItems)).toEqual(original);
	});

	it("keeps bill from and bill to apart", () => {
		const original = draft({
			billFrom: party({ name: "Sender", city: "Leeds" }),
			billTo: party({ name: "Receiver", city: "Cardiff" }),
		});
		const { invoice, lineItems } = draftToRows(original, "u-1", "inv-1", NOW);

		expect(invoice.billFromName).toBe("Sender");
		expect(invoice.billFromCity).toBe("Leeds");
		expect(invoice.billToName).toBe("Receiver");
		expect(invoice.billToCity).toBe("Cardiff");

		const back = rowsToDraft(invoice, lineItems);
		expect(back.billFrom.name).toBe("Sender");
		expect(back.billTo.name).toBe("Receiver");
	});

	it("carries the user id and the ids it was given", () => {
		const { invoice, lineItems } = draftToRows(draft(), "u-9", "inv-9", NOW);

		expect(invoice.userId).toBe("u-9");
		expect(invoice.id).toBe("inv-9");
		expect(lineItems[0].invoiceId).toBe("inv-9");
	});

	it("stores an empty optional as null, and reads it back as empty", () => {
		const { invoice, lineItems } = draftToRows(
			draft({ paymentTerms: "", notes: "", lineItems: [item({ description: "" })] }),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(invoice.paymentTerms).toBeNull();
		expect(invoice.notes).toBeNull();
		expect(lineItems[0].description).toBeNull();

		const back = rowsToDraft(invoice, lineItems);
		expect(back.paymentTerms).toBe("");
		expect(back.notes).toBe("");
		expect(back.lineItems[0].description).toBe("");
	});

	it("writes a new invoice as a draft, and stamps both timestamps", () => {
		const { invoice } = draftToRows(draft(), "u-1", "inv-1", NOW);

		expect(invoice.status).toBe("draft");
		expect(invoice.createdAt).toBe(NOW);
		expect(invoice.updatedAt).toBe(NOW);
	});

	it("keeps the original createdAt on a later write", () => {
		const later = "2026-09-01T09:00:00.000Z";
		const { invoice } = draftToRows(draft(), "u-1", "inv-1", later, NOW);

		expect(invoice.createdAt).toBe(NOW);
		expect(invoice.updatedAt).toBe(later);
	});

	it("leaves the columns later features own alone", () => {
		const { invoice } = draftToRows(draft(), "u-1", "inv-1", NOW);

		expect(invoice.logoAssetId).toBeNull();
		expect(invoice.customFields).toBeNull();
		expect(invoice.discountTotal).toBe(0);
		expect(invoice.taxTotal).toBe(0);
	});
});

describe("the money the server computes", () => {
	/* The whole reason this seam exists. The posted total is a number the client
	   worked out, and the stored one has to be the number this side worked out. */
	it("overrules a posted total that disagrees with quantity times rate", () => {
		const { invoice, lineItems } = draftToRows(
			draft({ lineItems: [item({ quantity: 1, rate: 50000, total: 1 })] }),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(lineItems[0].total).toBe(50000);
		expect(invoice.subtotal).toBe(50000);
		expect(invoice.total).toBe(50000);
	});

	it("ignores a posted subtotal entirely, summing the items instead", () => {
		const { invoice } = draftToRows(
			draft({
				lineItems: [
					item({ id: "a", quantity: 2, rate: 50000, total: 0 }),
					item({ id: "b", quantity: 1, rate: 25000, total: 0 }),
				],
			}),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(invoice.subtotal).toBe(125000);
	});

	// Same rounding as the editor and the preview, so a saved invoice matches
	// the number the user was looking at when they pressed save.
	it("rounds a fractional cent the way the rest of the app rounds", () => {
		const { lineItems } = draftToRows(
			draft({ lineItems: [item({ quantity: 0.333, rate: 1000, total: 999 })] }),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(lineItems[0].total).toBe(333);
	});

	it("gives an invoice with no items a subtotal of zero", () => {
		const { invoice, lineItems } = draftToRows(
			draft({ lineItems: [] }),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(lineItems).toEqual([]);
		expect(invoice.subtotal).toBe(0);
		expect(invoice.total).toBe(0);
	});

	it("makes the total the subtotal while discount and tax are zero", () => {
		const { invoice } = draftToRows(draft(), "u-1", "inv-1", NOW);

		expect(invoice.total).toBe(invoice.subtotal - invoice.discountTotal + invoice.taxTotal);
	});
});

describe("line item order", () => {
	it("takes position from the array, not from what was posted", () => {
		const { lineItems } = draftToRows(
			draft({
				lineItems: [
					item({ id: "first", position: 99 }),
					item({ id: "second", position: 3 }),
					item({ id: "third", position: 0 }),
				],
			}),
			"u-1",
			"inv-1",
			NOW,
		);

		expect(lineItems.map((row) => [row.id, row.position])).toEqual([
			["first", 0],
			["second", 1],
			["third", 2],
		]);
	});

	// Rows come back from SQL in whatever order the query gave them; the draft
	// has to be in display order regardless.
	it("reads items back in position order whatever order the rows arrive in", () => {
		const { invoice, lineItems } = draftToRows(
			draft({
				lineItems: [
					item({ id: "first" }),
					item({ id: "second" }),
					item({ id: "third" }),
				],
			}),
			"u-1",
			"inv-1",
			NOW,
		);

		const shuffled = [lineItems[2], lineItems[0], lineItems[1]];
		const back = rowsToDraft(invoice, shuffled);

		expect(back.lineItems.map((line) => line.id)).toEqual([
			"first",
			"second",
			"third",
		]);
	});
});
