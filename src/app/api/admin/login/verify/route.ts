import { z } from "zod";
import { isAdminEnabled, verifyAdminCode } from "@/server/admin/auth";
import { AppError } from "@/server/errors";
import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().max(254), code: z.string().trim().max(12) });

export const POST = withErrors("admin.login.verify", async (request: Request) => {
  await assertSameOrigin();
  if (!isAdminEnabled()) throw new AppError("not_found", "Not found");
  const parsed = Body.safeParse(await readJson(request, 2_000));
  if (!parsed.success || !(await verifyAdminCode(parsed.data.email, parsed.data.code, await clientKey()))) {
    throw new AppError("validation_failed", "That code is not valid or has expired. Request a new one.");
  }
  return json({ ok: true });
});
