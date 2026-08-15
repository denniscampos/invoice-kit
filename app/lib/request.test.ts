import { describe, expect, it } from "vitest";
import { rateLimitKey, readBoundedText } from "./request.server";

const post = (body: BodyInit | null) =>
	new Request("https://example.test/invoice/pdf", { method: "POST", body });

const byteLength = (text: string) => new TextEncoder().encode(text).length;

describe("readBoundedText", () => {
	it("returns a body that fits", async () => {
		expect(await readBoundedText(post("hello"), 1024)).toBe("hello");
	});

	it("accepts a body of exactly the limit", async () => {
		const body = "a".repeat(64);

		expect(await readBoundedText(post(body), 64)).toBe(body);
	});

	it("refuses a body one byte over the limit", async () => {
		expect(await readBoundedText(post("a".repeat(65)), 64)).toBeNull();
	});

	it("returns an empty string for no body", async () => {
		expect(await readBoundedText(post(null), 64)).toBe("");
	});

	/* The reason this counts bytes. Ninety accented characters are ninety
	   characters and a hundred and eighty bytes, so a character count would let
	   this through a limit it is twice the size of. */
	it("counts bytes rather than characters", async () => {
		const accented = "é".repeat(90);

		expect(accented.length).toBe(90);
		expect(byteLength(accented)).toBe(180);
		expect(await readBoundedText(post(accented), 100)).toBeNull();
	});

	it("keeps multibyte characters intact", async () => {
		const text = 'Café — naïve — 🧾 "quoted" — Ω';

		expect(await readBoundedText(post(text), 1024)).toBe(text);
	});

	/* A body arriving in pieces is the case the byte counting has to survive, and
	   the one where decoding chunk by chunk would corrupt a split character. */
	it("handles a chunked body split mid character", async () => {
		const encoded = new TextEncoder().encode("🧾🧾🧾");
		const stream = new ReadableStream({
			start(controller) {
				// Deliberately split inside the first emoji's four bytes.
				controller.enqueue(encoded.slice(0, 2));
				controller.enqueue(encoded.slice(2));
				controller.close();
			},
		});
		const request = new Request("https://example.test/invoice/pdf", {
			method: "POST",
			body: stream,
			// @ts-expect-error duplex is required for a stream body and not in the DOM types
			duplex: "half",
		});

		expect(await readBoundedText(request, 1024)).toBe("🧾🧾🧾");
	});

	it("stops reading a chunked body once it passes the limit", async () => {
		let chunksPulled = 0;
		const stream = new ReadableStream({
			pull(controller) {
				chunksPulled += 1;
				if (chunksPulled > 50) return controller.close();
				controller.enqueue(new Uint8Array(1024));
			},
		});
		const request = new Request("https://example.test/invoice/pdf", {
			method: "POST",
			body: stream,
			// @ts-expect-error duplex is required for a stream body and not in the DOM types
			duplex: "half",
		});

		expect(await readBoundedText(request, 4096)).toBeNull();
		// Five chunks to pass 4KB, not the fifty the body was willing to send.
		expect(chunksPulled).toBeLessThan(10);
	});
});

describe("rateLimitKey", () => {
	const withHeaders = (headers: Record<string, string>) =>
		new Request("https://example.test/invoice/pdf", { method: "POST", headers });

	it("buckets by the address Cloudflare reports", () => {
		expect(rateLimitKey(withHeaders({ "cf-connecting-ip": "203.0.113.7" }))).toBe(
			"203.0.113.7",
		);
	});

	/* The header the caller controls. Trusting it would hand every request its
	   own allowance, which is the same as having no limit at all. */
	it("ignores X-Forwarded-For", () => {
		const key = rateLimitKey(
			withHeaders({
				"cf-connecting-ip": "203.0.113.7",
				"x-forwarded-for": "198.51.100.1",
			}),
		);

		expect(key).toBe("203.0.113.7");
	});

	it("does not fall back to a caller-supplied header", () => {
		const key = rateLimitKey(withHeaders({ "x-forwarded-for": "198.51.100.1" }));

		expect(key).not.toBe("198.51.100.1");
	});

	/* An unidentified caller shares one bucket rather than skipping the check,
	   so the unknown case throttles harder rather than not at all. */
	it.each([
		["a missing header", {}],
		["an empty header", { "cf-connecting-ip": "" }],
		["a whitespace header", { "cf-connecting-ip": "   " }],
	])("shares a single bucket for %s", (_label, headers) => {
		expect(rateLimitKey(withHeaders(headers))).toBe("unidentified");
	});

	it("gives two different callers two different buckets", () => {
		const a = rateLimitKey(withHeaders({ "cf-connecting-ip": "203.0.113.7" }));
		const b = rateLimitKey(withHeaders({ "cf-connecting-ip": "203.0.113.8" }));

		expect(a).not.toBe(b);
	});
});
