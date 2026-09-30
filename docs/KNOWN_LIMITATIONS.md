# Known limitations and unverified parts

Honest list of what is not done, not verified, or deliberately simple. Updated 29 September 2026
(compatibility reports, sandbox mode and the redesign). The launch status is in LAUNCH_CHECKLIST.md.

## Not yet verified with real accounts

These are implemented against the providers' official documentation and covered by
automated tests with fakes, but have **not** been exercised against the real services
because no credentials were available during development:

- **Cashfree** order creation, hosted checkout redirect, real webhooks (signature format,
  `x-idempotency-key` header) and status lookups. Test in sandbox before launch (SETUP.md §7).
- **OpenAI** report generation with a real model: prose quality in each language, token
  usage, latency and cost per report, for personal reports and each compatibility
  category. Read several real reports per language first.
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
- The personal Western report has no chart wheel diagram (tables only); Indian reports
  include fixed-sign (South Indian style) and house-based (North Indian style) diagrams.
  Western compatibility reports include a two-ring wheel.
- Divisional charts (Navamsa D9 and others) are not calculated.
- Timelines are relative to the payment date and look about two years ahead.
- Historical time zones follow the IANA tz database bundled with Node.js. Before 1970 some
  regions' local practices may differ from tz data; very old or unusual records should be
  double-checked.

## Compatibility reports

- No compatibility score or points total (Ashtakoota/porutham) is given, by design: the
  traditional totals assume bride/groom roles. Individual traditional factors (Moon-sign
  relationship, Tara, Gana, Graha Maitri; Yoni and Nadi for romantic categories) are shown
  with their certainty. Rajju, Vedha, Mahendra and Stree Deergha are not calculated.
- Western compatibility uses cross-chart aspects for the seven classical planets and the
  Ascendant (only with an exact birth time), house overlays (only when the receiving
  chart's time is exact) and element balance. Composite and Davison charts are not built.
- When a birth time is unknown, aspect orbs are shown as approximate ("≈") from the middle
  of the possible range, and factors that could change during the day are shown as
  possibilities.
- Names are masked in notes before they reach the AI by matching the names exactly as
  typed; nicknames or other spellings in notes are not detected.

## Language and content

- Report labels, chart names and emails in Tamil, Hindi, Telugu, Kannada and Malayalam
  were drafted without native-speaker review (`translationReview: "pending"` in
  `src/config/languages.ts`). The website interface itself is English only.
- AI output is validated for structure, ids, lengths, question count and script, not for
  astrological soundness or tone. Safety rules are in the prompt; spot-check reports.
- Demo mode shows placeholder text, not a real interpretation (clearly labelled).
- Policy pages are careful drafts, not legal advice; business details must be filled in
  and a lawyer should review them (docs/LEGAL_READINESS.md).
- Regional perspectives exist for Tamil, Kannada and Hindi (Janma Kundali). Telugu and
  Malayalam are report languages without a dedicated regional perspective.
- The public sample report was removed; there are no sample previews on the site.

## Scale and operations (see ARCHITECTURE.md)

- Designed for a small launch. No load testing was done; no claims are made about
  thousands of simultaneous customers.
- Rate limiting uses Postgres counters (fine for launch; move to Redis if it gets busy).
- Birthplace search uses a prefix search on names; spelling mistakes are not corrected.
- There is no admin dashboard: operations are owner-run commands.
- Refunds are made in the Cashfree dashboard, not in the app.
- Local demo mode uses PGlite, which allows one process at a time: stop `npm run dev`
  before running scripts against the local demo database.
