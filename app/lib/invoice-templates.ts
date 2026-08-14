/* The registry's data half: the ids, their labels, and the one rule that turns
   an untrusted value into an id we can render. The components live beside their
   markup in app/components/invoice/templates, so this file holds no JSX and can
   be imported anywhere, including the Worker that renders the PDF (feature 5)
   and a test that has no DOM. */

/* Switcher order, from the editor mockup. The id union is derived from this
   list rather than declared beside it, so adding a template here is the only
   edit needed to extend the type, and the component map that satisfies it stops
   compiling until the new template is registered. */
export const INVOICE_TEMPLATES = [
	{ id: "minimal", label: "Minimal" },
	{ id: "classic", label: "Classic" },
	{ id: "compact", label: "Compact" },
] as const satisfies readonly { id: string; label: string }[];

export type InvoiceTemplateId = (typeof INVOICE_TEMPLATES)[number]["id"];

/* What an anonymous draft opens in, and where anything unrecognized lands. */
export const DEFAULT_TEMPLATE_ID: InvoiceTemplateId = "minimal";

/* Takes unknown and never throws. Its input is a sessionStorage value today and
   a posted request body in feature 5, and isStoredDraft does not check
   templateId at all, so this is the only thing standing between a tampered
   draft and a render. */
export function resolveTemplateId(value: unknown): InvoiceTemplateId {
	const match = INVOICE_TEMPLATES.find((template) => template.id === value);
	return match ? match.id : DEFAULT_TEMPLATE_ID;
}
