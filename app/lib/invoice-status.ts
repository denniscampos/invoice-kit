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

/* The three a user may put an invoice into, which is not the whole of
   `InvoiceStatus`.

   `void` is missing on purpose. It is a real stored status, but feature 12 owns
   it along with delete, because the two are one decision: a draft is deleted and
   a sent invoice is voided and kept. A control that could set it here would
   pre-empt the rules that feature has yet to make about what may be voided.

   Nothing else in the app decides anything on the strength of a status. It
   changes what the badge says and, through `displayStatus`, whether a past-due
   invoice reads as overdue; it does not gate editing, saving, or rendering. A
   later feature that wants to make a real decision from a status has to argue
   for that separately. */
export const SETTABLE_STATUSES = ["draft", "sent", "paid"] as const;

export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

/* Takes unknown, because this reads a form field. Membership in this list rather
   than in `InvoiceStatus`, or "void" would be accepted: it is a perfectly valid
   status, just not one this feature hands out. */
export function parseSettableStatus(value: unknown): SettableStatus | null {
	return SETTABLE_STATUSES.includes(value as SettableStatus)
		? (value as SettableStatus)
		: null;
}

/* What may be done to an invoice in a given state.

   One function rather than a status comparison at each call site, because there
   are three of those (the loader deciding what to render, the action deciding
   what to allow, and the component deciding what to show) and three copies of a
   rule is how the rule stops being one.

   The whole matrix:

     draft   edit yes   setStatus yes   void no    delete YES
     sent    edit yes   setStatus yes   void YES   delete no
     paid    edit yes   setStatus yes   void no    delete no
     void    edit NO    setStatus NO    void no    delete no

   A void invoice is frozen, and that is the only place in this app where a
   status decides anything beyond what a badge says. It earns it: voiding exists
   so a cancelled invoice is kept, and a record that can still be rewritten, or
   moved back out of void, is not kept. Every other cell only picks which of the
   two removal paths an invoice qualifies for, which is the point of feature 12.

   `canEdit` and `canSetStatus` have the same answer today and are still two
   flags, because they are two questions: may the body be rewritten, and may the
   recorded status move. They agree only because `void` is currently the one
   terminal state, so both are derived from that single fact rather than written
   out twice. A later feature that freezes one without the other changes one
   line here instead of hunting for the call sites.

   F-54 is why `canSetStatus` exists: the status intent shipped before this
   function did and answered to nobody, so a void invoice could be posted back to
   paid, and because `canEdit` follows the stored status, that made it editable
   again.

   Deleting is for a draft, because nobody outside has seen it. Voiding is for a
   sent one, because its number is already with a client and a hole in the
   sequence is what an accountant asks about. A paid invoice is neither: being
   paid and being cancelled contradict each other, and the instrument for that is
   a credit note, which this app does not have. Status is freely settable
   (feature 10), so a user who really means it can move an invoice to draft and
   delete it; that is their call, and this rule is about the state on record
   rather than a claim about history. */
export type InvoicePermissions = {
	canEdit: boolean;
	canSetStatus: boolean;
	canVoid: boolean;
	canDelete: boolean;
};

export function invoicePermissions(status: InvoiceStatus): InvoicePermissions {
	const frozen = status === "void";

	return {
		canEdit: !frozen,
		canSetStatus: !frozen,
		canVoid: status === "sent",
		canDelete: status === "draft",
	};
}

/* The value a status control should show, or null when there should be no
   control.

   The permission is asked first and the narrowing second, and the order is the
   whole point (F-58). These used to be computed side by side: the component read
   a narrowed value and the action read the permission, two answers to one
   question, which is how F-54 happened one layer down. Now the value cannot
   exist when the rule says no, so a component cannot render a control the action
   will refuse.

   The second check is not a duplicate of the first. `canSetStatus` is the rule;
   `parseSettableStatus` is what proves to the type system that a status a user
   may set is one of the three the control can offer. If the two ever disagree,
   the permission wins and this returns null, which is the direction that fails
   safe. */
export function settableStatusOf(status: InvoiceStatus): SettableStatus | null {
	if (!invoicePermissions(status).canSetStatus) return null;

	return parseSettableStatus(status);
}

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
