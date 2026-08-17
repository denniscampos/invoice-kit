import type { InvoiceDraft, Party } from "~/types/invoice";

/* The seam between the two paths. An anonymous visitor reaches for "save", makes
   an account, and their draft should be saved and on screen when they land,
   without pressing Save again.

   The draft already survives the sign-up/sign-in redirect in sessionStorage, and
   the editor already knows how to create-save and hand off to /invoices/:id. This
   file carries the missing piece: a single-use intent flag that says "the user
   asked to save this before authenticating", and the two decisions that gate the
   automatic save. There is no server code here; the flag only decides whether to
   trigger the save the editor already has. */

/* Sibling to the draft in sessionStorage, same version-in-the-key discipline: a
   mismatch is ignored rather than migrated. */
const HANDOFF_STORAGE_KEY = "invoice-kit:handoff:v1";
const HANDOFF_VALUE = "1";

function isPartyBlank(party: Party): boolean {
	return Object.values(party).every((value) => value.trim() === "");
}

/* Whether there is nothing worth saving. The version, status, number, dates,
   currency, and template are always populated defaults, so they never count; only
   what the user actually typed does. An empty draft handed off would put a blank
   INV-0001 on a brand-new account's dashboard, which is a poor first thing to
   find, so the handoff skips it. */
export function isDraftEmpty(draft: InvoiceDraft): boolean {
	return (
		draft.lineItems.length === 0 &&
		isPartyBlank(draft.billFrom) &&
		isPartyBlank(draft.billTo) &&
		draft.paymentTerms.trim() === "" &&
		draft.notes.trim() === ""
	);
}

/* The one rule of the handoff: save only when the user asked to (intent), is
   actually signed in now, and there is a real draft to save. Bare "signed in with
   a draft" is not enough, because a signed-in user editing a fresh draft or
   refreshing mid-type also has one, and auto-saving that would mint a junk invoice
   on every visit. */
export function shouldSaveOnHandoff(input: {
	intent: boolean;
	signedIn: boolean;
	draft: InvoiceDraft | null;
}): boolean {
	const { intent, signedIn, draft } = input;
	return intent && signedIn && draft !== null && !isDraftEmpty(draft);
}

/* Set when the anonymous user clicks "Create an account to save it". It rides
   through the auth trip in sessionStorage and is read once on the way back. Errors
   are swallowed as elsewhere: a private-browsing tab that cannot store the flag
   simply falls back to the manual Save, which is no worse than before. */
export function markSaveHandoff(): void {
	try {
		window.sessionStorage.setItem(HANDOFF_STORAGE_KEY, HANDOFF_VALUE);
	} catch {
		// Losing the automatic handoff beats showing the user an error.
	}
}

/* Reads the flag and clears it in the same breath, so the intent is single-use by
   construction: a refresh or React's double-invoked effect reads false the second
   time and cannot save twice. */
export function takeSaveHandoff(): boolean {
	try {
		const raw = window.sessionStorage.getItem(HANDOFF_STORAGE_KEY);
		window.sessionStorage.removeItem(HANDOFF_STORAGE_KEY);
		return raw === HANDOFF_VALUE;
	} catch {
		return false;
	}
}
