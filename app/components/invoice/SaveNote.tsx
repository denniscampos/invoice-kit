import { Link } from "react-router";
import { markSaveHandoff } from "~/lib/draft-handoff";

/* What the mockup puts above the form for a visitor with no account.

   It says where the invoice actually is, which is the honest answer: in this
   tab, and nowhere else. Someone who closes it and comes back expecting to find
   their work is the person this note exists for. */
export function SaveNote() {
	return (
		<p className="flex items-center gap-2 rounded-lg border bg-accent px-4 py-3 text-xs text-muted-foreground">
			<span>
				Not signed in. Your invoice stays in this tab.{" "}
				{/* Clicking here is the user asking to save this draft. The flag rides
				   through sign-up (or sign-in, past the cross-link) in sessionStorage,
				   so the editor can finish the save when they land back signed in. */}
				<Link
					to="/sign-up"
					className="font-medium text-primary"
					onClick={markSaveHandoff}
				>
					Create an account
				</Link>{" "}
				to save it.
			</span>
		</p>
	);
}
