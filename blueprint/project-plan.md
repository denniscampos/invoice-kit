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

- Create and download an invoice with no account, as a one-off
- Create an account to save, manage, and track invoices over time
- Create invoices using simple, minimal templates
- Add and edit multiple invoice line items
- Keep an in-progress invoice through sign-up so nothing is retyped
- Store invoices and retrieve them later
- Delete a draft invoice, or void one that was already sent
- Track invoice status, such as draft, sent, paid, or overdue
- Generate and download PDF invoices from HTML templates using Cloudflare Browser Rendering/Puppeteer
- Upload and store previous invoices not created in the app
- Store uploaded assets such as logos and invoice files
- Support Cloudflare D1 for the database and R2 for file storage
- Allow users to self-host the app without relying on the official hosted version

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
- Optional custom fields

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
- Optional custom fields

Invoice Details:

- Logo
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
- Attached/uploaded invoice files

## 5. Tech - What stack are we using?

The app will use React Router for the frontend and run on Cloudflare. It will use Cloudflare D1 for SQLite-based data storage, Cloudflare R2 for file storage, Tailwind CSS v4 for styling, and shadcn/ui for reusable UI components. Authentication will use Better Auth with email and password sessions stored in D1, chosen over hand-rolled JWTs so password hashing, session handling, and resets come from a maintained library. Creating and downloading an invoice needs no account; saving, managing, and uploading do. Because the free path calls Browser Rendering without a session, the PDF endpoint needs rate limiting (Cloudflare Rate Limiting, or Turnstile if abuse gets creative). PDF generation will use HTML invoice templates rendered through Puppeteer, likely via Cloudflare Browser Rendering; PDFs are generated on demand rather than stored.

## 6. Monetize - How will this make money?

No monetization is planned for the MVP. The initial goal is to build a useful, self-hostable invoice tool; monetization can be considered later if needed.

## 7. UI/UX - How should this look and feel?

The UI should be minimal, clean, and fast. Users should fill out invoice details in a form on the left while seeing a live invoice preview/template on the right that updates as they type. The app opens straight into the editor with no sign-up wall; the account prompt appears only when the user asks for something that needs one, such as saving. Sign-up and sign-in are plain, single-purpose pages.

## 8. Deployment - Where and how will this ship?

The app will be deployed on Cloudflare, using Cloudflare Pages/Workers for hosting, D1 for the database, and R2 for uploaded files and assets. Self-hosting means the repo runs: clone it, `pnpm install`, point it at your own D1 and R2, and go. It is the same code and the same accounts as the hosted version, with no special single-user mode; you just make an account on your own instance. The only local setup is copying `.dev.vars.example`, so there are no third-party service keys to obtain.