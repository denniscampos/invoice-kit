import { describe, expect, it } from "vitest";
import { safeRedirectTo } from "./auth.server";

describe("safeRedirectTo", () => {
	it("keeps a path in this app", () => {
		expect(safeRedirectTo("/invoices")).toBe("/invoices");
	});

	it("keeps the query string with it", () => {
		expect(safeRedirectTo("/invoices?status=paid")).toBe("/invoices?status=paid");
	});

	/* The whole reason this function exists. A crafted link sends someone to our
	   real sign in page, they really sign in, and land somewhere else entirely. */
	it("refuses a protocol-relative URL", () => {
		expect(safeRedirectTo("//evil.com")).toBe("/");
		expect(safeRedirectTo("//evil.com/pay")).toBe("/");
	});

	it("refuses an absolute URL", () => {
		expect(safeRedirectTo("https://evil.com")).toBe("/");
		expect(safeRedirectTo("http://evil.com/pay")).toBe("/");
	});

	it("refuses a scheme that is not a location at all", () => {
		expect(safeRedirectTo("javascript:alert(1)")).toBe("/");
		expect(safeRedirectTo("data:text/html,<script>alert(1)</script>")).toBe("/");
	});

	// A browser treats the backslash as a slash, so this leaves the site too.
	it("refuses a backslash disguised as a path", () => {
		expect(safeRedirectTo("/\\evil.com")).toBe("/");
	});

	it("falls back to the editor when there is nothing to honour", () => {
		expect(safeRedirectTo("")).toBe("/");
		expect(safeRedirectTo(null)).toBe("/");
		expect(safeRedirectTo(undefined)).toBe("/");
	});

	// A bare word is a relative path the browser would resolve against the
	// current page, which is not the same page for every caller.
	it("refuses anything that is not rooted", () => {
		expect(safeRedirectTo("invoices")).toBe("/");
		expect(safeRedirectTo("../admin")).toBe("/");
	});
});
