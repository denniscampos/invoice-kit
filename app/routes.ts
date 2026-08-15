import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/editor.tsx"),
	// A resource route: no component, it answers with the document itself.
	route("invoice/pdf", "routes/invoice.pdf.tsx"),
	// Better Auth owns every path under here; the splat hands them all over.
	route("api/auth/*", "routes/api.auth.$.tsx"),
	route("sign-up", "routes/sign-up.tsx"),
	route("sign-in", "routes/sign-in.tsx"),
	// Action only: a GET that ends a session is a link anything can fire.
	route("sign-out", "routes/sign-out.tsx"),
] satisfies RouteConfig;
