import type { CalculationWindow, ChartInput } from "@/domain/astrology/chart-types";
import { sampleInstants } from "./facts";

export interface SamplingPlan {
  /** Stated birth instant, or null when the time is unknown. */
  stated: number | null;
  /** Every instant evaluated (includes the stated instant). */
  samples: number[];
  /** Whether time-sensitive points (ascendant, houses) can be evaluated at all. */
  timeKnown: boolean;
  window: CalculationWindow;
}

const MINUTE = 60_000;

/**
 * Which instants to evaluate:
 * - exact: just the birth moment;
 * - approximate: every 10 minutes across +/- the stated window (the ascendant moves
 *   at most ~5 degrees in 10 minutes, so no sign can be skipped);
 * - unknown: every 30 minutes across the whole local birth day, only to test which
 *   facts are the same all day. No single moment is ever treated as the birth time.
 */
export function planSamples(input: ChartInput): SamplingPlan {
  if (input.timeCertainty === "unknown" || input.birthUtcMs === null) {
    const samples = sampleInstants(input.dayStartUtcMs, input.dayEndUtcMs, 30 * MINUTE);
    return {
      stated: null,
      samples,
      timeKnown: false,
      window: {
        certainty: "unknown",
        statedUtc: null,
        startUtc: new Date(input.dayStartUtcMs).toISOString(),
        endUtc: new Date(input.dayEndUtcMs).toISOString(),
        windowMinutes: null,
      },
    };
  }
  if (input.timeCertainty === "approximate") {
    const w = (input.windowMinutes ?? 60) * MINUTE;
    const start = input.birthUtcMs - w;
    const end = input.birthUtcMs + w;
    return {
      stated: input.birthUtcMs,
      samples: sampleInstants(start, end, 10 * MINUTE, [input.birthUtcMs]),
      timeKnown: true,
      window: {
        certainty: "approximate",
        statedUtc: new Date(input.birthUtcMs).toISOString(),
        startUtc: new Date(start).toISOString(),
        endUtc: new Date(end).toISOString(),
        windowMinutes: input.windowMinutes,
      },
    };
  }
  return {
    stated: input.birthUtcMs,
    samples: [input.birthUtcMs],
    timeKnown: true,
    window: {
      certainty: "exact",
      statedUtc: new Date(input.birthUtcMs).toISOString(),
      startUtc: new Date(input.birthUtcMs).toISOString(),
      endUtc: new Date(input.birthUtcMs).toISOString(),
      windowMinutes: null,
    },
  };
}

/** Index of the stated instant within the samples (or the middle sample). */
export function statedIndex(plan: SamplingPlan): number {
  if (plan.stated === null) return Math.floor(plan.samples.length / 2);
  return plan.samples.indexOf(plan.stated);
}
