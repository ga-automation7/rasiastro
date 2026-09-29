import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetEnvCacheForTests } from "@/server/config/env";
import { setDbForTests, type Database } from "@/server/db";
import { runMigrations } from "@/server/db/migrate";
import { createPgliteDatabase } from "@/server/db/pglite";
import { setEmailProviderForTests, type EmailProvider, type OutgoingEmail } from "@/server/delivery/email";
import { setInterpretationProviderForTests } from "@/server/interpretation/service";
import { setPaymentProviderForTests } from "@/server/payments/service";
import { seedDemoPlaces } from "@/server/places/repository";
import { setPdfRendererForTests } from "@/server/reports/pdf";
import { setStorageForTests } from "@/server/storage";
import type { OrderInputRaw } from "@/domain/order-input";

/**
 * Each test file runs in its own process (vitest "forks" pool) with a fresh
 * in-memory PostgreSQL (PGlite) and demo adapters, so tests never touch real
 * services or a developer's credentials.
 */
export function setTestEnv(overrides: Record<string, string | undefined> = {}): void {
  const base: Record<string, string | undefined> = {
    NODE_ENV: "test",
    APP_MODE: "demo",
    PUBLIC_SITE_URL: "http://localhost:3000",
    JOB_RUNNER: "local",
    STORAGE_PROVIDER: "local",
    LOCAL_STORAGE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "rasi-test-storage-")),
    DATABASE_URL: undefined,
    CASHFREE_CLIENT_ID: undefined,
    CASHFREE_CLIENT_SECRET: undefined,
    OPENAI_API_KEY: undefined,
    OPENAI_MODEL: undefined,
    RESEND_API_KEY: undefined,
    VERCEL_ENV: undefined,
    OWNER_ALERT_EMAIL: undefined,
    DEMO_USE_REAL_AI: "false",
    DEMO_SEND_REAL_EMAIL: "false",
    // Reset everything a test may have set, so settings never leak between tests.
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    CASHFREE_ENV: undefined,
    APP_SECRET: undefined,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    INNGEST_EVENT_KEY: undefined,
    INNGEST_SIGNING_KEY: undefined,
    INNGEST_DEV: undefined,
    BUSINESS_LEGAL_NAME: undefined,
    BUSINESS_ADDRESS: undefined,
    GRIEVANCE_OFFICER_NAME: undefined,
    SUPPORT_PHONE: undefined,
    PERSONAL_ORDERS_ENABLED: undefined,
    COMPATIBILITY_ORDERS_ENABLED: undefined,
    OPENAI_MODEL_COMPATIBILITY: undefined,
  };
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCacheForTests();
}

export async function setupTestDb(): Promise<Database> {
  const db = await createPgliteDatabase(null);
  await runMigrations(db);
  await seedDemoPlaces(db);
  setDbForTests(db);
  return db;
}

export class CapturingEmailProvider implements EmailProvider {
  readonly id = "demo-file" as const;
  sent: OutgoingEmail[] = [];
  failWith: Error | null = null;
  async send(email: OutgoingEmail) {
    if (this.failWith) throw this.failWith;
    this.sent.push(email);
    return { messageId: `test-${this.sent.length}` };
  }
}

export function stubPdf(): void {
  setPdfRendererForTests(async () => ({ pdf: new TextEncoder().encode("%PDF-1.7 test"), renderer: "test" }));
}

export function resetOverrides(): void {
  setInterpretationProviderForTests(null);
  setPaymentProviderForTests(null);
  setEmailProviderForTests(null);
  setStorageForTests(null);
  setPdfRendererForTests(null);
}

export function orderInput(overrides: Partial<OrderInputRaw> = {}, birth: Partial<OrderInputRaw["birth"]> = {}): OrderInputRaw {
  return {
    tradition: "indian",
    language: "ta",
    birth: {
      subjectName: "Test Person",
      birthDate: "1990-08-15",
      timeCertainty: "exact",
      birthTime: "06:30",
      timeWindowMinutes: null,
      dstChoice: null,
      placeId: "demo:chennai",
      ...birth,
    },
    known: { moonSign: null, nakshatra: null, pada: null, ascendant: null, otherDetails: null },
    additionalContext: null,
    includeQuestions: false,
    questions: [],
    email: "customer@example.com",
    phone: "9876543210",
    consentProcessing: true,
    adultConfirmed: true,
    ...overrides,
  };
}

export const THREE_QUESTIONS = [
  "What themes may shape my career in the next two years?",
  "How can I bring more patience to my relationships?",
  "What should I focus on for personal growth this year?",
];
