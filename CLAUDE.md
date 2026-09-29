# Rasi Astro - engineering guide

Rasi Astro (rasiastro.com, "Your stars, your story.") sells personalised astrology
reports: a customer enters birth details, picks a tradition (Indian/Vedic or Western)
and a report language, optionally buys three questions, pays through Cashfree, and
receives a web report + PDF by secure email link. **There are no customer accounts.**

Read this file before changing anything. The owner is not a programmer: keep the
system simple, honest and well documented.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 (demo mode by default) |
| `npm run dev:inngest` | Local Inngest dev server (only when testing `JOB_RUNNER=inngest`) |
| `npm run check` | Lint + type check + all tests (run before every commit) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Vitest suite (in-memory Postgres via PGlite; PDF tests need local Chrome/Edge) |
| `npm run config:check` | Validate config and test each account read-only (no secrets printed) |
| `npm run db:migrate` | Apply `db/migrations/*.sql` (DATABASE_URL, else local `.data/pglite`) |
| `npm run places:import` | Import the GeoNames gazetteer (required for live) |
| `npm run storage:setup` | Create the private Supabase bucket |
| `npm run verify:pdf` | Render a PDF per language, check fonts/text layer, save page images |
| `npm run samples:build` | Rebuild `public/samples/rasi-astro-sample-report-en.pdf` |
| `npm run export:xlsx` | Owner Excel export to `exports/` |
| `npm run ops:status` / `ops:reconcile` / `ops:retry-report` / `ops:resend-email` / `ops:delete-order` / `ops:purge` | Owner operations (see docs/OPERATIONS.md) |

Scripts that open the local demo database need the dev server stopped (PGlite is
single-process; a lock file enforces this). With `DATABASE_URL` set they run any time.

## Architecture (modular monolith)

One Next.js App Router application. Boundaries:

```
src/config/        central, non-secret configuration (pricing, languages, site, hero media)
src/domain/        pure business rules shared by server and browser (pricing, input schema,
                   birth-time resolution, chart types, status types) - no I/O
src/i18n/          report/email dictionaries for ta, en, hi, te, kn, ml
src/server/        server-only code (never import from *.client.tsx - ESLint enforces this)
  config/          env parsing (zod) + readiness (which providers, may we take money?)
  db/              Database interface; postgres.js (Supabase) and PGlite (demo/tests); migrator
  places/          gazetteer search, demo places, GeoNames parser
  orders/          order creation (frozen inputs, price snapshot), birth resolution, status view
  payments/        provider interface, Cashfree adapter, demo adapter, state machine
  astrology/       chart calculation (built-in engine on astronomy-engine, MIT)
  interpretation/  AI boundary: schema, versioned prompt, validation, OpenAI + demo providers
  reports/         report document, periods, discrepancies, HTML/SVG renderer, PDF, sample
  jobs/            outbox, dispatch, pipeline steps, Inngest functions, local demo runner
  delivery/        email providers (Resend / demo file), templates, delivery + recovery
  access/          hashed expiring access tokens
  storage/         private file storage (Supabase / local disk)
  exports/         owner .xlsx export
  ops/             health, alerts, retention
src/app/           pages and API route handlers (thin: validate, authorise, call services)
src/components/    UI; files named *.client.tsx are client components
db/migrations/     versioned SQL (append-only; applied migrations are checksummed)
scripts/           owner CLI scripts (tsx); scripts/lib has dev helpers
tests/             Vitest
```

Request -> service -> repository/provider. Providers sit behind interfaces
(`PaymentProvider`, `CalculationProvider`, `InterpretationProvider`, `EmailProvider`,
`StorageProvider`) so a vendor can be replaced without touching business logic.

### Order lifecycle
1. `POST /api/orders/preview` validates everything and resolves the birth moment.
2. `POST /api/orders` creates the order: inputs frozen, server-computed price snapshot,
   access token issued as an HttpOnly cookie. Changes later = a new order.
3. `POST /api/orders/:id/checkout` creates (or reuses) a Cashfree order for the stored
   amount; the browser opens Cashfree hosted checkout.
4. Payment evidence (signed webhook, or authenticated status lookup on return / by the
   sweeper) goes through `applyPaymentEvidence` - ONE transaction marks paid, creates
   `report_jobs` + an `outbox` row. Then the outbox is dispatched (Inngest event or local runner).
5. Pipeline steps (each idempotent, each skips stored work): calculate -> interpret_core ->
   interpret_timeline -> interpret_synthesis -> assemble -> render_pdf -> finalize.
6. finalize marks ready and enqueues delivery; delivery emails a fresh link
   (`/access#t=TOKEN` - token in the URL fragment, never sent to servers).

## Business invariants (do not break)

- **Prices** live only in `src/config/pricing.ts`: report INR 49 (4900 paise); add-on of
  THREE questions INR 20 in total (2000); totals 4900 / 6900. Integer paise everywhere.
  The server computes the price; nothing price-related is read from requests. Orders
  store a price snapshot + `pricing_version`. The PDF is always included.
- One order = one tradition + one language. Questions are answered only when the
  package is `report_with_questions` (validated on input AND enforced in the pipeline).
- **Payment truth** comes only from verified server-side evidence. Never trust the
  browser redirect. Amount, currency and provider order id must match the snapshot.
  A paid order never moves backwards. Duplicates/mismatches -> `needs_review` + alert.
- Payment confirmation and job creation are atomic (outbox pattern). Never add
  fire-and-forget promises; never run generation inside the checkout request.
- Every pipeline step must be idempotent and must not repeat paid AI calls. Retries
  are bounded. Retrying never charges the customer again.
- **Chart facts come only from the calculation layer.** The AI interprets; it never
  produces positions. Unknown/approximate birth times produce `Fact` values with status
  `uncertain`/`omitted` - never a silent noon or a guessed value.
- Customer-supplied chart details are unverified context: shown, compared, never used
  to override calculations.
- Customer text (notes, questions) is untrusted data: it goes only in the JSON payload of
  the prompt, never in instructions. No name, email, phone, birthplace or payment data
  is sent to the AI.
- Regional perspectives (Tamil, Kannada, North Indian) are presentation/interpretation
  perspectives over ONE calculated chart. Never describe them as separate sciences.
- No fake reviews, counts, endorsements, urgency or accuracy guarantees. Astrology is
  described as interpretive, not scientifically validated.
- Access: an order reference or email NEVER grants access; only a 256-bit token (stored
  hashed, expiring). Unauthorised = "not found". Recovery responses are identical
  whether or not the email matched.
- Demo adapters never run in live mode, and demo mode is refused on the production
  deployment (`isProductionDeployment`). Missing live config disables checkout.
- A language is sold only if `enabled` in `src/config/languages.ts` AND `npm run verify:pdf`
  passes for it.

## Standards

- Strict TypeScript (`noUncheckedIndexedAccess`), small cohesive modules, explicit interfaces.
- Presentation, business rules, persistence and providers stay separate.
- Server-side validation (zod) and authorisation for every sensitive operation.
- SQL: parameters are strings/numbers/booleans/null with explicit casts (`$1::uuid`);
  select `date`/`time` as text, counts as `::int` (keeps postgres.js and PGlite identical).
- Migrations are append-only. Every new table: `enable row level security` (no policies)
  so Supabase's public API roles can read nothing.
- No secrets in code, logs, browser bundles or screenshots. No `NEXT_PUBLIC_` secrets
  (there are no NEXT_PUBLIC variables at all). Use `log` from `src/server/log.ts`
  (it redacts); never log tokens, emails, phones, birth data or report text.
- Report HTML is built with the auto-escaping `html` template in `src/server/reports/html.ts`.
- Bump versions when behaviour changes: `PRICING_VERSION`, `CALCULATION_VERSION`,
  `PROMPT_VERSION`, `REPORT_SCHEMA_VERSION`, `CONSENT_VERSION`.
- Comments explain *why* and non-obvious constraints, not what the code says.
- Never describe scaffolding, mocks or untested code as production-ready.
- Before committing: `npm run check`. For PDF/font changes also `npm run verify:pdf`.
