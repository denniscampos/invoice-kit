import { Field } from "~/components/invoice/Field";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { Party } from "~/types/invoice";

type FieldSpec = {
	field: keyof Party;
	label: string;
	type?: "text" | "email" | "tel";
	/* Identifiers and numbers align better with tabular figures, same as money. */
	tabular?: boolean;
};

/* Row grouping comes from the feature 1 mockup: name and email, then address
   and phone, then the city line, then country and tax id. */
const ROWS: FieldSpec[][] = [
	[
		{ field: "name", label: "Name" },
		{ field: "email", label: "Email", type: "email" },
	],
	[
		{ field: "address", label: "Address" },
		{ field: "phone", label: "Phone", type: "tel", tabular: true },
	],
	[
		{ field: "city", label: "City" },
		{ field: "region", label: "State / region" },
		{ field: "postalCode", label: "ZIP / postal code", tabular: true },
	],
	[
		{ field: "country", label: "Country" },
		{ field: "taxId", label: "Tax / business ID", tabular: true },
	],
];

// Tailwind needs the full class name in the source, so no template strings here.
const ROW_COLUMNS: Record<number, string> = {
	2: "sm:grid-cols-2",
	3: "sm:grid-cols-3",
};

type PartyFieldsProps = {
	title: string;
	/* Distinguishes the two rendered copies, so every label points at its own
	   input rather than the first one on the page. */
	idPrefix: string;
	value: Party;
	onChange: (party: Party) => void;
};

export function PartyFields({
	title,
	idPrefix,
	value,
	onChange,
}: PartyFieldsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{ROWS.map((row, index) => (
					<div
						key={index}
						className={`grid gap-3 ${ROW_COLUMNS[row.length]}`}
					>
						{row.map(({ field, label, type, tabular }) => {
							const id = `${idPrefix}-${field}`;

							return (
								<Field key={field} id={id} label={label}>
									<Input
										id={id}
										type={type ?? "text"}
										value={value[field]}
										onChange={(event) =>
											onChange({ ...value, [field]: event.target.value })
										}
										className={tabular ? "tabular-nums" : undefined}
									/>
								</Field>
							);
						})}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
