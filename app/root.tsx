import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { cloudflareContext } from "~/context";
import { getUser } from "~/lib/auth.server";
import {
	FONT_CSS_ORIGIN,
	FONT_FILE_ORIGIN,
	INTER_STYLESHEET_HREF,
} from "~/lib/fonts";

/* Who is signed in, resolved once for the whole app.

   Here rather than in each page so every route gets a truthful app bar without
   asking, and so the answer arrives with the document: a client side lookup
   would render the bar as anonymous first and correct itself a moment later.

   This runs on every navigation, so it stays one indexed lookup. Anything else
   added here is paid for on every page load in the app. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(cloudflareContext);

	return { user: await getUser(request, env) };
}

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: FONT_CSS_ORIGIN },
	{ rel: "preconnect", href: FONT_FILE_ORIGIN, crossOrigin: "anonymous" },
	{ rel: "stylesheet", href: INTER_STYLESHEET_HREF },
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
