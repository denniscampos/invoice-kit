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
