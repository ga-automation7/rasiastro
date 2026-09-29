import { TRADITIONS, type LanguageCode } from "@/config/languages";
import { getPairDictionary } from "@/i18n/pair";
import { issueAccessToken } from "../access/tokens";
import { getEnv } from "../config/env";
import { getDb, type SqlExecutor } from "../db";
import { log, scrubText } from "../log";
import { alertOwner } from "../ops/alerts";
import { getOrder, recordFunnelEvent } from "../orders/repository";
import { RATE_LIMITS, consumeRateLimit } from "../security/rate-limit";
import { EmailSendError, getEmailProvider } from "./email";
import { recoveryEmail, reportReadyEmail } from "./templates";

/**
 * Delivery is separate from generation: if email fails, the report stays available
 * on the website and delivery is retried on its own, without regenerating anything.
 */
function accessLink(token: string): string {
  return `${getEnv().PUBLIC_SITE_URL.replace(/\/$/, "")}/access#t=${token}`;
}

function traditionLabel(code: "indian" | "western"): string {
  return TRADITIONS.find((t) => t.code === code)?.title ?? code;
}

/** What the email calls the report: the tradition, or the compatibility category. */
function reportLabel(order: { product: string; tradition: "indian" | "western"; compatibilityCategory: string | null }, language: LanguageCode): string {
  if (order.product !== "compatibility" || !order.compatibilityCategory) return traditionLabel(order.tradition);
  const pair = getPairDictionary(language);
  return `${pair.reportTitle} · ${pair.categories[order.compatibilityCategory as keyof typeof pair.categories]}`;
}

async function ensureDeliveryRow(db: SqlExecutor, orderId: string, kind: "report_ready" | "access_recovery", dedupeKey: string, provider: string) {
  await db.query(
    `insert into deliveries (order_id, kind, dedupe_key, provider) values ($1::uuid, $2, $3, $4) on conflict (dedupe_key) do nothing`,
    [orderId, kind, dedupeKey, provider],
  );
  const rows = await db.query<{ id: string; status: string; attempts: number }>(`select id, status, attempts from deliveries where dedupe_key = $1`, [dedupeKey]);
  return rows[0]!;
}

export async function deliverReport(orderId: string, options: { resend?: boolean } = {}): Promise<"sent" | "already_sent"> {
  const db = await getDb();
  const env = getEnv();
  const order = await getOrder(db, orderId);
  if (!order) throw new Error("Order not found");
  if (order.generationStatus !== "ready") throw new Error("Report is not ready yet");

  const provider = getEmailProvider();
  const dedupeKey = `report_ready:${orderId}`;
  const delivery = await ensureDeliveryRow(db, orderId, "report_ready", dedupeKey, provider.id);
  if (delivery.status === "sent" && !options.resend) return "already_sent";

  const attempt = delivery.attempts + 1;
  await db.query(`update deliveries set attempts = $2::int, status = 'pending', updated_at = now() where id = $1::uuid`, [delivery.id, attempt]);
  await db.query(`update orders set delivery_status = 'sending', updated_at = now() where id = $1::uuid and delivery_status <> 'sent'`, [orderId]);

  const access = await issueAccessToken(db, orderId, "report_email", env.ACCESS_LINK_TTL_DAYS);
  const email = reportReadyEmail({
    language: order.language,
    reference: order.reference,
    link: accessLink(access.token),
    expiresAt: access.expiresAt,
    supportEmail: env.SUPPORT_EMAIL,
    traditionLabel: reportLabel(order, order.language),
  });
  try {
    const result = await provider.send({
      to: order.reportEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Same key for automatic retries (the provider suppresses duplicates); a
      // deliberate owner-triggered resend uses a fresh key.
      idempotencyKey: options.resend ? `report-ready-${orderId}-resend-${attempt}` : `report-ready-${orderId}`,
      tags: { kind: "report_ready" },
    });
    await db.query(
      `update deliveries set status = 'sent', provider_message_id = $2, sent_at = now(), last_error = null, updated_at = now() where id = $1::uuid`,
      [delivery.id, result.messageId],
    );
    await db.query(`update orders set delivery_status = 'sent', updated_at = now() where id = $1::uuid`, [orderId]);
    log.info("report email sent", { orderId, provider: provider.id, attempt });
    return "sent";
  } catch (error) {
    await db.query(`update deliveries set last_error = $2, updated_at = now() where id = $1::uuid`, [delivery.id, scrubText((error as Error).message)]);
    log.warn("report email failed", { orderId, attempt, error });
    throw error;
  }
}

export function isRetriableEmailError(error: unknown): boolean {
  return !(error instanceof EmailSendError) || error.retriable;
}

export async function markDeliveryFailed(orderId: string, error: unknown): Promise<void> {
  const db = await getDb();
  const order = await getOrder(db, orderId);
  await db.query(`update orders set delivery_status = 'failed', updated_at = now() where id = $1::uuid and delivery_status <> 'sent'`, [orderId]);
  await db.query(`update deliveries set status = 'failed', updated_at = now() where dedupe_key = $1 and status <> 'sent'`, [`report_ready:${orderId}`]);
  if (order) await recordFunnelEvent(db, "delivery_failed", order.mode, orderId);
  await alertOwner(
    "Report email could not be delivered",
    `Order ${order?.reference ?? orderId}: the report is ready and viewable on the site, but the email failed (${scrubText(String((error as Error)?.message ?? error))}). After fixing email settings run: npm run ops:resend-email -- ${order?.reference ?? orderId}`,
  );
}

/**
 * No-account recovery: emails fresh links for paid orders on that address. The HTTP
 * response is identical whether or not anything matched (no enumeration), and both
 * the IP and the email address are rate limited.
 */
export async function processRecoveryRequest(email: string, reference: string | null, clientKey: string): Promise<void> {
  const db = await getDb();
  const env = getEnv();
  const normalized = email.trim().toLowerCase();
  if (!(await consumeRateLimit(db, RATE_LIMITS.recoveryPerIp, clientKey))) return;
  if (!(await consumeRateLimit(db, RATE_LIMITS.recoveryPerEmail, `email:${normalized}`))) return;

  const orders = await db.query<{ id: string; reference: string; tradition: "indian" | "western"; product: string; compatibility_category: string | null }>(
    `select id, reference, tradition, product, compatibility_category from orders
      where lower(report_email) = $1 and payment_status = 'paid' and mode = $2
        and ($3::text is null or reference = $3::text)
      order by created_at desc limit 5`,
    [normalized, env.APP_MODE, reference ? reference.trim().toUpperCase() : null],
  );
  if (orders.length === 0) {
    log.info("recovery request matched no orders");
    return;
  }
  const links = [];
  for (const o of orders) {
    const access = await issueAccessToken(db, o.id, "recovery_email", env.ACCESS_LINK_TTL_DAYS);
    links.push({ reference: o.reference, link: accessLink(access.token), traditionLabel: reportLabel({ product: o.product, tradition: o.tradition, compatibilityCategory: o.compatibility_category }, "en") });
  }
  const provider = getEmailProvider();
  const message = recoveryEmail({ links, supportEmail: env.SUPPORT_EMAIL });
  const dedupeKey = `recovery:${orders[0]!.id}:${Date.now()}`;
  const delivery = await ensureDeliveryRow(db, orders[0]!.id, "access_recovery", dedupeKey, provider.id);
  try {
    const result = await provider.send({ to: normalized, subject: message.subject, html: message.html, text: message.text, idempotencyKey: dedupeKey, tags: { kind: "access_recovery" } });
    await db.query(`update deliveries set status = 'sent', attempts = 1, provider_message_id = $2, sent_at = now(), updated_at = now() where id = $1::uuid`, [delivery.id, result.messageId]);
    log.info("recovery email sent", { count: orders.length });
  } catch (error) {
    await db.query(`update deliveries set status = 'failed', attempts = 1, last_error = $2, updated_at = now() where id = $1::uuid`, [delivery.id, scrubText((error as Error).message)]);
    log.error("recovery email failed", { error });
  }
}
