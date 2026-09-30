import { getEnv } from "../config/env";
import { chooseProviders, getCheckoutAvailability, getConfigChecks, getProductChecks, getSiteState } from "../config/readiness";
import { getDb } from "../db";
import { getSchemaVersion } from "../db/migrate";
import { countUndispatched } from "../jobs/outbox";
import { getPlacesAvailability } from "../places/service";
import { resolveBrowserSource } from "../reports/pdf";

/** Operational health. Contains no secrets, keys, customer data or connection strings. */
export async function getHealthReport() {
  const env = getEnv();
  const started = Date.now();
  let database: { ok: boolean; schemaVersion: string | null; latencyMs: number | null; error?: string } = { ok: false, schemaVersion: null, latencyMs: null };
  let places = null;
  let backlog = null;
  try {
    const db = await getDb();
    await db.query("select 1");
    database = { ok: true, schemaVersion: await getSchemaVersion(db), latencyMs: Date.now() - started };
    places = await getPlacesAvailability(db);
    const [stuck, failed, review] = await Promise.all([
      countUndispatched(db, 15),
      db.query<{ n: number }>(`select count(*)::int as n from orders where generation_status = 'failed' and created_at > now() - interval '7 days'`),
      db.query<{ n: number }>(`select count(*)::int as n from orders where payment_status = 'needs_review'`),
    ]);
    backlog = { undispatchedOver15Min: stuck, failedReportsLast7Days: failed[0]?.n ?? 0, paymentsNeedingReview: review[0]?.n ?? 0 };
  } catch (error) {
    database = { ...database, error: (error as Error).name };
  }
  const personal = getCheckoutAvailability(env, "personal");
  const compatibility = getCheckoutAvailability(env, "compatibility");
  const checkout = { available: personal.available || compatibility.available };
  return {
    status: database.ok && checkout.available && (places?.ok ?? false) ? "ok" : "degraded",
    mode: env.APP_MODE,
    site: getSiteState(env).kind,
    products: {
      personal: personal.available && (places?.ok ?? false),
      compatibility: compatibility.available && (places?.ok ?? false),
    },
    providers: chooseProviders(env),
    pdfBrowser: resolveBrowserSource(),
    checkoutAvailable: checkout.available && (places?.ok ?? false),
    checks: [...getConfigChecks(env), ...getProductChecks("personal", env), ...getProductChecks("compatibility", env)].map((c) => ({ key: c.key, label: c.label, ok: c.ok, detail: c.ok ? null : c.detail })),
    database,
    places,
    backlog,
  };
}
