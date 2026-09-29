import { after } from "next/server";
import { z } from "zod";
import { GENERIC_RECOVERY_MESSAGE } from "@/config/messages";
import { processRecoveryRequest } from "@/server/delivery/service";
import { validationError } from "@/server/errors";
import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";
import { log } from "@/server/log";

export const dynamic = "force-dynamic";

const RecoverySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^RA-[0-9A-Z]{8}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

/**
 * Link recovery without accounts. The response is always the same generic message,
 * returned immediately, whether or not the email matches an order - so this endpoint
 * cannot be used to discover who has ordered. The lookup and email happen afterwards.
 */
export const POST = withErrors("recover", async (request: Request) => {
  await assertSameOrigin();
  const parsed = RecoverySchema.safeParse(await readJson(request, 2_000));
  if (!parsed.success) throw validationError("Please enter a valid email address.", { email: "Invalid email" });
  const key = await clientKey();
  after(async () => {
    try {
      await processRecoveryRequest(parsed.data.email, parsed.data.reference ?? null, key);
    } catch (error) {
      log.error("recovery processing failed", { error });
    }
  });
  return json({ message: GENERIC_RECOVERY_MESSAGE }, { status: 202 });
});
