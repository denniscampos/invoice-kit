-- One row per day, holding how many PDFs have been rendered.
--
-- The daily browser allowance is the resource this protects, and no rate
-- limiting window can express a day. The row holds a date and a number and
-- nothing about who asked, which is what makes writing it from an anonymous
-- request consistent with the anonymous tier rule in coding-standards.md.

create table render_quota (
	day text not null primary key,
	renders integer not null default 0
);
