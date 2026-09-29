import { getDb } from "@/server/db";
import { orderNotAccessible } from "@/server/errors";
import { json, requireOrderAccess, withErrors } from "@/server/http";
import {
  getCompatibilityContext,
  getContext,
  getOrder,
  getQuestions,
  listBirthDetails,
  type OrderContextInput,
  type StoredBirthDetails,
} from "@/server/orders/repository";

export const dynamic = "force-dynamic";

function birthOf(birth: StoredBirthDetails) {
  return {
    subjectName: birth.subjectName,
    birthDate: birth.birthDate,
    timeCertainty: birth.timeCertainty,
    birthTime: birth.birthTime,
    timeWindowMinutes: birth.timeWindowMinutes,
    place: { id: birth.placeId, name: birth.placeName, region: birth.placeRegion, country: birth.placeCountryName, timezoneId: birth.timezoneId },
  };
}

function knownOf(ctx: OrderContextInput | null) {
  return {
    moonSign: ctx?.knownMoonSign ?? null,
    nakshatra: ctx?.knownNakshatra ?? null,
    pada: ctx?.knownPada ?? null,
    ascendant: ctx?.knownAscendant ?? null,
    otherDetails: ctx?.otherKnownDetails ?? null,
  };
}

/**
 * Returns an existing order's inputs so the customer can correct them and place a
 * NEW order (orders are frozen once created). Only for a browser with access.
 */
export const GET = withErrors("orders.prefill", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  const db = await getDb();
  const [order, people] = await Promise.all([getOrder(db, orderId), listBirthDetails(db, orderId)]);
  if (!order || people.length === 0) throw orderNotAccessible();

  if (order.product === "compatibility") {
    const [ctxA, ctxB, shared] = await Promise.all([getContext(db, orderId, 1), getContext(db, orderId, 2), getCompatibilityContext(db, orderId)]);
    return json({
      product: "compatibility",
      category: order.compatibilityCategory,
      tradition: order.tradition,
      language: order.language,
      participants: [
        { birth: birthOf(people[0]!), known: knownOf(ctxA), additionalInfo: ctxA?.additionalContext ?? null },
        { birth: birthOf(people[1]!), known: knownOf(ctxB), additionalInfo: ctxB?.additionalContext ?? null },
      ],
      shared: shared ?? { howKnown: null, knownDuration: null, hopes: null, sharedCircumstances: null },
      email: order.reportEmail,
      phone: order.payerPhone,
    });
  }

  const [ctx, questions] = await Promise.all([getContext(db, orderId), getQuestions(db, orderId)]);
  return json({
    product: "personal",
    tradition: order.tradition,
    language: order.language,
    birth: birthOf(people[0]!),
    known: knownOf(ctx),
    additionalContext: ctx?.additionalContext ?? null,
    includeQuestions: order.packageCode === "report_with_questions",
    questions,
    email: order.reportEmail,
    phone: order.payerPhone,
  });
});
