import type { Route } from "./+types/invoice.pdf";
import { parseDraft } from "~/lib/invoice-draft";
import { buildPrintDocument, MAX_DRAFT_BYTES } from "~/lib/print-document.server";
import { readBoundedText } from "~/lib/request.server";

/* The account free render endpoint. It takes an invoice draft as JSON and
   returns the document to print. Feature 5b keeps this route, its guards, and
   its status codes exactly as they are, and returns a PDF instead of the HTML.

   The order of the guards is the point: size before parsing, parsing before
   validation, validation before rendering. Nothing oversized or malformed
   should reach the renderer, and in 5b nothing should reach Browser Rendering,
   which is the slowest and most expensive call in the app.

   No session, no storage. This is the anonymous tier, so the only thing it can
   be asked to do is draw the invoice it was handed. */

const PLAIN_TEXT = "text/plain; charset=utf-8";

function fail(status: number, message: string, headers: HeadersInit = {}) {
	return new Response(message, {
		status,
		headers: { "content-type": PLAIN_TEXT, ...headers },
	});
}

const methodNotAllowed = () =>
	fail(405, "Use POST with an invoice draft as JSON.", { allow: "POST" });

// A GET reaches the loader rather than the action, so the refusal lives here too.
export function loader() {
	return methodNotAllowed();
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return methodNotAllowed();

	/* The declared length is a cheap first refusal, and it is not trusted: a
	   request can understate or omit it, so the real bytes are measured below. */
	const declaredLength = Number(request.headers.get("content-length"));
	if (declaredLength > MAX_DRAFT_BYTES) {
		return fail(413, "That invoice is too large to render.");
	}

	/* The real guard: the body is counted as it arrives and abandoned the moment
	   it passes the cap, so an oversized request is never held in memory whether
	   or not it declared its length. */
	const body = await readBoundedText(request, MAX_DRAFT_BYTES);
	if (body === null) {
		return fail(413, "That invoice is too large to render.");
	}

	let payload: unknown;
	try {
		payload = JSON.parse(body);
	} catch {
		return fail(400, "The request body is not JSON.");
	}

	/* One rule for every draft, whether it came from this app's own storage or
	   from a stranger's curl. A draft that does not check out is refused, never
	   repaired into something printable. */
	const draft = parseDraft(payload);
	if (!draft) return fail(400, "That is not a valid invoice draft.");

	return new Response(buildPrintDocument(draft), {
		headers: {
			"content-type": "text/html; charset=utf-8",
			// Someone's billing details: never hold a copy at the edge.
			"cache-control": "no-store",
		},
	});
}
