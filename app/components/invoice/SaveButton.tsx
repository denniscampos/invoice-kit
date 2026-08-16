import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	readSavedInvoiceRef,
	type SavedInvoiceRef,
	writeSavedInvoiceRef,
} from "~/lib/invoice-draft";
import type { SaveResult } from "~/lib/invoice-save.server";
import type { InvoiceDraft } from "~/types/invoice";

/* Saving, without leaving the page.

   A fetcher rather than a Form: the invoice is on screen and half typed, and a
   navigation would throw away scroll position and focus to tell the user
   something a button label can say. */
/* One key, so the button in the app bar and the message beside the form are
   reading the same submission rather than two unrelated fetchers. */
const SAVE_FETCHER_KEY = "save-invoice";

export function SaveButton({ draft }: { draft: InvoiceDraft }) {
	const fetcher = useFetcher<SaveResult>({ key: SAVE_FETCHER_KEY });
	const saving = fetcher.state !== "idle";

	/* What this tab last saved, so pressing Save twice updates one invoice
	   instead of making two. A hint, not a permission: the server scopes every
	   write by the session's user and creates a new invoice if this id turns out
	   not to be theirs. */
	const [saved, setSaved] = useState<SavedInvoiceRef | null>(null);
	const [savedNumber, setSavedNumber] = useState<string | null>(null);

	useEffect(() => {
		setSaved(readSavedInvoiceRef());
	}, []);

	useEffect(() => {
		if (fetcher.data?.ok) {
			const ref = {
				id: fetcher.data.id,
				invoiceNumber: fetcher.data.invoiceNumber,
			};

			setSaved(ref);
			setSavedNumber(ref.invoiceNumber);
			writeSavedInvoiceRef(ref);
		}
	}, [fetcher.data]);

	// Editing after a save means what is on screen is no longer what was stored.
	useEffect(() => {
		setSavedNumber(null);
	}, [draft]);

	function save() {
		/* The id goes only while the number still matches the one it was saved
		   under. A changed number means the user has moved on to their next
		   invoice, and sending the id would aim this save at the previous one and
		   overwrite it, which is exactly what F-41 was.

		   The trade: correcting the number of an existing invoice produces a
		   second invoice rather than a renamed one. That is a duplicate the user
		   can see and delete; the alternative silently destroyed an invoice. */
		const sameInvoice =
			saved !== null && saved.invoiceNumber === draft.invoiceNumber.trim();

		fetcher.submit(
			{
				draft: JSON.stringify(draft),
				invoiceId: sameInvoice ? saved.id : "",
			},
			{ method: "post" },
		);
	}

	return (
		<Button
			type="button"
			variant="secondary"
			size="sm"
			onClick={save}
			disabled={saving}
			aria-busy={saving}
		>
			{saving ? "Saving..." : savedNumber ? "Saved" : "Save"}
		</Button>
	);
}

/* The refusal, next to the form rather than in the bar. The bar is where the
   button lives, but a sentence explaining that a number is taken belongs beside
   the field holding that number. */
export function SaveError() {
	const fetcher = useFetcher<SaveResult>({ key: SAVE_FETCHER_KEY });

	if (!fetcher.data || fetcher.data.ok) return null;

	return (
		<p
			role="alert"
			className="rounded-lg bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue-fg"
		>
			{fetcher.data.error}
		</p>
	);
}
