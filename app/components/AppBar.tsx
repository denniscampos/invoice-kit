import type { ReactNode } from "react";

/* `actions` is where the mockup puts the primary buttons: right aligned after a
   spacer, Download PDF today and Sign in and Save once those exist. The bar
   takes them as children rather than reaching for the draft itself, so it stays
   a piece of chrome with no idea what an invoice is. */
export function AppBar({ actions }: { actions?: ReactNode }) {
	return (
		<header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-6">
			<div className="flex items-center gap-2 font-semibold tracking-tight">
				<span className="grid size-[22px] place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
					IK
				</span>
				Invoice Kit
			</div>
			<nav className="ml-4 flex gap-1">
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
