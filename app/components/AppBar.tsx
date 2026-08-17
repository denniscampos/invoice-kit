import type { ReactNode } from "react";
import { ReceiptTextIcon } from "lucide-react";
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

			{/* One entry on a phone, both from `sm` up.

			    At 320px the editor's bar is exactly full, 305px of 305, because Sign
			    out, Save, and Download PDF take 252px between them. Shortening
			    Download PDF to "PDF" below `sm` returns about 60px, which buys one
			    icon-sized link and not two text ones. Invoices is the one to spend it
			    on: the brand mark above is already a link to `/`, so the trip back to
			    the editor works and only the outbound trip was missing (F-45). */}
			<nav className="ml-1 flex gap-0.5 sm:ml-4 sm:gap-1">
				<NavItem to="/" end className="hidden sm:block">
					Editor
				</NavItem>
				{/* Only for someone who has invoices to look at. A nav entry that
				    exists to bounce a visitor to sign-in is the sign-up wall this
				    app deliberately does not have. */}
				{user ? (
					<NavItem to="/invoices">
						<ReceiptTextIcon className="size-4 sm:hidden" aria-hidden="true" />
						{/* `sr-only` rather than `hidden`, so the link is still named
						    "Invoices" on a phone where only the icon shows. */}
						<span className="sr-only sm:not-sr-only">Invoices</span>
					</NavItem>
				) : null}
			</nav>

			{actions ? <div className="ml-auto">{actions}</div> : null}
		</header>
	);
}

/* NavLink rather than Link plus a comparison: it works out `isActive` from the
   router's own matching and writes `aria-current="page"` itself, so the marker
   cannot disagree with the page actually being shown.

   `end` is per entry rather than always on. Editor needs it, or "/" matches
   every route and looks current everywhere. Invoices must not have it, or
   opening an invoice at /invoices/:id marks nothing at all, and a user deep in a
   section should be able to see which section that is. */
function NavItem({
	to,
	end,
	className,
	children,
}: {
	to: string;
	end?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<NavLink
			to={to}
			end={end}
			className={({ isActive }) =>
				cn(
					"flex items-center rounded-md px-2 py-1.5 font-medium sm:px-3",
					isActive
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
					className,
				)
			}
		>
			{children}
		</NavLink>
	);
}
