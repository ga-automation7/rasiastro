// Minimal types for the official Cashfree.js loader (the package ships none).
// Only the calls documented in its README / Cashfree's redirect-checkout guide are declared.
declare module "@cashfreepayments/cashfree-js" {
  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top" | "_modal" | HTMLElement;
  }
  export interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<unknown>;
  }
  export function load(options: { mode: "sandbox" | "production" }): Promise<CashfreeInstance | null>;
}
