import { useState } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { isRouteErrorResponse, Link } from "react-router";
import type { Route } from "./+types/invoices.$id";
import { AppBar } from "~/components/AppBar";
import { DownloadPdfButton } from "~/components/invoice/DownloadPdfButton";
import { InvoiceEditorPanes } from "~/components/invoice/InvoiceEditorPanes";
import { SaveButton, SaveError } from "~/components/invoice/SaveButton";
import { StatusBadge } from "~/components/invoice/StatusBadge";
import {
	StatusControl,
	type StatusResult,
} from "~/components/invoice/StatusControl";
import { SessionActions } from "~/components/SessionActions";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cloudflareContext } from "~/context";
import { requireUser } from "~/lib/auth.server";
import { displayStatus, parseSettableStatus } from "~/lib/invoice-status";
import { saveDraftEdit } from "~/lib/invoice-save.server";
import { getInvoice, setInvoiceStatus } from "~/lib/invoice-store.server";
import type { InvoiceDraft } from "~/types/invoice";

/* The generated type makes `loaderData` optional here precisely because this
   route has an ErrorBoundary: on the 404 path the loader threw, so there is no
   invoice to name and the boundary is what renders. */
export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `${loaderData.invoiceNumber} - Invoice Kit`
				: "Invoice not found - Invoice Kit",
		},
	];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);

	// Throws a redirect to sign in, carrying this URL as where to come back to.
	const user = await requireUser(request, env);

	/* Scoped by the session's user inside the query. The id in the URL is a
	   claim like any other id from a request, and someone else's invoice comes
	   back null exactly as a nonexistent one does. */
	const invoice = await getInvoice(env.DB, user.id, params.id);

	/* 404 rather than 403, deliberately: a 403 would confirm that this id names
	   a real invoice belonging to somebody. */
	if (!invoice) throw new Response("Not found", { status: 404 });

	return {
		id: invoice.id,
		invoiceNumber: invoice.draft.invoiceNumber,
		/* Derived here rather than in the component, and from one date: the
		   Worker's clock is UTC and the browser's is local, so deriving it during
		   render would let the two disagree about what day it is. */
		display: displayStatus(invoice.status, invoice.draft.dueDate, new Date()),
		/* The stored status, for the control, which is a different question from
		   the one the badge answers. Null for an invoice this feature has no
		   business moving, which today means only a void one: nothing can produce
		   that yet, and when feature 12 can, un-voiding is its decision to design
		   rather than a fourth entry in a select. */
		settableStatus: parseSettableStatus(invoice.status),
		draft: invoice.draft,
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const { env } = context.get(cloudflareContext);
	const user = await requireUser(request, env);

	const form = await request.formData();

	/* Two things post here now, so each says which it is rather than being told
	   apart by which fields it brought. An intent nobody recognises is refused,
	   never allowed to fall through to the save path. */
	const intent = form.get("intent");

	if (intent === "status") {
		const status = parseSettableStatus(form.get("status"));

		/* The select cannot produce anything else, so this is about requests that
		   did not come from it: `void` belongs to feature 12, and junk belongs
		   nowhere. */
		if (!status) {
			return {
				ok: false as const,
				error: "That is not a status an invoice can be set to.",
			} satisfies StatusResult;
		}

		const changed = await setInvoiceStatus(env.DB, user.id, params.id, status);
		if (!changed) throw new Response("Not found", { status: 404 });

		return { ok: true as const, status } satisfies StatusResult;
	}

	if (intent !== "save") {
		return { ok: false as const, error: "That request was not understood." };
	}

	let payload: unknown;
	try {
		payload = JSON.parse(String(form.get("draft") ?? ""));
	} catch {
		return {
			ok: false as const,
			error: "That invoice could not be read. Please try again.",
		};
	}

	/* The id comes from the URL, never from the form. There is one place this
	   app looks to answer which invoice is being written, and the query scopes it
	   by the session's user either way. */
	const result = await saveDraftEdit(env.DB, user.id, params.id, payload);

	/* No such invoice for this user: deleted from another window, or never
	   theirs. The same 404 the loader gives, rather than creating a second
	   invoice at an id this URL no longer describes. */
	if (!result) throw new Response("Not found", { status: 404 });

	return result;
}

type LoaderData = Route.ComponentProps["loaderData"];

export default function InvoiceDetail({ loaderData, params }: Route.ComponentProps) {
	/* Keyed by the id so going from one invoice to another remounts and reseeds
	   the editor. React reuses the component across a param change, and without
	   this the second invoice would open holding the first one's state. */
	return <SavedInvoiceEditor key={params.id} invoice={loaderData} />;
}

function SavedInvoiceEditor({ invoice }: { invoice: LoaderData }) {
	/* Straight from the loader, no restore dance: this invoice's home is D1, and
	   the same data renders on the Worker and in the browser, so there is nothing
	   to hydrate around. Nothing is written to sessionStorage either, or editing a
	   saved invoice would overwrite the anonymous draft in another tab. */
	const [draft, setDraft] = useState<InvoiceDraft>(invoice.draft);

	function patchDraft(patch: Partial<InvoiceDraft>) {
		setDraft((current) => ({ ...current, ...patch }));
	}

	return (
		<>
			<AppBar
				actions={
					<div className="flex items-center gap-2">
						<SessionActions />
						<SaveButton draft={draft} invoiceId={invoice.id} />
						<DownloadPdfButton draft={draft} />
					</div>
				}
			/>
			{/* A strip under the bar rather than a heading inside the form column:
			    it has to say which invoice is open regardless of which pane the user
			    is looking at, and the panes below own their own padding. */}
			<div className="border-b bg-card">
				<div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3">
					<Link
						to="/invoices"
						className="-ml-1.5 flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
					>
						<ChevronLeftIcon className="size-4" />
						Invoices
					</Link>
					<span className="font-semibold tracking-tight tabular-nums">
						{invoice.invoiceNumber}
					</span>
					{/* Badge and control side by side, and they can disagree on purpose:
					    a sent invoice past its due date reads Overdue here while the
					    control reads Sent. The badge is what the invoice is today, the
					    control is what was recorded. Offering Overdue as a choice would
					    say the user could pick it. */}
					<StatusBadge status={invoice.display} />
					{invoice.settableStatus ? (
						<StatusControl status={invoice.settableStatus} />
					) : null}
				</div>
			</div>
			<InvoiceEditorPanes
				draft={draft}
				onChange={patchDraft}
				notice={<SaveError />}
			/>
		</>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const notFound = isRouteErrorResponse(error) && error.status === 404;

	return (
		<>
			<AppBar actions={<SessionActions />} />
			<main className="mx-auto w-full max-w-[1100px] p-6">
				<Card className="items-center gap-3 px-6 py-14 text-center">
					<p className="font-medium">
						{notFound ? "No such invoice" : "That invoice could not be opened"}
					</p>
					<p className="max-w-[42ch] text-sm text-muted-foreground">
						{notFound
							? "It may have been deleted, or the address may be wrong."
							: "Something went wrong loading it. Try again in a moment."}
					</p>
					<Button asChild size="sm" className="mt-1">
						<Link to="/invoices">Back to invoices</Link>
					</Button>
				</Card>
			</main>
		</>
	);
}
