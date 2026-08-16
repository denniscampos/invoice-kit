import { useEffect, useState } from "react";
import type { Route } from "./+types/editor";
import { AppBar } from "~/components/AppBar";
import { DownloadPdfButton } from "~/components/invoice/DownloadPdfButton";
import { InvoiceDetailsFields } from "~/components/invoice/InvoiceDetailsFields";
import { LineItemsCard } from "~/components/invoice/LineItemsCard";
import { PartyFields } from "~/components/invoice/PartyFields";
import { PreviewPane } from "~/components/invoice/PreviewPane";
import { SaveButton, SaveError } from "~/components/invoice/SaveButton";
import { SaveNote } from "~/components/invoice/SaveNote";
import { SessionActions } from "~/components/SessionActions";
import { cloudflareContext } from "~/context";
import { getUser, requireUser } from "~/lib/auth.server";
import { saveDraft } from "~/lib/invoice-save.server";
import { nextInvoiceNumber } from "~/lib/invoice-number";
import { listInvoiceNumbers } from "~/lib/invoice-store.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import {
	createEmptyDraft,
	readStoredDraft,
	todaysDates,
	writeStoredDraft,
} from "~/lib/invoice-draft";
import type { InvoiceDraft, Party } from "~/types/invoice";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Invoice Kit" },
		{ name: "description", content: "Make an invoice, download the PDF." },
	];
}

/* The number to suggest for a brand new invoice. Null for a visitor with no
   account, who has no sequence to count on from and keeps the INV-0001 the
   editor already starts with. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);
	const user = await getUser(request, env);

	if (!user) return { signedIn: false, suggestedNumber: null };

	return {
		signedIn: true,
		suggestedNumber: nextInvoiceNumber(await listInvoiceNumbers(env.DB, user.id)),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const { env } = context.get(cloudflareContext);

	/* Throws a redirect to sign in when there is no session. Saving is the first
	   thing in this app that needs an account, which is exactly the moment the
	   overview says to ask for one. */
	const user = await requireUser(request, env);

	const form = await request.formData();
	const knownId = String(form.get("invoiceId") ?? "") || null;

	let payload: unknown;
	try {
		payload = JSON.parse(String(form.get("draft") ?? ""));
	} catch {
		return { ok: false as const, error: "That invoice could not be read. Please try again." };
	}

	return saveDraft(env.DB, user.id, payload, knownId);
}

export default function Editor({ loaderData }: Route.ComponentProps) {
	const { signedIn, suggestedNumber } = loaderData;
	const [draft, setDraft] = useState<InvoiceDraft>(() => ({
		...createEmptyDraft(),
		/* The Worker renders in UTC and the browser in local time, so the two can
		   disagree about what day it is. Dates start blank so both render the same
		   HTML, then the client fills them in below. */
		issueDate: "",
		dueDate: "",
	}));

	/* Until the stored draft has been read, writing would overwrite it with the
	   blank initial state. */
	const [restored, setRestored] = useState(false);

	useEffect(() => {
		/* Once, on mount. Saving revalidates the loader, which changes
		   `suggestedNumber` to the next one in the sequence, and without this
		   guard that would re-run the restore and replace the draft object the
		   user is editing. */
		if (restored) return;

		const stored = readStoredDraft();

		if (stored) {
			setDraft(stored);
		} else {
			setDraft((current) => ({
				...current,
				...todaysDates(),
				/* Only on a brand new invoice. Overwriting a restored draft's number
				   would undo whatever the user typed there before their last visit. */
				...(suggestedNumber ? { invoiceNumber: suggestedNumber } : {}),
			}));
		}

		setRestored(true);
	}, [restored, suggestedNumber]);

	useEffect(() => {
		if (!restored) return;

		// Debounced so typing a name is not one storage write per keystroke.
		const timer = setTimeout(() => writeStoredDraft(draft), 300);
		return () => clearTimeout(timer);
	}, [draft, restored]);

	function patchDraft(patch: Partial<InvoiceDraft>) {
		setDraft((current) => ({ ...current, ...patch }));
	}

	function setParty(key: "billFrom" | "billTo") {
		return (party: Party) => patchDraft({ [key]: party });
	}

	return (
		<>
			<AppBar
				actions={
					<div className="flex items-center gap-2">
						<SessionActions />
						{signedIn ? <SaveButton draft={draft} /> : null}
						<DownloadPdfButton draft={draft} />
					</div>
				}
			/>
			<main className="editor:grid-cols-[minmax(420px,1fr)_minmax(520px,1.05fr)] mx-auto grid max-w-[1560px] items-start gap-6 p-6">
				<div className="flex min-w-0 flex-col gap-4">
					{signedIn ? <SaveError /> : <SaveNote />}
					<InvoiceDetailsFields draft={draft} onChange={patchDraft} />
					<LineItemsCard draft={draft} onChange={patchDraft} />
					<PartyFields
						title="Bill from"
						idPrefix="bill-from"
						value={draft.billFrom}
						onChange={setParty("billFrom")}
					/>
					<PartyFields
						title="Bill to"
						idPrefix="bill-to"
						value={draft.billTo}
						onChange={setParty("billTo")}
					/>
					<Card>
						<CardHeader>
							<CardTitle>Notes</CardTitle>
						</CardHeader>
						<CardContent>
							<Textarea
								id="notes"
								aria-label="Additional notes"
								placeholder="Shown at the bottom of the invoice."
								className="min-h-[72px]"
								value={draft.notes}
								onChange={(event) => patchDraft({ notes: event.target.value })}
							/>
						</CardContent>
					</Card>
				</div>

				{/* min-w-0 because a grid item defaults to min-width:auto, which means
				    it refuses to be narrower than its content. The document inside has
				    a real minimum width, and without this the whole page widens to fit
				    it and scrolls sideways on a phone. It scrolls inside its own frame
				    instead, which is what the frame was built for. */}
				<div className="editor:sticky editor:top-20 min-w-0">
					<PreviewPane draft={draft} onChange={patchDraft} />
				</div>
			</main>
		</>
	);
}
