# Claim-to-feature checklist (internal)

Every concrete thing the website promises must be something the product actually
produces. Marketing copy lives in `src/content/site-copy.ts`, the FAQ in
`src/components/landing/Faq.tsx`, and the policies in `src/app/*/page.tsx`.
Check this list before adding or changing a claim. Reviewed 30 September 2026.

## Claims made, and where they are produced

| Claim | Produced by |
| --- | --- |
| Personal ₹49; three questions ₹20 in total; ₹69 with questions; compatibility ₹39 for two | `src/config/pricing.ts`; server-side quote in `src/domain/pricing.ts`; tests |
| Online report and PDF included; no account or subscription | report page + `/api/orders/:id/pdf`; access tokens (no accounts) |
| One tradition and one language per purchase; any language with either tradition | order schemas (`src/domain/order-input.ts`, `compatibility-input.ts`) |
| Six report languages | `src/config/languages.ts` (`enabled`), i18n dictionaries, `npm run verify:pdf` |
| Calculated chart; AI interprets but never invents positions | `src/server/astrology/*`; prompt rules; `validate.ts` rejects unknown fact IDs |
| Rasi chart (D1) in fixed-sign and house-based diagrams | `src/server/reports/chart-svg.ts` (South Indian and North Indian styles; the house-based one needs a known Lagna) |
| Lagna, Rasi, Nakshatra, pada; planetary placements with signs, degrees, houses, dignities | `vedic.ts`; planet table in `render.ts` |
| Vimshottari dasha and relevant Saturn/Jupiter transits (incl. Sade Sati) | `dasha.ts`, `transits.ts`, `periods.ts` |
| Tithi, weekday, Tamil solar month and lunar months | `vedic.ts` panchanga/calendars; facts table |
| Tamil, Kannada and Hindi (Janma Kundali) regional perspectives in every Indian report | `src/server/interpretation/perspectives.ts` (keys `tamil`, `kannada`, `north_indian`) |
| Western: Sun, Moon, Rising (with time), aspects, houses (with time), element/modality balance, sect, modern and traditional readings | `western.ts`; `render.ts` |
| Looking back / looking ahead as possibilities; career, relationships, growth, money; summary | timeline and synthesis parts (`schema.ts`, `prompt-v1.ts`) |
| Answers to purchased questions only | pipeline passes questions only for `report_with_questions` |
| Unknown/approximate birth time handled honestly | `Fact` values (known / uncertain / omitted) and limitations text |
| Compatibility: both charts, category-specific factors, communication, shared strengths, potential friction, category dynamics, prompts to discuss | `src/server/astrology/compatibility.ts`, `pair-schema.ts`, `pair-render.ts` |
| No compatibility score or percentage; no directives to marry/separate/hire | analysis has no score; `pair-validate.ts` rejects scores; prompt rules |
| Names, email, phone and birthplace not sent to the AI | `input.ts`, `pair-input.ts` (`maskNames`); tests |
| Checked automatically for structure, completeness and language | `validate.ts`, `pair-validate.ts` |
| "Frontier AI", "advanced AI" (homepage hero, engine section, trust line) | Production `OPENAI_MODEL` is a current flagship generation model. The model and provider are never named. **Re-check this wording whenever OPENAI_MODEL changes**; drop "frontier" if a smaller or older model is used. |
| Homepage report previews | `src/server/reports/preview.ts` quotes the public SAMPLE report (`sample.ts`): a fictional person, a genuinely calculated chart, hand-written illustrative text, labelled as a sample on the page |
| "No subscription · Downloadable PDF · No account required"; recovery by email | one-off orders; `/api/orders/:id/pdf`; access tokens; `/recover` |
| Reports prepared in the background, usually within `DELIVERY_TYPICAL_MINUTES` | Inngest pipeline; value is a setting to be measured in sandbox |
| Retries never cost extra; reopening never pays again | idempotent pipeline; access by link |
| Retention periods stated in the Privacy Policy | `RETENTION_*` settings, `src/server/ops/retention.ts` (daily job) |

## Claims deliberately NOT made (features missing)

- Navamsa (D9) or other divisional charts.
- "Porutham" or a traditional compatibility points total (Ashtakoota): not implemented as a score because it assumes bride/groom roles; individual factors are shown instead.
- Dedicated Telugu and Malayalam regional perspectives (only report languages today).
- Human astrologer review, "expert reviewed", "hand-curated", or any astrologer-equivalence.
- Accuracy percentages, customer counts, testimonials, endorsements, scientific validation.
- A chart wheel diagram in *personal* Western reports (tables only); the dual-ring wheel exists only in Western compatibility reports.
- "Instant" delivery.
- Bengali, Marathi, Gujarati or any other language.
- A live consultation with the question add-on.
- A downloadable sample PDF (the homepage shows sample pages only; the owner removed the old sample-report area and later asked for these previews).
- "One of the world's most capable AI models", or any ranking of the AI (not verifiable).
- Price comparisons such as "less than a coffee".
