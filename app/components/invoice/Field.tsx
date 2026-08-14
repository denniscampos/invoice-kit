import type { ReactNode } from "react";
import { Label } from "~/components/ui/label";

type FieldProps = {
	id: string;
	label: string;
	className?: string;
	children: ReactNode;
};

/* A labeled control. The label is always bound to its control by id, which is
   what makes clicking the label focus the right box when a field name like
   "Name" appears more than once on the page. */
export function Field({ id, label, className, children }: FieldProps) {
	return (
		<div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
			<Label htmlFor={id} className="text-xs text-muted-foreground">
				{label}
			</Label>
			{children}
		</div>
	);
}
