import {
	INVOICE_TEMPLATES,
	type InvoiceTemplateId,
	resolveTemplateId,
} from "~/lib/invoice-templates";

/* The segmented control in the preview bar. Buttons with aria-pressed rather
   than a Select, as the mockup draws it: a two or three item choice belongs
   beside the thing it changes, visible at a glance.

   It renders the registry, so a template added there appears here without this
   file being touched. */

type TemplateSwitcherProps = {
	templateId: string;
	onSelect: (templateId: InvoiceTemplateId) => void;
};

const SEGMENT =
	"cursor-pointer rounded-[4px] px-2.5 py-[3px] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const PRESSED = "bg-card font-medium text-foreground shadow-sm";
const UNPRESSED = "text-muted-foreground hover:text-foreground";

export function TemplateSwitcher({ templateId, onSelect }: TemplateSwitcherProps) {
	/* Compared against the resolved id, not the raw one: a draft carrying a
	   template that no longer exists shows the default segment pressed, which is
	   what is actually being rendered, rather than no segment at all. */
	const active = resolveTemplateId(templateId);

	return (
		<div
			role="group"
			aria-label="Invoice template"
			className="flex gap-0.5 rounded-sm bg-muted p-0.5"
		>
			{INVOICE_TEMPLATES.map((template) => (
				<button
					key={template.id}
					type="button"
					aria-pressed={template.id === active}
					onClick={() => onSelect(template.id)}
					className={`${SEGMENT} ${template.id === active ? PRESSED : UNPRESSED}`}
				>
					{template.label}
				</button>
			))}
		</div>
	);
}
