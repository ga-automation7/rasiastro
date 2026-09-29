# Running Rasi Astro day to day

All commands run from the project folder on your computer, using the settings in
`.env.local`. When `.env.local` contains the live `DATABASE_URL`, commands act on the
**live** database, so read the prompts carefully. Commands never print secrets.

## Every day (2 minutes)

```bash
npm run ops:status
```
Shows whether checkout is available and lists orders that need attention:

| What you see | What it means | What to do |
| --- | --- | --- |
| `payment=needs_review` | Amount mismatch or a second payment for an already-paid order | Open the order in the Cashfree dashboard. Refund duplicates there. If the payment is genuine and correct, reply to the customer and run `ops:retry-report` after confirming. |
| `report=failed` | Generation stopped after retries (e.g. AI key/model problem) | Fix the cause (`npm run config:check`), then `npm run ops:retry-report -- RA-XXXXXXXX` |
| `payment=paid report=...` older than 30 min | Stuck job | `npm run ops:retry-report -- RA-XXXXXXXX` |
| `email=failed` | Report is ready but the email bounced/failed | Check Resend, then `npm run ops:resend-email -- RA-XXXXXXXX` |

If `OWNER_ALERT_EMAIL` is set you also receive an email for each of these.

## Excel export

```bash
npm run export:xlsx
npm run export:xlsx -- --from 2026-10-01 --to 2026-10-31
```
Creates `exports/rasi-astro-export-<date>.xlsx` with sheets *Orders*, *Birth details*,
*Questions*, *Report status* and *Payments*, linked by **Order ID**. Times are Indian
Standard Time. Report text is not included (it stays in private storage).

The file contains personal data: keep it on an encrypted device, don't email it, delete
it when done. The export is owner-only: there is no web page for it on purpose.

## A customer says they paid but the site shows unpaid

1. Ask for the order reference (RA-...) from their order page or payment receipt.
2. `npm run ops:reconcile -- RA-XXXXXXXX` asks Cashfree for the real status.
3. If Cashfree shows it paid, the report starts automatically. If Cashfree shows no
   payment, the money did not reach you; banks usually reverse failed UPI debits.

(The site also does this automatically every 10 minutes and when the customer returns
from the payment page.)

## Recovering a failed report

```bash
npm run ops:retry-report -- RA-XXXXXXXX
```
Re-runs only the unfinished steps (no repeat AI cost for parts already written). The
customer is never charged again. To rewrite the AI text from scratch (for example after
fixing a translation problem): add `--regenerate-text --yes`.

If a report cannot be completed, refund the customer from the Cashfree dashboard
(*Transactions → the payment → Refund*) and email them.

## Refunds

Refunds are done in the Cashfree dashboard. The app does not issue refunds itself.
Note the refund in your records (the Excel export shows the payment reference).

## Customer asks to delete their data

```bash
npm run ops:delete-order -- RA-XXXXXXXX          # shows what will happen
npm run ops:delete-order -- RA-XXXXXXXX --yes    # does it
```
Unpaid orders are deleted completely. Paid orders keep only the financial record
(reference, amount, dates, payment ids); birth details, notes, questions, report text,
PDF and links are erased.

Verify the request comes from the order's email address before deleting.

## Retention (automatic)

A daily job (Inngest, 03:30 IST) deletes abandoned unpaid orders after
`RETENTION_UNPAID_DAYS` and erases personal data from paid orders after
`RETENTION_REPORT_DAYS`. To preview or run it manually: `npm run ops:purge`
(dry run) / `npm run ops:purge -- --yes`.

## Backups and restoring

- **Database:** Supabase backups depend on your plan (*Database → Backups*). A paid plan
  with daily backups or point-in-time recovery is recommended once you have customers.
  Also keep an occasional off-site copy: `npm run export:xlsx` (human-readable) and, for a
  full technical copy, `pg_dump` with the direct connection string (ask a developer).
- **Restoring:** in Supabase *Database → Backups*, choose a backup and restore (this
  replaces current data - restore into a new project first if you only need to look
  something up). After a restore run `npm run db:migrate` and `npm run ops:status`.
- **Report PDFs** live in the private `reports` bucket. If one is lost it can be rebuilt
  from the stored report text: `npm run ops:retry-report -- RA-XXXXXXXX --rerender-pdf`.
- **Code:** GitHub keeps the full history.

## Health checks

`https://rasiastro.com/api/health` returns `{"status":"ok"}` or `degraded` (use it in an
uptime monitor such as UptimeRobot). With the header
`Authorization: Bearer <HEALTH_CHECK_TOKEN>` it shows which check fails (no secrets).

## Funnel numbers

The database table `funnel_events` counts: form started, checkout started, payment
verified, report ready, delivery failed, generation failed. It contains no birth data or
report content. A developer can chart it; an SQL example for the Supabase SQL editor:

```sql
select event, count(*) from funnel_events
where created_at > now() - interval '30 days' and mode = 'live'
group by event order by event;
```

## Changing prices

Prices are in `src/config/pricing.ts`. Change the amounts **and** `PRICING_VERSION`, run
`npm run check`, commit and deploy. Existing orders keep their original price snapshot.
