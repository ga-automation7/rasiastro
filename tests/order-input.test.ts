import { describe, expect, it } from "vitest";
import { OrderInputSchema, normalizePhone } from "@/domain/order-input";
import { orderInput, THREE_QUESTIONS } from "./helpers";

const parse = (value: unknown) => OrderInputSchema.safeParse(value);

describe("order input validation", () => {
  it("accepts a complete report-only order", () => {
    expect(parse(orderInput()).success).toBe(true);
  });

  it("requires all three questions when the add-on is selected", () => {
    expect(parse(orderInput({ includeQuestions: true, questions: THREE_QUESTIONS })).success).toBe(true);
    expect(parse(orderInput({ includeQuestions: true, questions: THREE_QUESTIONS.slice(0, 2) })).success).toBe(false);
    expect(parse(orderInput({ includeQuestions: true, questions: [THREE_QUESTIONS[0]!, THREE_QUESTIONS[1]!, "short"] })).success).toBe(false);
    expect(parse(orderInput({ includeQuestions: true, questions: [...THREE_QUESTIONS, "a fourth question that is not allowed"] })).success).toBe(false);
  });

  it("does not accept questions without the paid add-on (answer eligibility)", () => {
    const result = parse(orderInput({ includeQuestions: false, questions: THREE_QUESTIONS }));
    expect(result.success).toBe(false);
  });

  it("drops empty question slots when the add-on is removed", () => {
    const result = parse(orderInput({ includeQuestions: false, questions: ["", "", ""] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.questions).toEqual([]);
  });

  it("never accepts a time for an unknown birth time, and requires one otherwise", () => {
    expect(parse(orderInput({}, { timeCertainty: "unknown", birthTime: null })).success).toBe(true);
    expect(parse(orderInput({}, { timeCertainty: "unknown", birthTime: "12:00" })).success).toBe(false);
    expect(parse(orderInput({}, { timeCertainty: "exact", birthTime: null })).success).toBe(false);
    expect(parse(orderInput({}, { timeCertainty: "exact", birthTime: "25:00" })).success).toBe(false);
  });

  it("requires an uncertainty window for approximate times", () => {
    expect(parse(orderInput({}, { timeCertainty: "approximate", timeWindowMinutes: null })).success).toBe(false);
    expect(parse(orderInput({}, { timeCertainty: "approximate", timeWindowMinutes: 60 })).success).toBe(true);
    expect(parse(orderInput({}, { timeCertainty: "approximate", timeWindowMinutes: 45 })).success).toBe(false);
  });

  it("rejects impossible or future dates", () => {
    expect(parse(orderInput({}, { birthDate: "1990-02-30" })).success).toBe(false);
    expect(parse(orderInput({}, { birthDate: "1899-12-31" })).success).toBe(false);
    expect(parse(orderInput({}, { birthDate: "2999-01-01" })).success).toBe(false);
  });

  it("keeps nakshatra details for Indian reports only", () => {
    const known = { moonSign: null, nakshatra: "rohini" as const, pada: 2, ascendant: null, otherDetails: null };
    expect(parse(orderInput({ known })).success).toBe(true);
    expect(parse(orderInput({ tradition: "western", known })).success).toBe(false);
  });

  it("requires consent and a valid email", () => {
    expect(parse({ ...orderInput(), consentProcessing: false }).success).toBe(false);
    expect(parse({ ...orderInput(), email: "not-an-email" }).success).toBe(false);
  });

  it("limits free text and rejects control characters", () => {
    expect(parse(orderInput({ additionalContext: "x".repeat(1001) })).success).toBe(false);
    expect(parse(orderInput({}, { subjectName: "Bad\u0000Name" })).success).toBe(false);
  });

  it("normalises Indian and international mobile numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("098765 43210")).toBe("9876543210");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("accepts Unicode names in every supported script", () => {
    for (const name of ["முருகன் செல்வம்", "राम शर्मा", "శ్రీనివాస్", "ಅನಿತಾ ರಾವ್", "അനൂപ് നായർ", "José O'Neil-Smith"]) {
      expect(parse(orderInput({}, { subjectName: name })).success).toBe(true);
    }
  });
});
