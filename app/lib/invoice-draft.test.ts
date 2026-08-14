import { describe, expect, it } from "vitest";
import {
	addDays,
	addLineItem,
	createEmptyDraft,
	invoiceSubtotal,
	isDueDatePinned,
	nextDueDate,
	removeLineItem,
	reorderLineItems,
	toIsoDate,
	updateLineItem,
} from "./invoice-draft";
import type { LineItem } from "~/types/invoice";

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
