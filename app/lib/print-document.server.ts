import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceDocument } from "~/components/invoice/templates";
import {
	FONT_CSS_ORIGIN,
	FONT_FILE_ORIGIN,
	INTER_STYLESHEET_HREF,
} from "~/lib/fonts";
import { PRINT_STYLES } from "~/lib/print-styles";
import type { InvoiceDraft } from "~/types/invoice";

/* The invoice as one standalone HTML document: the same component the preview
   renders, wrapped in a letter sized page and carrying its own styles. Feature
   5b hands this string to a headless browser and gets the PDF back, so it has
   to stand on its own with nothing to link to except the webfont.

   Server only. It inlines the whole compiled stylesheet, which the browser
   running the app already has. */

/* The largest draft the render endpoint will accept, in bytes. A real invoice
   with two hundred line items and long descriptions lands around 60KB, so this
   is roughly double the worst honest case and far below anything worth calling
   a payload. It lives here rather than in the route because it is a limit on
   what this renderer will be asked to draw, and feature 5b keeps it in front of
   the browser call, which is the expensive one. */
export const MAX_DRAFT_BYTES = 128 * 1024;

/* Long enough for any real invoice number, short enough that no filesystem or
   browser has an opinion about it. */
const MAX_FILENAME_STEM = 60;

/* What the downloaded file is called. The invoice number is user input that
   arrives in a request body and goes straight into a Content-Disposition
   header, so this is a sanitizer before it is a formatter: a quote would end the
   filename early and a newline would start a header of the attacker's choosing.

   Only letters, digits, dot, dash, and underscore survive; everything else
   collapses to a dash. Leading dots and dashes go too, which is what turns a
   path like ../../etc/passwd into etc-passwd rather than something a careless
   consumer might treat as a path. */
export function pdfFilename(invoiceNumber: string): string {
	const stem = invoiceNumber
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.slice(0, MAX_FILENAME_STEM)
		.replace(/^[-.]+|[-.]+$/g, "");

	return stem ? `${stem}.pdf` : "invoice.pdf";
}

/* Page geometry lives here rather than in a template, the split feature 3 set:
   the templates carry their own padding and the container decides the paper.
   margin: 0 on the page and the template's padding as the printed margin, so
   the PDF matches the preview instead of adding a second margin around it. */
const PAGE_STYLES = `
@page { size: Letter; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page {
	width: 8.5in;
	min-height: 11in;
	margin: 0 auto;
	background: var(--color-paper);
}
/* Keep a row and its rule together, and never strand a heading at the foot of
   a page, once an invoice runs past one sheet. */
tr, address, h1, h2, h3 { break-inside: avoid; }
h1, h2, h3 { break-after: avoid; }
`;

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

/* The document's markup comes from React, which escapes as it renders, but the
   title is interpolated into a hand written string. An invoice number is user
   input and reaches this function from a request body, so it gets escaped here
   or it closes the title element for us. */
function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/* `styles` is an argument rather than a plain import because `PRINT_STYLES` is
   empty under Vitest, which loads none of the app's Vite plugins. Passing it in
   is the same move `createEmptyDraft(today)` makes with the clock. */
export function buildPrintDocument(
	draft: InvoiceDraft,
	styles: string = PRINT_STYLES,
): string {
	/* Loud rather than silent. Without this, a build change that broke the
	   stylesheet import would produce a structurally perfect, completely unstyled
	   PDF, and the first person to notice would be whoever opened the file after
	   sending it to a client. The route turns this into its existing 502 and logs
	   the reason, which is a much better place to find out. */
	if (!styles.trim()) {
		throw new Error("The print stylesheet is empty: the PDF would be unstyled.");
	}

	const invoice = renderToStaticMarkup(createElement(InvoiceDocument, { draft }));
	const title = escapeHtml(`Invoice ${draft.invoiceNumber}`.trim());

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="preconnect" href="${FONT_CSS_ORIGIN}" />
<link rel="preconnect" href="${FONT_FILE_ORIGIN}" crossorigin />
<link rel="stylesheet" href="${escapeHtml(INTER_STYLESHEET_HREF)}" />
<style>${styles}${PAGE_STYLES}</style>
</head>
<body>
<div class="page">${invoice}</div>
</body>
</html>
`;
}
