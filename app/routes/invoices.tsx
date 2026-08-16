import { Link } from "react-router";
import type { Route } from "./+types/invoices";
import { AppBar } from "~/components/AppBar";
import { SessionActions } from "~/components/SessionActions";
import { StatusBadge } from "~/components/invoice/StatusBadge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { cloudflareContext } from "~/context";
import { requireUser } from "~/lib/auth.server";
import { formatInvoiceDate } from "~/lib/format";
import { displayStatus } from "~/lib/invoice-status";
import { INVOICE_LIST_LIMIT, listInvoices } from "~/lib/invoice-store.server";
import { formatMoney } from "~/lib/money";

export function meta() {
	return [{ title: "Invoices - Invoice Kit" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);

	// Throws a redirect to sign in, carrying /invoices as where to come back to.
	const user = await requireUser(request, env);

	const { invoices, more } = await listInvoices(env.DB, user.id);

	/* Overdue is worked out here rather than in the component, and from one date
	   rather than one per row. The Worker's clock is UTC and the browser's is
	   local, so deriving this during render would let the two disagree about what
	   day it is and produce a hydration mismatch. */
	const today = new Date();

	return {
		more,
		/* Sent down rather than imported by the component. Everything in
		   invoice-store.server is server-only, and React Router strips those imports
		   from `loader` but not from the rest of the module, so a component reading
		   the constant directly drags the whole store into the client bundle and the
		   build refuses. */
		limit: INVOICE_LIST_LIMIT,
		invoices: invoices.map((invoice) => ({
			...invoice,
			display: displayStatus(invoice.status, invoice.dueDate, today),
		})),
	};
}

export default function Invoices({ loaderData }: Route.ComponentProps) {
	const { invoices, more, limit } = loaderData;

	return (
		<>
			<AppBar actions={<SessionActions />} />
			<main className="mx-auto w-full max-w-[1100px] p-6">
				<div className="mb-6 flex items-baseline justify-between gap-4">
					<h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
					{invoices.length > 0 ? (
						<Button asChild size="sm">
							<Link to="/">New invoice</Link>
						</Button>
					) : null}
				</div>

				{invoices.length === 0 ? <NoInvoices /> : <InvoiceTable rows={invoices} />}

				{more ? (
					<p className="mt-3 text-sm text-muted-foreground">
						Showing your {limit} most recent invoices.
					</p>
				) : null}
			</main>
		</>
	);
}

function NoInvoices() {
	return (
		<Card className="items-center gap-3 px-6 py-14 text-center">
			<p className="font-medium">No saved invoices yet</p>
			<p className="max-w-[42ch] text-sm text-muted-foreground">
				Invoices you save from the editor show up here, with what you billed and
				whether it has been paid.
			</p>
			<Button asChild size="sm" className="mt-1">
				<Link to="/">Make an invoice</Link>
			</Button>
		</Card>
	);
}

type Row = Awaited<ReturnType<typeof loader>>["invoices"][number];

function InvoiceTable({ rows }: { rows: Row[] }) {
	return (
		<Card className="py-0">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="px-4">Number</TableHead>
						<TableHead>Client</TableHead>
						<TableHead>Issued</TableHead>
						<TableHead>Due</TableHead>
						<TableHead>Status</TableHead>
						{/* Money right aligned so the digits line up down the column. */}
						<TableHead className="px-4 text-right">Total</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.id}>
							<TableCell className="px-4 font-medium tabular-nums">
								{row.invoiceNumber}
							</TableCell>
							<TableCell>
								{/* An invoice can be saved before the client is filled in, so
								    this is a real state rather than an edge case. */}
								{row.billToName.trim() || (
									<span className="text-muted-foreground">No client</span>
								)}
							</TableCell>
							<TableCell className="tabular-nums">
								{formatInvoiceDate(row.issueDate)}
							</TableCell>
							<TableCell className="tabular-nums">
								{formatInvoiceDate(row.dueDate)}
							</TableCell>
							<TableCell>
								<StatusBadge status={row.display} />
							</TableCell>
							{/* Formatted per row: two invoices in this list can be in
							    different currencies, so a symbol in the header would be a
							    lie about at least one of them. */}
							<TableCell className="px-4 text-right tabular-nums">
								{formatMoney(row.total, row.currency)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
}
