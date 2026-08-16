import { Link } from "react-router";

/* What the mockup puts above the form for a visitor with no account.

   It says where the invoice actually is, which is the honest answer: in this
   tab, and nowhere else. Someone who closes it and comes back expecting to find
   their work is the person this note exists for. */
export function SaveNote() {
	return (
		<p className="flex items-center gap-2 rounded-lg border bg-accent px-4 py-3 text-xs text-muted-foreground">
			<span>
				Not signed in. Your invoice stays in this tab.{" "}
				<Link to="/sign-up" className="font-medium text-primary">
					Create an account
				</Link>{" "}
				to save it.
			</span>
		</p>
	);
}
