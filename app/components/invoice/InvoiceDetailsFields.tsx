import { Field } from "~/components/invoice/Field";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { nextDueDate } from "~/lib/invoice-draft";
import type { InvoiceDraft } from "~/types/invoice";

/* A short list covers the common cases. The full ISO 4217 set arrives with
   settings (feature 22), where a default currency is configurable. */
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

type InvoiceDetailsFieldsProps = {
	draft: InvoiceDraft;
	onChange: (patch: Partial<InvoiceDraft>) => void;
};

export function InvoiceDetailsFields({
	draft,
	onChange,
}: InvoiceDetailsFieldsProps) {
	function handleIssueDate(issueDate: string) {
		onChange({ issueDate, dueDate: nextDueDate(draft, issueDate) });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Invoice details</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="grid gap-3 sm:grid-cols-3">
					<Field id="invoice-number" label="Invoice number">
						<Input
							id="invoice-number"
							className="tabular-nums"
							value={draft.invoiceNumber}
							onChange={(event) =>
								onChange({ invoiceNumber: event.target.value })
							}
						/>
					</Field>
					<Field id="issue-date" label="Issue date">
						<Input
							id="issue-date"
							type="date"
							className="tabular-nums"
							value={draft.issueDate}
							onChange={(event) => handleIssueDate(event.target.value)}
						/>
					</Field>
					<Field id="due-date" label="Due date">
						<Input
							id="due-date"
							type="date"
							className="tabular-nums"
							value={draft.dueDate}
							onChange={(event) => onChange({ dueDate: event.target.value })}
						/>
					</Field>
				</div>

				<div className="grid gap-3 sm:grid-cols-3">
					<Field id="currency" label="Currency">
						<Select
							value={draft.currency}
							onValueChange={(currency) => onChange({ currency })}
						>
							<SelectTrigger id="currency" className="w-full">
								{/* Radix resolves the selected item's label on the client, so the
								    trigger renders blank during SSR. The code is the label here,
								    so pass it through directly. */}
								<SelectValue>{draft.currency}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{CURRENCIES.map((code) => (
									<SelectItem key={code} value={code}>
										{code}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field
						id="payment-terms"
						label="Payment terms"
						className="sm:col-span-2"
					>
						<Input
							id="payment-terms"
							placeholder="Net 30"
							value={draft.paymentTerms}
							onChange={(event) =>
								onChange({ paymentTerms: event.target.value })
							}
						/>
					</Field>
				</div>
			</CardContent>
		</Card>
	);
}
