import {
	DEFAULT_TEMPLATE_ID,
	resolveTemplateId,
} from "~/lib/invoice-templates";
import { lineItemTotal } from "~/lib/money";
import type { InvoiceDraft, LineItem, Party } from "~/types/invoice";

export const DRAFT_VERSION = 1;
/* sessionStorage, not localStorage: the draft holds a client's name, address,
   and billed amount, and that should not outlive the tab on a shared machine.
   The version is in the key and in the payload; a mismatch discards. */
export const DRAFT_STORAGE_KEY = "invoice-kit:draft:v1";
export const DEFAULT_CURRENCY = "USD";
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

/* Line item helpers. Each takes the draft and returns a new lineItems array,
   never mutating, so the caller can hand the result straight to setState. They
   are pure on purpose: the ordering rules are the part worth testing, and they
   should be testable without a DOM or a drag library. */

type DraftItems = Pick<InvoiceDraft, "lineItems">;

/* position mirrors array order and is renumbered after every structural change,
   so it stays contiguous for feature 7 to persist and feature 3 to render. */
function renumber(items: LineItem[]): LineItem[] {
	return items.map((item, index) =>
		item.position === index ? item : { ...item, position: index },
	);
}

/* Quantity starts at 1 because that is what an added row almost always means;
   the rest is blank for the user to fill. */
export function createLineItem(): LineItem {
	return {
		id: crypto.randomUUID(),
		position: 0,
		name: "",
		description: "",
		quantity: 1,
		rate: 0,
		total: 0,
	};
}

export function addLineItem(draft: DraftItems): LineItem[] {
	return renumber([...draft.lineItems, createLineItem()]);
}

export function removeLineItem(draft: DraftItems, id: string): LineItem[] {
	return renumber(draft.lineItems.filter((item) => item.id !== id));
}

export function updateLineItem(
	draft: DraftItems,
	id: string,
	patch: Partial<Omit<LineItem, "id" | "position" | "total">>,
): LineItem[] {
	return draft.lineItems.map((item) => {
		if (item.id !== id) return item;

		const updated = { ...item, ...patch };
		// Recomputed unconditionally so the stored total can never disagree with
		// the quantity and rate sitting next to it.
		updated.total = lineItemTotal(updated.quantity, updated.rate);
		return updated;
	});
}

/* Moves the dragged item to the dropped-on item's position. Anything that does
   not describe a real move (unknown id, dropped on itself) returns the list
   unchanged rather than throwing, because a drag library will report those. */
export function reorderLineItems(
	draft: DraftItems,
	fromId: string,
	toId: string,
): LineItem[] {
	const from = draft.lineItems.findIndex((item) => item.id === fromId);
	const to = draft.lineItems.findIndex((item) => item.id === toId);
	if (from === -1 || to === -1 || from === to) return draft.lineItems;

	const reordered = [...draft.lineItems];
	const [moved] = reordered.splice(from, 1);
	reordered.splice(to, 0, moved);

	return renumber(reordered);
}

export function invoiceSubtotal(draft: DraftItems): number {
	return draft.lineItems.reduce((sum, item) => sum + item.total, 0);
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

/* Everything below is the boundary between a draft this app wrote and one it
   merely received. A draft arrives from sessionStorage today and from a posted
   request body in feature 5, and neither can be trusted to hold what the type
   says it holds.

   The rule is the same for both: a draft that does not check out is discarded,
   never repaired. Merging defaults into a half-real invoice would hand the user
   a document that looks complete and quietly is not, which is worse on an
   invoice than showing them an empty editor. */

const PARTY_FIELDS = [
	"name",
	"address",
	"city",
	"region",
	"postalCode",
	"country",
	"email",
	"phone",
	"taxId",
] as const;

const isText = (value: unknown): value is string => typeof value === "string";

// Rejects NaN and Infinity, which is the point: both survive a typeof check and
// then render as "NaN" on the invoice.
const isCount = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

// Money is integer minor units everywhere, so a fractional cent is corruption.
const isMinorUnits = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value);

function parseParty(value: unknown): Party | null {
	if (typeof value !== "object" || value === null) return null;

	const source = value as Record<string, unknown>;
	const party = {} as Party;

	for (const field of PARTY_FIELDS) {
		const text = source[field];
		if (!isText(text)) return null;
		party[field] = text;
	}

	return party;
}

function parseLineItem(value: unknown): LineItem | null {
	if (typeof value !== "object" || value === null) return null;

	const source = value as Record<string, unknown>;
	const { id, name, description, position, quantity, rate, total } = source;

	if (!isText(id) || !isText(name) || !isText(description)) return null;
	if (!isMinorUnits(position) || !isCount(quantity)) return null;
	if (!isMinorUnits(rate) || !isMinorUnits(total)) return null;

	return { id, position, name, description, quantity, rate, total };
}

/* Takes unknown and never throws. Fields are copied across one by one rather
   than the object being cast, so an unrecognized key on the input cannot ride
   along into the app or into the PDF renderer. */
export function parseDraft(value: unknown): InvoiceDraft | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}

	const source = value as Record<string, unknown>;
	const {
		version,
		status,
		invoiceNumber,
		issueDate,
		dueDate,
		currency,
		paymentTerms,
		notes,
	} = source;

	if (version !== DRAFT_VERSION || status !== "draft") return null;
	if (!isText(invoiceNumber) || !isText(currency)) return null;
	if (!isText(issueDate) || !isText(dueDate)) return null;
	if (!isText(paymentTerms) || !isText(notes)) return null;

	const billFrom = parseParty(source.billFrom);
	const billTo = parseParty(source.billTo);
	if (!billFrom || !billTo) return null;

	if (!Array.isArray(source.lineItems)) return null;
	const lineItems: LineItem[] = [];
	for (const item of source.lineItems) {
		const parsed = parseLineItem(item);
		if (!parsed) return null;
		lineItems.push(parsed);
	}

	return {
		version: DRAFT_VERSION,
		invoiceNumber,
		status: "draft",
		/* The one field that is normalized rather than rejected, because the
		   registry already answers for it: an id nothing renders becomes the
		   default, which is what the document would have shown anyway. */
		templateId: resolveTemplateId(source.templateId),
		issueDate,
		dueDate,
		currency,
		billFrom,
		billTo,
		paymentTerms,
		notes,
		lineItems,
	};
}

/* Returns null rather than throwing for every failure mode: no draft stored,
   storage unavailable (private browsing), unparseable JSON, or a draft written
   by a different version of the shape. A bad draft is discarded, never
   migrated. */
export function readStoredDraft(): InvoiceDraft | null {
	try {
		const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
		if (!raw) return null;

		return parseDraft(JSON.parse(raw));
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
