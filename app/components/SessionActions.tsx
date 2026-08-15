import { Form, Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";
import { Button } from "~/components/ui/button";

/* The one part of the chrome that knows about sessions, so the app bar does not
   have to. It reads the root loader rather than taking a prop, which means any
   page can drop it into the bar's actions slot without threading the user down
   through its own loader. */
export function SessionActions() {
	/* Undefined, not null, when the root loader has not run: inside the
	   ErrorBoundary, and during the initial client render of a hydration error.
	   Throwing here would replace whatever went wrong with a blank page. */
	const user = useRouteLoaderData<typeof rootLoader>("root")?.user;

	if (!user) {
		return (
			<Button asChild variant="ghost" size="sm">
				<Link to="/sign-in">Sign in</Link>
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-2">
			{/* Hidden on a phone, where the row has no width to spare. The button
			    is what you came for; the name is a reassurance. */}
			<span className="hidden text-sm text-muted-foreground sm:inline">
				{user.name.trim() || user.email}
			</span>

			{/* A real form, so signing out is a POST. Better Auth does not require a
			    name, so a blank one falls back to the email above rather than
			    greeting someone with an empty space. */}
			<Form method="post" action="/sign-out">
				<Button type="submit" variant="ghost" size="sm">
					Sign out
				</Button>
			</Form>
		</div>
	);
}
