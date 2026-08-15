import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/editor.tsx"),
	// A resource route: no component, it answers with the document itself.
	route("invoice/pdf", "routes/invoice.pdf.tsx"),
	// Better Auth owns every path under here; the splat hands them all over.
	route("api/auth/*", "routes/api.auth.$.tsx"),
] satisfies RouteConfig;
