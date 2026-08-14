import type { InvoiceDraft, Party } from "~/types/invoice";

export const DRAFT_VERSION = 1;
/* sessionStorage, not localStorage: the draft holds a client's name, address,
   and billed amount, and that should not outlive the tab on a shared machine.
   The version is in the key and in the payload; a mismatch discards. */
export const DRAFT_STORAGE_KEY = "invoice-kit:draft:v1";
export const DEFAULT_CURRENCY = "USD";
export const DEFAULT_TEMPLATE_ID = "minimal";
export const DEFAULT_INVOICE_NUMBER = "INV-0001";
export const DUE_DATE_OFFSET_DAYS = 30;

/* Local calendar date, not UTC. toISOString() would roll the date backwards for
   anyone west of Greenwich after 4pm, which is exactly when invoices get sent. */
export function toIsoDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
	const [year, month, day] = isoDate.split("-").map(Number);
	// Month is 0-indexed, and Date normalizes overflow, so this crosses months
	// and years without special cases.
	return toIsoDate(new Date(year, month - 1, day + days));
}

/* Whether the user has taken the due date over, derived rather than stored, so
   it survives a refresh (F-01). The blank issue date falls out of the same
   comparison rather than short-circuiting it, or a due date the user typed reads
   as unpinned the moment the issue date is cleared (F-07). A due date that
   happens to equal the default reads as unpinned, which is the residual
   ambiguity of deriving rather than storing this (F-08). */
export function defaultDueDate(issueDate: string): string {
	return issueDate ? addDays(issueDate, DUE_DATE_OFFSET_DAYS) : "";
}

export function isDueDatePinned(draft: {
	issueDate: string;
	dueDate: string;
}): boolean {
	return draft.dueDate !== defaultDueDate(draft.issueDate);
}

/* The due date after the issue date changes: unchanged when pinned, otherwise
   following the new issue date. Clearing an unpinned issue date clears the due
   date with it, which keeps "both blank" the only unpinned blank state. */
export function nextDueDate(
	draft: { issueDate: string; dueDate: string },
	issueDate: string,
): string {
	return isDueDatePinned(draft) ? draft.dueDate : defaultDueDate(issueDate);
}

function emptyParty(): Party {
	return {
		name: "",
		address: "",
		city: "",
		region: "",
		postalCode: "",
		country: "",
		email: "",
		phone: "",
		taxId: "",
	};
}

/* The issue date and the due date that follows it, from one clock reading. */
export function todaysDates(today: Date = new Date()) {
	const issueDate = toIsoDate(today);
	return { issueDate, dueDate: addDays(issueDate, DUE_DATE_OFFSET_DAYS) };
}

function isStoredDraft(value: unknown): value is InvoiceDraft {
	if (typeof value !== "object" || value === null) return false;

	const draft = value as Partial<InvoiceDraft>;

	return (
		draft.version === DRAFT_VERSION &&
		typeof draft.issueDate === "string" &&
		typeof draft.invoiceNumber === "string" &&
		typeof draft.billFrom === "object" &&
		draft.billFrom !== null &&
		typeof draft.billTo === "object" &&
		draft.billTo !== null &&
		Array.isArray(draft.lineItems)
	);
}

/* Returns null rather than throwing for every failure mode: no draft stored,
   storage unavailable (private browsing), unparseable JSON, or a draft written
   by a different version of the shape. A bad draft is discarded, never
   migrated. */
export function readStoredDraft(): InvoiceDraft | null {
	try {
		const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
		if (!raw) return null;

		const parsed: unknown = JSON.parse(raw);
		return isStoredDraft(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function writeStoredDraft(draft: InvoiceDraft): void {
	try {
		window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		/* Private browsing rejects writes and a full quota throws. Losing the
		   restore-on-refresh convenience is not worth showing the user an error. */
	}
}

export function createEmptyDraft(today: Date = new Date()): InvoiceDraft {
	const { issueDate, dueDate } = todaysDates(today);

	return {
		version: DRAFT_VERSION,
		invoiceNumber: DEFAULT_INVOICE_NUMBER,
		status: "draft",
		templateId: DEFAULT_TEMPLATE_ID,
		issueDate,
		dueDate,
		currency: DEFAULT_CURRENCY,
		billFrom: emptyParty(),
		billTo: emptyParty(),
		paymentTerms: "",
		notes: "",
		lineItems: [],
	};
}
