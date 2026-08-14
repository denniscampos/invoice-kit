import { createContext } from "react-router";

/**
 * Cloudflare bindings and execution context for the current request.
 *
 * Seeded in `workers/app.ts` and read in loaders/actions/middleware via
 * `context.get(cloudflareContext)`.
 */
export const cloudflareContext = createContext<{
	env: Env;
	ctx: ExecutionContext;
}>();
