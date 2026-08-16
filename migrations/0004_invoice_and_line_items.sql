-- Invoices and their line items: the first tables holding a user's own content.
--
-- Table names are snake_case, matching render_quota, the only other table this
-- project wrote by hand. Column names are camelCase, matching both the data
-- model in project-overview.md and Better Auth's own tables, so a row maps onto
-- an object by copying rather than renaming.
--
-- Party details are copied onto the invoice rather than referenced. An invoice
-- has to keep the address it was sent with even after the client record changes,
-- so feature 21 (client reuse) will add a record to copy from, not a foreign key.
--
-- There is no overdue column and there will not be one: overdue is
-- status = 'sent' and dueDate < today, computed at read time. A stored flag
-- would need a scheduled job to flip it and would be wrong for any invoice the
-- job missed.

create table invoice (
	id text not null primary key,
	userId text not null references "user" ("id") on delete cascade,

	-- User-visible and editable. Unique per user, not globally: two people can
	-- both have an INV-0001.
	invoiceNumber text not null,

	-- draft | sent | paid | void. Only 'draft' is written until feature 10, but
	-- the column accepts all four now rather than being migrated then.
	status text not null default 'draft',

	templateId text not null,

	-- ISO YYYY-MM-DD, never a Date.
	issueDate text not null,
	dueDate text not null,

	-- ISO 4217, stored per invoice so history keeps the currency it was issued in.
	currency text not null,

	-- Feature 13. Null until a logo is attached.
	logoAssetId text,

	billFromName text not null,
	billFromAddress text not null,
	billFromCity text not null,
	billFromRegion text not null,
	billFromPostalCode text not null,
	billFromCountry text not null,
	billFromEmail text not null,
	billFromPhone text not null,
	billFromTaxId text not null,

	billToName text not null,
	billToAddress text not null,
	billToCity text not null,
	billToRegion text not null,
	billToPostalCode text not null,
	billToCountry text not null,
	billToEmail text not null,
	billToPhone text not null,
	billToTaxId text not null,

	paymentTerms text,
	notes text,

	-- Integer minor units, always. Every one of these is computed on the server
	-- from quantity and rate; none is accepted from the client.
	subtotal integer not null,
	discountTotal integer not null default 0,
	taxTotal integer not null default 0,
	total integer not null,

	-- Feature 18. JSON, null until then.
	customFields text,

	-- ISO 8601 UTC strings.
	createdAt text not null,
	updatedAt text not null
);

create table line_item (
	id text not null primary key,
	invoiceId text not null references invoice (id) on delete cascade,
	position integer not null,
	name text not null,
	description text,

	-- The one real number in the schema. Half a day and 1.5 metres are real
	-- quantities; half a cent is not a real price.
	quantity real not null,

	-- Minor units, per unit.
	rate integer not null,

	-- round(quantity * rate), stored rather than derived so a saved invoice
	-- never recomputes to a different number than the one it was sent with.
	total integer not null
);

-- Every query for a user's invoices filters on userId, so it is indexed.
create index invoice_userId_idx on invoice (userId);

-- The uniqueness rule the invoice number promises: per user, not global.
create unique index invoice_userId_invoiceNumber_idx on invoice (userId, invoiceNumber);

-- Line items are always fetched by their invoice, in display order.
create index line_item_invoiceId_position_idx on line_item (invoiceId, position);
