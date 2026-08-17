import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { SAVE_FETCHER_KEY } from "~/components/invoice/SaveButton";
import { shouldSaveOnHandoff, takeSaveHandoff } from "~/lib/draft-handoff";
import { readStoredDraft } from "~/lib/invoice-draft";
import type { SaveResult } from "~/lib/invoice-save.server";

/* The automatic half of feature 7b's manual save: finish the save the anonymous
   user reached for, once they come back signed in.

   Renders nothing. On the way back from sign-up or sign-in it reads the intent
   flag, and if there is a real draft to save, submits it. The draft is read from
   sessionStorage here rather than taken as a prop because the editor hydrates its
   own draft in a mount effect, so its in-memory copy is still empty on the first
   render this fires on. */
export function DraftHandoff({ signedIn }: { signedIn: boolean }) {
	/* The very fetcher SaveButton drives, by key, so a successful handoff save
	   clears the draft and lands on /invoices/:id through the one effect that
	   already owns that move, not a second copy of it. Both this and SaveButton
	   render exactly when signedIn is true, so that button is always mounted to
	   finish the job. */
	const fetcher = useFetcher<SaveResult>({ key: SAVE_FETCHER_KEY });
	const handled = useRef(false);

	useEffect(() => {
		// Once per mount, and the flag is single-use anyway; between them a refresh
		// or React's double-invoked effect cannot save twice.
		if (handled.current) return;
		handled.current = true;

		/* Consume the intent whether or not it leads to a save, so an abandoned or
		   empty handoff leaves nothing behind to fire on a later sign-in. */
		const intent = takeSaveHandoff();
		const draft = readStoredDraft();
		if (!shouldSaveOnHandoff({ intent, signedIn, draft })) return;

		// shouldSaveOnHandoff is true only with a real draft in hand.
		fetcher.submit(
			{ intent: "save", draft: JSON.stringify(draft) },
			{ method: "post" },
		);
	}, [signedIn, fetcher]);

	return null;
}
