# Security and operations checklist

Tick these before taking real payments, and review them every few months.

## Before launch

- [ ] `npm run check` passes and `npm run verify:pdf` passes for every enabled language.
- [ ] `npm run config:check` shows ✓ for every line with `APP_MODE=live`.
- [ ] `/api/health` (with token) shows `status: ok` and `checkoutAvailable: true` on the production URL.
- [ ] Production uses `CASHFREE_ENV=production`; Preview uses sandbox keys only.
- [ ] Cashfree webhook points to `https://rasiastro.com/api/webhooks/cashfree` and shows 200 deliveries.
- [ ] A real ₹49 test purchase and refund done end to end.
- [ ] Supabase: row-level security is ON for every table (Table editor shows "RLS enabled"); the `reports` bucket is **private**.
- [ ] The Supabase **service role / secret key** exists only in Vercel env vars and your `.env.local` - nowhere else.
- [ ] Resend domain verified (SPF/DKIM); support mailbox receives mail.
- [ ] Business details and grievance officer are filled in; policy pages reviewed by a lawyer.
- [ ] Translations reviewed by native speakers (Tamil, Hindi, Telugu, Kannada, Malayalam).
- [ ] At least one chart per tradition compared against established astrology software (see KNOWN_LIMITATIONS.md).
- [ ] OpenAI monthly spend limit set; `AI_DAILY_TOKEN_BUDGET` set to what you are willing to spend per day.
- [ ] Vercel on a plan that allows commercial use; spend alerts configured.
- [ ] Database backups confirmed (plan level) and a restore rehearsed once.
- [ ] Two-factor authentication ON for GitHub, Vercel, Supabase, Cashfree, OpenAI, Resend, Inngest and your domain registrar.
- [ ] `OWNER_ALERT_EMAIL` set and an uptime monitor on `/api/health`.

## How the app protects customers (already built)

- No accounts or passwords to steal. Report access needs a 256-bit random link token;
  only its SHA-256 hash is stored. Links expire (`ACCESS_LINK_TTL_DAYS`); recovery emails a
  fresh link and responds identically whether or not the email matched.
- Tokens travel in the URL **fragment** (`#t=`), which browsers never send to servers, so
  they cannot appear in server logs or Referer headers. They are then kept in an HttpOnly,
  SameSite cookie scoped to one order.
- Unauthorised requests for orders, reports and PDFs get "not found" - no enumeration.
  PDFs are in a private bucket; downloads use 60-second signed URLs after authorisation.
- Order pages and APIs send `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`,
  `Referrer-Policy: no-referrer`; robots.txt blocks them too.
- Prices are computed on the server; payment success requires a signature-verified
  webhook or an authenticated Cashfree lookup, matching amount, currency and order id.
- Duplicate/out-of-order webhooks are harmless (unique constraints, idempotent state
  machine, paid is final). Mismatches are held for review, never fulfilled.
- Rate limits (stored in the database) on place search, previews, orders, checkout,
  payment refresh, link exchange and recovery.
- Security headers: CSP, HSTS (production), X-Frame-Options DENY, nosniff, Permissions-Policy.
- Report HTML escapes all AI and customer text; PDF rendering blocks all network access.
- The AI receives no name, email, phone, birthplace or payment data (names typed inside
  notes are masked too); customer text is passed as data with explicit instructions not
  to follow it.
- Logs are structured JSON with automatic redaction of emails, phone numbers, tokens and
  personal fields.
- Excel exports neutralise formula injection and are created only by an owner-run
  command - there is no admin web page.
- Demo and sandbox modes are refused on the production domain; a hosted deployment without
  an explicit `APP_MODE` takes no orders; live mode refuses demo adapters and closes
  ordering if any required service is missing. Each product has its own on/off switch.
- Compatibility orders record the purchaser's confirmation that they have the other
  person's permission; privacy requests are handled with `npm run ops:privacy-export`
  and `npm run ops:delete-order` after verifying the requester's email.

## Incident basics

- **Suspected key leak:** rotate the key in that provider's dashboard immediately, update
  Vercel env vars, redeploy. For `APP_SECRET` just replace it (only affects rate-limit keys).
- **Suspected link leak for one order:** a developer can revoke tokens
  (`revokeOrderTokens`), then send the customer a fresh link (`ops:resend-email`).
- **Site misbehaving during a payment problem:** set `PERSONAL_ORDERS_ENABLED=false` and/or
  `COMPATIBILITY_ORDERS_ENABLED=false` in Vercel and redeploy - ordering pauses with a
  polite message while existing reports keep working.
