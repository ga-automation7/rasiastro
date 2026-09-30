import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { assertCanTakeOrders } from "@/server/orders/service";
import { findBirthplaces, getPlacesAvailability } from "@/server/places/service";
import { setTestEnv, setupTestDb } from "./helpers";

/**
 * Birthplace search and ordering must fail safely: sandbox and live never use the
 * small demo list, and without the real gazetteer ordering stays closed with a
 * customer-safe message instead of a broken form.
 */
const SANDBOX = {
  APP_MODE: "sandbox",
  CASHFREE_ENV: "sandbox",
  PUBLIC_SITE_URL: "https://rasi-astro.vercel.app",
  APP_SECRET: "x".repeat(40),
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  CASHFREE_CLIENT_ID: "id",
  CASHFREE_CLIENT_SECRET: "secret",
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "some-model",
  RESEND_API_KEY: "re_test",
  STORAGE_PROVIDER: "supabase",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  JOB_RUNNER: "inngest",
  INNGEST_EVENT_KEY: "evt",
  INNGEST_SIGNING_KEY: "sign",
};

describe("birthplace search", () => {
  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  it("works from the demo list in demo mode", async () => {
    setTestEnv();
    const places = await findBirthplaces("Chennai");
    expect(places.length).toBeGreaterThan(0);
    expect((await getPlacesAvailability(await getDb())).ok).toBe(true);
  });

  it("never offers demo places in sandbox or live, and ordering stays closed without the gazetteer", async () => {
    setTestEnv(SANDBOX);
    expect(await findBirthplaces("Chennai")).toEqual([]);
    expect((await getPlacesAvailability(await getDb())).ok).toBe(false);
    await expect(assertCanTakeOrders("personal", { tradition: "indian", language: "en" })).rejects.toMatchObject({ message: expect.stringMatching(/not open yet/) });
    await expect(assertCanTakeOrders("compatibility", { tradition: "indian", language: "en" })).rejects.toMatchObject({ message: expect.stringMatching(/not open yet/) });
    setTestEnv();
  });

  it("ignores too-short queries without error", async () => {
    setTestEnv();
    expect(await findBirthplaces("C")).toEqual([]);
  });
});
