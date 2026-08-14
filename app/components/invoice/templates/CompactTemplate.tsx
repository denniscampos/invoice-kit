import {
	formatInvoiceDate,
	type PartyAddressLine,
	partyAddressLines,
} from "~/lib/format";
import { invoiceSubtotal } from "~/lib/invoice-draft";
import { formatMoney } from "~/lib/money";
import type { InvoiceDraft, Party } from "~/types/invoice";

/* The dense invoice, for a long item list that should still fit on one page.
   Every field the other templates show is here; the space comes out of the type
   scale, the padding, and the arrangement, never out of the content.

   Pure and SSR safe by contract, like every template. */

type InvoiceTemplateProps = {
	draft: InvoiceDraft;
};

const LABEL =
	"text-[9px] font-semibold uppercase tracking-[0.09em] text-paper-muted";

/* What holds this template's running text apart. The glyph is hidden from
   assistive technology, but the spaces around it are real text nodes outside the
   hidden span, so removing the glyph still leaves the fields separated rather
   than running them into one word. */
function Separator() {
	return (
		<>
			{" "}
			<span aria-hidden="true" className="mx-0.5 text-paper-rule">
				|
			</span>{" "}
		</>
	);
}

export function CompactTemplate({ draft }: InvoiceTemplateProps) {
	return (
		<article className="grid gap-5 bg-paper px-8 py-7 text-[11px] leading-[1.5] text-paper-ink">
			<InvoiceHeader draft={draft} />

			<section className="grid grid-cols-2 gap-8">
				<SenderBlock party={draft.billFrom} />
				<ClientBlock party={draft.billTo} />
			</section>

			<ItemsTable draft={draft} />
			<Totals draft={draft} />
			<InvoiceFooter draft={draft} />
		</article>
	);
}

/* One line: who is billing on the left, which invoice and when on the right.
   No initial square and no stacked meta block, which is most of what Minimal
   spends its vertical space on. */
function InvoiceHeader({ draft }: InvoiceTemplateProps) {
	const name = draft.billFrom.name.trim();
	const dates = [
		{ label: "Issued", value: formatInvoiceDate(draft.issueDate) },
		{ label: "Due", value: formatInvoiceDate(draft.dueDate) },
	].filter((date) => date.value);

	return (
		<header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
			<b
				className={`text-[15px] font-semibold ${
					name ? "text-paper-ink" : "text-paper-muted"
				}`}
			>
				{name || "Your business"}
			</b>

			<div className="text-paper-muted">
				<span className="font-semibold text-paper-ink">Invoice</span>{" "}
				<span className="tabular-nums text-paper-ink">
					{draft.invoiceNumber}
				</span>
				{dates.map((date) => (
					<span key={date.label}>
						<Separator />
						{date.label}{" "}
						<span className="tabular-nums text-paper-ink">{date.value}</span>
					</span>
				))}
			</div>
		</header>
	);
}

const HEAD_CELL = `${LABEL} border-b border-paper-rule pb-1.5`;
/* Rows carry no rule of their own here; the head underline and the total rule
   are the only two lines in the document. */
const CELL = "py-[6px] align-top break-words";
const NUMERIC_CELL = `${CELL} whitespace-nowrap text-right tabular-nums`;

function ItemsTable({ draft }: InvoiceTemplateProps) {
	return (
		<table className="w-full table-fixed border-collapse">
			<thead>
				<tr>
					<th className={`${HEAD_CELL} text-left`}>Description</th>
					<th className={`${HEAD_CELL} w-12 text-right`}>Qty</th>
					<th className={`${HEAD_CELL} w-20 text-right`}>Rate</th>
					<th className={`${HEAD_CELL} w-24 text-right`}>Amount</th>
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
								<span className="text-paper-muted">
									<Separator />
									{item.description}
								</span>
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
		<div className="ml-auto w-[220px] tabular-nums">
			<div className="flex justify-between py-1 text-paper-muted">
				<span>Subtotal</span>
				<span>{formatMoney(subtotal, draft.currency)}</span>
			</div>
			<div className="flex justify-between border-t border-paper-ink pt-2 text-[15px] font-semibold">
				<span>Total due</span>
				<span>
					{formatMoney(subtotal, draft.currency)} {draft.currency}
				</span>
			</div>
		</div>
	);
}

/* One line each rather than a two column block, so the footer costs two rows of
   text instead of a heading, a body, and the gap between them. */
function InvoiceFooter({ draft }: InvoiceTemplateProps) {
	const blocks = [
		{ heading: "Payment terms", body: draft.paymentTerms.trim() },
		{ heading: "Notes", body: draft.notes.trim() },
	].filter((block) => block.body);

	if (blocks.length === 0) return null;

	return (
		<footer className="grid gap-1 border-t border-paper-rule pt-3 text-paper-muted">
			{blocks.map((block) => (
				<p key={block.heading} className="m-0 break-words">
					<span className={`${LABEL} mr-2`}>{block.heading}</span>
					{/* The draft holds newlines from a textarea, but this footer is one
					    line per block, so they read as spaces rather than rows. */}
					{block.body.replace(/\s*\n\s*/g, " ")}
				</p>
			))}
		</footer>
	);
}

/* The address as running text rather than a column of short lines: the same
   fields, a third of the height. Keyed by position for the reason feature 3
   recorded: the list is rebuilt every render, never reordered, and two lines can
   hold the same word. */
function AddressLines({
	lines,
	afterName,
}: {
	lines: PartyAddressLine[];
	afterName: boolean;
}) {
	return (
		<>
			{lines.map((line, index) => (
				<span key={index}>
					{index > 0 || afterName ? <Separator /> : null}
					<span className={line.numeric ? "tabular-nums" : ""}>
						{line.text}
					</span>
				</span>
			))}
		</>
	);
}

/* The header line already carries the sender's name, so this block is the
   address on its own rather than the name a second time. With no address there
   is nothing left for the heading to head, so the whole block goes. */
function SenderBlock({ party }: { party: Party }) {
	const lines = partyAddressLines(party);

	if (lines.length === 0) return null;

	return (
		<div>
			<h3 className={`${LABEL} mb-1`}>From</h3>
			<address className="break-words not-italic text-paper-muted">
				<AddressLines lines={lines} afterName={false} />
			</address>
		</div>
	);
}

/* The client's name appears nowhere else, so unlike the sender's it stays. */
function ClientBlock({ party }: { party: Party }) {
	const name = party.name.trim();

	return (
		<div>
			<h3 className={`${LABEL} mb-1`}>Bill to</h3>
			<address className="break-words not-italic text-paper-muted">
				<b
					className={`font-semibold ${
						name ? "text-paper-ink" : "text-paper-muted"
					}`}
				>
					{name || "Client name"}
				</b>
				<AddressLines lines={partyAddressLines(party)} afterName={true} />
			</address>
		</div>
	);
}
