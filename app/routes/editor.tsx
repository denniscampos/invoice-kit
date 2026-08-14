import { useEffect, useState } from "react";
import type { Route } from "./+types/editor";
import { AppBar } from "~/components/AppBar";
import { InvoiceDetailsFields } from "~/components/invoice/InvoiceDetailsFields";
import { PartyFields } from "~/components/invoice/PartyFields";
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

export default function Editor() {
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
		const stored = readStoredDraft();

		if (stored) {
			setDraft(stored);
		} else {
			setDraft((current) => ({ ...current, ...todaysDates() }));
		}

		setRestored(true);
	}, []);

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
			<AppBar />
			<main className="editor:grid-cols-[minmax(420px,1fr)_minmax(520px,1.05fr)] mx-auto grid max-w-[1560px] items-start gap-6 p-6">
				<div className="flex flex-col gap-4">
					<InvoiceDetailsFields draft={draft} onChange={patchDraft} />
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

				{/* Reserved for the live preview (feature 3). */}
				<div className="editor:sticky editor:top-20 h-[560px] rounded-xl border bg-card" />
			</main>
		</>
	);
}
