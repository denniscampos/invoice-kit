import { Button } from "~/components/ui/button";

/* Paper without a render call.

   The browser prints the page it already has, using the print rules in
   `app.css`, so this costs nothing per use, needs no rate limit, and still works
   when the day's Browser Rendering allowance is spent, which is exactly when
   Download PDF stops working. For the one-off path it is the shorter route to the
   same sheet of paper.

   No pending state and no error state, unlike its neighbour. `window.print()`
   hands over to the browser's own dialog, which this page cannot observe: there
   is no way to know whether the user printed, saved a PDF, or cancelled, so
   claiming any of them would be a guess.

   Hidden below `sm`, which is the rule the nav already follows and for the same
   reason. Measured: adding this button put the bar at 336px inside a 320px screen
   and scrolled the page sideways, which is F-35 returning. The bar was already
   exactly full (F-45), and of the things in it this is the one to drop first,
   because printing from a phone is the least likely route to paper. The gap is
   real and recorded rather than squeezed. */
export function PrintButton() {
	return (
		<Button
			type="button"
			variant="secondary"
			size="sm"
			onClick={() => window.print()}
			className="hidden sm:inline-flex"
		>
			Print
		</Button>
	);
}
