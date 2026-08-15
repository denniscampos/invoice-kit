import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		reactRouter(),
	],
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		/* One port, always. strictPort is the part that matters: without it Vite
		   quietly moves to the next free port when this one is busy, and
		   BETTER_AUTH_URL in .dev.vars stops matching the origin the app is
		   actually served from. Failing to start is the better outcome, because
		   the alternative shows up later as a confusing 403 from auth.

		   5180 rather than Vite's 5173 so this project and the others on this
		   machine can run at the same time. */
		port: 5180,
		strictPort: true,
	},
});
