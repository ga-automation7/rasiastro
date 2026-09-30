# Setting up Rasi Astro for real customers

This guide takes you from "works on my computer in demo mode" to "takes real payments at
rasiastro.com". Do the steps in order. Each step says **what the service does**, **what
you click**, **where the keys go**, and **how to check it worked**.

- Every environment variable (what it is, where to get it, secret or not, test vs live
  value) is listed once, in **[VERCEL_SETUP.md](VERCEL_SETUP.md)**.
- What is done, what is waiting for you, and what blocks a paid launch is tracked in
  **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)**.

> **Golden rules**
> - Keys and passwords go only in `.env.local` (your computer) and in Vercel's
>   *Environment Variables* screen. Never paste them into chat, email, screenshots or code.
> - Entering keys does not set up the accounts themselves: domain verification, webhooks,
>   Cashfree activation and DNS are separate steps below.
> - After changing settings, run `npm run config:check`. It tests each account without
>   printing secrets and names exactly what is missing.
> - The site never takes money it cannot deliver on: if something required is missing,
>   it shows "Online ordering is not open yet" and no order form.

---

## 0. Decisions only you can make (before launch)

| Decision | Why it matters | Where it goes |
| --- | --- | --- |
| Business structure, legal name, address, registration | Shown on the policy and contact pages; Cashfree requires them | `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS`, `BUSINESS_REGISTRATION` |
| GST registration (ask your accountant) | Tax on sales; GSTIN shown if registered | `BUSINESS_GSTIN` |
| A named Grievance Officer, a support phone and a monitored mailbox | Indian e-commerce rules; complaints must be acknowledged within 48 hours | `GRIEVANCE_OFFICER_*`, `SUPPORT_PHONE`, `SUPPORT_EMAIL` |
| Retention periods | How long birth details and reports are kept | `RETENTION_UNPAID_DAYS`, `RETENTION_REPORT_DAYS` |
| Delivery and refund service levels | Shown to customers; set them from measured sandbox times | `DELIVERY_*`, `REFUND_INITIATION_WORKING_DAYS` |
| Professional legal review | The policies are careful drafts, not legal advice; see docs/LEGAL_READINESS.md | the pages in `src/app/` |
| Native-speaker review of report labels | Tamil, Hindi, Telugu, Kannada and Malayalam labels have not been reviewed by native speakers | `src/i18n/*.ts` |

## 1. Your computer (already done if demo mode works)

1. Install Node.js LTS (22.17 or newer) and Google Chrome (or use Microsoft Edge).
2. In this folder: `npm install`, then `npm run dev`, open http://localhost:3000.
3. Copy `.env.example` to a new file named `.env.local`. You will fill it in as you go.

## 2. Supabase - database and private file storage (make two projects)

**What it does:** stores orders, payments, job status and reports (PostgreSQL), and keeps
the PDFs in a private bucket. Use one project for testing (`rasi-astro-test`) and one for
live (`rasi-astro`), so test orders never mix with real ones.

For each project:

1. Create it at https://supabase.com. Choose the region **Mumbai** and save the database
   password in your password manager.
2. **Database connection:** click **Connect** → *Transaction pooler* → copy the string,
   replace `[YOUR-PASSWORD]`, and put it in `.env.local` as `DATABASE_URL=...`.
3. **API keys:** *Project Settings → API*: **Project URL** → `SUPABASE_URL`; the
   **secret / service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server only, very sensitive).
4. Set `STORAGE_PROVIDER=supabase` in `.env.local`.
5. Stop the dev server, then run the bootstrap commands in VERCEL_SETUP.md section 6
   (`db:migrate`, `storage:setup`, `places:import`) and check their expected output.
6. **Backups:** *Database → Backups*: confirm what your plan includes. A paid plan with
   daily backups is strongly recommended for the live project. See docs/OPERATIONS.md.

## 3. Cashfree - payments

**What it does:** shows customers Cashfree's secure payment page (UPI, cards,
netbanking). The app never sees card or UPI details.

1. Sign up at https://merchant.cashfree.com and complete business verification (KYC).
   Cashfree reviews your website: it must show the contact, terms, privacy, refund and
   delivery pages (built - fill in the business details first).
2. **Test mode:** *Developers → API Keys* → App ID and Secret Key → `CASHFREE_CLIENT_ID`,
   `CASHFREE_CLIENT_SECRET`, with `CASHFREE_ENV=sandbox` and `APP_MODE=sandbox`.
3. **Webhook:** after deploying (step 6), *Developers → Webhooks* → add
   `https://<your-site>/api/webhooks/cashfree` with the events listed in VERCEL_SETUP.md
   section 7.
4. **Live:** once Cashfree approves your account, generate **production** keys and use
   them with `CASHFREE_ENV=production` and `APP_MODE=live`. If Cashfree asks you to
   whitelist or approve your domain, add `rasiastro.com` there. Add the production webhook.

## 4. OpenAI - writing the interpretation

**What it does:** turns the calculated chart into readable prose in the chosen language.
It never calculates positions.

1. At https://platform.openai.com add billing and create an API key → `OPENAI_API_KEY`.
2. Run `npm run config:check`; it lists the models your key can use. Set
   `OPENAI_MODEL=<exact model id>` and run the check again to confirm access.
3. Set a **monthly spending limit** in OpenAI's dashboard. The app also has a daily cap
   (`AI_DAILY_TOKEN_BUDGET`).
4. Read several real reports in each language (and several compatibility categories) in
   sandbox before launch.

## 5. Resend - emails, and Inngest - background jobs

**Resend:** *Domains → Add domain* → `rasiastro.com`; add the DNS records Resend shows at
GoDaddy; wait for **Verified**; create an API key → `RESEND_API_KEY`. Make sure the
support mailbox really receives mail. `npm run config:check` confirms the domain.

**Inngest:** sign up at https://www.inngest.com and install the **Inngest integration
for Vercel** (it adds the keys and syncs `/api/inngest` on each deployment). Set
`JOB_RUNNER=inngest`. The Inngest dashboard should show four functions: *Generate
report*, *Email report link*, *Reconcile and resume*, *Retention and housekeeping*.

## 6. Vercel - test site first, then live

Vercel's Hobby plan is for non-commercial use only; the live shop needs **Pro**.

1. Import the project in Vercel (or deploy with the CLI, VERCEL_SETUP.md section 8).
2. Enter the **sandbox** values from VERCEL_SETUP.md section 4 (test Supabase project,
   Cashfree sandbox keys, `APP_MODE=sandbox`, `PUBLIC_SITE_URL=https://<project>.vercel.app`).
3. Deploy to production on the `*.vercel.app` address and add the sandbox webhook.
4. **Check health:**
   ```bash
   curl -H "Authorization: Bearer <HEALTH_CHECK_TOKEN>" https://<project>.vercel.app/api/health
   ```
   Every check should be `ok: true`, with `site: "sandbox"` and both products `true`.

## 7. Test everything in sandbox

1. Place a personal order and a compatibility order on the test site; pay with Cashfree's
   published **test** payment methods (Cashfree docs, "Test data").
2. Confirm for each: the order page moves through *Payment confirmed → Preparing your
   chart → Writing your interpretation → Preparing your PDF → Your report is ready*; the
   report opens; the PDF downloads and looks right; the email arrives with a working link.
3. In Cashfree's dashboard, check the webhook delivery shows HTTP 200.
4. Try: cancelling on the payment page (order shows it and lets you retry); *Find my
   report* with your email; opening the report link in a private window after copying
   only the address bar (it must NOT open).
5. Note how long reports took; set `DELIVERY_TYPICAL_MINUTES` and `DELIVERY_MAX_HOURS`.
6. Run `npm run ops:status` and `npm run export:xlsx` against the test database.

## 8. Go live

Switch the Production variables to live values (live Supabase project, production
Cashfree keys, `APP_MODE=live`, `PUBLIC_SITE_URL=https://rasiastro.com`,
`INNGEST_SERVE_ORIGIN=https://rasiastro.com`, business details), attach `rasiastro.com`
in Vercel and add the DNS records Vercel shows at GoDaddy, redeploy, then do the single
real-payment test in LAUNCH_CHECKLIST.md.

## If something does not work

- Run `npm run config:check` - it names the missing or wrong setting.
- `https://<site>/api/health` with the token shows which check fails.
- Orders stuck or failed: see docs/OPERATIONS.md.
