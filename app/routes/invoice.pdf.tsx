import puppeteer from "@cloudflare/puppeteer";
import type { Route } from "./+types/invoice.pdf";
import { cloudflareContext } from "~/context";
import { getUser } from "~/lib/auth.server";
import { parseDraft } from "~/lib/invoice-draft";
import {
	buildPrintDocument,
	MAX_DRAFT_BYTES,
	pdfFilename,
} from "~/lib/print-document.server";
import {
	consumeRenderQuota,
	releaseRenderQuota,
	secondsUntilNextDay,
} from "~/lib/render-quota.server";
import { rateLimitKey, readBoundedText } from "~/lib/request.server";

/* The render endpoint. It takes an invoice draft as JSON and returns the
   document to print. Feature 5b keeps this route, its guards, and its status
   codes exactly as they are, and returns a PDF instead of the HTML.

   The order of the guards is the point: size before parsing, parsing before
   validation, validation before rendering. Nothing oversized or malformed
   should reach the renderer, and nothing should reach Browser Rendering, which
   is the slowest and most expensive call in the app.

   Reachable without an account, and it still touches no storage on anyone's
   behalf: it draws the invoice it was handed and keeps nothing. It does read the
   session, but only to answer one question, which of the two throttles apply
   (F-46). The overview's tier table is the rule being implemented: the burst
   limits are the price of being anonymous, and the daily render quota is
   everybody's, because the account's browser time is a shared and unrefillable
   thing that a signed-in user can exhaust just as easily. */

const PLAIN_TEXT = "text/plain; charset=utf-8";

function fail(status: number, message: string, headers: HeadersInit = {}) {
	return new Response(message, {
		status,
		headers: { "content-type": PLAIN_TEXT, ...headers },
	});
}

const methodNotAllowed = () =>
	fail(405, "Use POST with an invoice draft as JSON.", { allow: "POST" });

/* The free tier lets a new browser start once every twenty seconds, so that is
   the shortest honest thing to tell someone to wait. */
const BROWSER_RETRY_AFTER_SECONDS = 20;

// The throttle's window, so the number the caller is told matches the config.
const THROTTLE_RETRY_AFTER_SECONDS = 60;

/* The shared bucket's key. A constant, because the point of the second limiter
   is that everyone lands in the same one. */
const GLOBAL_KEY = "invoice-pdf";

/* Whether this request carries a session, which is the only thing this route
   wants to know about who is asking.

   A failure is answered as "no", so an unreadable session costs the caller the
   anonymous tier's throttle rather than handing anyone the unthrottled path.
   That is the same fail-closed call the two guards below make.

   Asked before the throttle, which is otherwise the first thing this route does
   on purpose. That ordering is not weakened by this: Better Auth answers a
   request carrying no session cookie without going to the database, and a flood
   is exactly that. One carrying a cookie costs a single indexed lookup, which is
   what any signed-in request already pays. */
async function isSignedIn(env: Env, request: Request): Promise<boolean> {
	try {
		return (await getUser(request, env)) !== null;
	} catch (error) {
		console.error("Session lookup failed on the render endpoint", error);
		return false;
	}
}

/* Two questions, asked in order: is this caller going too fast, and is everyone
   together going too fast. The second is only asked when the first passes, so a
   caller who is already being turned away does not also spend the allowance the
   rest of the world is sharing. */
async function isThrottled(env: Env, request: Request): Promise<boolean> {
	const caller = await env.PDF_LIMITER.limit({ key: rateLimitKey(request) });
	if (!caller.success) return true;

	const everyone = await env.PDF_GLOBAL_LIMITER.limit({ key: GLOBAL_KEY });
	return !everyone.success;
}

/* Cloudflare reports an exhausted browser quota as a 429 inside the launch
   error's message. Matching on text is not something to be proud of, but the
   error carries no code to read, and the alternative is telling a user their
   invoice is broken when it is merely queued. */
function isOutOfBrowserQuota(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("429") || /rate limit/i.test(message);
}

// A GET reaches the loader rather than the action, so the refusal lives here too.
export function loader() {
	return methodNotAllowed();
}

export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== "POST") return methodNotAllowed();

	const { env } = context.get(cloudflareContext);

	/* Before the body is read, let alone rendered: a caller sending floods of
	   large payloads should be turned away at the door rather than after being
	   measured. Rendering is what this protects, but reading is not free either.

	   Skipped for a signed-in user, whose downloads the overview does not rate
	   limit. Two a minute is the right ceiling for a stranger and the wrong one
	   for someone sending out their invoices for the week; behind an office NAT it
	   was worse still, because the limiter keys on the IP everyone shares. */
	try {
		if (!(await isSignedIn(env, request)) && (await isThrottled(env, request))) {
			return fail(
				429,
				"Too many invoice downloads from here. Try again in a minute.",
				{ "retry-after": String(THROTTLE_RETRY_AFTER_SECONDS) },
			);
		}
	} catch (error) {
		console.error("Rate limiter unavailable", error);

		/* Fail closed, deliberately. Waving traffic through would hand the
		   account's daily browser allowance to whatever just broke, and that
		   allowance cannot be refilled before tomorrow. A download that fails for
		   a minute is the cheaper mistake. */
		return fail(503, "Downloads are briefly unavailable. Try again shortly.", {
			"retry-after": String(THROTTLE_RETRY_AFTER_SECONDS),
		});
	}

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

	/* Last guard before the expensive call, and last on purpose: the day's
	   capacity is spent only by a request that was going to be rendered, so a
	   malformed body or a throttled caller never costs anyone a slot. */
	let quota;
	try {
		quota = await consumeRenderQuota(env.DB);
	} catch (error) {
		console.error("Render quota unavailable", error);

		/* Fail closed, the same call the rate limiter makes and for the same
		   reason: an allowance that cannot be refilled until tomorrow is not one
		   to hand out while the counter is blind. */
		return fail(503, "Downloads are briefly unavailable. Try again shortly.", {
			"retry-after": String(THROTTLE_RETRY_AFTER_SECONDS),
		});
	}

	if (!quota.allowed) {
		/* Tomorrow, not in a minute. This is the daily allowance, and telling
		   someone to retry shortly would send them back into the same wall. */
		return fail(
			503,
			"Invoice downloads have reached today's limit. Please try again tomorrow.",
			{ "retry-after": String(secondsUntilNextDay()) },
		);
	}

	let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

	try {
		browser = await puppeteer.launch(env.BROWSER);
		const page = await browser.newPage();

		/* networkidle0, not the default: the document links a webfont, and taking
		   the PDF the moment the markup is set would set the invoice in whatever
		   the browser falls back to. */
		await page.setContent(buildPrintDocument(draft), {
			waitUntil: "networkidle0",
		});

		/* And then wait for the font itself. networkidle0 covers the request in
		   practice, but it is a quiet-network heuristic, not a promise that the
		   face is ready to paint; this is the actual signal. A PDF set in the
		   fallback face looks fine until you hold it next to the preview. */
		await page.evaluate(() => document.fonts.ready);

		/* printBackground because the paper and Classic's filled table head are
		   backgrounds, and a print defaults to dropping them. */
		const pdf = await page.pdf({ format: "Letter", printBackground: true });

		/* puppeteer types the result as a Node Buffer, which the Workers Response
		   does not take. Copying it into a plain Uint8Array is a few hundred
		   kilobytes and keeps the types honest, rather than casting the mismatch
		   away. */
		return new Response(new Uint8Array(pdf), {
			headers: {
				"content-type": "application/pdf",
				"content-disposition": `attachment; filename="${pdfFilename(draft.invoiceNumber)}"`,
				// Someone's billing details: never hold a copy at the edge.
				"cache-control": "no-store",
			},
		});
	} catch (error) {
		// Detail to the Worker log, which observability is on for; a sentence to
		// the caller, who can do nothing with a stack trace.
		console.error("Invoice PDF render failed", error);

		/* An unassigned `browser` means the launch itself failed, so no browser
		   time was spent and the slot taken above bought nothing. A failure after
		   this point did open a browser, and that is a real cost the day should
		   still carry. */
		if (!browser) {
			try {
				await releaseRenderQuota(env.DB);
			} catch (releaseError) {
				/* Swallowed on purpose. The caller's problem is the render that
				   failed, and replacing that with a database error would report the
				   wrong thing; the worst case is one slot lost from today. */
				console.error("Could not release the render slot", releaseError);
			}
		}

		/* Running out of browser quota is the failure this app will actually see:
		   the free tier allows one new browser every twenty seconds. Telling
		   someone that something broke, when all they have to do is wait, is the
		   wrong answer, so it gets its own status and its own sentence. */
		if (isOutOfBrowserQuota(error)) {
			return fail(
				503,
				"Too many invoices are being generated right now. Try again in a moment.",
				{ "retry-after": String(BROWSER_RETRY_AFTER_SECONDS) },
			);
		}

		return fail(502, "The invoice could not be rendered right now.");
	} finally {
		/* Always, including after a throw. A session left open counts against the
		   concurrent limit until it times out ten minutes later. */
		await browser?.close();
	}
}
