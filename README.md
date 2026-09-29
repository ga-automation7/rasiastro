# Rasi Astro

**Your stars, your story.** Personalised astrology reports at rasiastro.com.

Customers choose **Indian (Vedic)** or **Western** astrology and a report language
(**Tamil, English, Hindi, Telugu, Kannada or Malayalam**), enter birth details, can add
**three personal questions**, pay, and receive their report online and as a **PDF** by
secure email link. There are no accounts, passwords or subscriptions.

| Package | Price |
| --- | --- |
| One report (Indian or Western), web + PDF | ₹49 |
| Report + three questions (₹20 for all three) | ₹69 |

---

## Try it on your computer (no accounts needed)

You need **Node.js 22.17 or newer** (https://nodejs.org, "LTS") and **Google Chrome or
Microsoft Edge** (used to make the PDFs).

1. Open a terminal in this folder.
2. Install everything once:
   ```bash
   npm install
   ```
3. Start the site:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000 in your browser.

It starts in **demo mode**: a yellow banner says so, payments are simulated (no money),
report text is sample text, emails are saved as files in `.data/emails/` instead of
being sent, and everything is stored in `.data/` on your computer.

**Walk through a full order:** click *Get your report* → choose tradition and language →
enter birth details (try "Hyderabad" or "Salem" to see how the site asks you to choose
between places with the same name) → optionally add three questions → review and *Pay*
→ on the demo checkout page click *Simulate successful payment* → watch the progress
steps → read the report and download the PDF.

To stop the site press `Ctrl + C` in the terminal.

## What is real and what is demo

| Part | Demo mode | Live mode |
| --- | --- | --- |
| Chart calculation | Real (built-in engine) | Same |
| Birthplaces | ~50 sample places | Full GeoNames list (import once) |
| Payments | Simulated page | Cashfree hosted checkout |
| Report text | Placeholder text in the chosen language | Written by OpenAI from the calculated chart |
| PDF | Real, via your Chrome/Edge | Real, via serverless Chromium on Vercel |
| Email | Saved to `.data/emails/` | Sent by Resend |
| Database / files | `.data/` on your computer | Supabase (database + private storage) |
| Background jobs | Inside the dev server | Inngest |

## Going live

Follow **[SETUP.md](SETUP.md)** step by step. It explains each account (Supabase,
Cashfree, OpenAI, Resend, Inngest, Vercel), where each key goes, and how to test.
The site will refuse to take real payments until every required service is configured.

## Documentation

| Document | For |
| --- | --- |
| [SETUP.md](SETUP.md) | Creating accounts, keys, deploying, testing a real payment |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Daily running: Excel export, failed reports, refunds, deletion requests, backups |
| [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) | Security and operational checklist before and after launch |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | What is not done or not yet verified |
| [docs/HERO_ASSETS.md](docs/HERO_ASSETS.md) | Replacing the homepage hero image / animation |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together, scaling notes |
| [CLAUDE.md](CLAUDE.md) | Engineering rules for anyone (or any AI) changing the code |

## Everyday commands

```bash
npm run dev            # run the site locally
npm run check          # lint + type check + tests
npm run config:check   # check settings and test each account (prints no secrets)
npm run export:xlsx    # Excel export of orders into the exports/ folder
npm run ops:status     # orders that need attention
```
