import { lineItemTotal } from "~/lib/money";
import type {
	InvoiceDraft,
	InvoiceStatus,
	LineItem,
	Party,
} from "~/types/invoice";

/* Invoices in D1: the mapping between the draft the editor speaks and the rows
   the database holds, and the reads and writes on top of it.

   Every function here takes the user id as an argument and puts it in the SQL.
   Nothing reads a session, and nothing accepts an id that arrived from a
   request; the route resolves who is asking and this module trusts it. */

/* Re-exported so the callers that already import it from here keep working; it
   now lives in types/invoice.ts because the dashboard needs it on the client. */
export type { InvoiceStatus };

/* What a stored invoice looks like coming back out. The editable body stays an
   InvoiceDraft rather than being flattened into forty fields, so the editor and
   the store speak one language and this file holds the only translation.

   Load bearing: features 9, 10, 11, and 12 all read this. */
export type SavedInvoice = {
	id: string;
	userId: string;
	status: InvoiceStatus;
	// ISO 8601 UTC.
	createdAt: string;
	updatedAt: string;
	draft: InvoiceDraft;
};

/* The invoice row, one property per column. Written out rather than derived so
   that adding a column is a type error here first. */
export type InvoiceRow = {
	id: string;
	userId: string;
	invoiceNumber: string;
	status: InvoiceStatus;
	templateId: string;
	issueDate: string;
	dueDate: string;
	currency: string;
	logoAssetId: string | null;
	billFromName: string;
	billFromAddress: string;
	billFromCity: string;
	billFromRegion: string;
	billFromPostalCode: string;
	billFromCountry: string;
	billFromEmail: string;
	billFromPhone: string;
	billFromTaxId: string;
	billToName: string;
	billToAddress: string;
	billToCity: string;
	billToRegion: string;
	billToPostalCode: string;
	billToCountry: string;
	billToEmail: string;
	billToPhone: string;
	billToTaxId: string;
	paymentTerms: string | null;
	notes: string | null;
	subtotal: number;
	discountTotal: number;
	taxTotal: number;
	total: number;
	customFields: string | null;
	createdAt: string;
	updatedAt: string;
};

export type LineItemRow = {
	id: string;
	invoiceId: string;
	position: number;
	name: string;
	description: string | null;
	quantity: number;
	rate: number;
	total: number;
};

/* The columns a list row needs, and the type is whatever they are.

   Deriving the type from the list rather than writing both means they cannot
   drift: adding a column here adds it to `InvoiceSummary`, and a name that is
   not a real column is a type error rather than an undefined at runtime.

   Expands to id, invoiceNumber, status, billToName, issueDate, dueDate,
   currency, total, and updatedAt. Deliberately not `select *`: a list row has no
   use for eighteen party columns or the notes, and reading more than the answer
   needs on a route that runs constantly is what F-43 was about. */
const SUMMARY_COLUMNS = [
	"id",
	"invoiceNumber",
	"status",
	"billToName",
	"issueDate",
	"dueDate",
	"currency",
	"total",
	"updatedAt",
] as const satisfies readonly (keyof InvoiceRow)[];

/* Load bearing: features 10, 11, and 12 read this. */
export type InvoiceSummary = Pick<InvoiceRow, (typeof SUMMARY_COLUMNS)[number]>;

/* How many invoices the dashboard will show. An unbounded "every invoice this
   user has ever made" is F-43's shape on the one screen guaranteed to grow, so
   the query is capped and the screen says when it hit the cap. Real paging waits
   until somebody actually has fifty invoices; building it now would be guessing
   at how they want to page through a list nobody has yet. */
export const INVOICE_LIST_LIMIT = 50;

/* The money the server is willing to store, computed from quantity and rate
   alone.

   The draft arrives carrying a total on every line item, and `parseDraft` proves
   those are integers rather than proving they are the right integers. Recomputing
   is not really about a caller lying, though a caller can: it is that two places
   compute the same number, and the stored invoice should be the one this side
   worked out. `lineItemTotal` is the same rounding the editor and the preview
   already use, so a saved invoice matches what the user was shown. */
function pricedItems(items: LineItem[]): LineItem[] {
	return items.map((item, index) => ({
		...item,
		/* The array is the display order. A posted `position` is a claim about
		   ordering that the array itself already answers. */
		position: index,
		total: lineItemTotal(item.quantity, item.rate),
	}));
}

type RowPair = { invoice: InvoiceRow; lineItems: LineItemRow[] };

export function draftToRows(
	draft: InvoiceDraft,
	userId: string,
	id: string,
	now: string,
	createdAt: string = now,
): RowPair {
	const items = pricedItems(draft.lineItems);
	const subtotal = items.reduce((sum, item) => sum + item.total, 0);

	/* Discount and tax stay zero until feature 19, so the total is the subtotal
	   today. It is still written as the arithmetic rather than as `subtotal`, so
	   that the day those columns are populated this line already says how they
	   combine. */
	const discountTotal = 0;
	const taxTotal = 0;

	return {
		invoice: {
			id,
			userId,
			invoiceNumber: draft.invoiceNumber,
			// 7a only ever writes a draft. Feature 10 owns the other three.
			status: "draft",
			templateId: draft.templateId,
			issueDate: draft.issueDate,
			dueDate: draft.dueDate,
			currency: draft.currency,
			logoAssetId: null,
			...partyColumns("billFrom", draft.billFrom),
			...partyColumns("billTo", draft.billTo),
			/* Empty is stored as null rather than "". The column is nullable
			   because the model says these are optional, and two ways to say
			   "nothing" in one column is a query nobody gets right later. */
			paymentTerms: draft.paymentTerms || null,
			notes: draft.notes || null,
			subtotal,
			discountTotal,
			taxTotal,
			total: subtotal - discountTotal + taxTotal,
			customFields: null,
			createdAt,
			updatedAt: now,
		},
		lineItems: items.map((item) => ({
			id: item.id,
			invoiceId: id,
			position: item.position,
			name: item.name,
			description: item.description || null,
			quantity: item.quantity,
			rate: item.rate,
			total: item.total,
		})),
	};
}

export function rowsToDraft(
	invoice: InvoiceRow,
	lineItems: LineItemRow[],
): InvoiceDraft {
	return {
		version: 1,
		invoiceNumber: invoice.invoiceNumber,
		/* The draft type only knows the word "draft": editing is the only thing
		   it describes. A sent or paid invoice still opens in the editor, and
		   feature 10 reads its real status from `SavedInvoice.status` beside
		   this, not from here. */
		status: "draft",
		templateId: invoice.templateId,
		issueDate: invoice.issueDate,
		dueDate: invoice.dueDate,
		currency: invoice.currency,
		billFrom: partyFrom("billFrom", invoice),
		billTo: partyFrom("billTo", invoice),
		paymentTerms: invoice.paymentTerms ?? "",
		notes: invoice.notes ?? "",
		lineItems: [...lineItems]
			.sort((a, b) => a.position - b.position)
			.map((row) => ({
				id: row.id,
				position: row.position,
				name: row.name,
				description: row.description ?? "",
				quantity: row.quantity,
				rate: row.rate,
				total: row.total,
			})),
	};
}

export function toSavedInvoice(
	invoice: InvoiceRow,
	lineItems: LineItemRow[],
): SavedInvoice {
	return {
		id: invoice.id,
		userId: invoice.userId,
		status: invoice.status,
		createdAt: invoice.createdAt,
		updatedAt: invoice.updatedAt,
		draft: rowsToDraft(invoice, lineItems),
	};
}

/* The nine party fields, prefixed. Written once for each direction rather than
   eighteen times per direction, because a hand-copied list of near-identical
   assignments is where a billTo quietly ends up holding a billFrom. */
const PARTY_FIELDS = [
	"Name",
	"Address",
	"City",
	"Region",
	"PostalCode",
	"Country",
	"Email",
	"Phone",
	"TaxId",
] as const;

const PARTY_KEYS = {
	Name: "name",
	Address: "address",
	City: "city",
	Region: "region",
	PostalCode: "postalCode",
	Country: "country",
	Email: "email",
	Phone: "phone",
	TaxId: "taxId",
} as const satisfies Record<(typeof PARTY_FIELDS)[number], keyof Party>;

/* Exactly the nine prefixed columns, so spreading this into an InvoiceRow is
   checked rather than hoped: a Record<string, string> would satisfy nothing and
   let a missing column through to a runtime insert error. */
type PartyColumns<P extends string> = {
	[Field in (typeof PARTY_FIELDS)[number] as `${P}${Field}`]: string;
};

const INVOICE_COLUMNS = [
	"id",
	"userId",
	"invoiceNumber",
	"status",
	"templateId",
	"issueDate",
	"dueDate",
	"currency",
	"logoAssetId",
	...PARTY_FIELDS.map((field) => `billFrom${field}` as const),
	...PARTY_FIELDS.map((field) => `billTo${field}` as const),
	"paymentTerms",
	"notes",
	"subtotal",
	"discountTotal",
	"taxTotal",
	"total",
	"customFields",
	"createdAt",
	"updatedAt",
] as const satisfies readonly (keyof InvoiceRow)[];

const LINE_ITEM_COLUMNS = [
	"id",
	"invoiceId",
	"position",
	"name",
	"description",
	"quantity",
	"rate",
	"total",
] as const satisfies readonly (keyof LineItemRow)[];

/* An insert built from the column list rather than from a hand-written string,
   so a column added to the row type and forgotten here is a type error rather
   than a mismatched placeholder count at runtime. */
function insertStatement(table: string, columns: readonly string[]): string {
	const placeholders = columns.map((_, index) => `?${index + 1}`).join(", ");

	return `insert into ${table} (${columns.join(", ")}) values (${placeholders})`;
}

function valuesOf<Row>(row: Row, columns: readonly (keyof Row)[]): unknown[] {
	return columns.map((column) => row[column]);
}

function writeStatements(db: D1Database, pair: RowPair): D1PreparedStatement[] {
	return [
		db
			.prepare(insertStatement("invoice", INVOICE_COLUMNS))
			.bind(...valuesOf(pair.invoice, INVOICE_COLUMNS)),
		...pair.lineItems.map((row) =>
			db
				.prepare(insertStatement("line_item", LINE_ITEM_COLUMNS))
				.bind(...valuesOf(row, LINE_ITEM_COLUMNS)),
		),
	];
}

/* Saves a new invoice and its line items together.

   One batch, so the two tables cannot disagree: an invoice with no items, or
   items with no invoice, is not a state this app should be able to reach. */
export async function createInvoice(
	db: D1Database,
	userId: string,
	draft: InvoiceDraft,
	now: string = new Date().toISOString(),
): Promise<SavedInvoice> {
	const pair = draftToRows(draft, userId, crypto.randomUUID(), now);
	await db.batch(writeStatements(db, pair));

	return toSavedInvoice(pair.invoice, pair.lineItems);
}

/* One invoice, if it belongs to this user.

   The user id is in the where clause rather than checked afterwards, and
   someone else's invoice is indistinguishable from one that does not exist:
   both are null, so a caller answers 404 for both and never confirms that an
   id belongs to somebody. */
export async function getInvoice(
	db: D1Database,
	userId: string,
	id: string,
): Promise<SavedInvoice | null> {
	const invoice = await db
		.prepare(`select * from invoice where id = ?1 and userId = ?2`)
		.bind(id, userId)
		.first<InvoiceRow>();

	if (!invoice) return null;

	const { results } = await db
		.prepare(
			`select * from line_item where invoiceId = ?1 order by position asc`,
		)
		.bind(id)
		.all<LineItemRow>();

	return toSavedInvoice(invoice, results);
}

/* This user's invoices for the dashboard, newest first.

   Ordered by issue date because an invoice is a dated document and that is how
   people look for one; `createdAt` breaks ties so two invoices issued the same
   day come back in a stable order rather than whatever SQLite feels like.

   Asks for one row more than it will show, which is how `more` can be honest
   without a second count query: getting the extra row back is the only proof
   that the cap actually cut something off. */
export async function listInvoices(
	db: D1Database,
	userId: string,
	limit: number = INVOICE_LIST_LIMIT,
): Promise<{ invoices: InvoiceSummary[]; more: boolean }> {
	const { results } = await db
		.prepare(
			`select ${SUMMARY_COLUMNS.join(", ")} from invoice
			 where userId = ?1
			 order by issueDate desc, createdAt desc
			 limit ?2`,
		)
		.bind(userId, limit + 1)
		.all<InvoiceSummary>();

	return { invoices: results.slice(0, limit), more: results.length > limit };
}

/* The highest sequence number this user has used, for the next one to count on
   from. Scoped like everything else here; a number belonging to somebody else is
   none of this user's business and would not collide with theirs anyway.

   One row, not the whole column. This runs on every editor load and again after
   every save, and the number of invoices a user has is the number this app
   exists to grow, so reading all of them to look at one was a cost that only
   went up (F-43).

   Ordered by length first: as strings, 'INV-9999' sorts above 'INV-10000', and
   the longer number is the larger one once the sequence outgrows its padding.

   A handful rather than exactly one, and `glob` rather than `like`. Sorting is
   by string, so any INV- value made of letters outranks the real numbers at the
   same width: INV-DRAFT beats INV-0002. Asking for a single row meant that one
   could be unparseable, leaving `nextInvoiceNumber` to fall back to INV-0001 and
   suggest a number the user already had (F-44). The glob keeps out anything with
   no digit after the dash, and the small limit covers what it cannot express,
   like INV-12AB, by letting `nextInvoiceNumber` skip it the way it always has.

   Still bounded, which is the whole point of not reading the column (F-43). */
export async function listInvoiceNumbers(
	db: D1Database,
	userId: string,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`select invoiceNumber from invoice
			 where userId = ?1 and invoiceNumber glob 'INV-[0-9]*'
			 order by length(invoiceNumber) desc, invoiceNumber desc
			 limit 10`,
		)
		.bind(userId)
		.all<{ invoiceNumber: string }>();

	return results.map((row) => row.invoiceNumber);
}

/* Whether this user already has an invoice with this number, ignoring the one
   being edited. The unique index is what actually guarantees it; this exists so
   the answer can be a sentence rather than a constraint error. */
export async function invoiceNumberTaken(
	db: D1Database,
	userId: string,
	invoiceNumber: string,
	exceptId?: string,
): Promise<boolean> {
	const row = await db
		.prepare(
			`select 1 as hit from invoice
			 where userId = ?1 and invoiceNumber = ?2 and id is not ?3
			 limit 1`,
		)
		.bind(userId, invoiceNumber, exceptId ?? null)
		.first<{ hit: number }>();

	return row !== null;
}

/* Replaces an invoice's contents, keeping its id, its createdAt, and its status.

   The line items are deleted and rewritten rather than diffed. An invoice has a
   handful of rows, editing reorders and removes them freely, and a diff would be
   more code to get wrong for no gain the user could measure.

   Returns null when the invoice is not this user's, which is the same answer
   `getInvoice` gives, for the same reason. */
export async function updateInvoice(
	db: D1Database,
	userId: string,
	id: string,
	draft: InvoiceDraft,
	now: string = new Date().toISOString(),
): Promise<SavedInvoice | null> {
	const existing = await db
		.prepare(`select createdAt, status from invoice where id = ?1 and userId = ?2`)
		.bind(id, userId)
		.first<Pick<InvoiceRow, "createdAt" | "status">>();

	if (!existing) return null;

	const pair = draftToRows(draft, userId, id, now, existing.createdAt);

	/* The status the invoice already has, not the "draft" the mapping writes for
	   a new one. Editing a sent invoice must not quietly un-send it; feature 10
	   owns status changes. */
	pair.invoice.status = existing.status;

	/* The delete is scoped by userId through the invoice it belongs to, so a
	   mismatched pair cannot clear someone else's items even if the check above
	   were ever removed. */
	await db.batch([
		db
			.prepare(
				`delete from line_item where invoiceId in
				 (select id from invoice where id = ?1 and userId = ?2)`,
			)
			.bind(id, userId),
		db.prepare(`delete from invoice where id = ?1 and userId = ?2`).bind(id, userId),
		...writeStatements(db, pair),
	]);

	return toSavedInvoice(pair.invoice, pair.lineItems);
}

function partyColumns<P extends "billFrom" | "billTo">(
	prefix: P,
	party: Party,
): PartyColumns<P> {
	const columns: Record<string, string> = {};
	for (const field of PARTY_FIELDS) {
		columns[`${prefix}${field}`] = party[PARTY_KEYS[field]];
	}

	/* The one assertion in this file. The loop writes exactly the keys the
	   mapped type is built from, and the caller spreading this into an InvoiceRow
	   is where a missing column would actually be caught. */
	return columns as PartyColumns<P>;
}

function partyFrom(prefix: "billFrom" | "billTo", row: InvoiceRow): Party {
	const party = {} as Party;
	for (const field of PARTY_FIELDS) {
		party[PARTY_KEYS[field]] = row[
			`${prefix}${field}` as keyof InvoiceRow
		] as string;
	}

	return party;
}
