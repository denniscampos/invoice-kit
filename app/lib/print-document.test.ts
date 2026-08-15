import { describe, expect, it } from "vitest";
import { createEmptyDraft } from "./invoice-draft";
import { buildPrintDocument, pdfFilename } from "./print-document.server";
import type { InvoiceDraft } from "~/types/invoice";

/* Real CSS is passed in rather than imported: PRINT_STYLES resolves to an empty
   string under Vitest, which loads none of the app's Vite plugins. */
const STYLES = ".bg-paper{background-color:var(--color-paper)}";

function draft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
	return {
		...createEmptyDraft(new Date(2026, 7, 14)),
		invoiceNumber: "INV-0042",
		billFrom: {
			...createEmptyDraft(new Date(2026, 7, 14)).billFrom,
			name: "Acme Studio",
		},
		lineItems: [
			{
				id: "a",
				position: 0,
				name: "Brand identity system",
				description: "Logo and type scale",
				quantity: 1,
				rate: 450000,
				total: 450000,
			},
		],
		...overrides,
	};
}

describe("buildPrintDocument", () => {
	it("is a whole HTML document", () => {
		const html = buildPrintDocument(draft(), STYLES);

		expect(html.startsWith("<!doctype html>")).toBe(true);
		expect(html).toContain('<html lang="en">');
		expect(html).toContain('<meta charset="utf-8" />');
		expect(html.trimEnd().endsWith("</html>")).toBe(true);
	});

	it("sizes itself to a letter page with no margin of its own", () => {
		const html = buildPrintDocument(draft(), STYLES);

		expect(html).toContain("@page { size: Letter; margin: 0; }");
		expect(html).toContain("width: 8.5in");
		expect(html).toContain("min-height: 11in");
	});

	it("carries the styles it was given inside the style tag", () => {
		const html = buildPrintDocument(draft(), STYLES);
		const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

		expect(style).toContain(STYLES);
	});

	it("links the same webfont the app does", () => {
		const html = buildPrintDocument(draft(), STYLES);

		expect(html).toContain("fonts.googleapis.com/css2?family=Inter");
	});

	it("renders the invoice itself", () => {
		const html = buildPrintDocument(draft(), STYLES);

		expect(html).toContain("INV-0042");
		expect(html).toContain("Acme Studio");
		expect(html).toContain("Brand identity system");
		expect(html).toContain("$4,500.00");
	});

	it("renders the template the draft asks for", () => {
		const minimal = buildPrintDocument(draft({ templateId: "minimal" }), STYLES);
		const compact = buildPrintDocument(draft({ templateId: "compact" }), STYLES);

		expect(minimal).not.toEqual(compact);
		// Compact is the only one that sets its base size on the paper.
		expect(compact).toContain("text-[11px]");
		expect(minimal).not.toContain("text-[11px]");
	});

	/* Nothing in a printed invoice needs to run, and 5b feeds this straight to a
	   browser, so a script tag would be someone else's code executing. */
	it("contains no script", () => {
		const html = buildPrintDocument(
			draft({ notes: "<script>alert(1)</script>" }),
			STYLES,
		);

		expect(html).not.toContain("<script");
	});

	/* The invoice number is user input interpolated into a hand written title,
	   the one place React's escaping does not reach. */
	it("escapes the invoice number in the title", () => {
		const html = buildPrintDocument(
			draft({ invoiceNumber: '</title><script>alert(1)</script>' }),
			STYLES,
		);

		expect(html).not.toContain("</title><script>");
		expect(html).toContain("&lt;/title&gt;");
	});

	/* An unstyled document is a silent failure: perfect structure, no design, and
	   nobody looks until the invoice is already sent. */
	it.each([
		["nothing", ""],
		["whitespace", "   \n\t"],
	])("refuses to build with %s for a stylesheet", (_label, styles) => {
		expect(() => buildPrintDocument(draft(), styles)).toThrow(/stylesheet/i);
	});

	it("still produces a document for an empty draft", () => {
		const html = buildPrintDocument(createEmptyDraft(new Date(2026, 7, 14)), STYLES);

		expect(html).toContain("Your business");
		expect(html).toContain("No items yet");
		expect(html).not.toContain("undefined");
		expect(html).not.toContain("NaN");
	});
});

describe("pdfFilename", () => {
	it("names the file after the invoice number", () => {
		expect(pdfFilename("INV-0007")).toBe("INV-0007.pdf");
		expect(pdfFilename("2026_08_INV.14")).toBe("2026_08_INV.14.pdf");
	});

	it("collapses anything that is not filename material", () => {
		expect(pdfFilename("INV 0007")).toBe("INV-0007.pdf");
		expect(pdfFilename("INV/0007")).toBe("INV-0007.pdf");
		expect(pdfFilename("Facture nº 7 (août)")).toBe("Facture-n-7-ao-t.pdf");
	});

	/* The reason this function exists. A quote ends the filename early and a
	   newline starts a header of the caller's choosing, and this value reaches a
	   Content-Disposition header from a request body. */
	it.each([
		['a quote', 'INV"0007'],
		["a newline", "INV\n0007"],
		["a carriage return", "INV\r\n0007"],
		["a header break", 'INV"; x=1\r\nSet-Cookie: a=b'],
		["a semicolon", "INV;0007"],
	])("strips %s", (_label, invoiceNumber) => {
		const name = pdfFilename(invoiceNumber);

		expect(name).not.toMatch(/["\r\n;]/);
		expect(name.endsWith(".pdf")).toBe(true);
	});

	it("cannot be turned into a path", () => {
		expect(pdfFilename("../../etc/passwd")).toBe("etc-passwd.pdf");
		expect(pdfFilename("/etc/passwd")).toBe("etc-passwd.pdf");
		expect(pdfFilename("..")).toBe("invoice.pdf");
	});

	it.each([
		["an empty string", ""],
		["only spaces", "   "],
		["only punctuation", "///..."],
		["only dashes", "---"],
	])("falls back to a generic name for %s", (_label, invoiceNumber) => {
		expect(pdfFilename(invoiceNumber)).toBe("invoice.pdf");
	});

	it("truncates a number nobody should have typed", () => {
		const name = pdfFilename("INV-".repeat(200));

		expect(name.length).toBeLessThanOrEqual(64);
		expect(name.endsWith(".pdf")).toBe(true);
		// Truncation must not leave the stem ending in a dash.
		expect(name).not.toContain("-.pdf");
	});
});
