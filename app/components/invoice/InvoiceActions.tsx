import { useFetcher } from "react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import type { InvoicePermissions } from "~/lib/invoice-status";

export type InvoiceActionResult = { ok: true } | { ok: false; error: string };

/* Getting rid of an invoice, in whichever of the two ways it qualifies for.

   Both ask first, which the status control deliberately does not. The
   proportion is the reason: a wrong status is one click to put back, while a
   delete destroys rows and a void cannot be walked back at all. A confirmation
   belongs in front of what cannot be undone and nowhere else.

   Which button appears comes from the permissions the loader worked out, and the
   action checks the same rule against the stored status before it writes.
   Rendering no button is a courtesy to the user, not a guard on the data. */
export function InvoiceActions({
	invoiceNumber,
	permissions,
}: {
	invoiceNumber: string;
	permissions: InvoicePermissions;
}) {
	const fetcher = useFetcher<InvoiceActionResult>({ key: "invoice-actions" });
	const busy = fetcher.state !== "idle";

	if (!permissions.canVoid && !permissions.canDelete) return null;

	return (
		<div className="flex items-center gap-2">
			{permissions.canVoid ? (
				<Confirm
					label="Void"
					title={`Void ${invoiceNumber}?`}
					description="The invoice stays on your list as a record, marked void, and can no longer be edited. This cannot be undone."
					confirmLabel="Void it"
					busy={busy}
					onConfirm={() => fetcher.submit({ intent: "void" }, { method: "post" })}
				/>
			) : null}

			{permissions.canDelete ? (
				<Confirm
					label="Delete"
					title={`Delete ${invoiceNumber}?`}
					description="This draft and its line items are removed for good. Nothing keeps a copy."
					confirmLabel="Delete it"
					busy={busy}
					onConfirm={() =>
						fetcher.submit({ intent: "delete" }, { method: "post" })
					}
				/>
			) : null}

			{/* Only reachable when the server refuses something these buttons let
			    through, which would mean the status changed under the page. Shown
			    rather than swallowed, so a refusal is never silent. */}
			{fetcher.data && !fetcher.data.ok ? (
				<span role="alert" className="text-xs text-destructive">
					{fetcher.data.error}
				</span>
			) : null}
		</div>
	);
}

/* The dialog, rather than `window.confirm`: the app owns its chrome everywhere
   else, and the primitive brings the focus trap, the escape key, and the roles
   with it. Cancel is the resting focus, so a stray Enter does nothing. */
function Confirm({
	label,
	title,
	description,
	confirmLabel,
	busy,
	onConfirm,
}: {
	label: string;
	title: string;
	description: string;
	confirmLabel: string;
	busy: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="ghost" size="sm" disabled={busy}>
					{label}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep it</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={onConfirm}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
