import { parseDraft } from "~/lib/invoice-draft";
import {
	createInvoice,
	invoiceNumberTaken,
	updateInvoice,
} from "~/lib/invoice-store.server";
import type { InvoiceDraft } from "~/types/invoice";

/* What the editor gets back when it presses Save. A discriminated union rather
   than a nullable id, so a caller cannot read `id` off a failure. */
export type SaveResult =
	| { ok: true; id: string; invoiceNumber: string; savedAt: string }
	| { ok: false; error: string };

function duplicateNumberMessage(invoiceNumber: string): string {
	return `You already have an invoice numbered ${invoiceNumber}. Change the number and save again.`;
}

/* SQLite says this when the unique index refuses a row. Matching on the text is
   not lovely, but D1 surfaces no code to read, and the alternative is telling
   someone their invoice failed to save for reasons unknown when the actual
   reason is one they can fix in the form in front of them. */
function isDuplicateNumber(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);

	return /UNIQUE constraint failed: invoice\.userId, invoice\.invoiceNumber/i.test(
		message,
	);
}

/* The refusals both saves share, asked in the same order: is this a draft at
   all, does it carry a number, and is that number still free.

   `exceptId` is the invoice being written, which cannot clash with itself. */
async function checkDraft(
	db: D1Database,
	userId: string,
	payload: unknown,
	exceptId?: string,
): Promise<{ draft: InvoiceDraft } | { error: string }> {
	const draft = parseDraft(payload);
	if (!draft) {
		return { error: "That invoice could not be saved. Please check the form and try again." };
	}

	const invoiceNumber = draft.invoiceNumber.trim();
	if (!invoiceNumber) {
		return { error: "Give the invoice a number before saving it." };
	}

	if (await invoiceNumberTaken(db, userId, invoiceNumber, exceptId)) {
		return { error: duplicateNumberMessage(invoiceNumber) };
	}

	return { draft };
}

/* Saves a new invoice for this user.

   Create only. The editor at `/` is where an invoice that does not exist yet is
   written, and once it does the browser moves to its own URL, where
   `saveDraftEdit` takes over. There is no id to pass in and nothing to decide
   between creating and updating. */
export async function saveDraft(
	db: D1Database,
	userId: string,
	payload: unknown,
): Promise<SaveResult> {
	const checked = await checkDraft(db, userId, payload);
	if ("error" in checked) return { ok: false, error: checked.error };

	const { draft } = checked;

	try {
		const created = await createInvoice(db, userId, draft);

		return {
			ok: true,
			id: created.id,
			invoiceNumber: created.draft.invoiceNumber,
			savedAt: created.updatedAt,
		};
	} catch (error) {
		/* The check above can lose a race with another tab saving the same number.
		   The index is what actually guarantees uniqueness, so its refusal gets
		   the same sentence rather than a generic failure. */
		if (isDuplicateNumber(error)) {
			return {
				ok: false,
				error: duplicateNumberMessage(draft.invoiceNumber.trim()),
			};
		}

		throw error;
	}
}

/* Saves an edit to an invoice that already exists, identified by its id.

   Update only, and that is the whole difference from `saveDraft`. Null means
   there is no such invoice for this user, which the route answers with the same
   404 its loader gives. Falling through to a create here, the way `saveDraft`
   does for an id that was only ever a hint from sessionStorage, would leave the
   browser sitting on a URL that names nothing while being told the save worked. */
export async function saveDraftEdit(
	db: D1Database,
	userId: string,
	id: string,
	payload: unknown,
): Promise<SaveResult | null> {
	const checked = await checkDraft(db, userId, payload, id);
	if ("error" in checked) return { ok: false, error: checked.error };

	const { draft } = checked;

	try {
		const updated = await updateInvoice(db, userId, id, draft);
		if (!updated) return null;

		return {
			ok: true,
			id: updated.id,
			invoiceNumber: updated.draft.invoiceNumber,
			savedAt: updated.updatedAt,
		};
	} catch (error) {
		// Same race as above: the check can lose to another tab, the index cannot.
		if (isDuplicateNumber(error)) {
			return {
				ok: false,
				error: duplicateNumberMessage(draft.invoiceNumber.trim()),
			};
		}

		throw error;
	}
}
