import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { InvoiceDraft } from "~/types/invoice";

/* The primary action, where the editor mockup puts it. It posts the draft the
   user is looking at and hands back the file the Worker rendered.

   A render takes a few seconds, which is long enough that the button has to say
   so, and it can fail for a reason worth reading, which is why the message comes
   from the response rather than being invented here. */

type DownloadPdfButtonProps = {
	draft: InvoiceDraft;
};

const GENERIC_ERROR = "The download failed. Please try again.";

/* The server already sanitized this name into the header; reading it back beats
   shipping a second copy of that logic to the browser. */
function filenameFrom(disposition: string | null): string {
	const match = disposition?.match(/filename="([^"]+)"/);
	return match ? match[1] : "invoice.pdf";
}

function saveBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;

	/* In the document and then out again. Chromium downloads from a detached
	   anchor, other browsers have not always, and an element nobody can see for
	   one tick costs nothing. */
	document.body.appendChild(link);
	link.click();
	link.remove();

	/* Revoked on a later turn, not this one. The URL is what lets the browser
	   reach the blob, and a browser that starts the transfer after the current
	   task would find it already gone. */
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DownloadPdfButton({ draft }: DownloadPdfButtonProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function download() {
		setPending(true);
		setError(null);

		try {
			const response = await fetch("/invoice/pdf", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(draft),
			});

			if (!response.ok) {
				/* The endpoint answers in plain sentences, including the one about
				   waiting a moment when the account is out of browser quota. */
				const message = await response.text();
				setError(message.trim() || GENERIC_ERROR);
				return;
			}

			saveBlob(
				await response.blob(),
				filenameFrom(response.headers.get("content-disposition")),
			);
		} catch {
			// A dropped connection or an offline browser never reaches the endpoint.
			setError(GENERIC_ERROR);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			{error ? (
				/* Beside the button rather than in a toast: it is a short sentence
				   about the thing the user just pressed. */
				<span role="alert" className="text-xs text-destructive">
					{error}
				</span>
			) : null}
			{/* The label shortens below `sm` because the bar has no spare width
			    there, and the ~60px this returns is what pays for the Invoices link
			    beside the brand mark (F-45).

			    The accessible name is built from this content rather than pinned with
			    `aria-label`, so it follows the label instead of drifting from it. An
			    `aria-label` here read "Download PDF" in every state, including the
			    seconds when the button says it is preparing one, which is the
			    disagreement WCAG's Label in Name is about (F-50). What a screen reader
			    hears now: "Download PDF", "Download PDF..." while rendering, and
			    "Preparing PDF..." at the wider width, each containing what is on
			    screen. The `hidden` variant is display:none, so only one of the two
			    ever reaches the accessibility tree. */}
			<Button
				type="button"
				size="sm"
				onClick={download}
				disabled={pending}
				aria-busy={pending}
			>
				<span className="sm:hidden">
					{/* The trailing space is inside the span on purpose: name
					    computation joins text nodes without adding one. */}
					<span className="sr-only">Download </span>
					{pending ? "PDF..." : "PDF"}
				</span>
				<span className="hidden sm:inline">
					{pending ? "Preparing PDF..." : "Download PDF"}
				</span>
			</Button>
		</div>
	);
}
