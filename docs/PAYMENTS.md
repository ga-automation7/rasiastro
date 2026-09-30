# Payments

Rasi Astro can take payments through three providers. `PAYMENT_PROVIDER` picks the one
used for **new** checkouts; every payment attempt stores its provider and environment and
is always checked through that provider, so switching never breaks older orders.

| `PAYMENT_PROVIDER` | Product | How the customer pays | How we know it is paid |
| --- | --- | --- | --- |
| `urorelay` (in use) | **UroRelay** by UroPay (app.uropay.me) | Scans a UPI QR code on our order page; money goes straight to the owner's bank account | UroPay's own order status (asked by our server) is COMPLETED **and** a signed bank-SMS report from the UroPay Companion app matches the customer's UPI reference and the exact amount |
| `uropay` | UroPay **Merchant API** (dashboard.uropay.me) | Hosted checkout page (UPI, cards, net banking) | Signed advisory webhook, then a signed server-side order lookup |
| `cashfree` | Cashfree Payments | Cashfree hosted checkout | Signed webhook and server-side order lookup |

UroRelay and the UroPay Merchant API are different products with different keys and
APIs. The app never sends UroRelay keys to the Merchant API or the other way round.

Code: `src/server/payments/` (`urorelay.ts`, `uropay.ts`, `cashfree.ts`, `service.ts` for
the shared rules, `registry.ts` for which adapter handles which attempt).

## UroRelay: what it is and what it is not

UroRelay (docs: https://www.uropay.me/documentation) generates a UPI QR code for each
order and confirms payments by **reading your bank's UPI credit SMS** with the UroPay
Companion Android app. It is **not** a bank or payment-gateway API:

- The Companion app must run on an Android phone that receives your bank's UPI credit
  SMS (the SIM linked to the bank account that receives the money). It needs SMS, phone
  and notification permissions, a working internet connection, and must stay open and
  charged. If the phone is off, payments are confirmed when it reconnects.
- Vercel cannot replace the phone. If the phone is offline, orders wait in "checking".
- Your UroRelay plan has a monthly transaction limit. When it is reached UroPay stops
  calling our webhook; payments then need your manual check.
- There are no chargebacks or refunds through UroPay: money is in your bank account, so
  refunds are made by you (UPI or bank transfer).

### The customer's journey

1. The order is saved and priced on the server (₹49, ₹69 with three questions, ₹39 for
   compatibility). Our server asks UroRelay for a UPI QR code for that exact amount (the
   code refuses a QR whose amount differs).
2. The order page shows the QR code and, on phones, an "Open my UPI app" button.
3. After paying, the customer types the 12 digit UPI reference number (UTR) from their
   UPI app. We save it (one reference can belong to one order only) and pass it to UroPay.
   **This proves nothing by itself.** The page says "checking".
4. The Companion app reads the bank SMS and UroPay sends us a signed report. UroPay marks
   the order COMPLETED if it matches.
5. Our server asks UroPay for the status itself. Only COMPLETED **plus** a signed bank
   SMS report for that UroPay order, with the customer's reference and the exact amount,
   marks the order paid. Then exactly one report job starts.

### When something does not match (you decide in `/admin`)

| Situation | What happens |
| --- | --- |
| No bank SMS within 2 minutes (UroPay: REVIEW_REQUIRED) | Customer sees "confirming by hand"; you get an email; the order appears under **UPI payments to check** |
| UroPay says COMPLETED but no bank SMS reached us after 15 minutes | Held for review, same list |
| Bank SMS amount differs from the order amount | Held for review |
| A bank credit matches no order | Listed under **UPI credits not attached to a paid order**; you get an email |
| A UPI reference already used by another order | Refused when the customer types it |

In the order's page in `/admin`: check your bank account, then either type the 12 digit
reference and press **Payment received** (starts the report, exactly once) or press
**Not received** (the customer can pay again with a fresh QR code).

### Setting up UroRelay (owner steps)

1. app.uropay.me: subscribe to a plan and add your UPI ID (VPA) as the default.
2. Install the Companion app (Google Play: `mobi.gaurav.uropay`) on the Android phone
   that gets your bank's SMS; sign in; allow SMS, phone and notification access.
3. In the dashboard, set that phone's environment to **LIVE** for rasiastro.com (the site
   ignores TEST notifications when it is live, and emails you if it receives one).
4. Dashboard > Webhooks: add `https://www.rasiastro.com/api/webhooks/urorelay`.
5. Dashboard > API Keys: copy the key and secret into Vercel as
   `UROPAY_RELAY_API_KEY` and `UROPAY_RELAY_API_SECRET` (Sensitive, Production).
6. Vercel: `PAYMENT_PROVIDER=urorelay`, `PAYMENT_ENV=production`, `APP_MODE=live`.

## Switching to Cashfree later

A. Confirm Cashfree live activation. B. Add `CASHFREE_LIVE_CLIENT_ID` and
`CASHFREE_LIVE_CLIENT_SECRET` in Vercel (Production). C. Cashfree dashboard > Webhooks:
`https://www.rasiastro.com/api/webhooks/cashfree`. D. Do one explicitly authorised real
payment test. E. Set `PAYMENT_PROVIDER=cashfree` and redeploy (push to `main` or Redeploy).
F. Keep the UroRelay keys, webhook and Companion app running until every open UPI order
is settled: those orders stay on UroRelay. G. Check that older customers can still open
their reports (report links do not depend on the payment provider).

Historical UroRelay payments are never rewritten as Cashfree payments.
