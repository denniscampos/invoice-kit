import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { readSavedInvoiceId, writeSavedInvoiceId } from "~/lib/invoice-draft";
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

	/* The id of what we last saved, so pressing Save twice updates one invoice
	   instead of making two. It is a hint, not a permission: the server scopes
	   every write by the session's user and simply creates a new invoice if this
	   id turns out not to be theirs. */
	const [invoiceId, setInvoiceId] = useState<string | null>(null);
	const [savedNumber, setSavedNumber] = useState<string | null>(null);

	useEffect(() => {
		setInvoiceId(readSavedInvoiceId());
	}, []);

	useEffect(() => {
		if (fetcher.data?.ok) {
			setInvoiceId(fetcher.data.id);
			setSavedNumber(fetcher.data.invoiceNumber);
			writeSavedInvoiceId(fetcher.data.id);
		}
	}, [fetcher.data]);

	// Editing after a save means what is on screen is no longer what was stored.
	useEffect(() => {
		setSavedNumber(null);
	}, [draft]);

	function save() {
		fetcher.submit(
			{ draft: JSON.stringify(draft), invoiceId: invoiceId ?? "" },
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
