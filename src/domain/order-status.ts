/** Shape of the order status shown to customers (shared by server and browser). */
export type StageState = "done" | "active" | "pending" | "failed" | "skipped";

export type PaymentStatus = "awaiting_payment" | "pending" | "paid" | "failed" | "cancelled" | "expired" | "needs_review";
export type GenerationStatus = "not_started" | "queued" | "calculating" | "interpreting" | "rendering" | "ready" | "failed";
export type DeliveryStatus = "not_sent" | "sending" | "sent" | "failed";

export interface OrderStatusView {
  orderId: string;
  reference: string;
  mode: "demo" | "live";
  traditionTitle: string;
  languageName: string;
  totalLabel: string;
  includesQuestions: boolean;
  paymentStatus: PaymentStatus;
  generationStatus: GenerationStatus;
  deliveryStatus: DeliveryStatus;
  canRetryPayment: boolean;
  reportReady: boolean;
  pdfReady: boolean;
  stages: { key: string; label: string; state: StageState }[];
  supportEmail: string;
  personalDataDeleted: boolean;
}
