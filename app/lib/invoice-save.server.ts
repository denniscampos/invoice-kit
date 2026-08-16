import { parseDraft } from "~/lib/invoice-draft";
import {
	createInvoice,
	invoiceNumberTaken,
	updateInvoice,
} from "~/lib/invoice-store.server";

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

/* Saves what the editor posted, as this user.

   The id is a hint from the browser, not an authorisation: it says "I think I
   already saved this one". Every path through here is scoped by `userId`, so the
   worst a wrong id can do is fail to match and fall through to a create. */
export async function saveDraft(
	db: D1Database,
	userId: string,
	payload: unknown,
	knownId: string | null,
): Promise<SaveResult> {
	const draft = parseDraft(payload);
	if (!draft) {
		return { ok: false, error: "That invoice could not be saved. Please check the form and try again." };
	}

	const invoiceNumber = draft.invoiceNumber.trim();
	if (!invoiceNumber) {
		return { ok: false, error: "Give the invoice a number before saving it." };
	}

	if (await invoiceNumberTaken(db, userId, invoiceNumber, knownId ?? undefined)) {
		return { ok: false, error: duplicateNumberMessage(invoiceNumber) };
	}

	try {
		if (knownId) {
			const updated = await updateInvoice(db, userId, knownId, draft);

			/* Null means the id is not this user's, or no longer exists: a stale
			   id left in the tab after signing out, or an invoice deleted
			   elsewhere. Creating is the right answer, and it cannot touch anyone
			   else's row because the update never matched one. */
			if (updated) {
				return {
					ok: true,
					id: updated.id,
					invoiceNumber: updated.draft.invoiceNumber,
					savedAt: updated.updatedAt,
				};
			}
		}

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
			return { ok: false, error: duplicateNumberMessage(invoiceNumber) };
		}

		throw error;
	}
}
