import { describe, expect, it } from "vitest";
import { BirthDetailsSchema, TIME_WINDOW_OPTIONS } from "@/domain/order-input";
import { APPROX_BLOCKS, APPROX_BLOCK_WINDOW, approxBlockPatch, certaintyPatch, dobStatus, firstName, parseDateText, personalBirthErrors, personalTimeLabel, selectedApproxBlock, timeComplete } from "@/components/order/birth-input";
import { EMPTY_BIRTH, birthInput, time24, type BirthFieldsState } from "@/components/order/person";

// The personal birth step changes only how details are typed in. These tests pin the
// payload it produces to the same shape and rules the order API has always used.

const TODAY = new Date("2026-09-30T12:00:00Z");
const PLACE = { id: "demo-chennai", name: "Chennai", region: "Tamil Nadu", country: "India", timezoneId: "Asia/Kolkata" };

function filled(patch: Partial<BirthFieldsState> = {}): BirthFieldsState {
  return { ...EMPTY_BIRTH, subjectName: "Priya Raman", day: "07", month: "10", year: "1990", timeCertainty: "exact", hour12: "6", minute: "30", meridiem: "AM", place: PLACE, ...patch };
}

describe("typed and pasted dates", () => {
  it("reads the common Indian formats, day first", () => {
    const want = { day: "07", month: "10", year: "2003" };
    for (const text of ["07/10/2003", "7/10/2003", "7-10-2003", "07.10.2003", "07 10 2003", "07102003", "2003-10-07", " 07/10/2003 "]) {
      expect(parseDateText(text), text).toEqual(want);
    }
  });

  it("returns nothing for text that is not a date", () => {
    for (const text of ["", "abc", "07/10", "7/10/03", "2003", "07/1O/2003", "071003"]) {
      expect(parseDateText(text), text).toBeNull();
    }
  });
});

describe("date of birth checks (same rules as the server)", () => {
  const status = (d: string, m: string, y: string) => dobStatus(d, m, y, TODAY);

  it("waits for a complete date before judging it", () => {
    expect(status("", "", "")).toBe("empty");
    expect(status("07", "", "")).toBe("incomplete");
    expect(status("07", "10", "199")).toBe("incomplete");
  });

  it("knows leap years", () => {
    expect(status("29", "02", "2000")).toBe("ok");
    expect(status("29", "02", "1996")).toBe("ok");
    expect(status("29", "02", "1999")).toBe("invalid");
    expect(status("29", "02", "1900")).toBe("invalid");
  });

  it("rejects impossible days and months", () => {
    expect(status("31", "04", "1990")).toBe("invalid");
    expect(status("32", "01", "1990")).toBe("invalid");
    expect(status("00", "01", "1990")).toBe("invalid");
    expect(status("10", "13", "1990")).toBe("invalid");
    expect(status("10", "00", "1990")).toBe("invalid");
  });

  it("rejects future dates, dates before 1900 and people under 18", () => {
    expect(status("01", "10", "2026")).toBe("future");
    expect(status("31", "12", "1899")).toBe("too_early");
    expect(status("01", "01", "1900")).toBe("ok");
    expect(status("01", "10", "2008")).toBe("under_age");
    expect(status("30", "09", "2008")).toBe("ok");
  });

  it("accepts single digit day and month", () => {
    expect(status("7", "1", "1990")).toBe("ok");
    expect(birthInput(filled({ day: "7", month: "1" })).birthDate).toBe("1990-01-07");
  });
});

describe("approximate time of day", () => {
  it("maps every block to its centre with a two hour window, an allowed window", () => {
    expect(TIME_WINDOW_OPTIONS).toContain(APPROX_BLOCK_WINDOW);
    const centres: Record<string, string> = { late_night: "02:00", early_morning: "06:00", morning: "10:00", afternoon: "14:00", evening: "18:00", night: "22:00" };
    for (const block of APPROX_BLOCKS) {
      const s = filled({ ...certaintyPatch("approximate"), ...approxBlockPatch(block.key) });
      expect(time24(s)).toBe(centres[block.key]);
      expect(s.timeWindowMinutes).toBe(120);
      expect(selectedApproxBlock(s)).toBe(block.key);
      const payload = birthInput(s);
      expect(payload).toMatchObject({ timeCertainty: "approximate", birthTime: centres[block.key], timeWindowMinutes: 120 });
      expect(BirthDetailsSchema.safeParse(payload).success).toBe(true);
    }
  });

  it("the six blocks cover the whole day without gaps", () => {
    const covered = APPROX_BLOCKS.map((b) => Number(b.center.slice(0, 2)) - 2);
    expect(covered).toEqual([0, 4, 8, 12, 16, 20]);
  });

  it("the review shows the chosen time of day", () => {
    expect(personalTimeLabel(filled({ ...certaintyPatch("approximate"), ...approxBlockPatch("early_morning") }))).toBe("Early morning, 4 AM to 8 AM · approximate");
    expect(personalTimeLabel(filled())).toBe("6:30 AM (06:30) · exact");
  });

  it("a precise approximate time is not mistaken for a block", () => {
    const s = filled({ timeCertainty: "approximate", hour12: "6", minute: "00", meridiem: "AM", timeWindowMinutes: 30 });
    expect(selectedApproxBlock(s)).toBeNull();
    expect(personalTimeLabel(s)).toBe("6:00 AM (06:00) · approximate, ± 30 min");
    expect(BirthDetailsSchema.safeParse(birthInput(s)).success).toBe(true);
  });
});

describe("switching how sure the time is", () => {
  it("never carries a stale time from one mode to another", () => {
    let s = filled({ timeCertainty: "exact", hour12: "11", minute: "45", meridiem: "PM" });
    s = { ...s, ...certaintyPatch("approximate") };
    expect(s).toMatchObject({ hour12: "", minute: "", meridiem: "", timeWindowMinutes: null, dstChoice: null });
    expect(personalBirthErrors(s, TODAY)["birth.timeWindowMinutes"]).toBeDefined();

    s = { ...s, ...approxBlockPatch("evening") };
    s = { ...s, ...certaintyPatch("exact") };
    expect(s.timeWindowMinutes).toBeNull();
    expect(time24(s)).toBeNull();
    expect(personalBirthErrors(s, TODAY)["birth.birthTime"]).toBeDefined();
  });

  it("unknown time sends no time and no window", () => {
    const s = filled({ ...certaintyPatch("unknown") });
    const payload = birthInput(s);
    expect(payload).toMatchObject({ timeCertainty: "unknown", birthTime: null, timeWindowMinutes: null, dstChoice: null });
    expect(BirthDetailsSchema.safeParse(payload).success).toBe(true);
    expect(personalBirthErrors(s, TODAY)).toEqual({});
  });

  it("an exact time sends no window, and 12 AM / 12 PM mean midnight / noon", () => {
    expect(birthInput(filled({ hour12: "12", minute: "05", meridiem: "AM" }))).toMatchObject({ birthTime: "00:05", timeWindowMinutes: null });
    expect(birthInput(filled({ hour12: "12", minute: "05", meridiem: "PM" })).birthTime).toBe("12:05");
    expect(birthInput(filled({ hour12: "9", minute: "7", meridiem: "PM" })).birthTime).toBe("21:07");
  });
});

describe("personal step checks", () => {
  it("a complete step has no problems and passes the server schema", () => {
    const s = filled();
    expect(personalBirthErrors(s, TODAY)).toEqual({});
    expect(BirthDetailsSchema.safeParse(birthInput(s)).success).toBe(true);
  });

  it("names in any script are accepted", () => {
    for (const name of ["Priya", "பிரியா ராமன்", "प्रिया शर्मा", "ప్రియ", "ಪ್ರಿಯಾ", "പ്രിയ", "Anne Marie O'Neil", "Zoë Faure"]) {
      const s = filled({ subjectName: name });
      expect(personalBirthErrors(s, TODAY)["birth.subjectName"], name).toBeUndefined();
      expect(BirthDetailsSchema.safeParse(birthInput(s)).success, name).toBe(true);
    }
    expect(personalBirthErrors(filled({ subjectName: " a " }), TODAY)["birth.subjectName"]).toBeDefined();
  });

  it("flags each missing or wrong field with its own message", () => {
    const e = personalBirthErrors({ ...EMPTY_BIRTH }, TODAY);
    expect(Object.keys(e).sort()).toEqual(["birth.birthDate", "birth.placeId", "birth.subjectName", "birth.timeCertainty"]);
    expect(personalBirthErrors(filled({ day: "31", month: "02" }), TODAY)["birth.birthDate"]).toBe("Enter a valid date.");
    expect(personalBirthErrors(filled({ hour12: "13" }), TODAY)["birth.birthTime"]).toBeDefined();
    expect(personalBirthErrors(filled({ minute: "60" }), TODAY)["birth.birthTime"]).toBeDefined();
    expect(personalBirthErrors(filled({ meridiem: "" }), TODAY)["birth.birthTime"]).toBeDefined();
    expect(personalBirthErrors(filled({ place: null }), TODAY)["birth.placeId"]).toBe("Choose a location from the suggestions.");
  });

  it("time completeness and first names", () => {
    expect(timeComplete({ hour12: "6", minute: "30", meridiem: "AM" })).toBe(true);
    expect(timeComplete({ hour12: "0", minute: "30", meridiem: "AM" })).toBe(false);
    expect(timeComplete({ hour12: "6", minute: "", meridiem: "AM" })).toBe(false);
    expect(firstName("  Priya Raman ")).toBe("Priya");
    expect(firstName("A")).toBe("");
  });
});
