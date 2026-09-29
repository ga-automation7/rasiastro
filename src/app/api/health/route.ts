import { getEnv } from "@/server/config/env";
import { json } from "@/server/http";
import { getHealthReport } from "@/server/ops/health";
import { timingSafeEqualString } from "@/server/security/crypto";

export const dynamic = "force-dynamic";

/**
 * Public: {status} only (for uptime monitors). With the header
 * `Authorization: Bearer <HEALTH_CHECK_TOKEN>` it returns the detailed, secret-free report.
 */
export async function GET(request: Request): Promise<Response> {
  const report = await getHealthReport();
  const token = getEnv().HEALTH_CHECK_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const detailed = Boolean(token && supplied && timingSafeEqualString(supplied, token));
  const body = detailed ? report : { status: report.status };
  return json(body, { status: report.database.ok ? 200 : 503 });
}
