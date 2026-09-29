import { getEnv } from "../config/env";
import { log } from "../log";

/**
 * Operational alerts for the owner (payment needs review, report generation failed,
 * delivery failed). Always logged at error level; additionally emailed to
 * OWNER_ALERT_EMAIL when email is configured. Alerts must never contain customer
 * birth data or report content - only order references and next steps.
 */
export async function alertOwner(subject: string, body: string): Promise<void> {
  log.error("owner alert", { code: subject, detail: body });
  const env = getEnv();
  if (!env.OWNER_ALERT_EMAIL) return;
  try {
    const { getEmailProvider } = await import("../delivery/email");
    await getEmailProvider().send({
      to: env.OWNER_ALERT_EMAIL,
      subject: `[Rasi Astro alert] ${subject}`,
      html: `<p>${escapeHtml(body)}</p>`,
      text: body,
      idempotencyKey: null,
      tags: { kind: "owner_alert" },
    });
  } catch (error) {
    log.error("owner alert email failed", { error });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
