import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEMPLATE_ID,
	INVOICE_TEMPLATES,
	resolveTemplateId,
} from "./invoice-templates";

describe("resolveTemplateId", () => {
	it("returns every registered id unchanged", () => {
		for (const template of INVOICE_TEMPLATES) {
			expect(resolveTemplateId(template.id)).toBe(template.id);
		}
	});

	/* The default has to be renderable, or the fallback below hands the map an
	   id it has no component for. */
	it("keeps the default among the registered ids", () => {
		const ids = INVOICE_TEMPLATES.map((template) => template.id);
		expect(ids).toContain(DEFAULT_TEMPLATE_ID);
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["an empty string", ""],
		["an unknown id", "nope"],
		["a number", 4],
		["an object", { id: "minimal" }],
		["an array", ["minimal"]],
		["a boolean", true],
	])("falls back to the default for %s", (_label, value) => {
		expect(resolveTemplateId(value)).toBe(DEFAULT_TEMPLATE_ID);
	});
});
