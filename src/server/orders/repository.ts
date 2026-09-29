import type { CompatibilityCategory } from "@/config/compatibility";
import type { LanguageCode, TraditionCode } from "@/config/languages";
import type { NakshatraKey, SignKey } from "@/domain/astrology/constants";
import type { AppMode, DeliveryStatus, GenerationStatus, PaymentStatus } from "@/domain/order-status";
import type { PackageCode, PriceQuote, Product } from "@/domain/pricing";
import { jsonParam, type SqlExecutor } from "../db";
import type { ResolvedBirth } from "./resolve-birth";

export type { DeliveryStatus, GenerationStatus, PaymentStatus };

/** Participant numbers: 1 is the personal-report subject or compatibility "Person A"; 2 is "Person B". */
export type ParticipantNumber = 1 | 2;

export interface Order {
  id: string;
  reference: string;
  mode: AppMode;
  product: Product;
  compatibilityCategory: CompatibilityCategory | null;
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
  adultConfirmedAt: Date | null;
  thirdPartyPermissionAt: Date | null;
  paidAt: Date | null;
  reportReadyAt: Date | null;
  generationFailureCode: string | null;
  createdAt: Date;
  deleteAfter: Date;
}

interface OrderRow {
  id: string;
  reference: string;
  mode: AppMode;
  product: Product;
  compatibility_category: CompatibilityCategory | null;
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
  adult_confirmed_at: Date | null;
  third_party_permission_at: Date | null;
  paid_at: Date | null;
  report_ready_at: Date | null;
  generation_failure_code: string | null;
  created_at: Date;
  delete_after: Date;
}

export const ORDER_COLUMNS = `id, reference, mode, product, compatibility_category, tradition, report_language, package_code,
  pricing_version, currency, base_amount_paise, addon_amount_paise, total_amount_paise, price_snapshot, report_email,
  payer_phone, payment_status, generation_status, delivery_status, consent_processing_at, consent_version,
  adult_confirmed_at, third_party_permission_at, paid_at, report_ready_at, generation_failure_code, created_at, delete_after`;

export function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    reference: r.reference,
    mode: r.mode,
    product: r.product,
    compatibilityCategory: r.compatibility_category,
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
    adultConfirmedAt: r.adult_confirmed_at,
    thirdPartyPermissionAt: r.third_party_permission_at,
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
  mode: AppMode;
  product: Product;
  compatibilityCategory: CompatibilityCategory | null;
  tradition: TraditionCode;
  language: LanguageCode;
  quote: PriceQuote;
  reportEmail: string;
  payerPhone: string;
  consentVersion: string;
  deleteAfterDays: number;
  thirdPartyPermission: boolean;
}

export async function insertOrder(tx: SqlExecutor, order: NewOrder): Promise<string> {
  const rows = await tx.query<{ id: string }>(
    `insert into orders (reference, mode, product, compatibility_category, tradition, report_language, package_code, pricing_version,
        currency, base_amount_paise, addon_amount_paise, total_amount_paise, price_snapshot, report_email, payer_phone,
        consent_processing_at, consent_version, adult_confirmed_at, third_party_permission_at, delete_after)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::int, $11::int, $12::int, $13::jsonb, $14, $15, now(), $16, now(),
        case when $17::boolean then now() else null end, now() + ($18::int * interval '1 day'))
     returning id`,
    [
      order.reference,
      order.mode,
      order.product,
      order.compatibilityCategory,
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
      order.thirdPartyPermission,
      order.deleteAfterDays,
    ],
  );
  return rows[0]!.id;
}

export async function insertBirthDetails(tx: SqlExecutor, orderId: string, subjectName: string, birth: ResolvedBirth, participant: ParticipantNumber = 1): Promise<void> {
  await tx.query(
    `insert into birth_details (order_id, participant, subject_name, birth_date, time_certainty, birth_time_local, time_window_minutes,
        place_id, place_name, place_region, place_country_code, place_country_name, latitude, longitude, timezone_id,
        utc_offset_seconds, birth_utc, offset_resolution, tz_database_version)
     values ($1::uuid, $2::smallint, $3, $4::date, $5, $6::time, $7::int, $8, $9, $10, $11, $12, $13::float8, $14::float8, $15, $16::int,
        $17::timestamptz, $18, $19)`,
    [
      orderId,
      participant,
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
  /** Personal: notes about the reading. Compatibility: "additional information about this person". */
  additionalContext: string | null;
}

export async function insertContext(tx: SqlExecutor, orderId: string, c: OrderContextInput, participant: ParticipantNumber = 1): Promise<void> {
  await tx.query(
    `insert into order_context (order_id, participant, known_moon_sign, known_nakshatra, known_pada, known_ascendant, other_known_details, additional_context)
     values ($1::uuid, $2::smallint, $3, $4, $5::smallint, $6, $7, $8)`,
    [orderId, participant, c.knownMoonSign, c.knownNakshatra, c.knownPada, c.knownAscendant, c.otherKnownDetails, c.additionalContext],
  );
}

export async function insertQuestions(tx: SqlExecutor, orderId: string, questions: string[]): Promise<void> {
  for (const [index, question] of questions.entries()) {
    await tx.query(`insert into order_questions (order_id, position, question) values ($1::uuid, $2::smallint, $3)`, [orderId, index + 1, question]);
  }
}

export interface StoredBirthDetails {
  participant: ParticipantNumber;
  participantId: string;
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

interface BirthRow {
  participant: ParticipantNumber;
  participant_id: string;
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
}

const BIRTH_COLUMNS = `participant, participant_id, subject_name, birth_date::text as birth_date, time_certainty,
  to_char(birth_time_local, 'HH24:MI') as birth_time, time_window_minutes, place_id, place_name, place_region,
  place_country_code, place_country_name, latitude, longitude, timezone_id, utc_offset_seconds, birth_utc, offset_resolution`;

const mapBirth = (r: BirthRow): StoredBirthDetails => ({
  participant: Number(r.participant) as ParticipantNumber,
  participantId: r.participant_id,
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
});

export async function getBirthDetails(db: SqlExecutor, orderId: string, participant: ParticipantNumber = 1): Promise<StoredBirthDetails | null> {
  const rows = await db.query<BirthRow>(`select ${BIRTH_COLUMNS} from birth_details where order_id = $1::uuid and participant = $2::smallint`, [orderId, participant]);
  return rows[0] ? mapBirth(rows[0]) : null;
}

export async function listBirthDetails(db: SqlExecutor, orderId: string): Promise<StoredBirthDetails[]> {
  const rows = await db.query<BirthRow>(`select ${BIRTH_COLUMNS} from birth_details where order_id = $1::uuid order by participant`, [orderId]);
  return rows.map(mapBirth);
}

export async function getContext(db: SqlExecutor, orderId: string, participant: ParticipantNumber = 1): Promise<OrderContextInput | null> {
  const rows = await db.query<{
    known_moon_sign: SignKey | null;
    known_nakshatra: NakshatraKey | null;
    known_pada: number | null;
    known_ascendant: SignKey | null;
    other_known_details: string | null;
    additional_context: string | null;
  }>(
    `select known_moon_sign, known_nakshatra, known_pada, known_ascendant, other_known_details, additional_context
       from order_context where order_id = $1::uuid and participant = $2::smallint`,
    [orderId, participant],
  );
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

export interface CompatibilityContext {
  howKnown: string | null;
  knownDuration: string | null;
  hopes: string | null;
  sharedCircumstances: string | null;
}

export async function insertCompatibilityContext(tx: SqlExecutor, orderId: string, c: CompatibilityContext): Promise<void> {
  await tx.query(
    `insert into compatibility_context (order_id, how_known, known_duration, hopes, shared_circumstances) values ($1::uuid, $2, $3, $4, $5)`,
    [orderId, c.howKnown, c.knownDuration, c.hopes, c.sharedCircumstances],
  );
}

export async function getCompatibilityContext(db: SqlExecutor, orderId: string): Promise<CompatibilityContext | null> {
  const rows = await db.query<{ how_known: string | null; known_duration: string | null; hopes: string | null; shared_circumstances: string | null }>(
    `select how_known, known_duration, hopes, shared_circumstances from compatibility_context where order_id = $1::uuid`,
    [orderId],
  );
  const r = rows[0];
  return r ? { howKnown: r.how_known, knownDuration: r.known_duration, hopes: r.hopes, sharedCircumstances: r.shared_circumstances } : null;
}

export async function getQuestions(db: SqlExecutor, orderId: string): Promise<string[]> {
  const rows = await db.query<{ question: string }>(`select question from order_questions where order_id = $1::uuid order by position`, [orderId]);
  return rows.map((r) => r.question);
}

export type FunnelEvent = "form_started" | "checkout_started" | "payment_verified" | "report_ready" | "delivery_failed" | "generation_failed";

/** Counts only. When an order is known, its product is recorded from the order itself. */
export async function recordFunnelEvent(db: SqlExecutor, event: FunnelEvent, mode: AppMode, orderId: string | null = null, product: Product | null = null): Promise<void> {
  await db.query(
    `insert into funnel_events (event, order_id, mode, product)
     values ($1, $2::uuid, $3, coalesce($4, (select o.product from orders o where o.id = $2::uuid)))`,
    [event, orderId, mode, product],
  );
}
