# Rasi Astro - engineering guide

Rasi Astro (rasiastro.com) sells personalised astrology reports. Two products:

- **Personal report** (₹49; +₹20 for three questions = ₹69): one person, one tradition
  (Indian/Vedic or Western), one report language.
- **Compatibility report** (₹39 for the pair): exactly two people, one connection
  category (relationship, marriage, friendship, career & teamwork, business partnership,
  family), one tradition, one language. No question add-on.

Customers pay through the provider in `PAYMENT_PROVIDER` (now UroRelay UPI; Cashfree and the
UroPay Merchant API are also implemented, see docs/PAYMENTS.md) and receive a web report + PDF
by private email link.
**There are no customer accounts.** Positioning: "Centuries of tradition. Calculated by
machines. Interpreted for you."

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
| `npm run places:import` | Import the GeoNames gazetteer (required for sandbox and live) |
| `npm run storage:setup` | Create the private Supabase bucket |
| `npm run verify:pdf` | Render personal + compatibility PDFs per language, check fonts/text/footer, save page images |
| `npm run images:build` | Build homepage artwork derivatives + manifest from `assets-src/` |
| `npm run fonts:copy` / `fonts:subset` | Copy font files from packages / subset display fonts to the glyphs used |
| `npm run export:xlsx` | Owner Excel export to `exports/` |
| `npm run ops:status` / `ops:reconcile` / `ops:retry-report` / `ops:resend-email` / `ops:delete-order` / `ops:purge` / `ops:privacy-export` | Owner operations (see docs/OPERATIONS.md) |

Scripts that open the local demo database need the dev server stopped (PGlite is
single-process). On Windows Git Bash, prefix commands that take `/paths` as arguments
with `MSYS_NO_PATHCONV=1` (dev helpers in `scripts/lib/`).

## Architecture (modular monolith)

```
src/config/        central, non-secret configuration (pricing, languages, compatibility
                   categories, regional terms, site, artwork)
src/content/       customer-facing marketing copy (claims must match docs/CLAIMS.md)
src/domain/        pure business rules shared by server and browser - no I/O
src/i18n/          report/email dictionaries for ta, en, hi, te, kn, ml (pair.ts: compatibility)
src/server/        server-only code (never import from *.client.tsx - ESLint enforces this)
  config/          env parsing (zod) + readiness: providers, per-product checks, site state
  db/              Database interface; postgres.js (Supabase) and PGlite (demo/tests); migrator
  places/          gazetteer search, demo places, GeoNames parser
  orders/          order creation (both products), birth resolution, status view
  payments/        provider interface; UroRelay, UroPay Merchant API, Cashfree and demo adapters;
                   registry (each attempt uses the provider/environment that created it); state machine
  astrology/       chart engine (astronomy-engine, MIT) + compatibility.ts (pair analysis)
  interpretation/  AI boundary: schemas, versioned prompts, validation, OpenAI + demo providers
  reports/         report documents, renderers (personal + pair), SVG charts, PDF
  jobs/            outbox, dispatch, pipeline steps, Inngest functions, local demo runner
  delivery/        email providers, templates, delivery + recovery
  access/ storage/ exports/ ops/
src/app/           pages and API route handlers (thin: validate, authorise, call services)
src/components/    UI; files named *.client.tsx are client components
db/migrations/     versioned SQL (append-only; applied migrations are checksummed)
assets-src/        original artwork (derivatives in public/art/)
scripts/           owner CLI scripts (tsx); scripts/lib has dev helpers (screenshots, journeys)
tests/             Vitest
```

### Order lifecycle (both products)
1. Preview: `POST /api/orders/preview` or `/api/compatibility/orders/preview` validates and
   resolves each person's birth moment (own place, own historical time zone).
2. Create: `POST /api/orders` or `/api/compatibility/orders`: inputs frozen, server-computed
   price snapshot, participants stored as `birth_details` rows 1 (and 2), access token
   issued as an HttpOnly cookie. Changes later = a new order.
3. `POST /api/orders/:id/checkout` creates (or reuses) a provider order for the stored amount
   (UroRelay: a UPI QR shown on our order page; the customer then submits the UPI reference).
4. Payment evidence (signed webhook, or authenticated status lookup on return / by the
   sweeper) goes through `applyPaymentEvidence`: ONE transaction marks paid, creates
   `report_jobs` + an `outbox` row. Then the outbox is dispatched (Inngest or local runner).
5. Pipeline steps, each idempotent and skipping stored work: calculate (one chart; or two
   charts + `compatibility_analyses`) -> three AI parts (`core/timeline/synthesis` or
   `pair_core/pair_dynamics/pair_synthesis`) -> assemble -> render_pdf -> finalize.
6. finalize marks ready and enqueues delivery; delivery emails a fresh link
   (`/access#t=TOKEN` - token in the URL fragment, never sent to servers).

## Business invariants (do not break)

- **Prices** live only in `src/config/pricing.ts` (4900 / 2000 / 3900 paise; totals 4900,
  6900, 3900). Integer paise everywhere. The server computes the price; nothing
  price-related is read from requests. Orders store a price snapshot + `pricing_version`.
- One order = one product + one tradition + one language. Questions only for
  `report_with_questions` (validated on input AND enforced in the pipeline). A
  compatibility order has exactly two participants (tuple schema; the DB allows only
  participants 1 and 2; the pipeline refuses any other count).
- **Payment truth** comes only from verified server-side evidence. Amount, currency and
  provider order id must match the snapshot. A paid order never moves backwards.
- Payment confirmation and job creation are atomic (outbox). No fire-and-forget promises;
  never run generation inside a request. Every step idempotent; retries bounded and
  within the 300 s step limit; retrying never charges again or repeats paid AI calls.
- **Chart facts come only from the calculation layer.** Unknown/approximate birth times
  produce `Fact` values with status `uncertain`/`omitted`, per person, never a guess.
- **No compatibility scores or percentages**, no verdicts on marrying/separating/hiring,
  no gender or role assumptions; Yoni/Nadi only for romantic categories.
- Customer text is untrusted data: only in the prompt's JSON payload. No name, email,
  phone, birthplace or payment data is sent to the AI; names inside notes are masked
  (`maskNames`). The AI refers to people only as {{A}}/{{B}}.
- Regional perspectives (Tamil, Kannada, Hindi/Janma Kundali; key `north_indian` kept
  for stored reports) are presentation perspectives over ONE chart. Never describe them
  as separate sciences, and never claim Telugu/Malayalam perspectives exist.
- Marketing: every claim must be in docs/CLAIMS.md; never name the AI model/provider in
  marketing; no human-review, astrologer-equivalence, fake counts, urgency or guarantees.
- Access: an order reference or email NEVER grants access; only a 256-bit token (stored
  hashed, expiring). Unauthorised = "not found". Recovery responses identical.
- **Payments**: a UroRelay payment is paid only when UroPay reports COMPLETED and a signed
  bank-SMS report matches the UTR and amount; UTR_SUBMITTED / REVIEW_REQUIRED never pay.
  Anything unproven goes to the owner in /admin. Never add a path that pays on a typed reference.
- **Database**: production migrations run automatically in `vercel-build` (scripts/deploy-prepare.ts).
- **Modes**: demo (simulated), sandbox (real services, provider test mode), live (real money).
  Demo and sandbox are refused on rasiastro.com; a hosted site must set `APP_MODE`
  explicitly. `getSiteState()` is the single source for the banner and order buttons;
  each product has its own switch.
- Age policy: purchaser and every subject 18+. Children's data is not supported.
- A language is sold only if `enabled` in `src/config/languages.ts` AND `npm run verify:pdf` passes.
- Policies state only what the system does (retention, timings come from env).

## Standards

- Strict TypeScript (`noUncheckedIndexedAccess`), small cohesive modules, explicit interfaces.
- Server-side validation (zod) and authorisation for every sensitive operation.
- SQL: parameters with explicit casts (`$1::uuid`); select `date`/`time` as text, counts
  as `::int` (keeps postgres.js and PGlite identical).
- Migrations are append-only and backward compatible. Every new table:
  `enable row level security` (no policies) and revoke anon/authenticated.
- No secrets in code, logs, browser bundles or screenshots; no `NEXT_PUBLIC_` variables.
  Use `log` from `src/server/log.ts`; never log tokens, emails, phones, birth data or report text.
- Report HTML is built with the auto-escaping `html` template in `src/server/reports/html.ts`.
- UI: design tokens in `src/app/globals.css`; motion 150-250 ms for controls,
  300-500 ms for content; respect reduced motion; content must be visible without JS
  (reveals only hide under `html.js`). Indic text: no letter-spacing, generous line height.
- Bump versions when behaviour changes: `PRICING_VERSION`, `CALCULATION_VERSION`,
  `PAIR_CALCULATION_VERSION`, `PROMPT_VERSION`, `PAIR_PROMPT_VERSION`,
  `REPORT_SCHEMA_VERSION`, `PAIR_REPORT_SCHEMA_VERSION`, `CONSENT_VERSION`.
- Never describe scaffolding, mocks or untested code as production-ready.
- Before committing: `npm run check`. For PDF/font changes also `npm run verify:pdf`.
