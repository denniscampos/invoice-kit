import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { clearStoredDraft } from "~/lib/invoice-draft";
import type { SaveResult } from "~/lib/invoice-save.server";
import type { InvoiceDraft } from "~/types/invoice";

/* Saving, without leaving the page.

   A fetcher rather than a Form: the invoice is on screen and half typed, and a
   navigation would throw away scroll position and focus to tell the user
   something a button label can say. */
/* One key, so the button in the app bar, the message beside the form, and the
   automatic draft handoff are all reading the same submission rather than
   separate fetchers. Exported so DraftHandoff can submit through it and let this
   component's success effect do the landing. */
export const SAVE_FETCHER_KEY = "save-invoice";

/* `invoiceId` is set on `/invoices/:id`, where the invoice already exists and
   saving edits it in place. Without it, this is the editor at `/`, where saving
   creates an invoice and then hands the user over to its own URL.

   That handoff is the whole of what used to be a guess. The editor kept a note
   of the last invoice this tab saved and compared invoice numbers to decide
   whether the draft on screen was still that one, which is how F-41 destroyed an
   invoice. Now the new invoice gets an address and the editor goes there, so
   every save after the first is aimed by the URL and there is nothing to
   infer. */
export function SaveButton({
	draft,
	invoiceId,
}: {
	draft: InvoiceDraft;
	invoiceId?: string;
}) {
	const fetcher = useFetcher<SaveResult>({ key: SAVE_FETCHER_KEY });
	const navigate = useNavigate();
	const saving = fetcher.state !== "idle";

	const [savedNumber, setSavedNumber] = useState<string | null>(null);

	useEffect(() => {
		/* Idle, not merely answered. `fetcher.data` arrives the moment the action
		   returns, while the router is still revalidating this page's loader, and a
		   navigation started in that window is dropped: the URL changes and the old
		   route stays on screen. Waiting for the fetcher to settle is what makes the
		   handoff actually happen. */
		if (saving || !fetcher.data?.ok) return;

		setSavedNumber(fetcher.data.invoiceNumber);

		// An edit to an invoice that already has a URL: stay where we are.
		if (invoiceId) return;

		/* Both together, and in the browser rather than as a redirect from the
		   action, because the copy in this tab has to be forgotten in the same
		   breath as the move. A server redirect would leave the draft in storage,
		   and the next visit to `/` would offer the invoice that was just saved as
		   a new one, refusing to save under a number it already holds. */
		clearStoredDraft();
		navigate(`/invoices/${fetcher.data.id}`);
	}, [saving, fetcher.data, invoiceId, navigate]);

	// Editing after a save means what is on screen is no longer what was stored.
	useEffect(() => {
		setSavedNumber(null);
	}, [draft]);

	function save() {
		/* Only the intent and the draft. Which invoice this is, if it is one
		   already, is the route's business and it reads it from the URL; no id
		   travels in a form body anywhere in this app.

		   `intent` is what tells `/invoices/:id` this is a save rather than a
		   status change. The editor at `/` has one action and ignores it. */
		fetcher.submit(
			{ intent: "save", draft: JSON.stringify(draft) },
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
