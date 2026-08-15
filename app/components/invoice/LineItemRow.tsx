import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	formatMinorUnits,
	formatMoney,
	parseMoneyInput,
	parseQuantity,
} from "~/lib/money";
import type { LineItem } from "~/types/invoice";

/* Only where the header row is hidden. Above `sm` the column headings do this
   job, and repeating them per row would be noise. */
const STACKED_LABEL =
	"mb-1 block text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground sm:hidden";

type LineItemRowProps = {
	item: LineItem;
	index: number;
	currency: string;
	className: string;
	onPatch: (patch: Partial<Omit<LineItem, "id" | "position" | "total">>) => void;
	onRemove: () => void;
};

export function LineItemRow({
	item,
	index,
	currency,
	className,
	onPatch,
	onRemove,
}: LineItemRowProps) {
	/* The number fields keep their own text while they are being typed. The draft
	   holds numbers, so without this "12." or "1.0" would be reformatted out from
	   under the cursor on every keystroke. Only a successful parse reaches the
	   draft; the text is what the user sees. */
	const [quantityText, setQuantityText] = useState(() => String(item.quantity));
	const [rateText, setRateText] = useState(() => formatMinorUnits(item.rate));

	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: item.id });

	/* An empty field is a deliberate clear and means zero. Anything else that does
	   not parse leaves the stored value alone rather than overwriting a real
	   number with a guess. */
	function handleQuantity(text: string) {
		setQuantityText(text);

		if (!text.trim()) return onPatch({ quantity: 0 });

		const quantity = parseQuantity(text);
		if (quantity !== null) onPatch({ quantity });
	}

	function handleRate(text: string) {
		setRateText(text);

		if (!text.trim()) return onPatch({ rate: 0 });

		const rate = parseMoneyInput(text);
		if (rate !== null) onPatch({ rate });
	}

	const position = index + 1;

	return (
		<div
			ref={setNodeRef}
			className={`${className} ${isDragging ? "relative z-10 opacity-80" : ""}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			{/* Listeners go on the handle, never the row: on the row, selecting text
			    in an input would start a drag instead. */}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={`Reorder item ${position}`}
				className="size-8 cursor-grab text-muted-foreground active:cursor-grabbing"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="size-4" />
			</Button>
			<Input
				aria-label={`Description for item ${position}`}
				value={item.name}
				onChange={(event) => onPatch({ name: event.target.value })}
			/>
			{/* The three numbers travel together: one line beside the description
			    from `sm` up, their own line below it on a phone, where the header
			    row is hidden and each carries its own label instead. */}
			<div className="col-span-3 row-start-2 grid grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:grid-cols-[78px_110px_104px]">
				<div className="min-w-0">
					<span className={STACKED_LABEL}>Qty</span>
					<Input
						aria-label={`Quantity for item ${position}`}
						inputMode="decimal"
						className="text-right tabular-nums"
						value={quantityText}
						onChange={(event) => handleQuantity(event.target.value)}
					/>
				</div>
				<div className="min-w-0">
					<span className={STACKED_LABEL}>Rate</span>
					<Input
						aria-label={`Rate for item ${position}`}
						inputMode="decimal"
						className="text-right tabular-nums"
						value={rateText}
						onChange={(event) => handleRate(event.target.value)}
					/>
				</div>
				{/* The amount carries the currency, the rate input does not: a symbol
				    inside a field the user types into is noise they have to edit around. */}
				<div className="min-w-0 self-center">
					<span className={STACKED_LABEL}>Amount</span>
					<div className="truncate pr-2 text-right font-medium tabular-nums">
						{formatMoney(item.total, currency)}
					</div>
				</div>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={`Remove item ${position}`}
				className="col-start-3 row-start-1 size-8 text-muted-foreground hover:bg-status-overdue-bg hover:text-status-overdue-fg sm:col-start-4"
				onClick={onRemove}
			>
				&times;
			</Button>
		</div>
	);
}
