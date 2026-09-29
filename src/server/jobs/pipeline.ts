import type { ChartData, ChartInput } from "@/domain/astrology/chart-types";
import { localDayRange, parseIsoDate } from "@/domain/birth-time";
import { packageIncludesQuestions } from "@/domain/pricing";
import { getCalculationProvider } from "../astrology/provider";
import { getDb, jsonParam, type SqlExecutor } from "../db";
import { buildInterpretationInput, type InterpretationInput } from "../interpretation/input";
import { PROMPT_VERSION } from "../interpretation/prompt-v1";
import { AiConfigurationError } from "../interpretation/provider";
import { REPORT_SCHEMA_VERSION, type InterpretationParts } from "../interpretation/schema";
import { generatePart, getInterpretationProvider, getStoredPart, summariseCore } from "../interpretation/service";
import { log, scrubText } from "../log";
import { alertOwner } from "../ops/alerts";
import { getBirthDetails, getContext, getOrder, getQuestions, recordFunnelEvent, type Order, type StoredBirthDetails } from "../orders/repository";
import { findDiscrepancies } from "../reports/discrepancies";
import type { ReportDocument } from "../reports/document";
import { selectPeriods } from "../reports/periods";
import { renderPdf } from "../reports/pdf";
import { sha256Hex } from "../security/crypto";
import { getStorage } from "../storage";
import { enqueueOutbox } from "./outbox";

/**
 * Report generation as a sequence of idempotent steps. Each step checks what is
 * already stored and skips completed work, so any step can be retried (by Inngest
 * or the local runner) without paying for the same AI call or render twice.
 */
export const GENERATION_STEPS = ["calculate", "interpret_core", "interpret_timeline", "interpret_synthesis", "assemble", "render_pdf", "finalize"] as const;
export type GenerationStep = (typeof GENERATION_STEPS)[number];

/** Errors that retrying will not fix (bad configuration, invalid order state). */
export class PermanentJobError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PermanentJobError";
    this.code = code;
  }
}

export function isPermanentError(error: unknown): boolean {
  return error instanceof PermanentJobError || error instanceof AiConfigurationError;
}

interface LoadedOrder {
  order: Order;
  birth: StoredBirthDetails;
}

async function loadPaidOrder(db: SqlExecutor, orderId: string): Promise<LoadedOrder> {
  const order = await getOrder(db, orderId);
  if (!order) throw new PermanentJobError("order_missing", "Order not found");
  if (order.paymentStatus !== "paid") throw new PermanentJobError("not_paid", "Order is not paid; refusing to generate");
  const birth = await getBirthDetails(db, orderId);
  if (!birth) throw new PermanentJobError("birth_missing", "Birth details missing");
  return { order, birth };
}

/** The date "now" is fixed to the payment date so retries produce identical timelines. */
function referenceDate(order: Order): Date {
  const paid = order.paidAt ?? order.createdAt;
  return new Date(Date.UTC(paid.getUTCFullYear(), paid.getUTCMonth(), paid.getUTCDate()));
}

export function chartInputFor(order: Pick<Order, "tradition">, birth: StoredBirthDetails, reference: Date): ChartInput {
  const date = parseIsoDate(birth.birthDate)!;
  const day = localDayRange(birth.timezoneId, date);
  return {
    tradition: order.tradition,
    timeCertainty: birth.timeCertainty,
    birthUtcMs: birth.birthUtc ? birth.birthUtc.getTime() : null,
    windowMinutes: birth.timeWindowMinutes,
    dayStartUtcMs: day.startMs,
    dayEndUtcMs: day.endMs,
    localDate: date,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timeZoneId: birth.timezoneId,
    referenceDate: reference,
  };
}

async function setGenerationStatus(db: SqlExecutor, orderId: string, status: "calculating" | "interpreting" | "rendering", step: GenerationStep): Promise<void> {
  await db.query(
    `update orders set generation_status = $2, updated_at = now() where id = $1::uuid and generation_status not in ('ready', 'failed')`,
    [orderId, status],
  );
  await db.query(`update report_jobs set current_step = $2, status = case when status = 'queued' then 'running' else status end, updated_at = now() where order_id = $1::uuid`, [orderId, step]);
}

async function loadChart(db: SqlExecutor, orderId: string): Promise<{ data: ChartData; provider: string; providerVersion: string; calculationVersion: string } | null> {
  const rows = await db.query<{ data: ChartData; provider: string; provider_version: string; calculation_version: string }>(
    `select data, provider, provider_version, calculation_version from charts where order_id = $1::uuid`,
    [orderId],
  );
  const r = rows[0];
  return r ? { data: r.data, provider: r.provider, providerVersion: r.provider_version, calculationVersion: r.calculation_version } : null;
}

async function interpretationInput(db: SqlExecutor, loaded: LoadedOrder, chart: ChartData): Promise<InterpretationInput> {
  const { order, birth } = loaded;
  const context = await getContext(db, order.id);
  const questions = packageIncludesQuestions(order.packageCode) ? await getQuestions(db, order.id) : [];
  const today = referenceDate(order).toISOString().slice(0, 10);
  return buildInterpretationInput({
    chart,
    language: order.language,
    referenceDate: today,
    birthDate: birth.birthDate,
    periods: selectPeriods(chart, today),
    discrepancies: findDiscrepancies(chart, context),
    knownDetails: {
      moonSign: context?.knownMoonSign ?? null,
      nakshatra: context?.knownNakshatra ?? null,
      pada: context?.knownPada ?? null,
      ascendant: context?.knownAscendant ?? null,
      other: context?.otherKnownDetails ?? null,
    },
    notes: context?.additionalContext ?? null,
    questions,
  });
}

export async function runGenerationStep(orderId: string, step: GenerationStep): Promise<{ step: GenerationStep; skipped: boolean }> {
  const db = await getDb();
  const loaded = await loadPaidOrder(db, orderId);
  const { order, birth } = loaded;

  switch (step) {
    case "calculate": {
      if (await loadChart(db, orderId)) return { step, skipped: true };
      await setGenerationStatus(db, orderId, "calculating", step);
      const provider = getCalculationProvider();
      if (!provider.supports(order.tradition)) throw new PermanentJobError("tradition_unsupported", "No calculation provider for this tradition");
      const result = await provider.calculate(chartInputFor(order, birth, referenceDate(order)));
      await db.query(
        `insert into charts (order_id, provider, provider_version, calculation_version, conventions, settings, data, is_fixture)
         values ($1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, false) on conflict (order_id) do nothing`,
        [orderId, result.provider, result.providerVersion, result.calculationVersion, jsonParam(result.chart.conventions), jsonParam(result.settings), jsonParam(result.chart)],
      );
      return { step, skipped: false };
    }
    case "interpret_core":
    case "interpret_timeline":
    case "interpret_synthesis": {
      const part = step === "interpret_core" ? "core" : step === "interpret_timeline" ? "timeline" : "synthesis";
      if (await getStoredPart(db, orderId, part)) return { step, skipped: true };
      const chart = await loadChart(db, orderId);
      if (!chart) throw new Error("Chart not calculated yet");
      await setGenerationStatus(db, orderId, "interpreting", step);
      const input = await interpretationInput(db, loaded, chart.data);
      let prior: string | null = null;
      if (part !== "core") {
        const core = await getStoredPart(db, orderId, "core");
        if (!core) throw new Error("Core part missing");
        prior = summariseCore(core);
      }
      await generatePart(db, orderId, part, input, prior);
      return { step, skipped: false };
    }
    case "assemble": {
      const existing = await db.query(`select 1 from reports where order_id = $1::uuid`, [orderId]);
      if (existing.length) return { step, skipped: true };
      const chart = await loadChart(db, orderId);
      const [core, timeline, synthesis] = await Promise.all([getStoredPart(db, orderId, "core"), getStoredPart(db, orderId, "timeline"), getStoredPart(db, orderId, "synthesis")]);
      if (!chart || !core || !timeline || !synthesis) throw new Error("Report parts missing");
      const meta = await db.query<{ provider: string; model: string; is_demo: boolean; prompt_version: string }>(
        `select provider, model, is_demo, prompt_version from report_parts where order_id = $1::uuid order by part limit 1`,
        [orderId],
      );
      const doc = await buildOrderDocument(db, loaded, chart, { core, timeline, synthesis }, meta[0]!);
      await db.query(
        `insert into reports (order_id, schema_version, prompt_version, language, content) values ($1::uuid, $2, $3, $4, $5::jsonb) on conflict (order_id) do nothing`,
        [orderId, REPORT_SCHEMA_VERSION, meta[0]!.prompt_version, order.language, jsonParam(doc)],
      );
      return { step, skipped: false };
    }
    case "render_pdf": {
      const rows = await db.query<{ content: ReportDocument; pdf_storage_key: string | null }>(`select content, pdf_storage_key from reports where order_id = $1::uuid`, [orderId]);
      const report = rows[0];
      if (!report) throw new Error("Report not assembled yet");
      if (report.pdf_storage_key) return { step, skipped: true };
      await setGenerationStatus(db, orderId, "rendering", step);
      const { pdf, renderer } = await renderPdf(report.content);
      const key = `reports/${orderId}/${order.reference}-${order.language}.pdf`;
      await getStorage().put(key, pdf, "application/pdf");
      await db.query(
        `update reports set pdf_storage_key = $2, pdf_size_bytes = $3::int, pdf_sha256 = $4, pdf_renderer = $5, pdf_rendered_at = now(), updated_at = now() where order_id = $1::uuid`,
        [orderId, key, pdf.byteLength, sha256Hex(pdf), renderer],
      );
      return { step, skipped: false };
    }
    case "finalize": {
      const transitioned = await db.transaction(async (tx) => {
        const updated = await tx.query<{ id: string }>(
          `update orders set generation_status = 'ready', report_ready_at = now(), generation_failure_code = null, updated_at = now()
            where id = $1::uuid and generation_status <> 'ready' returning id`,
          [orderId],
        );
        await tx.query(`update report_jobs set status = 'succeeded', current_step = 'finalize', finished_at = now(), lease_owner = null, lease_expires_at = null, updated_at = now() where order_id = $1::uuid`, [orderId]);
        await enqueueOutbox(tx, "report.deliver", orderId, `report.deliver:${orderId}`);
        if (updated.length) await recordFunnelEvent(tx, "report_ready", order.mode, orderId);
        return updated.length > 0;
      });
      const { dispatchForOrder } = await import("./dispatch");
      await dispatchForOrder(orderId);
      return { step, skipped: !transitioned };
    }
  }
}

async function buildOrderDocument(
  db: SqlExecutor,
  loaded: LoadedOrder,
  chart: { data: ChartData; provider: string; providerVersion: string; calculationVersion: string },
  parts: InterpretationParts,
  meta: { provider: string; model: string; is_demo: boolean; prompt_version: string },
): Promise<ReportDocument> {
  const { order, birth } = loaded;
  const context = await getContext(db, order.id);
  const questions = packageIncludesQuestions(order.packageCode) ? await getQuestions(db, order.id) : [];
  const today = referenceDate(order).toISOString().slice(0, 10);
  const offset = birth.utcOffsetSeconds;
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const offsetLabel = `UTC${sign}${String(Math.floor(abs / 3600)).padStart(2, "0")}:${String(Math.floor((abs % 3600) / 60)).padStart(2, "0")}`;
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: "order",
    isDemo: order.mode === "demo" || meta.is_demo,
    orderReference: order.reference,
    language: order.language,
    tradition: order.tradition,
    preparedOn: today,
    subject: {
      name: birth.subjectName,
      birthDate: birth.birthDate,
      birthTime: birth.birthTime,
      timeCertainty: birth.timeCertainty,
      windowMinutes: birth.timeWindowMinutes,
      placeLabel: [birth.placeName, birth.placeRegion, birth.placeCountryName].filter(Boolean).join(", "),
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezoneId: birth.timezoneId,
      utcOffsetLabel: offsetLabel,
    },
    calculation: { provider: chart.provider, providerVersion: chart.providerVersion, calculationVersion: chart.calculationVersion },
    chart: chart.data,
    interpretation: { ...parts, promptVersion: meta.prompt_version ?? PROMPT_VERSION, provider: meta.provider, model: meta.model },
    periods: selectPeriods(chart.data, today),
    discrepancies: findDiscrepancies(chart.data, context),
    customerNotes: context?.additionalContext ?? null,
    questions,
  };
}

/** Marks a job permanently failed and tells the owner. The customer sees a support path. */
export async function markGenerationFailed(orderId: string, error: unknown): Promise<void> {
  const db = await getDb();
  const code = error instanceof PermanentJobError || error instanceof AiConfigurationError ? error.code : (error as Error)?.name ?? "unknown";
  const message = scrubText(error instanceof Error ? error.message : String(error));
  const order = await getOrder(db, orderId);
  await db.transaction(async (tx) => {
    await tx.query(
      `update orders set generation_status = 'failed', generation_failure_code = $2, updated_at = now() where id = $1::uuid and generation_status <> 'ready'`,
      [orderId, code],
    );
    await tx.query(
      `update report_jobs set status = 'failed', last_error_code = $2, last_error_message = $3, finished_at = now(), lease_owner = null, lease_expires_at = null, updated_at = now() where order_id = $1::uuid`,
      [orderId, code, message],
    );
    if (order) await recordFunnelEvent(tx, "generation_failed", order.mode, orderId);
  });
  log.error("report generation failed permanently", { orderId, code });
  await alertOwner(
    "Report generation failed",
    `Order ${order?.reference ?? orderId} could not be generated (${code}). The customer has been shown a support path. Fix the cause, then run: npm run ops:retry-report -- ${order?.reference ?? orderId}`,
  );
}

/** For status/ops: which provider will be used (without calling it). */
export function describeInterpretationProvider(): string {
  try {
    const p = getInterpretationProvider();
    return `${p.id}:${p.model}`;
  } catch (error) {
    return `unavailable (${(error as Error).message})`;
  }
}
