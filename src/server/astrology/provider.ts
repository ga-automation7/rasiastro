import type { ChartInput, ChartResult } from "@/domain/astrology/chart-types";
import { EPHEMERIS_NAME } from "./ephemeris";
import { buildVedicChart } from "./vedic";
import { buildWesternChart } from "./western";

/**
 * Chart calculation boundary. A commercial provider (e.g. a licensed Swiss Ephemeris
 * build or a hosted astrology API) can replace the built-in engine by implementing
 * this interface; everything downstream consumes ChartResult only.
 */
export interface CalculationProvider {
  readonly id: string;
  readonly version: string;
  supports(tradition: ChartInput["tradition"]): boolean;
  calculate(input: ChartInput): Promise<ChartResult>;
}

/**
 * Bump when any calculation rule changes (ayanamsa, house system, dasha year, orbs,
 * sampling). Stored with each chart so old reports remain explainable.
 */
export const CALCULATION_VERSION = "rasi-calc-1.0.0";

export const builtInCalculationProvider: CalculationProvider = {
  id: "rasi-astro-builtin",
  version: CALCULATION_VERSION,
  supports: () => true,
  async calculate(input) {
    const chart = input.tradition === "indian" ? buildVedicChart(input) : buildWesternChart(input);
    return {
      provider: "rasi-astro-builtin",
      providerVersion: EPHEMERIS_NAME,
      calculationVersion: CALCULATION_VERSION,
      settings: {
        tradition: input.tradition,
        timeCertainty: input.timeCertainty,
        windowMinutes: input.windowMinutes,
        latitude: input.latitude,
        longitude: input.longitude,
        timeZoneId: input.timeZoneId,
        referenceDate: input.referenceDate.toISOString().slice(0, 10),
      },
      chart,
    };
  },
};

export function getCalculationProvider(): CalculationProvider {
  return builtInCalculationProvider;
}
