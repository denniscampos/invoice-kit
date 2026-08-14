import { describe, expect, it } from "vitest";
import {
	currencySymbol,
	formatMinorUnits,
	formatMoney,
	lineItemTotal,
	parseMoneyInput,
	parseQuantity,
} from "./money";

describe("parseMoneyInput", () => {
	it.each([
		["12", 1200],
		["12.5", 1250],
		["12.50", 1250],
		["0", 0],
		["0.01", 1],
		["1250", 125000],
		/* The halfway state of typing "12.50". Accepted so the amount keeps up
		   with the keystrokes instead of freezing on the trailing point. */
		["12.", 1200],
	])("parses %s", (raw, expected) => {
		expect(parseMoneyInput(raw)).toBe(expected);
	});

	/* The case that fails if minor units are computed as parseFloat(raw) * 100:
	   12.345 * 100 is 1234.4999999999998, which rounds down to 1234. */
	it("rounds the third decimal place without float error", () => {
		expect(parseMoneyInput("12.345")).toBe(1235);
		expect(parseMoneyInput("0.005")).toBe(1);
		expect(parseMoneyInput("12.344")).toBe(1234);
		expect(parseMoneyInput("1.005")).toBe(101);
	});

	it("ignores separators and currency symbols", () => {
		expect(parseMoneyInput("1,250.00")).toBe(125000);
		expect(parseMoneyInput("$145.00")).toBe(14500);
		expect(parseMoneyInput(" 12.50 ")).toBe(1250);
		expect(parseMoneyInput("£8,680.00")).toBe(868000);
	});

	/* A comma is the decimal separator across most of the eurozone, and EUR is in
	   the currency picker. Reading "12,50" as 1250.00 was a hundredfold billing
	   error (F-10). */
	it("reads a decimal comma as a decimal point", () => {
		expect(parseMoneyInput("12,50")).toBe(1250);
		expect(parseMoneyInput("1,25")).toBe(125);
		expect(parseMoneyInput("0,005")).toBe(1);
		expect(parseMoneyInput("12,345")).toBe(1234500);
	});

	it("reads grouped thousands in either convention", () => {
		expect(parseMoneyInput("1,234,567")).toBe(123456700);
		expect(parseMoneyInput("1.234.567")).toBe(123456700);
		expect(parseMoneyInput("1.234,56")).toBe(123456);
		expect(parseMoneyInput("1,234.56")).toBe(123456);
	});

	/* The one case the string cannot settle: "1,250" is 1250 to an American and
	   1.25 to a German. It resolves as grouping, matching how the app formats. */
	it("treats a comma with exactly three digits after it as grouping", () => {
		expect(parseMoneyInput("1,250")).toBe(125000);
	});

	it("rejects inconsistent grouping rather than guessing", () => {
		expect(parseMoneyInput("1,23,456")).toBeNull();
		expect(parseMoneyInput("1.2.3")).toBeNull();
	});

	/* Four decimal places is a legitimate amount to type, not bad grouping: it
	   rounds to minor units like any other. */
	it("accepts more decimal places than it keeps", () => {
		expect(parseMoneyInput("12,3456")).toBe(1235);
		expect(parseMoneyInput("12.3456")).toBe(1235);
	});

	it.each([
		["", "empty string"],
		["   ", "whitespace only"],
		["abc", "letters"],
		["-5", "a negative"],
		["1.2.3", "two decimal points"],
		[".5", "no whole part"],
		["1e3", "exponent notation"],
	])("rejects %s (%s)", (raw) => {
		expect(parseMoneyInput(raw)).toBeNull();
	});

	it("rejects an amount too large to hold exactly", () => {
		expect(parseMoneyInput("999999999999999999")).toBeNull();
	});
});

describe("parseQuantity", () => {
	it.each([
		["1", 1],
		["0", 0],
		["1.5", 1.5],
		["18", 18],
		["0.25", 0.25],
		["1,000", 1000],
		// Same halfway-through-typing allowance as money.
		["3.", 3],
	])("parses %s", (raw, expected) => {
		expect(parseQuantity(raw)).toBe(expected);
	});

	/* The quantity column has to read a comma exactly as the rate column does,
	   or the same keystroke means different things one field apart (F-14). */
	it("reads separators the same way parseMoneyInput does", () => {
		expect(parseQuantity("1,5")).toBe(1.5);
		expect(parseQuantity("0,25")).toBe(0.25);
		expect(parseQuantity("1.234,5")).toBe(1234.5);
		expect(parseQuantity("1,234,567")).toBe(1234567);
	});

	it.each([
		["", "empty string"],
		["  ", "whitespace only"],
		["-2", "a negative"],
		["abc", "letters"],
		["2x", "trailing letters"],
		["1.2.3", "inconsistent grouping"],
		["$5", "a currency symbol"],
	])("rejects %s (%s)", (raw) => {
		expect(parseQuantity(raw)).toBeNull();
	});
});

describe("lineItemTotal", () => {
	it("multiplies a quantity by a rate in minor units", () => {
		expect(lineItemTotal(3, 1000)).toBe(3000);
		expect(lineItemTotal(18, 14500)).toBe(261000);
		expect(lineItemTotal(1, 85000)).toBe(85000);
	});

	it("rounds half away from zero", () => {
		expect(lineItemTotal(0.5, 999)).toBe(500);
		expect(lineItemTotal(0.5, 1001)).toBe(501);
	});

	/* 1.005 * 10000 is 10050.000000000002, and 0.1 * 3 is 0.30000000000000004.
	   Rounding at the point of multiplication is what keeps that out of the
	   stored total. */
	it("absorbs float error from a fractional quantity", () => {
		expect(lineItemTotal(1.005, 10000)).toBe(10050);
		expect(lineItemTotal(0.1, 300)).toBe(30);
		expect(lineItemTotal(2.675, 10000)).toBe(26750);
	});

	it("is zero when either side is zero", () => {
		expect(lineItemTotal(0, 14500)).toBe(0);
		expect(lineItemTotal(18, 0)).toBe(0);
	});
});

describe("formatMinorUnits", () => {
	it.each([
		[0, "0.00"],
		[1, "0.01"],
		[1250, "12.50"],
		[125000, "1,250.00"],
		[868000, "8,680.00"],
		[261000, "2,610.00"],
	])("formats %i as %s", (minor, expected) => {
		expect(formatMinorUnits(minor)).toBe(expected);
	});

	it("round-trips every parseable amount", () => {
		for (const raw of ["0", "12.50", "1,250.00", "8,680.00", "0.01"]) {
			const minor = parseMoneyInput(raw);
			expect(minor).not.toBeNull();
			expect(parseMoneyInput(formatMinorUnits(minor as number))).toBe(minor);
		}
	});
});

describe("currencySymbol", () => {
	it("resolves the symbol for the currencies in the picker", () => {
		expect(currencySymbol("USD")).toBe("$");
		expect(currencySymbol("EUR")).toBe("€");
		expect(currencySymbol("GBP")).toBe("£");
	});

	/* CAD and AUD share the dollar sign with USD in en-US, disambiguated by a
	   prefix. Whatever Intl returns is what the document shows, so this asserts
	   the shape rather than a hand-picked string. */
	it("returns something dollar-ish for the other dollar currencies", () => {
		expect(currencySymbol("CAD")).toContain("$");
		expect(currencySymbol("AUD")).toContain("$");
	});

	it("falls back to the code itself rather than throwing", () => {
		expect(currencySymbol("XYZ")).toBe("XYZ");
		expect(currencySymbol("not a currency")).toBe("not a currency");
		expect(currencySymbol("")).toBe("");
	});
});

describe("formatMoney", () => {
	it("puts the symbol in front of the exact digits", () => {
		expect(formatMoney(868000, "USD")).toBe("$8,680.00");
		expect(formatMoney(0, "USD")).toBe("$0.00");
		expect(formatMoney(1, "USD")).toBe("$0.01");
	});

	it("follows the currency", () => {
		expect(formatMoney(1250, "EUR")).toBe("€12.50");
		expect(formatMoney(1250, "GBP")).toBe("£12.50");
		expect(formatMoney(1250, "XYZ")).toBe("XYZ12.50");
	});

	/* The digits come from formatMinorUnits, not from dividing by 100 and
	   handing the float to Intl. */
	it("keeps the exact minor units", () => {
		expect(formatMoney(123456789, "USD")).toBe("$1,234,567.89");
	});
});
