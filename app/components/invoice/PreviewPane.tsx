import { InvoiceTemplate } from "~/components/invoice/InvoiceTemplate";
import type { InvoiceDraft } from "~/types/invoice";

/* Editor chrome around the document: the frame, the live bar, and the scrolling
   area. None of it travels to the PDF, which is why it is separate from
   InvoiceTemplate rather than a prop on it. */

type PreviewPaneProps = {
	draft: InvoiceDraft;
};

export function PreviewPane({ draft }: PreviewPaneProps) {
	return (
		<div className="overflow-hidden rounded-xl border shadow-sm">
			<div className="flex items-center gap-3 border-b bg-card px-4 py-3 text-xs text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className="size-1.5 rounded-full bg-status-paid-fg"
					/>
					Live preview
				</span>
			</div>

			{/* The cap applies only where the column is sticky. Below that breakpoint
			    the preview sits under the form and scrolling the page is the natural
			    way through it, so a scroll area inside a scroll area would just be in
			    the way. 11rem covers the sticky offset, this bar, and a bottom
			    margin. */}
			<div className="editor:max-h-[calc(100vh-11rem)] overflow-auto bg-muted p-4">
				<div className="shadow-sm">
					<InvoiceTemplate draft={draft} />
				</div>
			</div>
		</div>
	);
}
