# Legal readiness (internal)

**Not legal advice. The generated policies do not guarantee compliance.** This records
what the policy pages are based on, what was assumed, and what a qualified Indian lawyer
and accountant must confirm before a paid launch.

- Reviewed: 29 September 2026 (by the engineering assistant, not a lawyer).
- Pages: `/privacy`, `/terms`, `/refund-policy`, `/delivery-policy`, `/contact`
  (source in `src/app/*/page.tsx`; operational facts come from environment variables,
  see VERCEL_SETUP.md).
- Consent version stored with every order: `CONSENT_VERSION` in `src/domain/order-input.ts`
  (currently `2026-10-v2`). Bump it when the policies change materially.

## Sources consulted

| Source | Type | What it was used for |
| --- | --- | --- |
| PIB explainer "DPDP Rules, 2025 Notified" (17 Nov 2025), static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf | Official (Government of India) | Rules notified 14 Nov 2025; 18-month phased compliance; consent notice; contact for data queries; rights to access, correction, update, erasure, nomination; 90-day response; breach notification; verifiable parental consent for children; Data Protection Board |
| DPDP Act, 2023 and DPDP Rules, 2025 (links listed in the PIB explainer, meity.gov.in) | Official | Framework and terminology (Data Fiduciary, Data Principal, Processor) |
| Consumer Protection (E-Commerce) Rules, 2020, notification G.S.R. 462(E), 23 July 2020 (consumeraffairs.nic.in) | Official text (could not be downloaded during review; content taken from the secondary analysis below) | Duties of e-commerce entities |
| Trilegal analysis "Consumer Protection (E-Commerce) Rules, 2020" (5 Aug 2020) | Secondary (law firm) | Display of name/address/contact; grievance officer; explicit consent (no pre-ticked boxes); refunds per RBI rules within a reasonable period; no unilateral cancellation charges; inventory entities' duties (price, refunds, no unfair practices) |
| Consumer Protection Act, 2019 | Official (by reference) | Consumer rights and consumer commissions; unfair trade practices |
| CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 | Official (by reference) | No false urgency, no pre-ticked add-ons, no confirm-shaming |
| Information Technology Act, 2000, s.43A, and the SPDI Rules, 2011 | Official (by reference) | Current (pre-DPDP) duties for sensitive personal data: privacy policy, reasonable security, grievance officer |

## What is in force now vs later (as understood on the review date)

| Obligation | Status | How the product handles it |
| --- | --- | --- |
| E-Commerce Rules 2020: operator details, grievance officer, 48-hour acknowledgement, one-month redress, explicit consent, refunds | **In force** | Contact page shows operator and Grievance Officer (from env; live mode refuses to open without them); unticked consent boxes; refund policy; 48 h / one month stated. **Owner must actually meet the 48-hour and one-month timings.** |
| Consumer Protection Act 2019 rights | **In force** | Terms and refund policy explicitly preserve statutory rights and consumer-commission access |
| Dark-patterns guidelines 2023 | **In force** | No countdowns, fake discounts, "popular" badges, pre-ticked add-ons or drip pricing; the total is shown before payment |
| IT Act s.43A / SPDI Rules 2011 | **In force until replaced by DPDP** | Privacy policy, security measures, grievance contact |
| DPDP Act 2023 core obligations (notice, consent, rights, breach notification, Board) | **Phased**: Rules notified 14 Nov 2025 with an 18-month period; the main obligations are expected from about **13 May 2027**. Confirm the exact commencement notification. | Built in now: purpose-specific notice, separate confirmations, rights handling, retention enforcement, breach-notification commitment, 18+ only |
| DPDP children's data (verifiable parental consent) | Phased with the above | **Not supported**: purchaser and every subject must be 18+; a child's report is deleted if found |

## Assumptions

1. The business is an **inventory e-commerce entity** selling its own digital service to consumers in India (not a marketplace).
2. It is a small Data Fiduciary, **not** a "Significant Data Fiduciary".
3. Birth date, time and place are personal data but not "sensitive personal data" under the SPDI Rules (which list passwords, financial, health, biometric and similar data). Customers are asked not to enter health, financial or ID data in notes.
4. Cross-border processing (OpenAI, Resend, Inngest in the USA; Vercel and Supabase by region) is permitted because no restricted countries had been notified under DPDP s.16 at review time. Re-check at launch.
5. Customers who order a report about another person, or a compatibility report, obtain that person's permission (captured as a separate confirmation for compatibility orders).

## Open questions for a lawyer or accountant (before paid launch)

1. **Business structure** (sole proprietorship, LLP or company) and what must be displayed (Udyam, LLPIN, CIN, registered office).
2. **GST**: registration threshold and tax treatment of ₹39/₹49/₹69 digital reports; whether displayed prices must state "inclusive of GST"; invoice requirements.
3. **Retention of financial records**: how long order and payment records must be kept (tax and accounting law). The app keeps them indefinitely today; personal data is erased after `RETENTION_REPORT_DAYS` (default 400 days). Confirm both.
4. **Refund timing**: whether the refund policy's "initiate within N working days" and the refund situations are adequate under CPA 2019 and RBI rules for failed or duplicate transactions.
5. **Delivery commitments**: confirm the 24-hour maximum after measuring real delivery times.
6. **Jurisdiction clause**: the terms say only "laws of India". Decide whether to name a city for courts, without affecting consumer-commission rights.
7. **AI disclosure**: whether any sector guidance requires more specific AI labelling than the current disclosure (site, FAQ, terms, privacy).
8. **Astrology advertising**: confirm the copy (no guarantees, interpretive disclaimer) is acceptable under consumer and advertising rules.
9. **DPDP**: exact commencement dates; whether a consent-manager integration or a Data Protection Officer contact is needed for this size of business.
10. **National Consumer Helpline**: confirm current contact details before listing phone numbers on the site (the pages name the helpline and consumer commissions without numbers).

## Owner processes the policies promise

- Complaints and privacy requests: acknowledge within 48 hours, resolve within one month (docs/OPERATIONS.md, "Complaints and privacy requests").
- Refunds: decision, then initiation within `REFUND_INITIATION_WORKING_DAYS` working days.
- Breach: inform affected customers without delay and follow the notification rules in force.
