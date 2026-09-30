# Rasi Astro

**Centuries of tradition. Calculated by machines. Interpreted for you.**
Personalised astrology reports at rasiastro.com.

Customers choose **Indian (Vedic)** or **Western** astrology and a report language
(**Tamil, English, Hindi, Telugu, Kannada or Malayalam**), enter birth details, pay once,
and receive their report online and as a **PDF** by private email link. There are no
accounts, passwords or subscriptions.

| Product | Price |
| --- | --- |
| Personal report: one person, web + PDF | ₹49 |
| Personal report with three questions (₹20 for all three) | ₹69 |
| Compatibility report: two people, one connection category (relationship, marriage, friendship, career & teamwork, business partnership or family), web + PDF | ₹39 for the pair |

Charts are calculated by the app's own engine; an AI writes the interpretation from the
calculated data. No astrologer reviews reports, and the site says so.

---

## Try it on your computer (no accounts needed)

You need **Node.js 22.17 or newer** (https://nodejs.org, "LTS") and **Google Chrome or
Microsoft Edge** (used to make the PDFs).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. It starts in **demo mode**: a banner says so, payments are
simulated (no money), report text is sample text, emails are saved as files in
`.data/emails/`, and everything is stored in `.data/` on your computer.

**Walk through an order:** *Explore my chart* (personal) or *Explore our connection*
(compatibility) → fill in the steps (try "Hyderabad" or "Salem" to see how the site asks
you to choose between places with the same name) → review → *Continue to payment* → on
the demo checkout page click *Simulate successful payment* → watch the progress → read
the report and download the PDF. Press `Ctrl + C` in the terminal to stop.

## Demo, sandbox and live

| Part | Demo | Sandbox (test site) | Live |
| --- | --- | --- | --- |
| Payments | Simulated page | Cashfree **test** environment, no real money | Cashfree, real money |
| Report text | Placeholder text in the chosen language | Real AI | Real AI |
| Birthplaces | ~50 sample places | Full GeoNames list | Full GeoNames list |
| Database / files | `.data/` on your computer | Test Supabase project | Live Supabase project |
| Email | Saved to `.data/emails/` | Sent by Resend | Sent by Resend |
| Background jobs | Inside the dev server | Inngest | Inngest |
| Allowed on rasiastro.com | No | No | Yes |

## Going live

1. **[SETUP.md](SETUP.md)**: accounts, in order, with checks.
2. **[VERCEL_SETUP.md](VERCEL_SETUP.md)**: every environment variable, plan, webhooks, deploy and rollback.
3. **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)**: what is verified, what waits for you, what blocks a paid launch, and the final real-payment test.

## Documentation

| Document | For |
| --- | --- |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Daily running: status, Excel export, failed reports, refunds, pausing orders, complaints and privacy requests, backups |
| [docs/LEGAL_READINESS.md](docs/LEGAL_READINESS.md) | Sources, assumptions and open questions behind the policy pages |
| [docs/CLAIMS.md](docs/CLAIMS.md) | Every marketing claim mapped to the feature that produces it |
| [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) | Security checklist before and after launch |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | What is not done or not yet verified |
| [docs/HERO_ASSETS.md](docs/HERO_ASSETS.md) | Replacing the homepage artwork |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together, scaling notes |
| [CLAUDE.md](CLAUDE.md) | Engineering rules for anyone (or any AI) changing the code |

## Everyday commands

```bash
npm run check          # lint + type check + tests
npm run config:check   # check settings and test each account (prints no secrets)
npm run ops:status     # site state and orders that need attention
npm run export:xlsx    # Excel export of orders into the exports/ folder
```
