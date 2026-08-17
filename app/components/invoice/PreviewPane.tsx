import { TemplateSwitcher } from "~/components/invoice/TemplateSwitcher";
import { InvoiceDocument } from "~/components/invoice/templates";
import type { InvoiceDraft } from "~/types/invoice";

/* Editor chrome around the document: the frame, the live bar, and the scrolling
   area. None of it travels to the PDF, which is why it is separate from the
   document rather than a prop on it. */

type PreviewPaneProps = {
	draft: InvoiceDraft;
	onChange: (patch: Partial<InvoiceDraft>) => void;
};

export function PreviewPane({ draft, onChange }: PreviewPaneProps) {
	return (
		/* On paper the frame is not a frame, it is the page. `overflow-visible`
		   matters most: `overflow-hidden` here would clip a long invoice at the
		   first page instead of letting it flow onto the next. */
		<div className="overflow-hidden rounded-xl border shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
			{/* flex-wrap so the segments drop to a second line on a narrow screen
			    rather than crushing the label next to them. */}
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-3 text-xs text-muted-foreground print:hidden">
				<span className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className="size-1.5 rounded-full bg-status-paid-fg"
					/>
					Live preview
				</span>

				<div className="ml-auto">
					<TemplateSwitcher
						templateId={draft.templateId}
						onSelect={(templateId) => onChange({ templateId })}
					/>
				</div>
			</div>

			{/* The cap applies only where the column is sticky. Below that breakpoint
			    the preview sits under the form and scrolling the page is the natural
			    way through it, so a scroll area inside a scroll area would just be in
			    the way. 11rem covers the sticky offset, this bar, and a bottom
			    margin. */}
			<div className="editor:max-h-[calc(100vh-11rem)] overflow-auto bg-muted p-4 print:max-h-none print:overflow-visible print:bg-transparent print:p-0">
				<div className="shadow-sm print:shadow-none">
					<InvoiceDocument draft={draft} />
				</div>
			</div>
		</div>
	);
}
