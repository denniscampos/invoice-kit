import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LineItemRow } from "~/components/invoice/LineItemRow";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	addLineItem,
	invoiceSubtotal,
	removeLineItem,
	reorderLineItems,
	updateLineItem,
} from "~/lib/invoice-draft";
import { formatMoney } from "~/lib/money";
import type { InvoiceDraft, LineItem } from "~/types/invoice";

/* Column widths come from the mockup's .items-head / .item-row grid. The header
   and every row share them so the columns line up without a table.

   Only from `sm` up, though. Those fixed tracks add up to 396px before the
   description column gets anything, which is wider than a phone: below that the
   row stacks instead, with the numbers on a second line. */
const GRID =
	"grid grid-cols-[32px_1fr_32px] items-center gap-2 sm:grid-cols-[32px_1fr_auto_32px]";

type LineItemsCardProps = {
	draft: InvoiceDraft;
	onChange: (patch: Partial<InvoiceDraft>) => void;
};

export function LineItemsCard({ draft, onChange }: LineItemsCardProps) {
	const { lineItems } = draft;

	function setItems(lineItems: LineItem[]) {
		onChange({ lineItems });
	}

	/* The keyboard sensor is the reason this uses dnd-kit rather than the native
	   drag events: it makes the same reorder reachable with tab, space, arrows. */
	const sensors = useSensors(
		useSensor(PointerSensor, {
			// Without a small threshold, a click on the handle registers as a drag.
			activationConstraint: { distance: 4 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over) return;

		setItems(reorderLineItems(draft, String(active.id), String(over.id)));
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<CardTitle>Line items</CardTitle>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setItems(addLineItem(draft))}
				>
					Add item
				</Button>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				{lineItems.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						No line items yet. Add one to start billing.
					</p>
				) : (
					<>
						{/* Hidden where the row stacks: the columns it labels are not
						    there, and each field carries its own label instead. */}
						<div
							className={`${GRID} hidden px-1 text-xs font-medium text-muted-foreground sm:grid`}
						>
							<span />
							<span>Description</span>
							<span className="grid grid-cols-[78px_110px_104px] gap-2">
								<span className="text-right">Qty</span>
								<span className="text-right">Rate</span>
								<span className="text-right">Amount</span>
							</span>
							<span />
						</div>

						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							modifiers={[restrictToVerticalAxis, restrictToParentElement]}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={lineItems.map((item) => item.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="flex flex-col gap-2">
									{lineItems.map((item, index) => (
										<LineItemRow
											key={item.id}
											item={item}
											index={index}
											currency={draft.currency}
											className={GRID}
											onPatch={(patch) =>
												setItems(updateLineItem(draft, item.id, patch))
											}
											onRemove={() => setItems(removeLineItem(draft, item.id))}
										/>
									))}
								</div>
							</SortableContext>
						</DndContext>

						<div className="flex justify-end gap-5 border-t pt-3 font-medium">
							<span className="font-normal text-muted-foreground">Total</span>
							<span className="pr-2 tabular-nums">
								{formatMoney(invoiceSubtotal(draft), draft.currency)}
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
