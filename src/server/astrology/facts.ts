import type { Fact } from "@/domain/astrology/chart-types";
import { normalizeDegrees } from "@/domain/astrology/constants";
import { signedDelta } from "./ephemeris";

/**
 * Builds a Fact from values evaluated at every sampled instant of the possible birth
 * window: "known" only when every sample agrees.
 */
export function factFromSamples<T>(values: T[], statedValue: T | null, equals: (a: T, b: T) => boolean = Object.is): Fact<T> {
  if (values.length === 0) throw new Error("No samples");
  const unique: T[] = [];
  for (const v of values) {
    if (!unique.some((u) => equals(u, v))) unique.push(v);
  }
  // When every sample agrees, report the value at the stated time (it may carry
  // detail such as an exact degree that differs harmlessly between samples).
  if (unique.length === 1) return { status: "known", value: statedValue ?? unique[0]! };
  return { status: "uncertain", candidates: unique, atStatedTime: statedValue };
}

export function knownValue<T>(fact: Fact<T>): T | null {
  return fact.status === "known" ? fact.value : null;
}

/** Best available value: the known value, or the value at the stated time. */
export function bestValue<T>(fact: Fact<T>): T | null {
  if (fact.status === "known") return fact.value;
  if (fact.status === "uncertain") return fact.atStatedTime;
  return null;
}

/** [min, max] of a continuously moving longitude across samples (unwrapped, degrees). */
export function longitudeRange(samples: number[]): [number, number] {
  const first = samples[0]!;
  let current = first;
  let min = first;
  let max = first;
  for (let i = 1; i < samples.length; i += 1) {
    current += signedDelta(samples[i - 1]!, samples[i]!);
    min = Math.min(min, current);
    max = Math.max(max, current);
  }
  // Start in [0, 360); the end may exceed 360 when the range crosses 0° Aries.
  const start = normalizeDegrees(min);
  return [round4(start), round4(start + (max - min))];
}

export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Evenly spaced instants from start to end inclusive, always including `extra` points. */
export function sampleInstants(startMs: number, endMs: number, stepMs: number, extra: number[] = []): number[] {
  const points = new Set<number>(extra);
  for (let t = startMs; t < endMs; t += stepMs) points.add(t);
  points.add(endMs);
  return [...points].sort((a, b) => a - b);
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
