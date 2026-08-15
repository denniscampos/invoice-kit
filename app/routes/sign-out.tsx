import { redirect } from "react-router";
import type { Route } from "./+types/sign-out";
import { cloudflareContext } from "~/context";
import { createAuth } from "~/lib/auth.server";

/* Ending a session. A resource route: an action, no loader, no component.

   The missing loader is the point. A GET that signs people out is a link any
   prefetcher, crawler, or third party <img src> can fire, and the result is a
   user logged out by a page they only looked at. Without a loader the router
   answers a GET with 405 and nothing happens. */

export async function action({ request, context }: Route.ActionArgs) {
	const { env } = context.get(cloudflareContext);

	try {
		const { headers } = await createAuth(env).api.signOut({
			returnHeaders: true,
			headers: request.headers,
		});

		/* The clearing cookie has to ride the redirect, the mirror image of the
		   session cookie on sign in. Without it the session stays live and the
		   user is told they signed out. */
		const outgoing = new Headers();
		for (const cookie of headers.getSetCookie()) {
			outgoing.append("set-cookie", cookie);
		}

		return redirect("/", { headers: outgoing });
	} catch {
		/* Better Auth throws when there is no session to end, which happens on a
		   double click or an expired cookie. The outcome the user asked for is
		   already true, so send them to the editor rather than an error page. */
		return redirect("/");
	}
}
