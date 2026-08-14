import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceDocument } from "./index";
import { createEmptyDraft } from "~/lib/invoice-draft";
import { INVOICE_TEMPLATES } from "~/lib/invoice-templates";
import type { InvoiceDraft } from "~/types/invoice";

/* The one rule every template owes the others: switching cannot lose anything.
   Templates differ in arrangement, never in content, or the PDF stops matching
   what the user saw and a switch quietly drops a client's tax id.

   This is deliberately not a UI test. It asserts no layout, no class, and no
   markup, only that each registered template puts every populated field on the
   page. It runs for every template in the registry, so a template added later
   is covered the day it is registered. Appearance is still checked by eye. */

const FILLED: InvoiceDraft = {
	...createEmptyDraft(new Date(2026, 7, 13)),
	invoiceNumber: "INV-0042",
	issueDate: "2026-08-13",
	dueDate: "2026-09-12",
	currency: "EUR",
	paymentTerms: "Net 30",
	notes: "Thanks for your business.",
	billFrom: {
		name: "Acme Studio",
		address: "118 Fremont Street",
		city: "San Francisco",
		region: "CA",
		postalCode: "94105",
		country: "United States",
		email: "billing@acmestudio.co",
		phone: "+1 415 555 0132",
		taxId: "EIN 84-2910773",
	},
	billTo: {
		name: "Northwind Trading",
		address: "12 Bishopsgate",
		city: "London",
		region: "Greater London",
		postalCode: "EC2N 3AR",
		country: "United Kingdom",
		email: "ap@northwind.example",
		phone: "+44 20 7946 0958",
		taxId: "GB 123456789",
	},
	lineItems: [
		{
			id: "a",
			position: 0,
			name: "Brand identity system",
			description: "Logo, type scale, and colour",
			quantity: 1,
			rate: 450000,
			total: 450000,
		},
		{
			id: "b",
			position: 1,
			name: "Landing page build",
			description: "",
			quantity: 3,
			rate: 120000,
			total: 360000,
		},
	],
};

function renderText(draft: InvoiceDraft, templateId: string): string {
	const html = renderToStaticMarkup(
		createElement(InvoiceDocument, { draft: { ...draft, templateId } }),
	);

	// Text content only, so an assertion cannot pass on a class name.
	return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

const EXPECTED = [
	"INV-0042",
	"Acme Studio",
	"118 Fremont Street",
	"San Francisco, CA 94105",
	"United States",
	"billing@acmestudio.co",
	"+1 415 555 0132",
	"EIN 84-2910773",
	"Northwind Trading",
	"12 Bishopsgate",
	"London, Greater London EC2N 3AR",
	"United Kingdom",
	"ap@northwind.example",
	"+44 20 7946 0958",
	"GB 123456789",
	"Brand identity system",
	"Logo, type scale, and colour",
	"Landing page build",
	"13 Aug 2026",
	"12 Sep 2026",
	"Net 30",
	"Thanks for your business.",
	// Rate, line total, and the invoice total, all in the invoice's currency.
	"€1,200.00",
	"€3,600.00",
	"€8,100.00",
];

describe.each(INVOICE_TEMPLATES)("the $label template", ({ id }) => {
	it.each(EXPECTED)("shows %s", (expected) => {
		expect(renderText(FILLED, id)).toContain(expected);
	});

	it.each(["undefined", "NaN", "Invalid Date", "[object Object]"])(
		"never prints %s on a filled invoice",
		(garbage) => {
			expect(renderText(FILLED, id)).not.toContain(garbage);
		},
	);

	/* The blank draft is a real state, not a hypothetical: it is what the server
	   renders before the browser restores or dates itself. */
	it.each(["undefined", "NaN", "Invalid Date", "[object Object]"])(
		"never prints %s on an empty invoice",
		(garbage) => {
			const empty = { ...createEmptyDraft(new Date(2026, 7, 13)), issueDate: "", dueDate: "" };
			expect(renderText(empty, id)).not.toContain(garbage);
		},
	);

	it("still reads as an invoice when the draft is empty", () => {
		const empty = createEmptyDraft(new Date(2026, 7, 13));
		const text = renderText(empty, id);

		expect(text).toContain("Your business");
		expect(text).toContain("Client name");
		expect(text).toContain("No items yet");
	});
});
