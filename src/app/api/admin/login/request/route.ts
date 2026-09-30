import { z } from "zod";
import { isAdminEnabled, requestAdminCode } from "@/server/admin/auth";
import { AppError } from "@/server/errors";
import { assertSameOrigin, clientKey, json, readJson, withErrors } from "@/server/http";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().max(254) });

/** Emails a sign-in code to an allowed owner address. The answer never reveals whether the address is allowed. */
export const POST = withErrors("admin.login.request", async (request: Request) => {
  await assertSameOrigin();
  if (!isAdminEnabled()) throw new AppError("not_found", "Not found");
  const parsed = Body.safeParse(await readJson(request, 2_000));
  if (parsed.success) await requestAdminCode(parsed.data.email, await clientKey());
  return json({ message: "If this address is allowed, a sign-in code is on its way. It works for 10 minutes." });
});
