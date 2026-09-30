# Vercel setup for Rasi Astro

The one reference for hosting Rasi Astro on Vercel: plan, settings, every environment
variable, and the order to do things in. Written for a non-programmer owner.

> Setting environment variables does **not** by itself create accounts, verify
> domains, register webhooks or approve anything with a provider. Those are the
> separate account actions listed in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

Last checked against the official Vercel, Inngest, UroPay (UroRelay and Merchant API)
and Cashfree documentation on 30 September 2026.

**Current project:** `rasiastro` in the Vercel team **GA Automations** (Hobby plan).
Pushing to the `main` branch on GitHub deploys to production automatically.
`rasiastro.com` redirects to `www.rasiastro.com`, so provider webhooks must use the
`www` address (webhooks do not reliably follow redirects).

---

## 1. Plan: a paid shop needs Vercel Pro

- Vercel's own documentation says the free **Hobby plan is restricted to
  non-commercial, personal use only** (vercel.com/docs/plans/hobby). Rasi Astro takes
  payments, so the live shop needs **Vercel Pro** (USD 20 per developer seat per month,
  plus taxes, at the time of checking). A Hobby project is fine for a private test.
- Function time limit: 300 seconds per call by default on both plans (Pro can raise it
  to 800 s). Report generation fits inside this because every step (chart, each AI
  part, PDF) runs as a separate call through Inngest; `src/app/api/inngest/route.ts`
  sets `maxDuration = 300`.
- Region: `vercel.json` pins functions to Mumbai (`bom1`), close to Indian customers
  and to a Supabase project in Mumbai.
- "Protection Bypass for Automation" (needed only if you protect deployments that
  Inngest must reach) requires Pro.
- Image optimisation: Hobby includes 5,000 image transformations per month; Pro is
  billed by usage. The homepage uses three artwork files, so usage is small.

## 2. How the site decides what it may do

| `APP_MODE` | Payments | AI, email, storage, jobs | Allowed on rasiastro.com? | Banner |
| --- | --- | --- | --- | --- |
| `demo` | simulated | sample text; hosted demo still needs Supabase | No | "Explore a sample journey…" |
| `sandbox` | the payment provider's **test** environment, no real money | all real | No | "Test site…" |
| `live` | real money | all real | Yes (required there) | none |

If anything required is missing, the site shows **one** message ("Online ordering is not
open yet") and no order form. A hosted site with no `APP_MODE` set also stays closed:
it never silently falls back to demo. Existing reports stay reachable in every state.

## 3. Recommended rollout

1. **Test site (sandbox).** Deploy to production on the project's `*.vercel.app`
   address with `APP_MODE=sandbox`, Cashfree **sandbox** keys and a **separate test
   Supabase project**. Place real test orders with Cashfree's test methods.
2. **Live.** Change the variables to live values (new Supabase project, Cashfree
   production keys, `APP_MODE=live`, `PUBLIC_SITE_URL=https://rasiastro.com`), attach
   `rasiastro.com`, redeploy, then do the one real-payment test in LAUNCH_CHECKLIST.md.

Keeping test and live data in different Supabase projects means test orders can never
mix with real customers' orders.

Once `rasiastro.com` is attached, Vercel reports it as the project's production
domain, and the app then treats that project's production deployments as the real
shop: demo and sandbox are refused there. Preview deployments are protected, so
Cashfree and Inngest cannot reach them without extra setup. For testing after launch,
the simplest route is a second Vercel project (for example `rasi-astro-test`) from the
same code, with sandbox values and its own test Supabase project.

## 4. Environment variables

Enter these in **Vercel > your project > Settings > Environment Variables**. Tick
**Production** for live values and **Preview** for test values. Never paste secret
values into chats, email or documents; type them only into the Vercel form (and your
private `.env.local` on your own computer).

**Every change needs a redeploy** (Deployments > the latest one > Redeploy): Vercel
only applies variables to new deployments. That is the same for every row below.

"Secret" means: anyone who sees it could take money, read customer data or send email
as you. None of these ever reach the browser (there are no `NEXT_PUBLIC_` variables).

### Core

| Variable | What it does | Where you get it | Secret | Required | Test (sandbox) value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_MODE` | Demo, sandbox or live behaviour (section 2) | You choose | No | Yes, on every hosted deployment | `sandbox` | `live` |
| `PUBLIC_SITE_URL` | Address used in email links and payment return links; never taken from the visitor's browser | Your site address | No | Yes | `https://<project>.vercel.app` | `https://rasiastro.com` |
| `APP_SECRET` | Protects rate-limit keys | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Yes | Yes | a random 64-character value | a **different** random value |
| `PERSONAL_ORDERS_ENABLED` | Switch personal-report ordering on/off | You choose | No | No (default `true`) | `true` | `true` |
| `COMPATIBILITY_ORDERS_ENABLED` | Switch compatibility ordering on/off | You choose | No | No (default `true`) | `true` | `true` |

### Database and storage (Supabase)

| Variable | What it does | Where you get it | Secret | Required | Test value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection | Supabase > Project > Connect > **Transaction pooler** (port 6543), with your database password | Yes | Yes | test project's string | live project's string |
| `STORAGE_PROVIDER` | Where PDFs are kept | Fixed | No | Yes | `supabase` | `supabase` |
| `SUPABASE_URL` | Your Supabase project address | Supabase > Project Settings > API > Project URL | No | Yes | test project URL | live project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for the private PDF bucket | Supabase > Project Settings > API > `service_role` / secret key | **Yes (very sensitive)** | Yes | test project key | live project key |
| `SUPABASE_REPORTS_BUCKET` | Bucket name | Default is fine | No | No (default `reports`) | `reports` | `reports` |

### Payments

Only the provider named in `PAYMENT_PROVIDER` is used for **new** checkouts. Every
payment attempt remembers its provider and environment, so after switching (for example
from UroRelay to Cashfree) older orders keep being checked through their original
provider. Keep the old provider's keys until its open orders are settled.

| Variable | What it does | Where you get it | Secret | Required | Test value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `PAYMENT_PROVIDER` | Provider for new checkouts | You choose: `urorelay`, `uropay` (Merchant API) or `cashfree` | No | Yes | `urorelay` | `urorelay` (now), `cashfree` (later) |
| `PAYMENT_ENV` | Must match `APP_MODE` | Fixed | No | Yes | `test` | `production` |
| `UROPAY_RELAY_API_KEY` | UroRelay API key | app.uropay.me > API Keys | Yes | With `urorelay` | your key | your key |
| `UROPAY_RELAY_API_SECRET` | UroRelay API secret; also verifies its webhooks | Same place (shown when you regenerate keys) | **Yes** | With `urorelay` | your secret | your secret |
| `UROPAY_TEST_API_KEY`, `UROPAY_TEST_API_SECRET` | UroPay **Merchant API** test keys (a different product) | dashboard.uropay.me | **Yes** | With `uropay` | test keys | |
| `UROPAY_LIVE_API_KEY`, `UROPAY_LIVE_API_SECRET` | UroPay Merchant API production keys (need KYC) | Same | **Yes** | With `uropay` | | live keys |
| `CASHFREE_TEST_CLIENT_ID`, `CASHFREE_TEST_CLIENT_SECRET` | Cashfree sandbox keys | Cashfree Merchant Dashboard (Test) > Developers > API Keys | **Yes** | With `cashfree` | sandbox keys | |
| `CASHFREE_LIVE_CLIENT_ID`, `CASHFREE_LIVE_CLIENT_SECRET` | Cashfree production keys | Same, Live mode | **Yes** | With `cashfree` | | live keys |
| `CASHFREE_API_VERSION` | API version the code uses | Leave as is | No | No (default `2026-01-01`) | default | default |

Live payments are refused on Vercel Preview and Development deployments, whatever the
variables say. A deployment only reads the keys of its own environment.

### AI (OpenAI)

| Variable | What it does | Where you get it | Secret | Required | Test value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | Writes the interpretation | platform.openai.com > API keys (a project key with billing enabled) | **Yes** | Yes | a key (can be a separate test project) | live key |
| `OPENAI_MODEL` | Model name | Run `npm run config:check`; it lists models your key can use | No | Yes | chosen model | chosen model |
| `OPENAI_MODEL_COMPATIBILITY` | Optional different model for compatibility | Same | No | No | empty | empty or a model |
| `OPENAI_REASONING_EFFORT` | Only for reasoning models | OpenAI model docs | No | No | empty | empty |
| `AI_TIMEOUT_MS` | Time limit for one AI call; keep below 300000 | Default | No | No (default `240000`) | default | default |
| `AI_MAX_OUTPUT_TOKENS` | Size cap per report part | Default | No | No (default `16000`) | default | default |
| `AI_DAILY_TOKEN_BUDGET` | Cost safety cap per 24 h | You choose | No | No (default `4000000`) | default | set from expected volume |
| `AI_PRICE_INPUT_PER_MTOK_USD`, `AI_PRICE_OUTPUT_PER_MTOK_USD` | Cost estimates in the Excel export | Your model's price list | No | No | optional | recommended |

### Email (Resend) and contacts

| Variable | What it does | Where you get it | Secret | Required | Test value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Sends report and recovery emails | resend.com > API Keys (sending access) | **Yes** | Yes | a key | a key |
| `EMAIL_FROM` | Sender; must use your **verified** domain | Resend > Domains | No | Yes | `Rasi Astro <reports@rasiastro.com>` | same |
| `EMAIL_REPLY_TO` | Where replies go | Your mailbox | No | No (defaults to support) | optional | optional |
| `SUPPORT_EMAIL` | Shown on site, policies and emails | A real, monitored mailbox | No | Yes | your support address | your support address |
| `OWNER_ALERT_EMAIL` | Where failure alerts go | Your mailbox | No | Strongly recommended | your address | your address |

### Background jobs (Inngest)

| Variable | What it does | Where you get it | Secret | Required | Test value | Live value |
| --- | --- | --- | --- | --- | --- | --- |
| `JOB_RUNNER` | Durable jobs | Fixed | No | Yes | `inngest` | `inngest` |
| `INNGEST_EVENT_KEY` | Lets the app send job events | Added automatically by the **Inngest Vercel integration** | Yes | Yes | set by integration | set by integration |
| `INNGEST_SIGNING_KEY` | Lets the app verify Inngest's calls | Added automatically by the integration | **Yes** | Yes | set by integration | set by integration |
| `INNGEST_SERVE_ORIGIN` | Read by the Inngest SDK: tells Inngest to call your custom domain | You set it | No | Recommended | empty | `https://www.rasiastro.com` |
| `REPORT_CONCURRENCY` | Reports generated at once, per product | You choose | No | No (default `3`) | default | default |

### PDF

| Variable | What it does | Secret | Required | Value |
| --- | --- | --- | --- | --- |
| `PDF_BROWSER` | `auto` uses the bundled serverless Chromium on Vercel | No | No | `auto` |
| `CHROME_EXECUTABLE_PATH`, `PDF_BROWSER_WS_ENDPOINT` | Only for special setups; leave empty on Vercel | No / Yes | No | empty |

### Retention, service levels, business details

| Variable | What it does | Secret | Required | Value |
| --- | --- | --- | --- | --- |
| `ACCESS_LINK_TTL_DAYS` | Email link lifetime | No | No | `30` |
| `RETENTION_UNPAID_DAYS` | Delete abandoned unpaid orders | No | No | `14` |
| `RETENTION_REPORT_DAYS` | Erase personal data after payment | No | No | `400` (confirm with your accountant) |
| `DELIVERY_TYPICAL_MINUTES`, `DELIVERY_MAX_HOURS` | Shown in FAQ and Delivery Policy | No | No | set from measured sandbox times |
| `REFUND_INITIATION_WORKING_DAYS` | Shown in Refund Policy | No | No | a number you can keep |
| `HEALTH_CHECK_TOKEN` | Unlocks detailed `/api/health` | Yes | Recommended | random value |
| `LOG_LEVEL` | `debug` only while troubleshooting | No | No | empty |
| `BUSINESS_LEGAL_NAME` | Operator's legal name | No | **Live: yes** | exact legal name |
| `BUSINESS_ADDRESS` | Business address | No | **Live: yes** | full address |
| `BUSINESS_REGISTRATION` | e.g. Udyam, LLPIN or CIN | No | Recommended | as registered |
| `BUSINESS_GSTIN` | Only if GST-registered | No | No | GSTIN |
| `SUPPORT_PHONE` | Customer-care number | No | **Live: yes** | a number you answer |
| `GRIEVANCE_OFFICER_NAME` | Required disclosure | No | **Live: yes** | a named person |
| `GRIEVANCE_OFFICER_DESIGNATION`, `GRIEVANCE_OFFICER_EMAIL`, `GRIEVANCE_OFFICER_PHONE` | Grievance contact (email/phone default to support) | No | Recommended | |

### Owner dashboard

| Variable | What it does | Secret | Required | Value |
| --- | --- | --- | --- | --- |
| `ADMIN_EMAILS` | Who may sign in at `/admin` (comma separated). Empty = dashboard off | No | For the dashboard | your email |
| `ADMIN_SESSION_HOURS` | How long a sign-in lasts | No | No (default `12`) | `12` |

### Do not set these

- Set by Vercel automatically: `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`.
- Local-only: `LOCAL_DB_DIR`, `LOCAL_STORAGE_DIR`, `INNGEST_DEV`.
- Replaced (no longer read): `CASHFREE_ENV`, `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `UROPAY_PRODUCT`.
- Demo-only: `DEMO_USE_REAL_AI`, `DEMO_SEND_REAL_EMAIL`.

## 5. Settings in the Vercel dashboard

- **Settings > Functions**: leave defaults (the code sets its own limits). Fluid
  compute is on by default.
- **Settings > Deployment Protection**: keep preview deployments protected. Do **not**
  switch protection off to make callbacks work. Cashfree webhooks and Inngest must reach
  the deployment that is taking orders. For the recommended rollout that is a
  **production domain** (the `<project>.vercel.app` domain listed under Settings >
  Domains, and later rasiastro.com), which Vercel's Standard Protection leaves public
  while protecting previews and generated deployment URLs. Check by opening the address
  in a private browser window: it must load without a Vercel login. If you ever need
  Inngest on protected previews, use Vercel's "Protection Bypass for Automation" (Pro)
  and paste its secret into the Inngest integration's "Deployment protection key".
- **Integrations**: install the official **Inngest** integration and connect it to this
  project. It adds `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` and syncs the app on
  each deployment (the functions are served at `/api/inngest`).
- **Settings > Domains** (live only): add `rasiastro.com` and `www.rasiastro.com`.
  Vercel then shows the exact DNS records to enter at GoDaddy; copy them exactly.

## 6. Database: prepared automatically on every production deployment

You do not run database commands. `package.json` has a `vercel-build` script that runs
`scripts/deploy-prepare.ts` before each **Production** build:

1. Applies any new migration in `db/migrations/` (each once, in order, in its own
   transaction; applied ones are checksummed and never re-run; nothing is dropped).
   The runner creates its own `schema_migrations` table first, which is why
   `0001` cannot be pasted into the Supabase SQL editor on its own.
2. Imports the GeoNames birthplace list (about 150,000 places) the first time only.
3. Stops the deployment if the `reports` bucket is public.

Its lines start with `[deploy]` in the Vercel build log. Preview builds never touch a
database. While `APP_MODE` is not set, a database problem only produces a warning (the
site stays closed); once `APP_MODE` is set, it stops the deployment instead.

`npm run db:migrate`, `npm run places:import` and `npm run config:check` still work on
your computer with the values in `.env.local`, if you ever need them.

## 7. Webhooks

| Provider | Where | URL |
| --- | --- | --- |
| UroRelay | app.uropay.me > Webhooks | `https://www.rasiastro.com/api/webhooks/urorelay` |
| UroPay Merchant API | set per order by the app (no dashboard entry needed) | `https://www.rasiastro.com/api/webhooks/uropay` |
| Cashfree | Merchant Dashboard > Developers > Webhooks | `https://www.rasiastro.com/api/webhooks/cashfree` (events `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`, `PAYMENT_USER_DROPPED_WEBHOOK`) |

Every notification's signature is checked, and none of them marks an order paid on its
own: the app always asks the provider for the order's status itself (and every 10
minutes for open orders), so a lost notification is recovered and a forged one does
nothing. See [docs/PAYMENTS.md](docs/PAYMENTS.md) for how UroRelay confirmation works.

## 8. Deploy and roll back

Pushing to `main` on GitHub deploys to production automatically (Vercel's Git
integration). A failed build never replaces the live site.

```bash
npx vercel rollback
```

Instantly points production back at the previous deployment (or choose one in
Vercel > Deployments > … > Instant Rollback). Database migrations are additive, so the
previous version keeps working with the newer schema.
