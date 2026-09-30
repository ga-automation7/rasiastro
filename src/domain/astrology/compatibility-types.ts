import type { CompatibilityCategory } from "@/config/compatibility";
import type { Aspect, Fact, TimeCertainty } from "./chart-types";
import type { NakshatraKey, SignKey, VedicGraha, WesternBody } from "./constants";

/**
 * Cross-chart analysis for a compatibility report. Like ChartData, this is produced
 * by calculation code only; the AI interprets it but never produces it.
 *
 * Deliberately there is NO total score or percentage. Traditional point systems
 * (for example Ashtakoota) assume bride/groom roles and a marriage context, so each
 * factor is shown on its own, descriptively, with its certainty.
 */
export type PersonIndex = 0 | 1;

export type Gana = "deva" | "manushya" | "rakshasa";
export type Nadi = "adi" | "madhya" | "antya";
export type YoniAnimal =
  | "horse"
  | "elephant"
  | "sheep"
  | "serpent"
  | "dog"
  | "cat"
  | "rat"
  | "cow"
  | "buffalo"
  | "tiger"
  | "deer"
  | "monkey"
  | "mongoose"
  | "lion";
export type TaraName = "janma" | "sampat" | "vipat" | "kshema" | "pratyak" | "sadhana" | "naidhana" | "mitra" | "parama_mitra";
export type Friendship = "same" | "friend" | "neutral" | "enemy";
export type SignAxis = "1/1" | "2/12" | "3/11" | "4/10" | "5/9" | "6/8" | "7/7";

export interface MoonSignRelation {
  /** Sign count from person A's Moon sign to person B's (1-12), and back. */
  aToB: number;
  bToA: number;
  axis: SignAxis;
  /** Traditional Bhakoot reading (shown for relationship and marriage only). */
  bhakootTraditionallyChallenging: boolean;
}

export interface TaraRelation {
  aToB: { count: number; tara: TaraName; traditionallyChallenging: boolean };
  bToA: { count: number; tara: TaraName; traditionallyChallenging: boolean };
}

export type IndianFactor =
  | { key: "moon_sign_relationship"; result: Fact<MoonSignRelation> }
  | { key: "tara"; result: Fact<TaraRelation> }
  | { key: "gana"; result: Fact<{ a: Gana; b: Gana; same: boolean }> }
  | { key: "graha_maitri"; result: Fact<{ aLord: VedicGraha; bLord: VedicGraha; aTowardB: Friendship; bTowardA: Friendship }> }
  | { key: "yoni"; result: Fact<{ a: YoniAnimal; b: YoniAnimal; relation: "same" | "traditionally_opposed" | "different" }> }
  | { key: "nadi"; result: Fact<{ a: Nadi; b: Nadi; same: boolean }> };

export type IndianFactorKey = IndianFactor["key"];

export interface IndianPersonSummary {
  timeCertainty: TimeCertainty;
  moonSign: Fact<SignKey>;
  nakshatra: Fact<NakshatraKey>;
  lagnaSign: Fact<SignKey>;
}

export interface IndianPairAnalysis {
  kind: "indian";
  category: CompatibilityCategory;
  people: [IndianPersonSummary, IndianPersonSummary];
  /** Only the factors examined for this category, in reading order. */
  factors: IndianFactor[];
}

export type PairPoint = WesternBody | "ascendant";

export interface InterAspect {
  /** Person A's point, person B's point. */
  a: PairPoint;
  b: PairPoint;
  type: Aspect["type"];
  /** Orb at the stated times; when a birth time is unknown, the orb at the middle of the possible range. */
  orb: number | null;
  /** True when the orb is taken from the middle of an unknown birth time's range. */
  orbApproximate?: boolean;
  /** "uncertain": holds for some but not all possible birth times. */
  certainty: "known" | "uncertain";
  /** True when this pair of points is emphasised for the chosen category. */
  focus: boolean;
}

export interface HouseOverlay {
  /** The person whose planets are placed... */
  from: PersonIndex;
  /** ...into this person's houses. */
  into: PersonIndex;
  placements: { body: WesternBody; house: Fact<number> }[];
}

export interface WesternPersonSummary {
  timeCertainty: TimeCertainty;
  sun: Fact<SignKey>;
  moon: Fact<SignKey>;
  ascendant: Fact<SignKey>;
  elementBalance: Record<"fire" | "earth" | "air" | "water", number>;
  modalityBalance: Record<"cardinal" | "fixed" | "mutable", number>;
}

export interface WesternPairAnalysis {
  kind: "western";
  category: CompatibilityCategory;
  people: [WesternPersonSummary, WesternPersonSummary];
  interAspects: InterAspect[];
  overlays: HouseOverlay[];
  /** Overlays not calculated because the receiving chart needs an exact birth time. */
  overlaysOmitted: { from: PersonIndex; into: PersonIndex }[];
  focusBodies: WesternBody[];
}

export type PairAnalysis = IndianPairAnalysis | WesternPairAnalysis;
