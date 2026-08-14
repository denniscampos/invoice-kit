import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatMinorUnits, parseMoneyInput, parseQuantity } from "~/lib/money";
import type { LineItem } from "~/types/invoice";

type LineItemRowProps = {
	item: LineItem;
	index: number;
	className: string;
	onPatch: (patch: Partial<Omit<LineItem, "id" | "position" | "total">>) => void;
	onRemove: () => void;
};

export function LineItemRow({
	item,
	index,
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
			<Input
				aria-label={`Quantity for item ${position}`}
				inputMode="decimal"
				className="text-right tabular-nums"
				value={quantityText}
				onChange={(event) => handleQuantity(event.target.value)}
			/>
			<Input
				aria-label={`Rate for item ${position}`}
				inputMode="decimal"
				className="text-right tabular-nums"
				value={rateText}
				onChange={(event) => handleRate(event.target.value)}
			/>
			<div className="pr-2 text-right font-medium tabular-nums">
				{formatMinorUnits(item.total)}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label={`Remove item ${position}`}
				className="size-8 text-muted-foreground hover:bg-status-overdue-bg hover:text-status-overdue-fg"
				onClick={onRemove}
			>
				&times;
			</Button>
		</div>
	);
}
