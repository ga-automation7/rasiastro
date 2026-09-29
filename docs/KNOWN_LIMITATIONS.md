# Known limitations and unverified parts

Honest list of what is not done, not verified, or deliberately simple in version 1.

## Not yet verified with real accounts

These are implemented against the providers' official documentation and covered by
automated tests with fakes, but have **not** been exercised against the real services
because no credentials were available during development:

- **Cashfree** order creation, hosted checkout redirect, real webhooks (signature format,
  `x-idempotency-key` header) and status lookups. Test in sandbox before launch (SETUP.md §9).
- **OpenAI** report generation with a real model: prose quality in each language, token
  usage, latency and cost per report. Read several real reports per language first.
- **Resend** delivery (domain verification, inbox placement, spam filtering).
- **Supabase** Postgres (through the transaction pooler) and Storage (signed URLs).
  The same SQL was tested on PGlite (real PostgreSQL 17 compiled to WebAssembly).
- **Inngest** cloud execution, cron schedules and failure handlers.
- **Serverless PDF rendering** (`@sparticuz/chromium` on Vercel). PDFs were verified
  locally with Microsoft Edge 154 for all six languages; the Vercel Chromium build must be
  checked after the first deployment (place a sandbox order and open the PDF).

## Astrology calculations

- Positions come from Astronomy Engine (MIT licence, about ±1 arcminute), with our own
  implementation of the Lahiri ayanamsa, Placidus/Porphyry/whole-sign houses, mean nodes,
  Vimshottari dasha, tithi, sunrise weekday and Tamil/amanta/purnimanta months. Tests check
  them against published reference values (Meeus examples, Lahiri J2000, a London table of
  houses, known calendar facts), **but they have not been cross-checked chart-by-chart
  against commercial software** (e.g. Jagannatha Hora, Swiss Ephemeris-based tools).
  Before launch compare 10-20 charts, including ones near sign/nakshatra boundaries.
- Small, documented differences from other software are expected: mean vs true Rahu,
  365.25-day vs 360-day dasha years, the Tamil month-start day (sunrise rules), and
  aspect orbs.
- Kshaya (lost) lunar months are not handled (extremely rare). Adhika months are.
- The panchanga yoga is calculated but not shown in reports; karana is not calculated.
- The Western report has no chart wheel diagram (tables only); Indian reports include
  South and North Indian chart diagrams.
- Timelines are relative to the payment date and look about two years ahead.
- Historical time zones follow the IANA tz database bundled with Node.js. Before 1970 some
  regions' local practices may differ from tz data; very old or unusual records should be
  double-checked.

## Language and content

- Report labels, chart names and emails in Tamil, Hindi, Telugu, Kannada and Malayalam
  were drafted without native-speaker review (`translationReview: "pending"` in
  `src/config/languages.ts`). The website interface itself is English only.
- AI output is validated for structure, ids, lengths, question count and script, not for
  astrological soundness or tone. Safety rules are in the prompt; spot-check reports.
- Demo mode shows placeholder text, not a real interpretation (clearly labelled).
- Policy pages are sensible drafts, not legal advice; business details must be filled in.

## Scale and operations (see ARCHITECTURE.md)

- Designed for a small launch. No load testing was done; no claims are made about
  thousands of simultaneous customers.
- Rate limiting uses Postgres counters (fine for launch; move to Redis if it gets busy).
- Birthplace search uses a prefix search on names; spelling mistakes are not corrected.
- There is no admin dashboard: operations are owner-run commands.
- Refunds are made in the Cashfree dashboard, not in the app.
- Local demo mode uses PGlite, which allows one process at a time: stop `npm run dev`
  before running scripts against the local demo database.
