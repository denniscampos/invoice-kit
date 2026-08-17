# Build Plan

> One of the two planning docs you provide. Write it yourself or with the AI's help.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "login"` to pick a specific one.
Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

## Continuing after the initial build

This is a living roadmap, not a plan that freezes when the first release is
done. Keep completed items checked, then append new unchecked features as the
project grows. Optional milestone headings such as `## MVP` and `## Post-MVP`
keep a longer plan readable without changing how `/feature` finds the next
unchecked item.

Do not renumber completed features because their archived specs refer back to
those numbers. Continue with the next unused number. If a new feature materially
changes the product direction, users, data, stack, monetization, UI/UX, or
deployment, update the relevant part of `project-plan.md` too. Then re-run
`/overview` before spec'ing the feature.

You can edit this file directly or ask the AI to start a new feature by name. If
`/feature "team workspaces"` does not match an existing item, it will propose the
new build-plan line and any necessary project-plan changes, wait for approval,
refresh the overview, and then write the feature spec.

Scaffolding the app (create-next-app, etc.) and prototyping the look are
pre-build steps, not features (see the README), so don't list them here. Start
with your first real slice of functionality.

A common order that works well: build the core UI with placeholder data first,
then wire up data, auth, and integrations. Add deployment readiness only when the
app is worth shipping or a provider config change is part of the work. Adapt it
to your project.

## Format

Use checkboxes. Each item should be a feature-sized outcome, not a loose task or
a whole product area.

Good: a numbered, bolded outcome with a short description of what it delivers,
the way the MVP list below is written.

Avoid: bare nouns and areas rather than outcomes ("Database", "Auth, billing,
dashboard", "Make it look nice"). They are not feature-sized and give the build
loop nothing to finish.

The example checklist that shipped with the template lived here and was removed,
because its unchecked boxes belonged to a different project and anything looking
for the next unchecked item found them first.

If your first pass is just rough bullets, that is okay. Run `/overview` after
filling both planning docs; it will flag plan-shape problems and can propose a
cleaned-up checkbox version before generating the project overview.

## MVP

- [x] 1. **Invoice editor** - create a new invoice with bill from, bill to, invoice details, payment terms, and notes
- [x] 2. **Line items** - add, edit, remove, and total multiple invoice line items
- [x] 3. **Live invoice preview** - show a minimal invoice template that updates as the form is filled out
- [x] 4. **Template selection** - switch between simple invoice templates for the preview and final PDF
- [x] 5. **PDF generation** - generate and download PDF invoices from HTML templates using Cloudflare Browser Rendering/Puppeteer, with no account needed
  - [x] 5a. **Print-ready invoice HTML** - the Worker validates a posted draft and returns it as one standalone, letter-sized HTML document with the styles inlined
  - [x] 5b. **PDF download** - Browser Rendering turns that document into a PDF, streamed to a Download button in the editor

Items 1-5 are most of the free path: build an invoice and download it without
signing up. Nothing is stored on the server yet. Item 23 finishes that path with
a printed copy. Everything else below needs an account.

- [x] 6. **Accounts and auth** - sign up, sign in, sign out, and protected routes using Better Auth with D1
  - [x] 6a. **Database and auth server** - D1 created and bound, Better Auth configured against it, its schema migrated, its route handler mounted, no UI
  - [x] 6b. **Sign up and sign in** - the two pages, real sessions, back to the editor afterwards
  - [x] 6c. **Session in the app** - the app bar reflects who is signed in, sign out works, and a requireUser helper is ready for feature 7
- [x] 7. **Invoice persistence** - save invoices to D1, scoped to the signed-in user, and retrieve them later
  - [x] 7a. **Schema and the store** - the invoice and line item tables, the draft to row mapping, and create/read/update scoped by the session user, no UI
  - [x] 7b. **Saving from the editor** - the Save button, per-user invoice numbering, and what the editor shows once an invoice is saved

Feature 7 can write an invoice to D1 but nothing can read one back, so a saved
invoice is unreachable once the tab closes. Items 9, 11, 10, and 12 are the
dashboard that makes saving mean something, and they come before everything else.
The numbers below are out of sequence on purpose: they are the original ones,
kept so the archived specs and the overview still line up, reordered to the order
they get built in.

- [x] 9. **Invoice list** - the dashboard: browse saved invoices with client, invoice number, total, due date, and status
- [x] 11. **Invoice detail view** - open a saved invoice at its own URL to view, edit, download, or update it, so the editor works on one identified invoice instead of guessing which one it is
- [x] 10. **Invoice status tracking** - mark invoices draft, sent, or paid, and show overdue derived from the due date
- [ ] 12. **Delete and void** - delete a draft invoice, or void a sent one while keeping the record
- [ ] 23. **Print** - print the invoice straight from the browser, so the one-off path does not have to spend a Browser Rendering call to put an invoice on paper
- [ ] 8. **Draft handoff** - carry an in-progress anonymous invoice through sign-up and save it to the new account
- [ ] 19. **Tax and discount controls** - support invoice-level taxes, discounts, and adjusted totals
- [ ] 13. **Logo upload** - upload a logo to R2 and attach it to an invoice, stored once per user and referenced by every invoice that uses it
- [ ] 24. **Password reset** - request a reset link by email and set a new password, via Better Auth and Cloudflare Email Service
- [x] 15. **Anonymous abuse protection** - rate limit the account-free PDF endpoint so Browser Rendering cannot be run up by strangers
- [ ] 16. **Local and self-hosted setup** - documented clone-to-running path against user-owned D1 and R2
- [ ] 17. **Deployment readiness** - confirm the deployed Cloudflare bindings, add the R2 bucket feature 13 needs, and verify migrations against the remote database

## Post-MVP

- [ ] 20. **Invoice duplication** - duplicate an existing invoice to quickly create a similar one
- [ ] 21. **Client reuse** - save and reuse bill-to client details across invoices
- [ ] 22. **Settings** - configure default currency, payment terms, sender details, and invoice numbering
- [ ] 18. **Custom fields** - allow optional custom fields for bill from, bill to, and invoice details
- [ ] 14. **Previous invoice upload** - upload and store invoice files that were created outside the app

Item 14 was moved out of the MVP. Storing files the app did not create is a
document archive rather than an invoice builder, and it is the expensive half of
R2: arbitrary content types, a download route, and its own size and abuse rules.
Item 13 keeps R2 for logos, which is an image, one bucket, and one upload route.

Item 24 was added after feature 6 shipped. Sign-up, sign-in, and sign-out work,
but nothing recovers an account, so a user who forgets their password is locked
out for good. That is a hole in the account path rather than a nice-to-have, and
the deployed instance already has a real account in it.