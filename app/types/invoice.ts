/* The shape of an invoice while it is being edited. Features 2 (line items),
   3 (preview), 4 (templates), 5 (PDF), 7 (persistence), and 8 (draft handoff)
   all read or write this, and it mirrors the D1 schema closely enough that
   saving is a mapping rather than a translation. Change it deliberately. */

export type Party = {
	name: string;
	address: string;
	city: string;
	region: string;
	postalCode: string;
	country: string;
	email: string;
	phone: string;
	taxId: string;
};

export type LineItem = {
	id: string;
	position: number;
	name: string;
	description: string;
	quantity: number;
	/* Minor units (cents). Floats here turn into rounding errors on a real
	   invoice, so no money value is ever a decimal. */
	rate: number;
	total: number;
};

export type InvoiceDraft = {
	version: 1;
	invoiceNumber: string;
	status: "draft";
	templateId: string;
	/* ISO YYYY-MM-DD, never a Date, so serialization is lossless. */
	issueDate: string;
	dueDate: string;
	/* ISO 4217 */
	currency: string;
	billFrom: Party;
	billTo: Party;
	paymentTerms: string;
	notes: string;
	lineItems: LineItem[];
};
