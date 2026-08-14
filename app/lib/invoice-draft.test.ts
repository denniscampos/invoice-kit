import { describe, expect, it } from "vitest";
import {
	addDays,
	addLineItem,
	createEmptyDraft,
	parseDraft,
	invoiceSubtotal,
	isDueDatePinned,
	nextDueDate,
	removeLineItem,
	reorderLineItems,
	toIsoDate,
	updateLineItem,
} from "./invoice-draft";
import type { InvoiceDraft, LineItem } from "~/types/invoice";

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

/* A draft carrying named items, so a reorder assertion reads as an order of
   names rather than a list of uuids. */
function draftWith(...names: string[]): { lineItems: LineItem[] } {
	return {
		lineItems: names.map((name, index) => ({
			id: `id-${name}`,
			position: index,
			name,
			description: "",
			quantity: 1,
			rate: 1000,
			total: 1000,
		})),
	};
}

const order = (items: LineItem[]) => items.map((item) => item.name);
const positions = (items: LineItem[]) => items.map((item) => item.position);

describe("addLineItem", () => {
	it("appends a blank row at the next position", () => {
		const items = addLineItem(draftWith("a", "b"));

		expect(items).toHaveLength(3);
		expect(positions(items)).toEqual([0, 1, 2]);
		expect(items[2]).toMatchObject({ name: "", quantity: 1, rate: 0, total: 0 });
		expect(items[2].id).not.toBe(items[1].id);
	});
});

describe("removeLineItem", () => {
	it("renumbers the rows left behind", () => {
		const items = removeLineItem(draftWith("a", "b", "c"), "id-b");

		expect(order(items)).toEqual(["a", "c"]);
		expect(positions(items)).toEqual([0, 1]);
	});

	it("ignores an id that is not there", () => {
		expect(order(removeLineItem(draftWith("a", "b"), "id-zzz"))).toEqual([
			"a",
			"b",
		]);
	});
});

describe("updateLineItem", () => {
	it("recomputes the total whenever quantity or rate changes", () => {
		const withRate = updateLineItem(draftWith("a"), "id-a", { rate: 14500 });
		expect(withRate[0].total).toBe(14500);

		const withQuantity = updateLineItem({ lineItems: withRate }, "id-a", {
			quantity: 18,
		});
		expect(withQuantity[0].total).toBe(261000);
	});

	it("leaves the total alone when only the name changes", () => {
		const items = updateLineItem(draftWith("a"), "id-a", { name: "Design" });

		expect(items[0].name).toBe("Design");
		expect(items[0].total).toBe(1000);
	});

	it("touches only the row it names, and does not mutate the original", () => {
		const draft = draftWith("a", "b");
		const items = updateLineItem(draft, "id-b", { rate: 500 });

		expect(items[0]).toBe(draft.lineItems[0]);
		expect(draft.lineItems[1].rate).toBe(1000);
	});
});

describe("reorderLineItems", () => {
	it("moves a row to the dropped-on position, top to bottom", () => {
		const items = reorderLineItems(draftWith("a", "b", "c"), "id-a", "id-c");

		expect(order(items)).toEqual(["b", "c", "a"]);
		expect(positions(items)).toEqual([0, 1, 2]);
	});

	it("moves a row bottom to top", () => {
		const items = reorderLineItems(draftWith("a", "b", "c"), "id-c", "id-a");

		expect(order(items)).toEqual(["c", "a", "b"]);
		expect(positions(items)).toEqual([0, 1, 2]);
	});

	it.each([
		["dropped on itself", "id-b", "id-b"],
		["an unknown source", "id-zzz", "id-a"],
		["an unknown target", "id-a", "id-zzz"],
	])("changes nothing for %s", (_name, fromId, toId) => {
		expect(order(reorderLineItems(draftWith("a", "b", "c"), fromId, toId))).toEqual(
			["a", "b", "c"],
		);
	});
});

describe("invoiceSubtotal", () => {
	it("sums the stored line totals", () => {
		const draft = draftWith("a", "b", "c");
		draft.lineItems[0].total = 261000;
		draft.lineItems[1].total = 348000;
		draft.lineItems[2].total = 85000;

		expect(invoiceSubtotal(draft)).toBe(694000);
	});

	it("is zero for a draft with no items", () => {
		expect(invoiceSubtotal(createEmptyDraft(new Date(2026, 7, 14)))).toBe(0);
	});
});

describe("parseDraft", () => {
	/* A draft the app itself wrote, as the round trip through sessionStorage
	   hands it back. Everything below is a mutation of this. */
	function stored(overrides: Record<string, unknown> = {}): Record<string, unknown> {
		const draft: InvoiceDraft = {
			...createEmptyDraft(new Date(2026, 7, 14)),
			invoiceNumber: "INV-0007",
			currency: "EUR",
			paymentTerms: "Net 30",
			notes: "Thanks.",
			billTo: {
				name: "Northwind Trading",
				address: "12 Bishopsgate",
				city: "London",
				region: "Greater London",
				postalCode: "EC2N 3AR",
				country: "United Kingdom",
				email: "ap@northwind.example",
				phone: "+44 20 7946 0958",
				taxId: "GB 123456789",
			},
			lineItems: [
				{
					id: "a",
					position: 0,
					name: "Brand identity system",
					description: "Logo and type scale",
					quantity: 1.5,
					rate: 450000,
					total: 675000,
				},
			],
		};

		return { ...JSON.parse(JSON.stringify(draft)), ...overrides };
	}

	it("returns a draft that survived the round trip unchanged", () => {
		const input = stored();

		expect(parseDraft(input)).toEqual(input);
	});

	it("keeps a quantity that is not a whole number", () => {
		// Money is integer minor units; quantity is deliberately not.
		expect(parseDraft(stored())?.lineItems[0].quantity).toBe(1.5);
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["an array", []],
		["a string", "nope"],
		["a number", 4],
		["an empty object", {}],
	])("rejects %s", (_label, value) => {
		expect(parseDraft(value)).toBeNull();
	});

	it.each([
		["a missing version", { version: undefined }],
		["a version from another shape", { version: 2 }],
		["a status it does not own", { status: "paid" }],
		["a missing invoice number", { invoiceNumber: undefined }],
		["a non-string invoice number", { invoiceNumber: 7 }],
		["a missing currency", { currency: undefined }],
		["a missing issue date", { issueDate: undefined }],
		["a missing due date", { dueDate: undefined }],
		["missing payment terms", { paymentTerms: undefined }],
		["missing notes", { notes: undefined }],
		["a missing party", { billTo: undefined }],
		["a party that is not an object", { billFrom: "Acme" }],
		["line items that are not an array", { lineItems: {} }],
	])("rejects %s", (_label, overrides) => {
		expect(parseDraft(stored(overrides))).toBeNull();
	});

	/* F-05: a party object missing its fields used to pass the old guard, then
	   flip a controlled input to uncontrolled once the editor read it. */
	it("rejects a party object missing fields", () => {
		expect(parseDraft(stored({ billFrom: { name: "Acme" } }))).toBeNull();
	});

	it("rejects a party field that is not a string", () => {
		const billTo = { ...(stored().billTo as object), postalCode: 94105 };

		expect(parseDraft(stored({ billTo }))).toBeNull();
	});

	/* F-12: a line item missing its numbers used to reach the document, where
	   the amount column rendered NaN.NaN and the invoice total became NaN. */
	it.each([
		["a missing total", { total: undefined }],
		["a non-numeric total", { total: "675000" }],
		["a NaN total", { total: Number.NaN }],
		["an infinite quantity", { quantity: Number.POSITIVE_INFINITY }],
		["a fractional cent", { rate: 1200.5 }],
		["a missing id", { id: undefined }],
		["a missing name", { name: undefined }],
		["a missing description", { description: undefined }],
		["a missing position", { position: undefined }],
		["an item that is not an object", null],
	])("rejects a line item with %s", (_label, itemOverrides) => {
		const base = (stored().lineItems as Record<string, unknown>[])[0];
		const item = itemOverrides === null ? null : { ...base, ...itemOverrides };

		expect(parseDraft(stored({ lineItems: [item] }))).toBeNull();
	});

	it("accepts an invoice with no line items", () => {
		expect(parseDraft(stored({ lineItems: [] }))?.lineItems).toEqual([]);
	});

	/* F-24: the id is normalized rather than rejected, because the registry
	   already decides what an unknown template renders as. */
	it.each([
		["an unregistered id", "nope"],
		["a missing id", undefined],
		["a number", 4],
	])("falls back to the default template for %s", (_label, templateId) => {
		expect(parseDraft(stored({ templateId }))?.templateId).toBe("minimal");
	});

	it("keeps a registered template id", () => {
		expect(parseDraft(stored({ templateId: "compact" }))?.templateId).toBe(
			"compact",
		);
	});

	/* Fields are copied one by one, so nothing unrecognized rides along into the
	   app or into the document the PDF is made from. */
	it("drops keys it does not recognize", () => {
		const parsed = parseDraft(stored({ evil: "<script>", userId: "someone" }));

		expect(parsed).not.toBeNull();
		expect(parsed).not.toHaveProperty("evil");
		expect(parsed).not.toHaveProperty("userId");
	});

	it("drops unrecognized keys inside a party and a line item", () => {
		const billFrom = { ...(stored().billFrom as object), evil: "x" };
		const item = {
			...(stored().lineItems as Record<string, unknown>[])[0],
			evil: "x",
		};
		const parsed = parseDraft(stored({ billFrom, lineItems: [item] }));

		expect(parsed?.billFrom).not.toHaveProperty("evil");
		expect(parsed?.lineItems[0]).not.toHaveProperty("evil");
	});
});
