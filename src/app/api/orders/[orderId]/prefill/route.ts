import { getDb } from "@/server/db";
import { orderNotAccessible } from "@/server/errors";
import { json, requireOrderAccess, withErrors } from "@/server/http";
import { getBirthDetails, getContext, getOrder, getQuestions } from "@/server/orders/repository";

export const dynamic = "force-dynamic";

/**
 * Returns an existing order's inputs so the customer can correct them and place a
 * NEW order (orders are frozen once created). Only for a browser with access.
 */
export const GET = withErrors("orders.prefill", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  const db = await getDb();
  const [order, birth, ctx, questions] = await Promise.all([getOrder(db, orderId), getBirthDetails(db, orderId), getContext(db, orderId), getQuestions(db, orderId)]);
  if (!order || !birth) throw orderNotAccessible();
  return json({
    tradition: order.tradition,
    language: order.language,
    birth: {
      subjectName: birth.subjectName,
      birthDate: birth.birthDate,
      timeCertainty: birth.timeCertainty,
      birthTime: birth.birthTime,
      timeWindowMinutes: birth.timeWindowMinutes,
      place: {
        id: birth.placeId,
        name: birth.placeName,
        region: birth.placeRegion,
        country: birth.placeCountryName,
        timezoneId: birth.timezoneId,
      },
    },
    known: {
      moonSign: ctx?.knownMoonSign ?? null,
      nakshatra: ctx?.knownNakshatra ?? null,
      pada: ctx?.knownPada ?? null,
      ascendant: ctx?.knownAscendant ?? null,
      otherDetails: ctx?.otherKnownDetails ?? null,
    },
    additionalContext: ctx?.additionalContext ?? null,
    includeQuestions: order.packageCode === "report_with_questions",
    questions,
    email: order.reportEmail,
    phone: order.payerPhone,
  });
});
