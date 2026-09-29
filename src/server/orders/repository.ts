import type { LanguageCode, TraditionCode } from "@/config/languages";
import type { NakshatraKey, SignKey } from "@/domain/astrology/constants";
import type { PackageCode, PriceQuote } from "@/domain/pricing";
import { jsonParam, type SqlExecutor } from "../db";
import type { ResolvedBirth } from "./resolve-birth";

export type PaymentStatus = "awaiting_payment" | "pending" | "paid" | "failed" | "cancelled" | "expired" | "needs_review";
export type GenerationStatus = "not_started" | "queued" | "calculating" | "interpreting" | "rendering" | "ready" | "failed";
export type DeliveryStatus = "not_sent" | "sending" | "sent" | "failed";

export interface Order {
  id: string;
  reference: string;
  mode: "demo" | "live";
  tradition: TraditionCode;
  language: LanguageCode;
  packageCode: PackageCode;
  pricingVersion: string;
  currency: "INR";
  baseAmountPaise: number;
  addonAmountPaise: number;
  totalAmountPaise: number;
  priceSnapshot: PriceQuote;
  reportEmail: string;
  payerPhone: string | null;
  paymentStatus: PaymentStatus;
  generationStatus: GenerationStatus;
  deliveryStatus: DeliveryStatus;
  consentProcessingAt: Date;
  consentVersion: string;
  paidAt: Date | null;
  reportReadyAt: Date | null;
  generationFailureCode: string | null;
  createdAt: Date;
  deleteAfter: Date;
}

interface OrderRow {
  id: string;
  reference: string;
  mode: "demo" | "live";
  tradition: TraditionCode;
  report_language: LanguageCode;
  package_code: PackageCode;
  pricing_version: string;
  currency: "INR";
  base_amount_paise: number;
  addon_amount_paise: number;
  total_amount_paise: number;
  price_snapshot: PriceQuote;
  report_email: string;
  payer_phone: string | null;
  payment_status: PaymentStatus;
  generation_status: GenerationStatus;
  delivery_status: DeliveryStatus;
  consent_processing_at: Date;
  consent_version: string;
  paid_at: Date | null;
  report_ready_at: Date | null;
  generation_failure_code: string | null;
  created_at: Date;
  delete_after: Date;
}

export const ORDER_COLUMNS = `id, reference, mode, tradition, report_language, package_code, pricing_version, currency,
  base_amount_paise, addon_amount_paise, total_amount_paise, price_snapshot, report_email, payer_phone,
  payment_status, generation_status, delivery_status, consent_processing_at, consent_version, paid_at,
  report_ready_at, generation_failure_code, created_at, delete_after`;

export function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    reference: r.reference,
    mode: r.mode,
    tradition: r.tradition,
    language: r.report_language,
    packageCode: r.package_code,
    pricingVersion: r.pricing_version,
    currency: r.currency,
    baseAmountPaise: r.base_amount_paise,
    addonAmountPaise: r.addon_amount_paise,
    totalAmountPaise: r.total_amount_paise,
    priceSnapshot: r.price_snapshot,
    reportEmail: r.report_email,
    payerPhone: r.payer_phone,
    paymentStatus: r.payment_status,
    generationStatus: r.generation_status,
    deliveryStatus: r.delivery_status,
    consentProcessingAt: r.consent_processing_at,
    consentVersion: r.consent_version,
    paidAt: r.paid_at,
    reportReadyAt: r.report_ready_at,
    generationFailureCode: r.generation_failure_code,
    createdAt: r.created_at,
    deleteAfter: r.delete_after,
  };
}

export async function getOrder(db: SqlExecutor, orderId: string, options: { forUpdate?: boolean } = {}): Promise<Order | null> {
  if (!isUuid(orderId)) return null;
  const rows = await db.query<OrderRow>(
    `select ${ORDER_COLUMNS} from orders where id = $1::uuid ${options.forUpdate ? "for update" : ""}`,
    [orderId],
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function getOrderByReference(db: SqlExecutor, reference: string): Promise<Order | null> {
  const rows = await db.query<OrderRow>(`select ${ORDER_COLUMNS} from orders where reference = $1`, [reference.trim().toUpperCase()]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export interface NewOrder {
  reference: string;
  mode: "demo" | "live";
  tradition: TraditionCode;
  language: LanguageCode;
  quote: PriceQuote;
  reportEmail: string;
  payerPhone: string;
  consentVersion: string;
  deleteAfterDays: number;
}

export async function insertOrder(tx: SqlExecutor, order: NewOrder): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `insert into orders (reference, mode, tradition, report_language, package_code, pricing_version, currency,
        base_amount_paise, addon_amount_paise, total_amount_paise, price_snapshot, report_email, payer_phone,
        consent_processing_at, consent_version, delete_after)
     values ($1, $2, $3, $4, $5, $6, $7, $8::int, $9::int, $10::int, $11::jsonb, $12, $13, now(), $14,
        now() + ($15::int * interval '1 day'))
     returning id`,
    [
      order.reference,
      order.mode,
      order.tradition,
      order.language,
      order.quote.packageCode,
      order.quote.pricingVersion,
      order.quote.currency,
      order.quote.baseAmountPaise,
      order.quote.addonAmountPaise,
      order.quote.totalAmountPaise,
      jsonParam(order.quote),
      order.reportEmail,
      order.payerPhone,
      order.consentVersion,
      order.deleteAfterDays,
    ],
  );
  return rows[0]!.id;
}

export async function insertBirthDetails(tx: SqlExecutor, orderId: string, subjectName: string, birth: ResolvedBirth): Promise<void> {
  await tx.query(
    `insert into birth_details (order_id, subject_name, birth_date, time_certainty, birth_time_local, time_window_minutes,
        place_id, place_name, place_region, place_country_code, place_country_name, latitude, longitude, timezone_id,
        utc_offset_seconds, birth_utc, offset_resolution, tz_database_version)
     values ($1::uuid, $2, $3::date, $4, $5::time, $6::int, $7, $8, $9, $10, $11, $12::float8, $13::float8, $14, $15::int,
        $16::timestamptz, $17, $18)`,
    [
      orderId,
      subjectName,
      birth.birthDate,
      birth.timeCertainty,
      birth.birthTime,
      birth.timeWindowMinutes,
      birth.place.id,
      birth.place.name,
      birth.place.admin1,
      birth.place.countryCode,
      birth.place.countryName,
      birth.place.latitude,
      birth.place.longitude,
      birth.place.timezoneId,
      birth.utcOffsetSeconds,
      birth.birthUtc,
      birth.offsetResolution,
      birth.tzDatabaseVersion,
    ],
  );
}

export interface OrderContextInput {
  knownMoonSign: SignKey | null;
  knownNakshatra: NakshatraKey | null;
  knownPada: number | null;
  knownAscendant: SignKey | null;
  otherKnownDetails: string | null;
  additionalContext: string | null;
}

export async function insertContext(tx: SqlExecutor, orderId: string, c: OrderContextInput): Promise<void> {
  await tx.query(
    `insert into order_context (order_id, known_moon_sign, known_nakshatra, known_pada, known_ascendant, other_known_details, additional_context)
     values ($1::uuid, $2, $3, $4::smallint, $5, $6, $7)`,
    [orderId, c.knownMoonSign, c.knownNakshatra, c.knownPada, c.knownAscendant, c.otherKnownDetails, c.additionalContext],
  );
}

export async function insertQuestions(tx: SqlExecutor, orderId: string, questions: string[]): Promise<void> {
  for (const [index, question] of questions.entries()) {
    await tx.query(`insert into order_questions (order_id, position, question) values ($1::uuid, $2::smallint, $3)`, [orderId, index + 1, question]);
  }
}

export interface StoredBirthDetails {
  subjectName: string;
  birthDate: string;
  timeCertainty: "exact" | "approximate" | "unknown";
  birthTime: string | null;
  timeWindowMinutes: number | null;
  placeId: string;
  placeName: string;
  placeRegion: string | null;
  placeCountryCode: string;
  placeCountryName: string;
  latitude: number;
  longitude: number;
  timezoneId: string;
  utcOffsetSeconds: number;
  birthUtc: Date | null;
  offsetResolution: ResolvedBirth["offsetResolution"];
}

export async function getBirthDetails(db: SqlExecutor, orderId: string): Promise<StoredBirthDetails | null> {
  const rows = await db.query<{
    subject_name: string;
    birth_date: string;
    time_certainty: StoredBirthDetails["timeCertainty"];
    birth_time: string | null;
    time_window_minutes: number | null;
    place_id: string;
    place_name: string;
    place_region: string | null;
    place_country_code: string;
    place_country_name: string;
    latitude: number;
    longitude: number;
    timezone_id: string;
    utc_offset_seconds: number;
    birth_utc: Date | null;
    offset_resolution: ResolvedBirth["offsetResolution"];
  }>(
    `select subject_name, birth_date::text as birth_date, time_certainty, to_char(birth_time_local, 'HH24:MI') as birth_time,
            time_window_minutes, place_id, place_name, place_region, place_country_code, place_country_name,
            latitude, longitude, timezone_id, utc_offset_seconds, birth_utc, offset_resolution
       from birth_details where order_id = $1::uuid`,
    [orderId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    subjectName: r.subject_name,
    birthDate: r.birth_date,
    timeCertainty: r.time_certainty,
    birthTime: r.birth_time,
    timeWindowMinutes: r.time_window_minutes,
    placeId: r.place_id,
    placeName: r.place_name,
    placeRegion: r.place_region,
    placeCountryCode: r.place_country_code,
    placeCountryName: r.place_country_name,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    timezoneId: r.timezone_id,
    utcOffsetSeconds: r.utc_offset_seconds,
    birthUtc: r.birth_utc,
    offsetResolution: r.offset_resolution,
  };
}

export async function getContext(db: SqlExecutor, orderId: string): Promise<OrderContextInput | null> {
  const rows = await db.query<{
    known_moon_sign: SignKey | null;
    known_nakshatra: NakshatraKey | null;
    known_pada: number | null;
    known_ascendant: SignKey | null;
    other_known_details: string | null;
    additional_context: string | null;
  }>(`select known_moon_sign, known_nakshatra, known_pada, known_ascendant, other_known_details, additional_context from order_context where order_id = $1::uuid`, [orderId]);
  const r = rows[0];
  if (!r) return null;
  return {
    knownMoonSign: r.known_moon_sign,
    knownNakshatra: r.known_nakshatra,
    knownPada: r.known_pada,
    knownAscendant: r.known_ascendant,
    otherKnownDetails: r.other_known_details,
    additionalContext: r.additional_context,
  };
}

export async function getQuestions(db: SqlExecutor, orderId: string): Promise<string[]> {
  const rows = await db.query<{ question: string }>(`select question from order_questions where order_id = $1::uuid order by position`, [orderId]);
  return rows.map((r) => r.question);
}

export async function recordFunnelEvent(
  db: SqlExecutor,
  event: "form_started" | "checkout_started" | "payment_verified" | "report_ready" | "delivery_failed" | "generation_failed",
  mode: "demo" | "live",
  orderId: string | null = null,
): Promise<void> {
  await db.query(`insert into funnel_events (event, order_id, mode) values ($1, $2::uuid, $3)`, [event, orderId, mode]);
}
