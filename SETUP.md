# Setting up Rasi Astro for real customers

This guide takes you from "works on my computer in demo mode" to "takes real payments at
rasiastro.com". Do the steps in order. Each step says **what the service does**, **what
you click**, **where the keys go**, and **how to check it worked**.

> **Golden rules**
> - Keys and passwords go only in `.env.local` (your computer) and in Vercel's
>   *Environment Variables* screen. Never paste them into chat, email, screenshots or code.
> - After changing settings, run `npm run config:check`. It tests each account without
>   printing any secrets and tells you exactly what is missing.
> - The site will not take real money until everything required is configured. If
>   something is missing, the order form shows "New orders are paused" instead.

---

## 0. Decisions only you can make (before launch)

| Decision | Why it matters | Where it goes |
| --- | --- | --- |
| Legal business name and address | Shown on the privacy, terms and contact pages; Cashfree requires them | `BUSINESS_LEGAL_NAME`, `BUSINESS_ADDRESS` |
| Grievance officer (a named person) | Indian e-commerce rules expect a named contact for complaints | `GRIEVANCE_OFFICER_NAME` |
| Support email (e.g. support@rasiastro.com) | Shown everywhere; customers write here | `SUPPORT_EMAIL` |
| Retention periods | How long birth details and reports are kept | `RETENTION_UNPAID_DAYS`, `RETENTION_REPORT_DAYS` |
| GST / tax registration | Ask your accountant whether GST applies to your sales | (outside the app) |
| Legal review of the policy pages | The pages in `src/app/privacy`, `terms`, `refund-policy`, `delivery-policy` are sensible drafts, not legal advice | Edit the page files or ask a developer |
| Translation review | Report labels in Tamil, Hindi, Telugu, Kannada and Malayalam were drafted without a native-speaker review | `src/i18n/*.ts` |

## 1. Your computer (already done if demo mode works)

1. Install Node.js LTS (22.17 or newer) and Google Chrome (or use Microsoft Edge).
2. In this folder: `npm install`, then `npm run dev`, open http://localhost:3000.
3. Copy `.env.example` to a new file named `.env.local`. You will fill it in as you go.

## 2. GitHub (to store the code privately)

Vercel deploys from GitHub. Create a **private** repository at https://github.com/new
(no README), then follow GitHub's "push an existing repository" instructions from this
folder. The `.gitignore` already keeps `.env.local`, `.data/` and `exports/` out of git.

## 3. Supabase - database and private file storage

**What it does:** stores orders, payments, job status and reports (PostgreSQL), and keeps
the PDFs in a private bucket.

1. Sign up at https://supabase.com and create a project. Choose the region **Mumbai**
   (closest to India) and save the database password in your password manager.
2. **Database connection:** click **Connect** (top of the project) → *Transaction pooler*
   → copy the connection string. Replace `[YOUR-PASSWORD]` with your password.
   Put it in `.env.local` as `DATABASE_URL=...`.
3. **API keys:** *Project Settings → API*: copy the **Project URL** into `SUPABASE_URL`
   and the **secret / service_role key** into `SUPABASE_SERVICE_ROLE_KEY`. This key
   bypasses all security rules - it must only ever be on the server.
4. In `.env.local` also set `STORAGE_PROVIDER=supabase`.
5. Stop the dev server, then run, one at a time:
   ```bash
   npm run db:migrate
   npm run places:import
   npm run storage:setup
   ```
   - `db:migrate` creates the tables (with row-level security switched on, so the public
     Supabase API can read nothing).
   - `places:import` downloads the free GeoNames list of ~150,000 towns and cities
     (about 10 MB; takes a few minutes) for the birthplace search.
   - `storage:setup` creates the **private** `reports` bucket.
6. **Check:** `npm run config:check` shows ✓ for the database, birthplaces and storage.
7. **Backups:** in Supabase open *Database → Backups* and confirm what your plan includes.
   For a business, a paid plan with daily backups (or point-in-time recovery) is strongly
   recommended. See docs/OPERATIONS.md for restoring.

## 4. Cashfree - payments

**What it does:** shows customers a secure Cashfree payment page (UPI, cards, netbanking).
The app never sees card or UPI details.

1. Sign up at https://merchant.cashfree.com and complete business verification (KYC).
   Cashfree reviews your website: it must show the contact, terms, privacy, refund and
   delivery policy pages (already built - fill in the business details first, step 0).
2. Start in **Test / Sandbox** mode. In the dashboard go to *Developers → API Keys*
   and copy the **App ID** and **Secret Key** into `.env.local`:
   ```
   CASHFREE_ENV=sandbox
   CASHFREE_CLIENT_ID=...
   CASHFREE_CLIENT_SECRET=...
   ```
3. **Webhook** (Cashfree tells us when a payment succeeds): after the site is deployed
   (step 8), in *Developers → Webhooks* add the endpoint
   `https://<your-site>/api/webhooks/cashfree` for **payment** events (success, failed,
   user dropped). Choose the latest webhook version offered. Webhooks need an https
   address, so they cannot reach your own computer; when testing locally the app instead
   asks Cashfree for the status when you return from the payment page.
4. **Check:** `npm run config:check` → "credentials accepted".
5. When Cashfree approves your account for real payments, generate **production** keys
   and set `CASHFREE_ENV=production` in Vercel's *Production* environment. The live
   site refuses to run with sandbox keys.
6. If Cashfree asks you to whitelist your domain, add `rasiastro.com` there.

## 5. OpenAI - writing the report text

**What it does:** turns the calculated chart into readable, personalised prose in the
chosen language. It never calculates positions.

1. Sign up at https://platform.openai.com, add billing, and create an API key
   (*API keys → Create new secret key*). Put it in `OPENAI_API_KEY`.
2. Run `npm run config:check`. It lists the models your account can use. Pick one that
   writes well in Indian languages (a current, capable general model; ask your developer
   if unsure) and set `OPENAI_MODEL=<exact model id>`. Run the check again - it confirms
   the model is available to your account.
3. In OpenAI's dashboard set a **monthly spending limit**. The app also has its own
   daily cap (`AI_DAILY_TOKEN_BUDGET`).
4. Optional: to see the real AI text while payments are still simulated, set
   `DEMO_USE_REAL_AI=true` and create an order locally. Read several reports in each
   language before launch.
5. Optional: fill `AI_PRICE_INPUT_PER_MTOK_USD` / `AI_PRICE_OUTPUT_PER_MTOK_USD` from
   OpenAI's pricing page so the Excel export shows estimated cost per report.

## 6. Resend - emails

**What it does:** sends the "your report is ready" email and link-recovery emails.

1. Sign up at https://resend.com. *Domains → Add domain* → `rasiastro.com`.
2. Resend shows DNS records (SPF/DKIM, possibly DMARC). Add them where you bought the
   domain (your registrar's DNS settings). Wait until Resend shows **Verified**.
3. *API Keys → Create* (sending access) → `RESEND_API_KEY`.
4. Set `EMAIL_FROM=Rasi Astro <reports@rasiastro.com>` and `SUPPORT_EMAIL`. Make sure you
   can actually receive mail at the support address (set up a mailbox or forwarding).
5. Optional: `OWNER_ALERT_EMAIL` = your address, for alerts about failed reports or
   payments needing review.
6. **Check:** `npm run config:check` → "domain rasiastro.com: verified".

## 7. Inngest - reliable background jobs

**What it does:** runs report generation step by step with automatic retries, even if
a server restarts; also runs the 10-minute safety sweep (missed payments, stuck jobs)
and the daily data-retention clean-up.

1. Sign up at https://www.inngest.com.
2. Easiest: install the **Inngest integration for Vercel** from the Inngest dashboard; it
   adds `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to your Vercel project automatically.
   Otherwise copy both keys from the Inngest dashboard into Vercel yourself.
3. Set `JOB_RUNNER=inngest`.
4. After each deployment Inngest must "sync" your app at `https://<your-site>/api/inngest`
   (the Vercel integration does this automatically). In the Inngest dashboard you should
   see 4 functions: *Generate report*, *Email report link*, *Reconcile and resume*,
   *Retention and housekeeping*.

## 8. Vercel - hosting the website

**What it does:** runs the website and the API.

> Vercel's free *Hobby* plan is for personal, non-commercial projects. A shop that takes
> payments should use the **Pro** plan. Check Vercel's current terms.

1. Sign up at https://vercel.com with GitHub and **Import** your repository.
2. Before the first deploy, open *Settings → Environment Variables* and add every value
   from your `.env.local`, plus:
   ```
   APP_MODE=live
   PUBLIC_SITE_URL=https://rasiastro.com
   APP_SECRET=<a new long random value>
   HEALTH_CHECK_TOKEN=<another random value>
   STORAGE_PROVIDER=supabase
   JOB_RUNNER=inngest
   ```
   Use the **Preview** environment with `CASHFREE_ENV=sandbox` for testing, and the
   **Production** environment with `CASHFREE_ENV=production` keys for real payments.
3. The project includes `vercel.json`, which runs functions in Mumbai (`bom1`, close to
   the Supabase Mumbai region). Keep Fluid Compute enabled (Vercel's default); its
   standard 2 GB memory and 300-second step limit are enough for PDF rendering and AI calls.
4. Deploy. Then *Settings → Domains* → add `rasiastro.com` and `www.rasiastro.com`, and
   follow Vercel's DNS instructions at your registrar.
5. **Check health:**
   ```bash
   curl -H "Authorization: Bearer <HEALTH_CHECK_TOKEN>" https://rasiastro.com/api/health
   ```
   Every check should be `ok: true` and `checkoutAvailable: true`.

## 9. Test everything with a sandbox payment (on a Preview deployment)

1. Open the Preview URL (Vercel shows it), place an order, and pay on Cashfree's test
   page using Cashfree's published **test** UPI IDs / cards (see Cashfree docs, "Test data").
2. Confirm: the order page moves through *Payment confirmed → … → Emailing*, the report
   opens, the PDF downloads and looks right, the email arrives with a working link.
3. In Cashfree's dashboard, check the webhook delivery shows HTTP 200.
4. Try: cancelling on the payment page (order shows "cancelled" and lets you retry);
   *Find my report* with your email (a fresh link arrives); opening the report link in a
   private window after copying only the address bar (it must NOT open).
5. Run `npm run ops:status` locally against the same database (same `DATABASE_URL`) to
   see the orders.
6. Only then switch the **Production** environment to live Cashfree keys and make one
   real ₹49 purchase yourself. Refund it from the Cashfree dashboard to practise refunds.

## Where every setting goes

| Setting | Service | `.env.local` | Vercel |
| --- | --- | --- | --- |
| `DATABASE_URL` | Supabase | yes (for scripts) | yes |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase | yes (for scripts) | yes |
| `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV` | Cashfree | for testing | yes (sandbox in Preview, production in Production) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI | optional | yes |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` | Resend | optional | yes |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest | no | yes (integration can add them) |
| `APP_MODE`, `PUBLIC_SITE_URL`, `APP_SECRET`, `HEALTH_CHECK_TOKEN` | - | demo values | live values |
| `BUSINESS_*`, `GRIEVANCE_OFFICER_NAME` | - | optional | yes |

## If something does not work

- Run `npm run config:check` - it names the missing or wrong setting.
- `https://<site>/api/health` with the token shows which check fails.
- Orders stuck or failed: see docs/OPERATIONS.md.
