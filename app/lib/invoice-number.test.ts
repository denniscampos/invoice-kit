import { describe, expect, it } from "vitest";
import { nextInvoiceNumber } from "./invoice-number";

describe("nextInvoiceNumber", () => {
	it("starts a user off at INV-0001", () => {
		expect(nextInvoiceNumber([])).toBe("INV-0001");
	});

	it("counts on from the highest number", () => {
		expect(nextInvoiceNumber(["INV-0007"])).toBe("INV-0008");
	});

	it("carries into the next ten", () => {
		expect(nextInvoiceNumber(["INV-0009"])).toBe("INV-0010");
	});

	// The padding is a minimum, not a maximum: the number is allowed to outgrow it.
	it("grows a digit past the padded width", () => {
		expect(nextInvoiceNumber(["INV-9999"])).toBe("INV-10000");
	});

	it("keeps a wider padding once a user has one", () => {
		expect(nextInvoiceNumber(["INV-000042"])).toBe("INV-000043");
	});

	it("does not shrink the padding when a shorter number is also present", () => {
		expect(nextInvoiceNumber(["INV-000042", "INV-0007"])).toBe("INV-000043");
	});

	it("takes the highest, not the last", () => {
		expect(nextInvoiceNumber(["INV-0003", "INV-0011", "INV-0007"])).toBe("INV-0012");
		expect(nextInvoiceNumber(["INV-0011", "INV-0003"])).toBe("INV-0012");
	});

	/* A user is free to number an invoice however they like. The sequence steps
	   over what it does not recognise rather than breaking on it. */
	it("ignores numbers that are not part of the sequence", () => {
		expect(nextInvoiceNumber(["2026-04", "ACME-1", "INV-0005"])).toBe("INV-0006");
	});

	it("starts over at INV-0001 when nothing matches the pattern", () => {
		expect(nextInvoiceNumber(["2026-04", "ACME-1", ""])).toBe("INV-0001");
	});

	it("is not fooled by something that merely contains a number", () => {
		expect(nextInvoiceNumber(["INV-0007-COPY", "PRE-INV-0009"])).toBe("INV-0001");
	});

	it("tolerates surrounding whitespace", () => {
		expect(nextInvoiceNumber([" INV-0007 "])).toBe("INV-0008");
	});

	// Number("...") would happily return Infinity or lose precision here.
	it("ignores a number too large to count on from", () => {
		expect(nextInvoiceNumber(["INV-99999999999999999999"])).toBe("INV-0001");
	});
});
