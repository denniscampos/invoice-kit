import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* Standalone rather than extending vite.config.ts: that config loads the
   Cloudflare and React Router plugins, which expect a Worker build and are not
   needed to test pure functions. Worker-level code that needs real bindings
   would use @cloudflare/vitest-pool-workers in its own project. */
export default defineConfig({
	/* The app imports through the ~ alias that tsconfig defines. Vite gets it from
	   tsconfigPaths in vite.config.ts, which this config deliberately does not
	   load, so it has to be declared here too. Without it, only type-only imports
	   through ~ work in tests, because those are erased before resolution. */
	resolve: {
		alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
	},
	test: {
		environment: "node",
		include: ["app/**/*.test.ts"],
		// "no tests ran" is a failure, not a pass.
		passWithNoTests: false,
	},
});
