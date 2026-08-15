import type { Route } from "./+types/api.auth.$";
import { cloudflareContext } from "~/context";
import { createAuth } from "~/lib/auth.server";

/* Better Auth's own endpoints, mounted under /api/auth. Everything the library
   offers lives behind this one splat route: sign up, sign in, sign out, session
   lookup, and whatever a future plugin adds.

   Both handlers do the same thing because the library reads the method itself.
   A GET reaches the loader and a POST reaches the action, and neither this file
   nor anything else in the app decides what a given path means. */

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);
	return createAuth(env).handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
	const { env } = context.get(cloudflareContext);
	return createAuth(env).handler(request);
}
