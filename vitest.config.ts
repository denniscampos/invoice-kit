import { defineConfig } from "vitest/config";

/* Standalone rather than extending vite.config.ts: that config loads the
   Cloudflare and React Router plugins, which expect a Worker build and are not
   needed to test pure functions. Worker-level code that needs real bindings
   would use @cloudflare/vitest-pool-workers in its own project. */
export default defineConfig({
	test: {
		environment: "node",
		include: ["app/**/*.test.ts"],
		// "no tests ran" is a failure, not a pass.
		passWithNoTests: false,
	},
});
