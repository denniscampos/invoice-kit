import type { ReactNode } from "react";
import { InvoiceDetailsFields } from "~/components/invoice/InvoiceDetailsFields";
import { LineItemsCard } from "~/components/invoice/LineItemsCard";
import { PartyFields } from "~/components/invoice/PartyFields";
import { PreviewPane } from "~/components/invoice/PreviewPane";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import type { InvoiceDraft, Party } from "~/types/invoice";

/* The editor itself: the form on the left, the live preview on the right.

   Shared by the two routes that edit an invoice, `/` and `/invoices/:id`,
   because the markup is identical. Deliberately holds no state and touches no
   storage: `/` restores a draft from sessionStorage and works out a suggested
   number, the detail route seeds from its loader and persists nothing, and
   folding those two into one component behind flags would be harder to read than
   the duplication it saved.

   `notice` is the slot above the form for whatever the route wants to say about
   saving. */
type InvoiceEditorPanesProps = {
	draft: InvoiceDraft;
	onChange: (patch: Partial<InvoiceDraft>) => void;
	notice?: ReactNode;
};

export function InvoiceEditorPanes({
	draft,
	onChange,
	notice,
}: InvoiceEditorPanesProps) {
	function setParty(key: "billFrom" | "billTo") {
		return (party: Party) => onChange({ [key]: party });
	}

	return (
		<main className="editor:grid-cols-[minmax(420px,1fr)_minmax(520px,1.05fr)] mx-auto grid max-w-[1560px] items-start gap-6 p-6">
			<div className="flex min-w-0 flex-col gap-4">
				{notice}
				<InvoiceDetailsFields draft={draft} onChange={onChange} />
				<LineItemsCard draft={draft} onChange={onChange} />
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
							onChange={(event) => onChange({ notes: event.target.value })}
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
				<PreviewPane draft={draft} onChange={onChange} />
			</div>
		</main>
	);
}
