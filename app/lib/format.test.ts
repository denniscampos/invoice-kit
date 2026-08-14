import { describe, expect, it } from "vitest";
import { formatInvoiceDate, partyAddressLines } from "./format";
import type { Party } from "~/types/invoice";

function party(fields: Partial<Party> = {}): Party {
	return {
		name: "",
		address: "",
		city: "",
		region: "",
		postalCode: "",
		country: "",
		email: "",
		phone: "",
		taxId: "",
		...fields,
	};
}

const text = (lines: { text: string }[]) => lines.map((line) => line.text);

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

describe("partyAddressLines", () => {
	it("prints a full address in document order", () => {
		const lines = partyAddressLines(
			party({
				name: "Acme Studio",
				address: "118 Fremont Street",
				city: "San Francisco",
				region: "CA",
				postalCode: "94105",
				country: "United States",
				email: "billing@acmestudio.co",
				phone: "+1 415 555 0132",
				taxId: "EIN 84-2910773",
			}),
		);

		expect(text(lines)).toEqual([
			"118 Fremont Street",
			"San Francisco, CA 94105",
			"United States",
			"billing@acmestudio.co",
			"+1 415 555 0132",
			"EIN 84-2910773",
		]);
	});

	/* The name is the one line every template sets differently, so it is not in
	   here. Leaving it out of the list is the contract, not an omission. */
	it("leaves the name out", () => {
		const lines = partyAddressLines(party({ name: "Acme Studio" }));

		expect(lines).toEqual([]);
	});

	it("returns nothing for an empty party", () => {
		expect(partyAddressLines(party())).toEqual([]);
	});

	it.each([
		["city alone", { city: "Berlin" }, "Berlin"],
		["region alone", { region: "CA" }, "CA"],
		["postal code alone", { postalCode: "94105" }, "94105"],
		["city and region", { city: "Berlin", region: "BE" }, "Berlin, BE"],
		["city and postal code", { city: "Berlin", postalCode: "10115" }, "Berlin 10115"],
		["region and postal code", { region: "CA", postalCode: "94105" }, "CA 94105"],
	])("joins %s without stray punctuation", (_label, fields, expected) => {
		expect(text(partyAddressLines(party(fields)))).toEqual([expected]);
	});

	/* A field holding only a space is indistinguishable from an empty one on the
	   page, but it survives a plain truthiness filter and prints an orphaned
	   comma or a blank line. */
	it("ignores fields holding only whitespace", () => {
		const lines = partyAddressLines(
			party({ address: "  ", city: " ", region: "CA", country: "\t" }),
		);

		expect(text(lines)).toEqual(["CA"]);
	});

	it("trims the text it does print", () => {
		const lines = partyAddressLines(party({ address: "  118 Fremont Street " }));

		expect(text(lines)).toEqual(["118 Fremont Street"]);
	});

	/* Templates set these in tabular figures; the rest follows the running text. */
	it("marks the phone and tax id as numeric and nothing else", () => {
		const lines = partyAddressLines(
			party({
				address: "118 Fremont Street",
				email: "billing@acmestudio.co",
				phone: "+1 415 555 0132",
				taxId: "EIN 84-2910773",
			}),
		);

		expect(lines.filter((line) => line.numeric).map((line) => line.text)).toEqual(
			["+1 415 555 0132", "EIN 84-2910773"],
		);
	});
});
