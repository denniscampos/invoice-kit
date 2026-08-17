import { useFetcher } from "react-router";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	parseSettableStatus,
	SETTABLE_STATUSES,
	STATUS_LABELS,
	type SettableStatus,
} from "~/lib/invoice-status";

/* What the route's status action answers with. Declared beside the component
   that reads it, and imported by the route so both ends are checked against one
   shape. */
export type StatusResult =
	| { ok: true; status: SettableStatus }
	| { ok: false; error: string };

/* Marking an invoice draft, sent, or paid.

   A fetcher rather than a `Form`, for the same reason `SaveButton` uses one: the
   invoice below may be half edited, and a navigation would throw that away to
   report something a control can show in place. It submits only the intent and
   the status, never the draft, so changing the status cannot save an edit and
   saving an edit cannot change the status.

   No confirmation step, deliberately. Nothing is destroyed by a wrong status and
   the fix is to pick the right one, so a prompt would be friction guarding
   nothing. */
export function StatusControl({ status }: { status: SettableStatus }) {
	const fetcher = useFetcher<StatusResult>({ key: "invoice-status" });
	const saving = fetcher.state !== "idle";

	/* The value being submitted wins while it is in flight. The loader is the
	   source of truth, but it only catches up after the action returns, and
	   without this the control would visibly snap back to the old status for the
	   length of the round trip. */
	const submitted = fetcher.formData?.get("status");
	const shown =
		(typeof submitted === "string" ? parseSettableStatus(submitted) : null) ??
		status;

	return (
		<div className="flex items-center gap-2">
			<Select
				value={shown}
				disabled={saving}
				onValueChange={(next) =>
					fetcher.submit({ intent: "status", status: next }, { method: "post" })
				}
			>
				{/* Named for a screen reader: the trigger shows only the current value,
				    so without this it announces "Draft" with no hint of what it sets. */}
				<SelectTrigger size="sm" aria-label="Invoice status">
					{/* Radix resolves the selected item's label on the client, so the
					    trigger renders blank during SSR unless the label is passed
					    through, the same as the currency field. */}
					<SelectValue>{STATUS_LABELS[shown]}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{SETTABLE_STATUSES.map((value) => (
						<SelectItem key={value} value={value}>
							{STATUS_LABELS[value]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Only reachable by a request this control did not make, since the select
			    can produce nothing else. Shown rather than swallowed so a refusal is
			    never silent. */}
			{fetcher.data && !fetcher.data.ok ? (
				<span role="alert" className="text-xs text-destructive">
					{fetcher.data.error}
				</span>
			) : null}
		</div>
	);
}
