import { beforeAll, describe, expect, it } from "vitest";
import { formatUtcOffset, localDayRange, resolveLocalTime } from "@/domain/birth-time";
import { getDb } from "@/server/db";
import { isDstPrompt, resolveBirth } from "@/server/orders/resolve-birth";
import { findBirthplaces } from "@/server/places/service";
import { previewOrder } from "@/server/orders/service";
import { orderInput, setTestEnv, setupTestDb } from "./helpers";

describe("historical time-zone resolution", () => {
  const at = (tz: string, y: number, m: number, d: number, h: number, min: number) => resolveLocalTime(tz, { year: y, month: m, day: d }, { hour: h, minute: min });

  it("uses India's historical offsets, including wartime time", () => {
    const modern = at("Asia/Kolkata", 1990, 8, 15, 6, 30);
    expect(modern.kind === "unique" && formatUtcOffset(modern.instant.offsetSeconds)).toBe("UTC+05:30");
    expect(modern.kind === "unique" && new Date(modern.instant.utcMs).toISOString()).toBe("1990-08-15T01:00:00.000Z");
    const war = at("Asia/Kolkata", 1943, 6, 1, 10, 0);
    expect(war.kind === "unique" && formatUtcOffset(war.instant.offsetSeconds)).toBe("UTC+06:30");
  });

  it("detects a repeated hour (clocks going back) instead of guessing", () => {
    const r = at("America/New_York", 2021, 11, 7, 1, 30);
    expect(r.kind).toBe("overlap");
    if (r.kind === "overlap") {
      expect(formatUtcOffset(r.earlier.offsetSeconds)).toBe("UTC-04:00");
      expect(formatUtcOffset(r.later.offsetSeconds)).toBe("UTC-05:00");
    }
  });

  it("detects a skipped hour (clocks going forward)", () => {
    expect(at("America/New_York", 2021, 3, 14, 2, 30).kind).toBe("gap");
  });

  it("applies British Standard Time (1968-71) and daylight saving in London", () => {
    const bst = at("Europe/London", 1970, 1, 15, 12, 0);
    expect(bst.kind === "unique" && formatUtcOffset(bst.instant.offsetSeconds)).toBe("UTC+01:00");
    const winter = at("Europe/London", 1990, 1, 15, 12, 0);
    expect(winter.kind === "unique" && formatUtcOffset(winter.instant.offsetSeconds)).toBe("UTC+00:00");
  });

  it("covers the whole local day when the time is unknown", () => {
    const day = localDayRange("Asia/Kolkata", { year: 1990, month: 8, day: 15 });
    expect(new Date(day.startMs).toISOString()).toBe("1990-08-14T18:30:00.000Z");
    expect(day.endMs - day.startMs).toBe(24 * 3_600_000 - 1000);
  });
});

describe("birth resolution with the place database", () => {
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  it("returns several candidates for an ambiguous place name so the customer must choose", async () => {
    const results = await findBirthplaces("Hyderabad");
    const countries = results.map((r) => r.countryCode).sort();
    expect(countries).toEqual(["IN", "PK"]);
    const salem = await findBirthplaces("salem");
    expect(salem.length).toBe(3);
  });

  it("finds places by alternate and native-script names", async () => {
    expect((await findBirthplaces("Madras"))[0]?.id).toBe("demo:chennai");
    expect((await findBirthplaces("சென்னை"))[0]?.id).toBe("demo:chennai");
    expect((await findBirthplaces("bangalore"))[0]?.id).toBe("demo:bengaluru");
  });

  it("never stores a birth moment for an unknown time", async () => {
    const r = await resolveBirth(await getDb(), orderInput({}, { timeCertainty: "unknown", birthTime: null }).birth as never);
    expect(isDstPrompt(r)).toBe(false);
    if (!isDstPrompt(r)) {
      expect(r.birthUtc).toBeNull();
      expect(r.offsetResolution).toBe("date_only");
    }
  });

  it("asks the customer to choose when the time happened twice", async () => {
    const preview = await previewOrder(orderInput({}, { placeId: "demo:new-york", birthDate: "2021-11-07", birthTime: "01:30" }), "dst-test");
    expect(preview.dstOverlap).not.toBeNull();
    const chosen = await previewOrder(orderInput({}, { placeId: "demo:new-york", birthDate: "2021-11-07", birthTime: "01:30", dstChoice: "later" }), "dst-test");
    expect(chosen.dstOverlap).toBeNull();
    expect(chosen.birth?.utcOffsetLabel).toBe("UTC-05:00");
  });

  it("rejects a time that did not exist locally", async () => {
    await expect(previewOrder(orderInput({}, { placeId: "demo:new-york", birthDate: "2021-03-14", birthTime: "02:30" }), "gap-test")).rejects.toThrow(/did not exist/);
  });
});
