import { isLanguageEnabled } from "@/config/languages";
import { CompatibilityOrderInputSchema, type CompatibilityOrderInput } from "@/domain/compatibility-input";
import { CONSENT_VERSION, OrderInputSchema, flattenIssues, type BirthDetailsInput, type OrderInput } from "@/domain/order-input";
import { formatInr, quoteCompatibility, quotePackage, type PriceQuote, type Product } from "@/domain/pricing";
import { issueAccessToken } from "../access/tokens";
import { getCalculationProvider } from "../astrology/provider";
import { getEnv } from "../config/env";
import { getCheckoutAvailability } from "../config/readiness";
import { getDb, type SqlExecutor } from "../db";
import { serviceUnavailable, validationError } from "../errors";
import { log } from "../log";
import { getPlacesAvailability } from "../places/service";
import { generateOrderReference } from "../security/crypto";
import { RATE_LIMITS, enforceRateLimit } from "../security/rate-limit";
import { insertBirthDetails, insertCompatibilityContext, insertContext, insertOrder, insertQuestions } from "./repository";
import { isDstPrompt, resolveBirth, type DstOverlapPrompt, type ResolvedBirth } from "./resolve-birth";

export function parseOrderInput(raw: unknown): OrderInput {
  const parsed = OrderInputSchema.safeParse(raw);
  if (!parsed.success) throw validationError("Please check the highlighted details.", flattenIssues(parsed.error));
  return parsed.data;
}

export function parseCompatibilityInput(raw: unknown): CompatibilityOrderInput {
  const parsed = CompatibilityOrderInputSchema.safeParse(raw);
  if (!parsed.success) throw validationError("Please check the highlighted details.", flattenIssues(parsed.error));
  return parsed.data;
}

/** Product-specific: a problem with one product never blocks the other. */
export async function assertCanTakeOrders(product: Product, input: { tradition: OrderInput["tradition"]; language: OrderInput["language"] }): Promise<void> {
  const availability = getCheckoutAvailability(getEnv(), product);
  if (!availability.available) {
    log.warn("checkout blocked by configuration", { product, count: availability.missing.length });
    throw serviceUnavailable(availability.customerMessage ?? "Orders are temporarily unavailable.");
  }
  if (!isLanguageEnabled(input.language)) throw serviceUnavailable("Reports in this language are not available yet.");
  if (!getCalculationProvider().supports(input.tradition)) throw serviceUnavailable("This report type is not available yet.");
  const places = await getPlacesAvailability(await getDb());
  if (!places.ok) throw serviceUnavailable("Online ordering is not open yet. Please check back soon.");
}

export interface BirthPreview {
  placeLabel: string;
  timeZoneId: string;
  utcOffsetLabel: string;
  localTimeLabel: string;
  timeCertainty: BirthDetailsInput["timeCertainty"];
  timeWindowMinutes: number | null;
}

export interface OrderPreview {
  quote: PriceQuote;
  totalLabel: string;
  birth: BirthPreview | null;
  dstOverlap: DstOverlapPrompt | null;
}

function describeBirth(resolved: ResolvedBirth): BirthPreview {
  const place = [resolved.place.name, resolved.place.admin1, resolved.place.countryName].filter(Boolean).join(", ");
  return {
    placeLabel: place,
    timeZoneId: resolved.place.timezoneId,
    utcOffsetLabel: resolved.utcOffsetLabel,
    localTimeLabel: resolved.birthTime ? `${resolved.birthDate} ${resolved.birthTime}` : `${resolved.birthDate} (time unknown)`,
    timeCertainty: resolved.timeCertainty,
    timeWindowMinutes: resolved.timeWindowMinutes,
  };
}

/** Validates everything the customer entered and shows how we interpreted it, before payment. */
export async function previewOrder(raw: unknown, clientKey: string): Promise<OrderPreview> {
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.orderPreview, clientKey);
  const input = parseOrderInput(raw);
  const quote = quotePackage(input.includeQuestions);
  const resolved = await resolveBirth(db, input.birth);
  if (isDstPrompt(resolved)) return { quote, totalLabel: formatInr(quote.totalAmountPaise), birth: null, dstOverlap: resolved };
  return { quote, totalLabel: formatInr(quote.totalAmountPaise), birth: describeBirth(resolved), dstOverlap: null };
}

export interface CreatedOrder {
  orderId: string;
  reference: string;
  accessToken: string;
  accessExpiresAt: Date;
  totalAmountPaise: number;
}

function dstFieldError(path: string) {
  return validationError("This birth time happened twice because the clocks went back. Please choose which one.", { [path]: "Choose the earlier or later time" });
}

/**
 * Creates the internal order BEFORE any payment is attempted. The inputs are frozen
 * from this moment: a correction after this point means starting a new order.
 */
export async function createOrder(raw: unknown, clientKey: string): Promise<CreatedOrder> {
  const env = getEnv();
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.orderCreate, clientKey);
  const input = parseOrderInput(raw);
  await assertCanTakeOrders("personal", input);

  const resolved = await resolveBirth(db, input.birth);
  if (isDstPrompt(resolved)) throw dstFieldError("birth.dstChoice");
  // Authoritative server-side price. Nothing price-related is read from the request.
  const quote = quotePackage(input.includeQuestions);

  const result = await db.transaction(async (tx) => {
    const reference = generateOrderReference();
    const orderId = await insertOrder(tx, {
      reference,
      mode: env.APP_MODE,
      product: "personal",
      compatibilityCategory: null,
      tradition: input.tradition,
      language: input.language,
      quote,
      reportEmail: input.email,
      payerPhone: input.phone,
      consentVersion: CONSENT_VERSION,
      deleteAfterDays: env.RETENTION_UNPAID_DAYS,
      thirdPartyPermission: false,
    });
    await insertBirthDetails(tx, orderId, input.birth.subjectName, resolved, 1);
    await insertContext(tx, orderId, {
      knownMoonSign: input.known.moonSign,
      knownNakshatra: input.tradition === "indian" ? input.known.nakshatra : null,
      knownPada: input.tradition === "indian" ? input.known.pada : null,
      knownAscendant: input.known.ascendant,
      otherKnownDetails: input.known.otherDetails,
      additionalContext: input.additionalContext,
    });
    await insertQuestions(tx, orderId, input.questions);
    const access = await issueAccessToken(tx, orderId, "checkout", env.ACCESS_LINK_TTL_DAYS);
    return { orderId, reference, access };
  });

  log.info("order created", { orderId: result.orderId, reference: result.reference, product: "personal", tradition: input.tradition, language: input.language, mode: env.APP_MODE });
  return { orderId: result.orderId, reference: result.reference, accessToken: result.access.token, accessExpiresAt: result.access.expiresAt, totalAmountPaise: quote.totalAmountPaise };
}

// ---------------------------------------------------------------------------
// Compatibility (two people)
// ---------------------------------------------------------------------------

export interface CompatibilityPreview {
  quote: PriceQuote;
  totalLabel: string;
  /** One entry per person, in order. Null where that person needs a DST choice. */
  participants: [BirthPreview | null, BirthPreview | null];
  dstOverlaps: [DstOverlapPrompt | null, DstOverlapPrompt | null];
}

async function resolveBoth(db: SqlExecutor, input: CompatibilityOrderInput) {
  // Each person is resolved independently: their own place, coordinates and the
  // historical time zone in force at their own birth. Nothing is shared between them.
  return Promise.all([resolveBirth(db, input.participants[0].birth), resolveBirth(db, input.participants[1].birth)]);
}

export async function previewCompatibilityOrder(raw: unknown, clientKey: string): Promise<CompatibilityPreview> {
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.compatibilityPreview, clientKey);
  const input = parseCompatibilityInput(raw);
  const quote = quoteCompatibility();
  const [a, b] = await resolveBoth(db, input);
  return {
    quote,
    totalLabel: formatInr(quote.totalAmountPaise),
    participants: [isDstPrompt(a) ? null : describeBirth(a), isDstPrompt(b) ? null : describeBirth(b)],
    dstOverlaps: [isDstPrompt(a) ? a : null, isDstPrompt(b) ? b : null],
  };
}

export async function createCompatibilityOrder(raw: unknown, clientKey: string): Promise<CreatedOrder> {
  const env = getEnv();
  const db = await getDb();
  await enforceRateLimit(db, RATE_LIMITS.compatibilityCreate, clientKey);
  const input = parseCompatibilityInput(raw);
  await assertCanTakeOrders("compatibility", input);

  const [a, b] = await resolveBoth(db, input);
  if (isDstPrompt(a)) throw dstFieldError("participants.0.birth.dstChoice");
  if (isDstPrompt(b)) throw dstFieldError("participants.1.birth.dstChoice");
  const resolved = [a, b] as const;
  const quote = quoteCompatibility();

  const result = await db.transaction(async (tx) => {
    const reference = generateOrderReference();
    const orderId = await insertOrder(tx, {
      reference,
      mode: env.APP_MODE,
      product: "compatibility",
      compatibilityCategory: input.category,
      tradition: input.tradition,
      language: input.language,
      quote,
      reportEmail: input.email,
      payerPhone: input.phone,
      consentVersion: CONSENT_VERSION,
      deleteAfterDays: env.RETENTION_UNPAID_DAYS,
      thirdPartyPermission: true,
    });
    for (const [index, participant] of input.participants.entries()) {
      const number = (index + 1) as 1 | 2;
      await insertBirthDetails(tx, orderId, participant.birth.subjectName, resolved[index] as ResolvedBirth, number);
      await insertContext(
        tx,
        orderId,
        {
          knownMoonSign: participant.known.moonSign,
          knownNakshatra: input.tradition === "indian" ? participant.known.nakshatra : null,
          knownPada: input.tradition === "indian" ? participant.known.pada : null,
          knownAscendant: participant.known.ascendant,
          otherKnownDetails: participant.known.otherDetails,
          additionalContext: participant.additionalInfo,
        },
        number,
      );
    }
    await insertCompatibilityContext(tx, orderId, input.shared);
    const access = await issueAccessToken(tx, orderId, "checkout", env.ACCESS_LINK_TTL_DAYS);
    return { orderId, reference, access };
  });

  log.info("order created", { orderId: result.orderId, reference: result.reference, product: "compatibility", tradition: input.tradition, language: input.language, mode: env.APP_MODE });
  return { orderId: result.orderId, reference: result.reference, accessToken: result.access.token, accessExpiresAt: result.access.expiresAt, totalAmountPaise: quote.totalAmountPaise };
}
