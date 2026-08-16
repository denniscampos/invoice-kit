/* The next invoice number to suggest.

   A suggestion, not a rule. The overview says the number defaults to the next in
   a per-user sequence and stays editable, and the unique index on
   (userId, invoiceNumber) is what actually enforces anything. This function only
   answers "what would come next", and it answers it per user: two people can
   both be on INV-0007. */

const PATTERN = /^INV-(\d+)$/;
const FALLBACK = "INV-0001";
const MIN_DIGITS = 4;

type Parsed = { value: number; digits: number };

function parse(candidate: string): Parsed | null {
	const match = PATTERN.exec(candidate.trim());
	if (!match) return null;

	const value = Number(match[1]);

	return Number.isSafeInteger(value) ? { value, digits: match[1].length } : null;
}

export function nextInvoiceNumber(existing: string[]): string {
	/* Anything that is not INV-<digits> is skipped rather than rejected. A user
	   is free to number an invoice "2026-04" or "ACME-1", and the sequence should
	   keep counting past it rather than break on it. */
	const parsed = existing
		.map(parse)
		.filter((entry): entry is Parsed => entry !== null);

	if (parsed.length === 0) return FALLBACK;

	const highest = parsed.reduce((a, b) => (b.value > a.value ? b : a));
	const next = highest.value + 1;

	/* Padding follows the widest number already in use, so a user who moved to
	   five digits stays there. It never shrinks: INV-10000 must not suggest
	   INV-0001 as its successor just because the number grew a digit. */
	const width = Math.max(
		MIN_DIGITS,
		...parsed.map((entry) => entry.digits),
	);

	return `INV-${String(next).padStart(width, "0")}`;
}
