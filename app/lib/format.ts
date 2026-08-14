import type { Party } from "~/types/invoice";

/* Display formatting for the invoice document. Kept apart from money.ts because
   the PDF renderer (feature 5) needs these on the Worker too, and neither should
   pull in anything browser-only. */

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/* An ISO date as it appears on the invoice: "2026-08-13" becomes "13 Aug 2026".

   Two deliberate choices. It returns "" rather than throwing or printing
   "Invalid Date", because the draft carries empty dates between the server
   render and the effect that fills them in, and the document must render in
   that window. And it builds the text from a month table instead of
   toLocaleDateString, so the same date reads the same way in the preview, in a
   test, and on the Worker that renders the PDF, rather than following whatever
   locale the code happens to run under. */
export function formatInvoiceDate(iso: string): string {
	const match = ISO_DATE.exec(iso.trim());
	if (!match) return "";

	const [, year, month, day] = match;
	const monthIndex = Number(month) - 1;
	const dayNumber = Number(day);

	if (monthIndex < 0 || monthIndex > 11) return "";
	if (dayNumber < 1 || dayNumber > 31) return "";

	return `${dayNumber} ${MONTHS[monthIndex]} ${year}`;
}

/* A line of a party's address block, below the name. `numeric` marks the ones
   that should be set in tabular figures; a template decides what that means for
   its own face. */
export type PartyAddressLine = {
	text: string;
	numeric: boolean;
};

/* The party's details as the lines to print, name excluded: the templates each
   render the name differently, and only these lines follow the same rules.

   Empty fields are dropped rather than printed blank, so a half-filled address
   reads as a short address instead of a block of gaps or stray punctuation.
   Fields are trimmed first, or a field holding only a space would survive the
   filter and print an orphaned comma. */
export function partyAddressLines(party: Party): PartyAddressLine[] {
	const field = (value: string) => value.trim();

	// "San Francisco, CA 94105": the postal code joins with a space, not a comma.
	const cityRegion = [field(party.city), field(party.region)]
		.filter(Boolean)
		.join(", ");
	const cityLine = [cityRegion, field(party.postalCode)]
		.filter(Boolean)
		.join(" ");

	return [
		{ text: field(party.address), numeric: false },
		{ text: cityLine, numeric: false },
		{ text: field(party.country), numeric: false },
		{ text: field(party.email), numeric: false },
		{ text: field(party.phone), numeric: true },
		{ text: field(party.taxId), numeric: true },
	].filter((line) => line.text);
}
