import { CURRENCY, PRICING, PRICING_VERSION } from "@/config/pricing";

export type Product = "personal" | "compatibility";
export type PackageCode = "report" | "report_with_questions" | "compatibility_pair";

export interface PriceLine {
  code: string;
  label: string;
  amountPaise: number;
}

export interface PriceQuote {
  pricingVersion: string;
  currency: typeof CURRENCY;
  /** Absent in snapshots stored before compatibility existed (treat as personal). */
  product?: Product;
  packageCode: PackageCode;
  includesQuestions: boolean;
  questionCount: number;
  baseAmountPaise: number;
  addonAmountPaise: number;
  totalAmountPaise: number;
  lines: PriceLine[];
}

/**
 * Computes the authoritative price for a package. The server calls this when an
 * order is created; any amount sent by the browser is ignored.
 */
export function quotePackage(includeQuestions: boolean): PriceQuote {
  const base = PRICING.report.amountPaise;
  const addon = includeQuestions ? PRICING.questionsAddon.amountPaise : 0;
  const lines: PriceLine[] = [{ code: PRICING.report.code, label: "Personalised astrology report (web + PDF)", amountPaise: base }];
  if (includeQuestions) {
    lines.push({
      code: PRICING.questionsAddon.code,
      label: `${PRICING.questionsAddon.questionCount} personalised questions (bundle)`,
      amountPaise: addon,
    });
  }
  return {
    pricingVersion: PRICING_VERSION,
    currency: CURRENCY,
    product: "personal",
    packageCode: includeQuestions ? "report_with_questions" : "report",
    includesQuestions: includeQuestions,
    questionCount: includeQuestions ? PRICING.questionsAddon.questionCount : 0,
    baseAmountPaise: base,
    addonAmountPaise: addon,
    totalAmountPaise: base + addon,
    lines,
  };
}

/** Compatibility: one price for the pair, whatever the category. No add-ons. */
export function quoteCompatibility(): PriceQuote {
  const total = PRICING.compatibility.amountPaise;
  return {
    pricingVersion: PRICING_VERSION,
    currency: CURRENCY,
    product: "compatibility",
    packageCode: "compatibility_pair",
    includesQuestions: false,
    questionCount: 0,
    baseAmountPaise: total,
    addonAmountPaise: 0,
    totalAmountPaise: total,
    lines: [{ code: PRICING.compatibility.code, label: "Compatibility report for two people (web + PDF)", amountPaise: total }],
  };
}

export function productForPackage(packageCode: PackageCode): Product {
  return packageCode === "compatibility_pair" ? "compatibility" : "personal";
}

export function packageIncludesQuestions(packageCode: PackageCode): boolean {
  return packageCode === "report_with_questions";
}

/** "₹49" / "₹69" - whole rupees when possible, otherwise two decimals. */
export function formatInr(paise: number): string {
  const rupees = paise / 100;
  const formatted = Number.isInteger(rupees)
    ? rupees.toLocaleString("en-IN")
    : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${formatted}`;
}

/** Converts paise to the decimal rupee amount payment providers expect (4900 -> 49). */
export function paiseToRupeeAmount(paise: number): number {
  if (!Number.isInteger(paise) || paise <= 0) throw new Error("Amount must be a positive integer of paise");
  return Math.round(paise) / 100;
}

/**
 * Converts a provider's decimal rupee amount back to paise without floating-point
 * surprises ("49.00", 49, 49.0 -> 4900). Returns null for anything malformed.
 */
export function rupeeAmountToPaise(amount: unknown): number | null {
  const text = typeof amount === "number" ? amount.toFixed(2) : typeof amount === "string" ? amount.trim() : "";
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "0").padEnd(2, "0"));
  return whole * 100 + fraction;
}
