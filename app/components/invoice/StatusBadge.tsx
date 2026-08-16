import { Badge } from "~/components/ui/badge";
import { STATUS_LABELS, type DisplayStatus } from "~/lib/invoice-status";

/* A Record rather than a switch, so adding a state to `DisplayStatus` is a type
   error here until it has a colour. The tokens have been in app.css since
   feature 1 waiting for a screen that shows status; this is that screen.

   The classes override the badge's default variant rather than adding a variant
   to the primitive: shadcn components are owned in this repo and editable, but
   five product-specific colours are not a general-purpose primitive concern. */
const STATUS_CLASSES: Record<DisplayStatus, string> = {
	draft: "bg-status-draft-bg text-status-draft-fg",
	sent: "bg-status-sent-bg text-status-sent-fg",
	paid: "bg-status-paid-bg text-status-paid-fg",
	overdue: "bg-status-overdue-bg text-status-overdue-fg",
	void: "bg-status-void-bg text-status-void-fg",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
	return (
		<Badge className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
	);
}
