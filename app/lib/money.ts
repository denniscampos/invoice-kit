/* Money is integer minor units everywhere in this app. These two functions are
   the only boundary between that and what a person types, so the rounding rule
   lives here and nowhere else. */

const MINOR_UNIT_DIGITS = 2;
const MINOR_UNITS_PER_MAJOR = 100;

/* Currency symbols and spaces carry no numeric meaning, so they come out before
   anything is decided. Separators emphatically do not: see splitAtDecimal. */
const DECORATION = /[\s$£€¥]/g;

/* Either a plain run of digits, or digits grouped in threes by one consistent
   separator. The backreference is what rejects "1.2.3" and "1,23,456". */
const WHOLE_PART = /^(?:\d+|\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*)$/;

/* Splits a number into its whole and fractional parts without assuming which
   separator means what, because that varies by country and this app has EUR and
   GBP in its currency picker.

   The last separator is the decimal point, with two exceptions that make it
   grouping instead. First, a separator that appears more than once cannot be a
   decimal point, so "1.234.567" and "1,234,567" are both grouped thousands.
   Second, a comma followed by exactly three digits, as in "1,250".

   That second case is the one the string genuinely cannot settle: a German
   writing "1,250" means one and a quarter. It resolves as grouping because the
   app formats in that convention, except when the number starts with a zero,
   where grouping would be meaningless and "0,005" can only be a decimal.
   Everything else follows the string: "12,50" is a decimal comma, "1.234,56" is
   German, "1,234.56" is American. */
function splitAtDecimal(text: string): { whole: string; fraction: string } {
	const lastSeparator = Math.max(text.lastIndexOf(","), text.lastIndexOf("."));
	if (lastSeparator === -1) return { whole: text, fraction: "" };

	const separator = text[lastSeparator];
	const repeated = text.indexOf(separator) !== lastSeparator;
	const trailingDigits = text.length - lastSeparator - 1;
	const ambiguousComma =
		separator === "," && trailingDigits === 3 && !text.startsWith("0");

	if (repeated || ambiguousComma) return { whole: text, fraction: "" };

	return {
		whole: text.slice(0, lastSeparator),
		fraction: text.slice(lastSeparator + 1),
	};
}

/* Parses a typed amount into integer minor units, or null when it is not a
   number this app will accept. Negatives are rejected: a negative line rate is
   a discount, which is feature 19, not a number to quietly store.

   Deliberately not Math.round(parseFloat(raw) * 100). That returns 1234 for
   "12.345", because 12.345 * 100 is 1234.4999999999998 in IEEE 754. Reading the
   digits as text keeps float error out of the one place it does real damage. */
export function parseMoneyInput(raw: string): number | null {
	const cleaned = raw.replace(DECORATION, "");
	if (!cleaned) return null;

	const { whole, fraction } = splitAtDecimal(cleaned);
	if (!WHOLE_PART.test(whole)) return null;
	if (!/^\d*$/.test(fraction)) return null;

	// One extra digit past the ones we keep, which is what decides the rounding.
	const digits = fraction.padEnd(MINOR_UNIT_DIGITS + 1, "0");
	const truncated =
		Number(whole.replace(/[.,]/g, "")) * MINOR_UNITS_PER_MAJOR +
		Number(digits.slice(0, MINOR_UNIT_DIGITS));
	const roundUp = Number(digits[MINOR_UNIT_DIGITS]) >= 5;
	const minor = roundUp ? truncated + 1 : truncated;

	// A long enough string of digits leaves the range where integers are exact.
	return Number.isSafeInteger(minor) ? minor : null;
}

/* Quantities are genuinely fractional (3.5 hours, 0.25 days), so unlike money
   they stay floats. They read separators through the same splitAtDecimal as
   money, because two fields sitting next to each other in the same row must not
   disagree about what a comma means. Currency symbols are not stripped here:
   a "$" in the quantity column is a mistake worth rejecting, not decoration. */
export function parseQuantity(raw: string): number | null {
	const cleaned = raw.replace(/\s/g, "");
	if (!cleaned) return null;

	const { whole, fraction } = splitAtDecimal(cleaned);
	if (!WHOLE_PART.test(whole)) return null;
	if (!/^\d*$/.test(fraction)) return null;

	const quantity = Number(`${whole.replace(/[.,]/g, "")}.${fraction || "0"}`);
	return Number.isFinite(quantity) ? quantity : null;
}

/* The only multiplication in the app. Rounding here rather than at display time
   is what makes a saved invoice reproduce its own arithmetic: the stored line
   total is the number the customer was shown, not one recomputed later from
   floats that may not land the same way. */
export function lineItemTotal(quantity: number, rate: number): number {
	const total = Math.round(quantity * rate);
	return Number.isSafeInteger(total) ? total : 0;
}

/* The symbol for a currency code, from Intl rather than a hand-written table
   that would go stale and never cover every code the app might see. Intl throws
   on a malformed code and returns the code itself for a well-formed unknown one,
   so both degrade to "USD 8,680.00" instead of breaking the document. */
export function currencySymbol(code: string): string {
	try {
		const parts = new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: code,
		}).formatToParts(0);

		return parts.find((part) => part.type === "currency")?.value ?? code;
	} catch {
		return code;
	}
}

/* Money for display. The digits come from formatMinorUnits rather than Intl, so
   the integer minor units are never routed through a division that could round
   them; Intl is used only for the symbol. */
export function formatMoney(minor: number, currency: string): string {
	return `${currencySymbol(currency)}${formatMinorUnits(minor)}`;
}

/* Minor units to a display string: 125000 becomes "1,250.00". No currency
   symbol, because the invoice carries the currency and the column header or the
   total line is where it belongs. */
export function formatMinorUnits(minor: number): string {
	const sign = minor < 0 ? "-" : "";
	const absolute = Math.abs(minor);
	const whole = Math.floor(absolute / MINOR_UNITS_PER_MAJOR);
	const fraction = absolute % MINOR_UNITS_PER_MAJOR;

	return `${sign}${whole.toLocaleString("en-US")}.${String(fraction).padStart(MINOR_UNIT_DIGITS, "0")}`;
}
