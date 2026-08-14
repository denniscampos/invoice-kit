import { formatInvoiceDate, partyAddressLines } from "~/lib/format";
import { invoiceSubtotal } from "~/lib/invoice-draft";
import { formatMoney } from "~/lib/money";
import type { InvoiceDraft, Party } from "~/types/invoice";

/* The default invoice document: modern sans, generous whitespace, hairline
   rules. Pure and SSR safe by contract, like every template: no state, no
   effects, no window, no clock. Everything it shows comes from the draft it is
   handed, because feature 5 renders this same component to a string on the
   Worker to make the PDF.

   It renders the document only. The frame, the bar, and the page size live
   outside it, so the preview can show it at natural width while the PDF wraps
   it in a letter sized page. */

type InvoiceTemplateProps = {
	draft: InvoiceDraft;
};

/* The document keeps its own colors in both color schemes. It is paper, not a
   surface, so nothing inside it carries a dark: variant. */
export function MinimalTemplate({ draft }: InvoiceTemplateProps) {
	return (
		<article className="grid gap-7 bg-paper px-11 py-10 text-paper-ink">
			<InvoiceHeader draft={draft} />

			<section className="grid grid-cols-2 gap-8">
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

			<ItemsTable draft={draft} />
			<Totals draft={draft} />
			<InvoiceFooter draft={draft} />
		</article>
	);
}

const HEAD_CELL =
	"border-b border-paper-rule pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-paper-muted";
/* break-words on the free text cell only. A pasted URL or reference number has
   no spaces to wrap at, and without this one of them widens the whole document,
   which matters more here than in the editor because this component is what
   feature 5 renders to PDF. The numeric cells stay on one line. */
const CELL = "border-b border-paper-rule py-[11px] align-top break-words";
const NUMERIC_CELL = `${CELL} whitespace-nowrap text-right tabular-nums`;

function ItemsTable({ draft }: InvoiceTemplateProps) {
	return (
		/* table-fixed, not auto: with auto layout a column is at least as wide as
		   its longest unbreakable word, so one pasted URL widens the table and
		   with it the whole document, break-words or not. Fixed layout sizes the
		   columns from these widths instead and lets the text wrap inside them. */
		<table className="w-full table-fixed border-collapse text-sm">
			<thead>
				<tr>
					<th className={`${HEAD_CELL} text-left`}>Description</th>
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
	/* Computed here rather than stored on the draft, the same rule feature 2 set
	   for the editor's total. Subtotal and total are the same number until
	   feature 19 adds tax and discounts; the document shows both because an
	   invoice reads as unfinished without a subtotal line. */
	const subtotal = invoiceSubtotal(draft);

	return (
		<div className="ml-auto w-[260px] text-sm tabular-nums">
			<div className="flex justify-between py-[7px] text-paper-muted">
				<span>Subtotal</span>
				<span>{formatMoney(subtotal, draft.currency)}</span>
			</div>
			<div className="mt-1 flex justify-between border-t border-paper-ink pt-3 text-lg font-semibold">
				<span>Total due</span>
				<span>
					{formatMoney(subtotal, draft.currency)} {draft.currency}
				</span>
			</div>
		</div>
	);
}

/* With neither terms nor notes there is nothing to head, so the whole footer
   goes rather than leaving a rule across the bottom of the page. */
function InvoiceFooter({ draft }: InvoiceTemplateProps) {
	if (!draft.paymentTerms.trim() && !draft.notes.trim()) return null;

	return (
		<footer className="grid grid-cols-2 gap-8 border-t border-paper-rule pt-5 text-sm text-paper-muted">
			<FooterBlock heading="Payment terms" body={draft.paymentTerms} />
			<FooterBlock heading="Notes" body={draft.notes} />
		</footer>
	);
}

function FooterBlock({ heading, body }: { heading: string; body: string }) {
	if (!body.trim()) return null;

	return (
		<div>
			<h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-paper-muted">
				{heading}
			</h3>
			{/* The draft holds newlines from a textarea; keep them. */}
			<p className="m-0 whitespace-pre-line break-words leading-[1.6]">
				{body}
			</p>
		</div>
	);
}

function InvoiceHeader({ draft }: InvoiceTemplateProps) {
	const initial = draft.billFrom.name.trim().charAt(0).toUpperCase();

	return (
		<header className="flex items-start justify-between gap-6">
			<div>
				{/* Before there is a name to take an initial from, the square stays as
				    a light placeholder rather than an empty black box. */}
				<div
					className={`mb-2.5 grid size-10 place-items-center rounded-md text-[15px] font-bold ${
						initial ? "bg-paper-ink text-paper" : "bg-paper-rule"
					}`}
				>
					{initial}
				</div>
				<h1 className="mb-0.5 text-[26px] font-semibold tracking-tight">
					Invoice
				</h1>
				<div className="break-words tabular-nums text-paper-muted">
					{draft.invoiceNumber}
				</div>
			</div>

			<dl className="grid gap-0.5 text-right text-sm tabular-nums text-paper-muted">
				<MetaRow label="Issued" value={formatInvoiceDate(draft.issueDate)} />
				<MetaRow label="Due" value={formatInvoiceDate(draft.dueDate)} />
				<MetaRow label="Terms" value={draft.paymentTerms} />
			</dl>
		</header>
	);
}

/* A row with no value is left out entirely. Rendering "Issued" with nothing
   after it reads as a broken document, and the dates are genuinely empty on the
   first render, before the effect that fills them in. */
function MetaRow({ label, value }: { label: string; value: string }) {
	if (!value.trim()) return null;

	return (
		<div>
			<dt className="inline">{label} </dt>
			<dd className="inline font-semibold text-paper-ink">{value}</dd>
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
	/* One list rather than two, so the lines are siblings with keys from a single
	   sequence. Keyed by position because the list is rebuilt on every render and
	   never reordered, and because the text itself is not unique: a company in
	   Singapore can have the same word on three lines. */
	const lines = partyAddressLines(party);

	return (
		<div>
			<h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-paper-muted">
				{heading}
			</h3>
			<address className="break-words text-sm not-italic leading-[1.65] text-paper-muted">
				<b
					className={`mb-0.5 block text-base font-semibold ${
						name ? "text-paper-ink" : "text-paper-muted"
					}`}
				>
					{name || placeholder}
				</b>
				{lines.map((line, index) => (
					<span
						key={index}
						className={`block ${line.numeric ? "tabular-nums" : ""}`}
					>
						{line.text}
					</span>
				))}
			</address>
		</div>
	);
}
