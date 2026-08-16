# Project Plan

> One of the two planning docs you provide. Answer each section in a line or two
> (a worksheet, not an essay). Draft it yourself or let the AI help you expand and
> sharpen it; either way, the content is yours to direct. When it's filled in, run
> `/overview` to generate the project overview from this plus `build-plan.md`.

## 1. Problem - What problem are we solving?

Creating invoices manually in Google Docs or similar tools is slow and repetitive. This project makes it easy to generate invoices, manage line items, store invoice history, and track whether invoices have been paid.

## 2. Users - Who is this for?

Freelancers, contractors, and small business owners who need a fast, simple way to create and manage invoices. Existing tools can feel bloated, outdated, or harder to use than necessary.

## 3. Features - What does the MVP need?

There are two paths through this app and everything below serves one of them.

**The one-off path.** Fill in an invoice, get a copy on paper or on disk, leave.
No account, nothing stored on the server, no reason to come back.

**The account path.** The same editor, plus a dashboard: save an invoice,
find it again, edit it, and track whether it was paid.

- Create an invoice with no account, as a one-off
- Print the invoice straight from the browser, or download it as a PDF
- Create invoices using simple, minimal templates
- Add and edit multiple invoice line items
- Apply taxes and discounts to the invoice total
- Create an account to save, manage, and track invoices over time
- Reset a forgotten password by email
- Store invoices and retrieve them later from a dashboard
- Open a saved invoice at its own address to view, edit, or download it
- Keep an in-progress invoice through sign-up so nothing is retyped
- Delete a draft invoice, or void one that was already sent
- Track invoice status, such as draft, sent, paid, or overdue
- Generate and download PDF invoices from HTML templates using Cloudflare Browser Rendering/Puppeteer
- Upload a logo and attach it to invoices
- Support Cloudflare D1 for the database and R2 for logo storage
- Allow users to self-host the app without relying on the official hosted version

Deliberately not in the MVP: storing invoice files the app did not create,
custom fields, saved clients, and settings. They are on the build plan under
Post-MVP. None of them serve the two paths above, and the file archive in
particular is a different product wearing the same login.

**The app never sends the invoice.** Marking one `sent` is the user recording
what they did; they still email the PDF themselves. Sending mail on a user's
behalf means their deliverability, their domain reputation, and a bounce
handling story, and none of that makes the invoice easier to write. Decided for
the MVP, not an oversight.

Password reset is the exception that does need mail, because an account nobody
can get back into is not an account. It sends to our own users, not to their
clients.

## 4. Data - What are we storing?

Users and sessions, managed by Better Auth: email, hashed password, and session
records. Every saved invoice and uploaded file belongs to exactly one user.

Anonymous invoices are never stored on the server. They live in the browser's
`sessionStorage` until the user signs up, at which point the in-progress invoice
is saved to their new account. Session storage is deliberate: an invoice holds
someone else's name, address, and billed amount, and that should not outlive the
tab on a shared computer.

Bill From:

- Name
- Address
- City
- State/region
- ZIP/postal code
- Country
- Email
- Phone
- Tax or business ID (VAT, ABN, EIN, and similar), optional
- Optional custom fields, Post-MVP (build plan item 18). The `customFields`
  column exists and stays null until then.

Bill To:

- Name
- Address
- City
- State/region
- ZIP/postal code
- Country
- Email
- Phone
- Tax or business ID (VAT, ABN, EIN, and similar), optional
- Optional custom fields, Post-MVP (build plan item 18). The `customFields`
  column exists and stays null until then.

Invoice Details:

- Logo, uploaded once by a signed-in user and stored in R2, then referenced by
  every invoice that uses it rather than copied onto each one. An anonymous
  invoice has no R2 object; its logo is a client-side image inlined at render
  time and it disappears with the tab.

  PNG, JPEG, and WebP only, 2 MB maximum, on both tiers. **No SVG**: the logo is
  inlined into a document that Browser Rendering opens in a real browser, and an
  SVG is a script-bearing document, not a picture. Accepting one would let an
  uploaded file run in the renderer.
- Invoice number, defaulting to a per-user sequence such as INV-0001 and editable
- Issue date
- Due date
- Currency
- Line items: name, description, quantity, rate, and total
- Subtotal, taxes, discounts, and final total
- Payment terms
- Additional notes
- Invoice status: draft, sent, or paid. Overdue is not stored; it is calculated
  from the due date on a sent invoice.

## 5. Tech - What stack are we using?

The app will use React Router for the frontend and run on Cloudflare. It will use Cloudflare D1 for SQLite-based data storage, Cloudflare R2 for logo storage, Tailwind CSS v4 for styling, and shadcn/ui for reusable UI components. Authentication will use Better Auth with email and password sessions stored in D1, chosen over hand-rolled JWTs so password hashing, session handling, and resets come from a maintained library. Creating and downloading an invoice needs no account; saving, managing, and uploading do. Because the free path calls Browser Rendering without a session, the PDF endpoint needs rate limiting (Cloudflare Rate Limiting, or Turnstile if abuse gets creative). PDF generation will use HTML invoice templates rendered through Puppeteer, likely via Cloudflare Browser Rendering; PDFs are generated on demand rather than stored.

Printing is the cheap sibling of the PDF and not the same feature. The browser's
own print dialog renders the invoice from the page using the print stylesheet the
PDF document already carries, so it costs nothing per use, needs no rate limit,
and still works when the day's render budget is spent. The PDF stays for the case
where a file is what the user actually needs, such as emailing it.

A saved invoice is addressable. Once the dashboard exists, the editor works on
one invoice identified by the URL rather than on a single unnamed draft in
`sessionStorage`, which is what the anonymous path keeps using.

Password reset needs to send mail, which is the one capability the stack did not
already have. Use Cloudflare Email Service rather than a third-party provider, so
the self-hosting story stays "you need a Cloudflare account", which it already
was. Better Auth owns the token and expiry; the sender is only a transport.
Email verification is not required to use the app: an unverified address can
still create invoices, because blocking the product on an inbox round trip is the
sign-up friction this project exists to avoid.

**UI primitives come from shadcn, but blocks do not come wholesale.** A block
like `dashboard-01` is a starting point to read, not a dependency to adopt: it
carries a table library, a chart library, and a sidebar this app does not use.
Take the primitives it is built from and the layout it suggests.

## 6. Monetize - How will this make money?

No monetization is planned for the MVP. The initial goal is to build a useful, self-hostable invoice tool; monetization can be considered later if needed.

## 7. UI/UX - How should this look and feel?

The UI should be minimal, clean, and fast. Users should fill out invoice details in a form on the left while seeing a live invoice preview/template on the right that updates as they type. The app opens straight into the editor with no sign-up wall; the account prompt appears only when the user asks for something that needs one, such as saving. Sign-up and sign-in are plain, single-purpose pages.

A one-off user should be able to reach a printed invoice without ever meeting a
decision about accounts: fill in the form, press Print or Download, done. Print
and Download sit together in the editor for both tiers.

A signed-in user gets one more surface, the dashboard: a list of their saved
invoices with client, number, total, due date, and status, each opening into the
same editor at its own address. That list is the whole of "manage them"; nothing
else needs to be added to make saving worth doing.

## 8. Deployment - Where and how will this ship?

The app will be deployed on Cloudflare, using Cloudflare Pages/Workers for hosting, D1 for the database, and R2 for uploaded logos. D1, Browser Rendering, and the two rate limiters are already bound and deployed; the R2 bucket is the one binding still to add, and it lands with the logo feature. Self-hosting means the repo runs: clone it, `pnpm install`, point it at your own D1 and R2, and go. It is the same code and the same accounts as the hosted version, with no special single-user mode; you just make an account on your own instance. The only local setup is copying `.dev.vars.example`, so there are no third-party service keys to obtain.