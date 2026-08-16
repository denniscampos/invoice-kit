import { toIsoDate } from "~/lib/invoice-draft";
import type { InvoiceStatus } from "~/types/invoice";

/* What a status looks like once it is on screen, which is not what is stored.

   `overdue` is derived at read time and has no column: a stored flag would need
   a scheduled job to flip it and would be wrong for every invoice the job
   missed. It is a face `sent` wears, not a fifth state an invoice can be put
   into, which is why nothing here can produce one and why only `sent` is
   eligible. */
export type DisplayStatus = InvoiceStatus | "overdue";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
	draft: "Draft",
	sent: "Sent",
	paid: "Paid",
	void: "Void",
	overdue: "Overdue",
};

/* Takes the day rather than reading the clock, so a caller decides what "now"
   means and the tests need no timer faking.

   Derive this in the loader, not the component. The Worker's clock is UTC and
   the browser's is local, so the two can disagree about the date; computing it
   once on the server means both renders agree and hydration matches. The cost is
   that a user well west of UTC can see an invoice due today flip to overdue late
   in their evening. It is a soft visual signal rather than a number, and the
   real fix is a per-user locale and timezone, which is feature 22's job (the
   same place F-15 and F-18 wait). */
export function displayStatus(
	status: InvoiceStatus,
	dueDate: string,
	today: Date,
): DisplayStatus {
	/* Paid and void are terminal: a paid invoice past its due date was paid, and
	   overdue would be a lie about a settled document. Draft was never sent, so
	   nobody owes anything yet. */
	if (status !== "sent") return status;

	const due = dueDate.trim();

	/* Both sides are ISO YYYY-MM-DD, so a string compare is a date compare. A due
	   date that is blank or malformed compares false and leaves the invoice
	   `sent`, which is the safer answer than accusing someone of being late on
	   the strength of a value this cannot read. */
	return due && due < toIsoDate(today) ? "overdue" : status;
}
