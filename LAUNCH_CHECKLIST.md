# Rasi Astro launch checklist

Status as of 29 September 2026. "Verified" means it was actually run and observed on
this date, locally, as described. Nothing here has been tested against real Cashfree,
OpenAI, Resend, Supabase, Inngest or Vercel accounts, because no credentials were
available. Passing local tests with simulated providers does not prove the live
integrations work.

## 1. Verified complete (locally, with evidence)

| Item | How it was verified |
| --- | --- |
| Lint, type check | `npm run lint`, `npm run typecheck`: no errors |
| Automated tests | `npm test`: 123 tests in 14 files passed |
| Production build | `npm run build`: succeeded, all routes compiled |
| Prices ₹49 / ₹69 / ₹39, computed on the server; browser-sent amounts ignored | tests `pricing`, `compatibility` |
| Questions answered only when bought; none for compatibility | tests `pipeline`, `compatibility` |
| Exactly two compatibility participants; separate birthplace, historical time zone, time certainty and notes per person | test `compatibility` + demo journey (Chennai exact time, New York unknown time) |
| Category changes analysis and AI brief; Yoni/Nadi only for relationship/marriage; no scores or percentages accepted | test `compatibility` |
| Names, email, phone and birthplaces never sent to the AI (also masked inside notes) | tests `pipeline`, `compatibility` |
| Reopening a report never calls the AI again | test `compatibility` |
| Payment: invalid/duplicate webhooks, amount mismatch → review, reconciliation of missed webhooks | test `payments` |
| Interrupted dispatch, AI timeout, malformed AI output, email failure after a ready report | test `pipeline` |
| Unauthorised report/PDF access refused; recovery responses identical | tests `access` + journeys (stranger browser: no report, PDF 404) |
| Demo and sandbox refused on rasiastro.com; hosted site without `APP_MODE` stays closed; banner and order buttons never contradict | test `demo-isolation` |
| Birthplace search: sandbox/live never offer demo places; ordering closed without the gazetteer | test `places` |
| Migration 0002 on an existing order: becomes personal, participant 1, amounts unchanged | test `compatibility`; also applied to the existing local demo database |
| Excel export: products, categories, both participants, shared context, cost by product, formula-injection safe, Unicode | tests `xlsx`, `compatibility` |
| PDFs: personal and compatibility in Tamil, English, Hindi, Telugu, Kannada, Malayalam, plus Western compatibility; correct script font embedded, selectable text, rasiastro.com footer with page numbers | `npm run verify:pdf` (13 PDFs passed) and page images inspected |
| Full demo journeys in a real browser: personal (Western, approximate time, Hindi, 3 questions) and compatibility (Indian, friendship, Tamil) | `scripts/lib/journey.ts`, no console errors |
| Layout at 360, 390, 768 and 1440 px: no horizontal overflow, no console errors | `scripts/lib/screenshots.ts` on home, compatibility, start, policies, recover |
| Reduced motion and no-JavaScript: all content visible | screenshots with `--reduced-motion` and `--no-js` |

## 2. Implemented but not externally verified

- Cashfree order creation, hosted checkout, webhook signature check and status lookup against real sandbox and production accounts.
- OpenAI structured output with your chosen model, in all six languages and all six compatibility categories (quality and cost per report).
- Resend delivery from `rasiastro.com`, including inbox placement.
- Supabase private bucket, short-lived signed PDF links, and PostgreSQL through the transaction pooler.
- Inngest on Vercel: function sync, per-product concurrency, 10-minute sweeper, daily retention.
- Serverless Chromium PDF rendering on Vercel (tested only with local Edge).
- GeoNames import into Supabase.
- Owner alert emails.
- Real delivery times (the 30-minute / 24-hour figures shown to customers are defaults until measured).

## 3. Waiting for your account actions

Entering keys does not do any of these. Each is a step in SETUP.md.

1. Create two Supabase projects (test and live, Mumbai), then run the bootstrap commands (VERCEL_SETUP.md §6).
2. Confirm Supabase backups on the live project's plan.
3. Cashfree: complete KYC and activation; get sandbox keys now and production keys after approval; approve or whitelist `rasiastro.com` if Cashfree asks.
4. Add Cashfree webhooks for the test site and later for rasiastro.com (VERCEL_SETUP.md §7).
5. OpenAI: enable billing, create a key, set a spending limit, pick a model with `npm run config:check`.
6. Inngest: create an account and install the Vercel integration.
7. Resend: add `rasiastro.com`, add its DNS records at GoDaddy, and wait for "Verified".
8. Set up a working support mailbox (and a phone number you answer).
9. Vercel: upgrade to Pro for the live shop; enter environment variables (VERCEL_SETUP.md §4).
10. Attach `rasiastro.com` in Vercel and add the DNS records Vercel shows at GoDaddy.

## 4. Blocking a paid launch

- [ ] Business details decided and entered: legal name, address, registration, support phone, named Grievance Officer (the live site refuses to open without them).
- [ ] GST position confirmed with an accountant.
- [ ] Professional legal review of the five policy pages (see docs/LEGAL_READINESS.md open questions).
- [ ] Vercel Pro plan (Hobby does not allow commercial use).
- [ ] Complete sandbox run on the test site: personal and compatibility orders, webhook HTTP 200, email received, PDF opens (SETUP.md §7).
- [ ] Real AI reports reviewed in every language you sell, with native speakers checking the fixed labels in `src/i18n` (marked `translationReview: "pending"` in `src/config/languages.ts`). Disable a language until it passes.
- [ ] Delivery times measured in sandbox and entered (`DELIVERY_TYPICAL_MINUTES`, `DELIVERY_MAX_HOURS`).
- [ ] An owner routine for complaints (acknowledge within 48 hours) and privacy requests (docs/OPERATIONS.md).
- [ ] The final real-payment test below, passed.

## 5. Final real-payment test (you run this, after approval)

Do this once on rasiastro.com in live mode, with your own card or UPI. Nobody else
should run it for you.

1. `npm run config:check` with live values: all ticks, both products AVAILABLE.
2. On rasiastro.com, buy a **₹49** personal report for yourself.
3. Cashfree dashboard: the payment shows ₹49.00, SUCCESS; the webhook delivery shows HTTP 200.
4. The order page shows each stage, then "Your report is ready"; the report opens.
5. "Download PDF" opens the PDF; it opens only from your browser (copy the page address into a private window: it must not open).
6. The email arrives from reports@rasiastro.com with a working link.
7. `npm run ops:status` shows no problems; `npm run export:xlsx` shows exactly one paid order, one report, one participant.
8. In Supabase Storage, the `reports` bucket is private and contains exactly one PDF for the order.
9. Refund the payment from the Cashfree dashboard to practise the refund flow; note how long it takes.
