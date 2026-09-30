import { getCategory } from "@/config/compatibility";
import { getLanguage, TRADITIONS } from "@/config/languages";
import { formatInr } from "@/domain/pricing";
import { getEnv } from "../config/env";
import { getDb } from "../db";
import type { OrderStatusView, StageState } from "@/domain/order-status";
import { getOrder } from "./repository";

/**
 * What the customer sees on the order status page. Stages reflect real recorded
 * states only - no simulated progress bars or percentages.
 */
export type { OrderStatusView, StageState } from "@/domain/order-status";

export async function getOrderStatusView(orderId: string): Promise<OrderStatusView | null> {
  const db = await getDb();
  const order = await getOrder(db, orderId);
  if (!order) return null;
  const pdf = await db.query<{ ready: boolean }>(`select (pdf_storage_key is not null) as ready from reports where order_id = $1::uuid`, [orderId]);
  const deleted = await db.query<{ deleted: boolean }>(`select personal_data_deleted_at is not null as deleted from orders where id = $1::uuid`, [orderId]);
  const job = await db.query<{ current_step: string | null }>(`select current_step from report_jobs where order_id = $1::uuid`, [orderId]);
  const [latest] = await db.query<{ provider: string; status: string; provider_status: string | null; checkout_data: Record<string, string> | string | null; submitted_reference: string | null }>(
    `select provider, status, provider_status, checkout_data, submitted_reference from payments where order_id = $1::uuid order by attempt desc limit 1`,
    [orderId],
  );
  const g = order.generationStatus;
  const paid = order.paymentStatus === "paid";
  const relay = latest?.provider === "urorelay" ? latest : null;
  const checkoutData = typeof relay?.checkout_data === "string" ? (JSON.parse(relay.checkout_data) as Record<string, string>) : relay?.checkout_data;
  const manualReview = Boolean(relay && !paid && (order.paymentStatus === "needs_review" || /REVIEW_REQUIRED/.test(relay.provider_status ?? "")));
  const paymentStage: OrderStatusView["paymentStage"] = manualReview ? "manual_review" : relay && relay.status === "pending" && relay.submitted_reference ? "checking" : null;
  const upi =
    relay && !paid && ["created", "pending"].includes(relay.status) && checkoutData?.qrCode && checkoutData.upiString
      ? {
          qrCode: checkoutData.qrCode,
          upiString: checkoutData.upiString,
          referenceSubmitted: Boolean(relay.submitted_reference),
          referenceHint: relay.submitted_reference ? `ending ${relay.submitted_reference.slice(-4)}` : null,
        }
      : null;
  // Generation stages 1-3 (chart, interpretation, PDF). For a failure, the stage is
  // taken from the step the job was on when it failed.
  const stepStage: Record<string, number> = { calculate: 1, interpret_core: 2, interpret_timeline: 2, interpret_synthesis: 2, assemble: 3, render_pdf: 3, finalize: 3 };
  const current =
    g === "ready" ? 4 : g === "rendering" ? 3 : g === "interpreting" ? 2 : g === "failed" ? stepStage[job[0]?.current_step ?? ""] ?? 1 : 1;
  const genState = (stage: number): StageState => {
    if (!paid) return "pending";
    if (stage < current) return "done";
    if (stage === current) return g === "failed" ? "failed" : "active";
    return "pending";
  };
  const stages: OrderStatusView["stages"] = [
    {
      key: "payment",
      label: "Payment confirmed",
      state: paid ? "done" : manualReview ? "active" : ["failed", "cancelled", "expired", "needs_review"].includes(order.paymentStatus) ? "failed" : "active",
    },
    { key: "chart", label: order.product === "compatibility" ? "Preparing both charts" : "Preparing your chart", state: genState(1) },
    { key: "interpretation", label: "Writing your interpretation", state: genState(2) },
    { key: "pdf", label: "Preparing your PDF", state: genState(3) },
    // Shown as done only when the stored report is actually marked ready.
    { key: "ready", label: "Your report is ready", state: g === "ready" ? "done" : "pending" },
  ];
  return {
    orderId: order.id,
    reference: order.reference,
    mode: order.mode,
    product: order.product,
    categoryLabel: order.compatibilityCategory ? getCategory(order.compatibilityCategory).label : null,
    traditionTitle: TRADITIONS.find((t) => t.code === order.tradition)?.title ?? order.tradition,
    languageName: getLanguage(order.language).englishName,
    totalLabel: formatInr(order.totalAmountPaise),
    includesQuestions: order.packageCode === "report_with_questions",
    paymentStatus: order.paymentStatus,
    generationStatus: g,
    deliveryStatus: order.deliveryStatus,
    canRetryPayment: ["awaiting_payment", "failed", "cancelled", "expired"].includes(order.paymentStatus),
    reportReady: g === "ready",
    pdfReady: Boolean(pdf[0]?.ready),
    stages,
    supportEmail: getEnv().SUPPORT_EMAIL,
    personalDataDeleted: Boolean(deleted[0]?.deleted),
    upi,
    paymentStage,
  };
}
