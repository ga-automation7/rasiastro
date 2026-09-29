import { isLanguageEnabled } from "@/config/languages";
import { CONSENT_VERSION, OrderInputSchema, flattenIssues, type OrderInput } from "@/domain/order-input";
import { formatInr, quotePackage, type PriceQuote } from "@/domain/pricing";
import { getEnv } from "../config/env";
import { getCheckoutAvailability } from "../config/readiness";
import { getDb } from "../db";
import { serviceUnavailable, validationError } from "../errors";
import { log } from "../log";
import { issueAccessToken } from "../access/tokens";
import { getPlacesAvailability } from "../places/service";
import { generateOrderReference } from "../security/crypto";
import { RATE_LIMITS, enforceRateLimit } from "../security/rate-limit";
import { getCalculationProvider } from "../astrology/provider";
import { insertBirthDetails, insertContext, insertOrder, insertQuestions } from "./repository";
import { isDstPrompt, resolveBirth, type DstOverlapPrompt, type ResolvedBirth } from "./resolve-birth";

export function parseOrderInput(raw: unknown): OrderInput {
  const parsed = OrderInputSchema.safeParse(raw);
  if (!parsed.success) throw validationError("Please check the highlighted details.", flattenIssues(parsed.error));
  return parsed.data;
}

export async function assertCanTakeOrders(input: Pick<OrderInput, "tradition" | "language">): Promise<void> {
  const availability = getCheckoutAvailability();
  if (!availability.available) {
    log.warn("checkout blocked by configuration", { count: availability.missing.length });
    throw serviceUnavailable(availability.customerMessage ?? "Orders are temporarily unavailable.");
  }
  if (!isLanguageEnabled(input.language)) throw serviceUnavailable("Reports in this language are not available yet.");
  if (!getCalculationProvider().supports(input.tradition)) throw serviceUnavailable("This report type is not available yet.");
  const places = await getPlacesAvailability(await getDb());
  if (!places.ok) throw serviceUnavailable("New orders are paused while we finish setting up. Please check back soon.");
}

export interface OrderPreview {
  quote: PriceQuote;
  totalLabel: string;
  birth: {
    placeLabel: string;
    timeZoneId: string;
    utcOffsetLabel: string;
    localTimeLabel: string;
    timeCertainty: OrderInput["birth"]["timeCertainty"];
    timeWindowMinutes: number | null;
  } | null;
  dstOverlap: DstOverlapPrompt | null;
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

function describeBirth(resolved: ResolvedBirth): NonNullable<OrderPreview["birth"]> {
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

export interface CreatedOrder {
  orderId: string;
  reference: string;
  accessToken: string;
  accessExpiresAt: Date;
  totalAmountPaise: number;
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
  await assertCanTakeOrders(input);

  const resolved = await resolveBirth(db, input.birth);
  if (isDstPrompt(resolved)) {
    throw validationError("This birth time happened twice because the clocks went back. Please choose which one.", {
      "birth.dstChoice": "Choose the earlier or later time",
    });
  }
  // Authoritative server-side price. Nothing price-related is read from the request.
  const quote = quotePackage(input.includeQuestions);

  const result = await db.transaction(async (tx) => {
    const reference = generateOrderReference();
    const orderId = await insertOrder(tx, {
      reference,
      mode: env.APP_MODE,
      tradition: input.tradition,
      language: input.language,
      quote,
      reportEmail: input.email,
      payerPhone: input.phone,
      consentVersion: CONSENT_VERSION,
      deleteAfterDays: env.RETENTION_UNPAID_DAYS,
    });
    await insertBirthDetails(tx, orderId, input.birth.subjectName, resolved);
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

  log.info("order created", { orderId: result.orderId, reference: result.reference, tradition: input.tradition, language: input.language, mode: env.APP_MODE });
  return {
    orderId: result.orderId,
    reference: result.reference,
    accessToken: result.access.token,
    accessExpiresAt: result.access.expiresAt,
    totalAmountPaise: quote.totalAmountPaise,
  };
}
