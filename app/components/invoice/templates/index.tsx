import type { ReactElement } from "react";
import { ClassicTemplate } from "./ClassicTemplate";
import { CompactTemplate } from "./CompactTemplate";
import { MinimalTemplate } from "./MinimalTemplate";
import {
	type InvoiceTemplateId,
	resolveTemplateId,
} from "~/lib/invoice-templates";
import type { InvoiceDraft } from "~/types/invoice";

/* The registry's component half, and the single entry point for rendering an
   invoice. Everything that draws the document goes through InvoiceDocument:
   the preview today, the PDF renderer on the Worker in feature 5. Neither picks
   a template itself, so neither can disagree about what the draft says. */

type InvoiceTemplateComponent = (props: {
	draft: InvoiceDraft;
}) => ReactElement;

/* A total Record rather than a lookup that might miss: registering an id in
   INVOICE_TEMPLATES without adding its component here is a type error, not a
   blank page. */
const TEMPLATE_COMPONENTS: Record<
	InvoiceTemplateId,
	InvoiceTemplateComponent
> = {
	minimal: MinimalTemplate,
	classic: ClassicTemplate,
	compact: CompactTemplate,
};

export function InvoiceDocument({ draft }: { draft: InvoiceDraft }) {
	const Template = TEMPLATE_COMPONENTS[resolveTemplateId(draft.templateId)];

	return <Template draft={draft} />;
}
