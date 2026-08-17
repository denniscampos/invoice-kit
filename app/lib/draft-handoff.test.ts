import { describe, expect, it } from "vitest";
import { isDraftEmpty, shouldSaveOnHandoff } from "./draft-handoff";
import { addLineItem, createEmptyDraft } from "./invoice-draft";
import type { InvoiceDraft } from "~/types/invoice";

// A fixed clock so the always-populated dates never make an "empty" draft look
// like it has content.
const empty = (): InvoiceDraft => createEmptyDraft(new Date(2026, 7, 17));

describe("isDraftEmpty", () => {
	it("is empty for a fresh draft, whose only fields are defaults", () => {
		expect(isDraftEmpty(empty())).toBe(true);
	});

	it("treats whitespace-only notes as still empty", () => {
		expect(isDraftEmpty({ ...empty(), notes: "   " })).toBe(true);
	});

	it("is not empty once a line item exists", () => {
		const draft = empty();
		expect(isDraftEmpty({ ...draft, lineItems: addLineItem(draft) })).toBe(
			false,
		);
	});

	it("is not empty once the bill-to has a name", () => {
		const draft = empty();
		expect(
			isDraftEmpty({ ...draft, billTo: { ...draft.billTo, name: "Acme" } }),
		).toBe(false);
	});

	it("is not empty once the bill-from has any field", () => {
		const draft = empty();
		expect(
			isDraftEmpty({
				...draft,
				billFrom: { ...draft.billFrom, email: "me@example.com" },
			}),
		).toBe(false);
	});

	it("is not empty once payment terms are set", () => {
		expect(isDraftEmpty({ ...empty(), paymentTerms: "Net 30" })).toBe(false);
	});

	it("is not empty once notes are set", () => {
		expect(isDraftEmpty({ ...empty(), notes: "Thanks" })).toBe(false);
	});
});

describe("shouldSaveOnHandoff", () => {
	const filled = (): InvoiceDraft => {
		const draft = empty();
		return { ...draft, billTo: { ...draft.billTo, name: "Acme" } };
	};

	it("saves when intent, a session, and a real draft all line up", () => {
		expect(
			shouldSaveOnHandoff({ intent: true, signedIn: true, draft: filled() }),
		).toBe(true);
	});

	it("does nothing without the intent", () => {
		expect(
			shouldSaveOnHandoff({ intent: false, signedIn: true, draft: filled() }),
		).toBe(false);
	});

	it("does nothing when not signed in", () => {
		expect(
			shouldSaveOnHandoff({ intent: true, signedIn: false, draft: filled() }),
		).toBe(false);
	});

	it("does nothing when there is no draft", () => {
		expect(
			shouldSaveOnHandoff({ intent: true, signedIn: true, draft: null }),
		).toBe(false);
	});

	it("does nothing when the draft is empty", () => {
		expect(
			shouldSaveOnHandoff({ intent: true, signedIn: true, draft: empty() }),
		).toBe(false);
	});
});
