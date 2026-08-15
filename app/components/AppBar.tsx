import type { ReactNode } from "react";

/* `actions` is where the mockup puts the primary buttons: right aligned after a
   spacer, Download PDF today and Sign in and Save once those exist. The bar
   takes them as children rather than reaching for the draft itself, so it stays
   a piece of chrome with no idea what an invoice is. */
export function AppBar({ actions }: { actions?: ReactNode }) {
	return (
		<header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4 sm:px-6">
			<div className="flex items-center gap-2 font-semibold tracking-tight">
				<span className="grid size-[22px] place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
					IK
				</span>
				{/* The mark alone on a phone. The wordmark and the Editor pill are the
				    two things in this row nobody needs there: one repeats what the
				    mark says, the other names the page you are already on. Keeping
				    them cost the bar more width than the screen has, and the page
				    scrolled sideways. */}
				<span className="hidden sm:inline">Invoice Kit</span>
			</div>
			<nav className="ml-4 hidden gap-1 sm:flex">
				<span
					aria-current="page"
					className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground"
				>
					Editor
				</span>
			</nav>

			{actions ? <div className="ml-auto">{actions}</div> : null}
		</header>
	);
}
