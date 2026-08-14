import { formatInvoiceDate, partyAddressLines } from "~/lib/format";
import { invoiceSubtotal } from "~/lib/invoice-draft";
import { formatMoney } from "~/lib/money";
import type { InvoiceDraft, Party } from "~/types/invoice";

/* The formal invoice: serif text, a centered title, a filled table head, and a
   double rule above the total. What a client's bookkeeper expects an invoice to
   look like, and what survives being printed and filed.

   Pure and SSR safe by contract, like every template: no state, no effects, no
   window, no clock, and no page geometry, which belongs to whatever wraps it. */

type InvoiceTemplateProps = {
	draft: InvoiceDraft;
};

/* Figures stay in the sans face. Georgia ships old style numerals, which sit at
   different heights and refuse to line up in a money column however tabular the
   font is told to be. Serif for the words, sans for the numbers. */
const FIGURES = "font-sans tabular-nums";

/* Serif, like the rest of the document's text. FIGURES above is the single
   deliberate exception, and it is a legibility fix rather than a taste call. */
const LABEL =
	"text-[10px] font-semibold uppercase tracking-[0.1em] text-paper-muted";

export function ClassicTemplate({ draft }: InvoiceTemplateProps) {
	return (
		<article className="grid gap-6 bg-paper px-12 py-11 font-serif text-paper-ink">
			<header className="border-b-2 border-paper-ink pb-5 text-center">
				<h1 className="text-[27px] font-semibold uppercase tracking-[0.22em]">
					Invoice
				</h1>
				<div className={`mt-1.5 break-words text-paper-muted ${FIGURES}`}>
					{draft.invoiceNumber}
				</div>
			</header>

			<section className="grid grid-cols-2 gap-10">
				<PartyBlock
					heading="From"
					party={draft.billFrom}
					placeholder="Your business"
				/>
				<PartyBlock
					heading="Bill to"
					party={draft.billTo}
					placeholder="Client name"
				/>
			</section>

			<MetaBand draft={draft} />
			<ItemsTable draft={draft} />
			<Totals draft={draft} />
			<InvoiceFooter draft={draft} />
		</article>
	);
}

/* Issue date, due date, and terms as a banded row across the width, where
   Minimal puts them beside the title. An empty band is a rule with nothing in
   it, so with none of the three filled the whole thing goes. */
function MetaBand({ draft }: InvoiceTemplateProps) {
	const entries = [
		{ label: "Issued", value: formatInvoiceDate(draft.issueDate) },
		{ label: "Due", value: formatInvoiceDate(draft.dueDate) },
		{ label: "Terms", value: draft.paymentTerms.trim() },
	].filter((entry) => entry.value);

	if (entries.length === 0) return null;

	return (
		<dl className="grid grid-cols-3 gap-6 border-y border-paper-rule py-3">
			{entries.map((entry) => (
				<div key={entry.label}>
					<dt className={LABEL}>{entry.label}</dt>
					<dd
						className={`mt-0.5 break-words text-sm font-semibold ${FIGURES}`}
					>
						{entry.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

const HEAD_CELL = `${LABEL} px-2 py-2.5 text-paper-ink`;
/* break-words on the free text cell only, and table-fixed above it, for the
   reason feature 3 recorded: with auto layout one pasted URL widens the column
   past the page, and this component is what becomes the PDF. */
const CELL = "border-b border-paper-rule px-2 py-2.5 align-top break-words";
const NUMERIC_CELL = `${CELL} whitespace-nowrap text-right ${FIGURES}`;

function ItemsTable({ draft }: InvoiceTemplateProps) {
	return (
		<table className="w-full table-fixed border-collapse text-sm">
			<thead>
				<tr className="bg-paper-rule">
					<th className={`${HEAD_CELL} text-left`}>Description</th>
					{/* Same widths as Minimal, so the description column gets the same
					    share of a narrow preview. The cells' own px-2 comes out of these,
					    not on top of them. */}
					<th className={`${HEAD_CELL} w-16 text-right`}>Qty</th>
					<th className={`${HEAD_CELL} w-24 text-right`}>Rate</th>
					<th className={`${HEAD_CELL} w-28 text-right`}>Amount</th>
				</tr>
			</thead>
			<tbody>
				{draft.lineItems.length === 0 ? (
					<tr>
						<td className={`${CELL} text-paper-muted`} colSpan={4}>
							No items yet
						</td>
					</tr>
				) : null}
				{draft.lineItems.map((item) => (
					<tr key={item.id}>
						<td className={CELL}>
							{item.name}
							{item.description ? (
								<div className="mt-0.5 text-xs text-paper-muted">
									{item.description}
								</div>
							) : null}
						</td>
						<td className={NUMERIC_CELL}>{item.quantity}</td>
						<td className={NUMERIC_CELL}>
							{formatMoney(item.rate, draft.currency)}
						</td>
						<td className={NUMERIC_CELL}>
							{formatMoney(item.total, draft.currency)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function Totals({ draft }: InvoiceTemplateProps) {
	const subtotal = invoiceSubtotal(draft);

	return (
		<div className="ml-auto w-[280px] text-sm">
			<div className="flex justify-between py-2 text-paper-muted">
				<span>Subtotal</span>
				<span className={FIGURES}>{formatMoney(subtotal, draft.currency)}</span>
			</div>
			{/* border-double needs the width to draw two lines; below 3px it
			    collapses to a single rule. */}
			<div className="mt-1 flex items-baseline justify-between border-t-4 border-double border-paper-ink pt-3 text-[17px] font-semibold">
				<span>Total due</span>
				<span className={FIGURES}>
					{formatMoney(subtotal, draft.currency)} {draft.currency}
				</span>
			</div>
		</div>
	);
}

function InvoiceFooter({ draft }: InvoiceTemplateProps) {
	if (!draft.paymentTerms.trim() && !draft.notes.trim()) return null;

	return (
		<footer className="grid grid-cols-2 gap-10 border-t border-paper-rule pt-5 text-sm text-paper-muted">
			<FooterBlock heading="Payment terms" body={draft.paymentTerms} />
			<FooterBlock heading="Notes" body={draft.notes} />
		</footer>
	);
}

function FooterBlock({ heading, body }: { heading: string; body: string }) {
	if (!body.trim()) return null;

	return (
		<div>
			<h3 className={`${LABEL} mb-1.5`}>{heading}</h3>
			{/* The draft holds newlines from a textarea; keep them. */}
			<p className="m-0 whitespace-pre-line break-words leading-[1.6]">{body}</p>
		</div>
	);
}

function PartyBlock({
	heading,
	party,
	placeholder,
}: {
	heading: string;
	party: Party;
	placeholder: string;
}) {
	const name = party.name.trim();
	const lines = partyAddressLines(party);

	return (
		<div>
			<h3 className={`${LABEL} mb-2`}>{heading}</h3>
			<address className="break-words text-sm not-italic leading-[1.7] text-paper-muted">
				<b
					className={`mb-0.5 block text-[17px] font-semibold ${
						name ? "text-paper-ink" : "text-paper-muted"
					}`}
				>
					{name || placeholder}
				</b>
				{/* Keyed by position: the list is rebuilt every render, never
				    reordered, and two lines can hold the same word. */}
				{lines.map((line, index) => (
					<span
						key={index}
						className={`block ${line.numeric ? FIGURES : ""}`}
					>
						{line.text}
					</span>
				))}
			</address>
		</div>
	);
}
