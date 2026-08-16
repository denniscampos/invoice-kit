import type { ReactNode } from "react";
import { Link, NavLink, useRouteLoaderData } from "react-router";
import { cn } from "~/lib/utils";
import type { loader as rootLoader } from "~/root";

/* `actions` is where the mockup puts the primary buttons: right aligned after a
   spacer, Download PDF today and Sign in and Save once those exist. The bar
   takes them as children rather than reaching for the draft itself, so it stays
   a piece of chrome with no idea what an invoice is. */
/* The gap tightens on a phone: feature 7b's Save button put the row 1px over a
   320px screen, which is F-35 again, and the space between the brand and the
   buttons is the cheapest 8px in the bar. */
export function AppBar({ actions }: { actions?: ReactNode }) {
	/* The same source SessionActions reads, for the same reason: any page can
	   drop the bar in without threading the user down through its own loader.
	   Undefined rather than null inside an ErrorBoundary, which lands on the
	   signed-out nav rather than throwing. */
	const user = useRouteLoaderData<typeof rootLoader>("root")?.user;

	return (
		<header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card px-4 sm:gap-4 sm:px-6">
			{/* The mark is a link home, which costs no width and is the only way back
			    to the editor on a phone, where the nav below is hidden. */}
			<Link
				to="/"
				className="flex items-center gap-2 font-semibold tracking-tight"
			>
				<span className="grid size-[22px] place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
					IK
				</span>
				{/* The mark alone on a phone. The wordmark and the Editor pill are the
				    two things in this row nobody needs there: one repeats what the
				    mark says, the other names the page you are already on. Keeping
				    them cost the bar more width than the screen has, and the page
				    scrolled sideways.

				    `sr-only` rather than `hidden`, because hidden takes the name out
				    of the accessibility tree too, and "IK" is not a product name a
				    screen reader user would recognise. Absolutely positioned at a
				    pixel, so it is read without taking any of the width this is
				    trying to save. */}
				<span className="sr-only sm:not-sr-only">Invoice Kit</span>
			</Link>

			{/* Hidden below `sm`, which is where the pill it replaces was too.
			    Measured: at 320px the editor's bar is already exactly full at 305px
			    of 305, because Save and Download PDF take 164px between them, so a
			    nav item of any width pushes the row off screen (F-35 again). The
			    consequence is that a phone cannot reach the dashboard from the
			    editor, which needs a real answer rather than a squeezed label. */}
			<nav className="ml-1 hidden gap-0.5 sm:ml-4 sm:flex sm:gap-1">
				<NavItem to="/">Editor</NavItem>
				{/* Only for someone who has invoices to look at. A nav entry that
				    exists to bounce a visitor to sign-in is the sign-up wall this
				    app deliberately does not have. */}
				{user ? <NavItem to="/invoices">Invoices</NavItem> : null}
			</nav>

			{actions ? <div className="ml-auto">{actions}</div> : null}
		</header>
	);
}

/* NavLink rather than Link plus a comparison: it works out `isActive` from the
   router's own matching and writes `aria-current="page"` itself, so the marker
   cannot disagree with the page actually being shown. `end` because without it
   "/" matches every route and the Editor tab would look current everywhere. */
function NavItem({ to, children }: { to: string; children: ReactNode }) {
	return (
		<NavLink
			to={to}
			end
			className={({ isActive }) =>
				cn(
					"rounded-md px-2 py-1.5 font-medium sm:px-3",
					isActive
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
				)
			}
		>
			{children}
		</NavLink>
	);
}
