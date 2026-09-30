import type { ChartData, ChartInput } from "@/domain/astrology/chart-types";
import type { PairAnalysis } from "@/domain/astrology/compatibility-types";
import { localDayRange, parseIsoDate } from "@/domain/birth-time";
import { packageIncludesQuestions } from "@/domain/pricing";
import { PAIR_CALCULATION_VERSION, analysePair } from "../astrology/compatibility";
import { getCalculationProvider } from "../astrology/provider";
import { getDb, jsonParam, type SqlExecutor } from "../db";
import { buildInterpretationInput, type InterpretationInput } from "../interpretation/input";
import { buildPairInterpretationInput, maskNames, type PairInterpretationInput } from "../interpretation/pair-input";
import { PAIR_PROMPT_VERSION } from "../interpretation/pair-prompt";
import { PAIR_REPORT_SCHEMA_VERSION, type PairPartName } from "../interpretation/pair-schema";
import { PROMPT_VERSION } from "../interpretation/prompt-v1";
import { AiConfigurationError } from "../interpretation/provider";
import { REPORT_SCHEMA_VERSION, type InterpretationParts, type PartName } from "../interpretation/schema";
import {
  generatePairPart,
  generatePart,
  getInterpretationProvider,
  getStoredPairPart,
  getStoredPart,
  summariseCore,
  summarisePairCore,
} from "../interpretation/service";
import { log, scrubText } from "../log";
import { alertOwner } from "../ops/alerts";
import {
  getCompatibilityContext,
  getContext,
  getOrder,
  getQuestions,
  listBirthDetails,
  recordFunnelEvent,
  type Order,
  type ParticipantNumber,
  type StoredBirthDetails,
} from "../orders/repository";
import { findDiscrepancies } from "../reports/discrepancies";
import type { ReportDocument } from "../reports/document";
import type { AnyReportDocument, PairPerson, PairReportDocument } from "../reports/pair-document";
import { selectPeriods } from "../reports/periods";
import { renderPdf } from "../reports/pdf";
import { sha256Hex } from "../security/crypto";
import { getStorage } from "../storage";
import { enqueueOutbox } from "./outbox";

/**
 * Report generation as a sequence of idempotent steps, shared by both products. Each
 * step checks what is already stored and skips completed work, so any step can be
 * retried (by Inngest or the local runner) without paying for the same AI call or
 * render twice. Step names are stable (Inngest checkpoints them by name).
 *
 * Personal:       calculate -> core / timeline / synthesis -> assemble -> PDF -> finalize
 * Compatibility:  calculate (both charts + pair analysis) -> pair_core / pair_dynamics /
 *                 pair_synthesis -> assemble -> PDF -> finalize
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
  people: StoredBirthDetails[];
}

async function loadPaidOrder(db: SqlExecutor, orderId: string): Promise<LoadedOrder> {
  const order = await getOrder(db, orderId);
  if (!order) throw new PermanentJobError("order_missing", "Order not found");
  if (order.paymentStatus !== "paid") throw new PermanentJobError("not_paid", "Order is not paid; refusing to generate");
  const people = await listBirthDetails(db, orderId);
  const expected = order.product === "compatibility" ? 2 : 1;
  if (people.length !== expected) throw new PermanentJobError("birth_missing", `Expected ${expected} participant(s), found ${people.length}`);
  return { order, people };
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

interface StoredChart {
  data: ChartData;
  provider: string;
  providerVersion: string;
  calculationVersion: string;
}

async function loadChart(db: SqlExecutor, orderId: string, participant: ParticipantNumber = 1): Promise<StoredChart | null> {
  const rows = await db.query<{ data: ChartData; provider: string; provider_version: string; calculation_version: string }>(
    `select data, provider, provider_version, calculation_version from charts where order_id = $1::uuid and participant = $2::int`,
    [orderId, participant],
  );
  const r = rows[0];
  return r ? { data: r.data, provider: r.provider, providerVersion: r.provider_version, calculationVersion: r.calculation_version } : null;
}

async function loadAnalysis(db: SqlExecutor, orderId: string): Promise<PairAnalysis | null> {
  const rows = await db.query<{ data: PairAnalysis }>(`select data from compatibility_analyses where order_id = $1::uuid`, [orderId]);
  return rows[0]?.data ?? null;
}

/** Calculates and stores one participant's chart. Returns false when it already existed. */
async function calculateChart(db: SqlExecutor, order: Order, birth: StoredBirthDetails): Promise<boolean> {
  if (await loadChart(db, order.id, birth.participant)) return false;
  const provider = getCalculationProvider();
  if (!provider.supports(order.tradition)) throw new PermanentJobError("tradition_unsupported", "No calculation provider for this tradition");
  const result = await provider.calculate(chartInputFor(order, birth, referenceDate(order)));
  await db.query(
    `insert into charts (order_id, participant, provider, provider_version, calculation_version, conventions, settings, data, is_fixture)
     values ($1::uuid, $2::int, $3, $4, $5, $6::text::jsonb, $7::text::jsonb, $8::text::jsonb, false) on conflict (order_id, participant) do nothing`,
    [order.id, birth.participant, result.provider, result.providerVersion, result.calculationVersion, jsonParam(result.chart.conventions), jsonParam(result.settings), jsonParam(result.chart)],
  );
  return true;
}

function knownDetails(context: Awaited<ReturnType<typeof getContext>>) {
  return {
    moonSign: context?.knownMoonSign ?? null,
    nakshatra: context?.knownNakshatra ?? null,
    pada: context?.knownPada ?? null,
    ascendant: context?.knownAscendant ?? null,
    other: context?.otherKnownDetails ?? null,
  };
}

async function interpretationInput(db: SqlExecutor, loaded: LoadedOrder, chart: ChartData): Promise<InterpretationInput> {
  const { order } = loaded;
  const birth = loaded.people[0]!;
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
    knownDetails: knownDetails(context),
    // The person's own name is masked in their notes and questions before the AI sees them.
    notes: maskNames(context?.additionalContext ?? null, [{ name: birth.subjectName, token: "[name]" }]),
    questions: questions.map((q) => maskNames(q, [{ name: birth.subjectName, token: "[name]" }]) ?? q),
  });
}

async function pairInterpretationInput(db: SqlExecutor, loaded: LoadedOrder): Promise<PairInterpretationInput> {
  const { order } = loaded;
  const [ca, cb, analysis, shared] = await Promise.all([loadChart(db, order.id, 1), loadChart(db, order.id, 2), loadAnalysis(db, order.id), getCompatibilityContext(db, order.id)]);
  if (!ca || !cb || !analysis) throw new Error("Charts not calculated yet");
  const [contextA, contextB] = await Promise.all([getContext(db, order.id, 1), getContext(db, order.id, 2)]);
  // Names never reach the AI, even when the customer mentions them in a note.
  const names = [
    { name: loaded.people[0]!.subjectName, token: "{{A}}" },
    { name: loaded.people[1]!.subjectName, token: "{{B}}" },
  ];
  const mask = (text: string | null) => maskNames(text, names);
  const person = (chart: ChartData, birth: StoredBirthDetails, context: typeof contextA) => {
    const known = knownDetails(context);
    return {
      chart,
      birthDate: birth.birthDate,
      knownDetails: { ...known, other: mask(known.other) },
      discrepancies: findDiscrepancies(chart, context),
      notes: mask(context?.additionalContext ?? null),
    };
  };
  return buildPairInterpretationInput({
    language: order.language,
    category: order.compatibilityCategory!,
    referenceDate: referenceDate(order).toISOString().slice(0, 10),
    analysis,
    people: [person(ca.data, loaded.people[0]!, contextA), person(cb.data, loaded.people[1]!, contextB)],
    shared: {
      howKnown: mask(shared?.howKnown ?? null),
      knownDuration: mask(shared?.knownDuration ?? null),
      hopes: mask(shared?.hopes ?? null),
      sharedCircumstances: mask(shared?.sharedCircumstances ?? null),
    },
  });
}

const PERSONAL_PARTS: Record<"interpret_core" | "interpret_timeline" | "interpret_synthesis", PartName> = {
  interpret_core: "core",
  interpret_timeline: "timeline",
  interpret_synthesis: "synthesis",
};
const PAIR_PARTS: Record<"interpret_core" | "interpret_timeline" | "interpret_synthesis", PairPartName> = {
  interpret_core: "pair_core",
  interpret_timeline: "pair_dynamics",
  interpret_synthesis: "pair_synthesis",
};

export async function runGenerationStep(orderId: string, step: GenerationStep): Promise<{ step: GenerationStep; skipped: boolean }> {
  const db = await getDb();
  const loaded = await loadPaidOrder(db, orderId);
  const { order } = loaded;
  const pair = order.product === "compatibility";

  switch (step) {
    case "calculate": {
      if (!pair) {
        if (await loadChart(db, orderId)) return { step, skipped: true };
        await setGenerationStatus(db, orderId, "calculating", step);
        await calculateChart(db, order, loaded.people[0]!);
        return { step, skipped: false };
      }
      // Each person's chart uses only their own birth details, place and time zone.
      if ((await loadAnalysis(db, orderId)) && (await loadChart(db, orderId, 1)) && (await loadChart(db, orderId, 2))) return { step, skipped: true };
      await setGenerationStatus(db, orderId, "calculating", step);
      for (const person of loaded.people) await calculateChart(db, order, person);
      const [a, b] = await Promise.all([loadChart(db, orderId, 1), loadChart(db, orderId, 2)]);
      const analysis = analysePair(order.compatibilityCategory!, a!.data, b!.data);
      await db.query(
        `insert into compatibility_analyses (order_id, category, tradition, calculation_version, data) values ($1::uuid, $2, $3, $4, $5::text::jsonb)
         on conflict (order_id) do nothing`,
        [orderId, order.compatibilityCategory, order.tradition, PAIR_CALCULATION_VERSION, jsonParam(analysis)],
      );
      return { step, skipped: false };
    }
    case "interpret_core":
    case "interpret_timeline":
    case "interpret_synthesis": {
      if (pair) {
        const part = PAIR_PARTS[step];
        if (await getStoredPairPart(db, orderId, part)) return { step, skipped: true };
        await setGenerationStatus(db, orderId, "interpreting", step);
        const input = await pairInterpretationInput(db, loaded);
        let prior: string | null = null;
        if (part !== "pair_core") {
          const core = await getStoredPairPart(db, orderId, "pair_core");
          if (!core) throw new Error("Core part missing");
          prior = summarisePairCore(core);
        }
        await generatePairPart(db, orderId, part, input, prior);
        return { step, skipped: false };
      }
      const part = PERSONAL_PARTS[step];
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
      const meta = await db.query<{ provider: string; model: string; is_demo: boolean; prompt_version: string }>(
        `select provider, model, is_demo, prompt_version from report_parts where order_id = $1::uuid order by part limit 1`,
        [orderId],
      );
      if (!meta[0]) throw new Error("Report parts missing");
      const doc: AnyReportDocument = pair ? await buildPairDocument(db, loaded, meta[0]) : await buildPersonalDocument(db, loaded, meta[0]);
      await db.query(
        `insert into reports (order_id, schema_version, prompt_version, language, content) values ($1::uuid, $2, $3, $4, $5::text::jsonb) on conflict (order_id) do nothing`,
        [orderId, doc.schemaVersion, meta[0].prompt_version, order.language, jsonParam(doc)],
      );
      return { step, skipped: false };
    }
    case "render_pdf": {
      const rows = await db.query<{ content: AnyReportDocument; pdf_storage_key: string | null }>(`select content, pdf_storage_key from reports where order_id = $1::uuid`, [orderId]);
      const report = rows[0];
      if (!report) throw new Error("Report not assembled yet");
      if (report.pdf_storage_key) return { step, skipped: true };
      await setGenerationStatus(db, orderId, "rendering", step);
      const { pdf, renderer } = await renderPdf(report.content);
      const key = `reports/${orderId}/${order.reference}-${pair ? "compatibility-" : ""}${order.language}.pdf`;
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
        await enqueueOutbox(tx, "report.deliver", orderId, `report.deliver:${orderId}`, { product: order.product });
        if (updated.length) await recordFunnelEvent(tx, "report_ready", order.mode, orderId);
        return updated.length > 0;
      });
      const { dispatchForOrder } = await import("./dispatch");
      await dispatchForOrder(orderId);
      return { step, skipped: !transitioned };
    }
  }
}

function subjectOf(birth: StoredBirthDetails): ReportDocument["subject"] {
  const offset = birth.utcOffsetSeconds;
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return {
    name: birth.subjectName,
    birthDate: birth.birthDate,
    birthTime: birth.birthTime,
    timeCertainty: birth.timeCertainty,
    windowMinutes: birth.timeWindowMinutes,
    placeLabel: [birth.placeName, birth.placeRegion, birth.placeCountryName].filter(Boolean).join(", "),
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezoneId: birth.timezoneId,
    utcOffsetLabel: `UTC${sign}${String(Math.floor(abs / 3600)).padStart(2, "0")}:${String(Math.floor((abs % 3600) / 60)).padStart(2, "0")}`,
  };
}

type PartMeta = { provider: string; model: string; is_demo: boolean; prompt_version: string };

async function buildPersonalDocument(db: SqlExecutor, loaded: LoadedOrder, meta: PartMeta): Promise<ReportDocument> {
  const { order } = loaded;
  const birth = loaded.people[0]!;
  const chart = await loadChart(db, order.id);
  const [core, timeline, synthesis] = await Promise.all([getStoredPart(db, order.id, "core"), getStoredPart(db, order.id, "timeline"), getStoredPart(db, order.id, "synthesis")]);
  if (!chart || !core || !timeline || !synthesis) throw new Error("Report parts missing");
  const parts: InterpretationParts = { core, timeline, synthesis };
  const context = await getContext(db, order.id);
  const questions = packageIncludesQuestions(order.packageCode) ? await getQuestions(db, order.id) : [];
  const today = referenceDate(order).toISOString().slice(0, 10);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: "order",
    isDemo: order.mode === "demo" || meta.is_demo,
    orderReference: order.reference,
    language: order.language,
    tradition: order.tradition,
    preparedOn: today,
    subject: subjectOf(birth),
    calculation: { provider: chart.provider, providerVersion: chart.providerVersion, calculationVersion: chart.calculationVersion },
    chart: chart.data,
    interpretation: { ...parts, promptVersion: meta.prompt_version ?? PROMPT_VERSION, provider: meta.provider, model: meta.model },
    periods: selectPeriods(chart.data, today),
    discrepancies: findDiscrepancies(chart.data, context),
    customerNotes: context?.additionalContext ?? null,
    questions,
  };
}

async function buildPairDocument(db: SqlExecutor, loaded: LoadedOrder, meta: PartMeta): Promise<PairReportDocument> {
  const { order } = loaded;
  const [ca, cb, analysis, shared, contextA, contextB] = await Promise.all([
    loadChart(db, order.id, 1),
    loadChart(db, order.id, 2),
    loadAnalysis(db, order.id),
    getCompatibilityContext(db, order.id),
    getContext(db, order.id, 1),
    getContext(db, order.id, 2),
  ]);
  const [core, dynamics, synthesis] = await Promise.all([
    getStoredPairPart(db, order.id, "pair_core"),
    getStoredPairPart(db, order.id, "pair_dynamics"),
    getStoredPairPart(db, order.id, "pair_synthesis"),
  ]);
  if (!ca || !cb || !analysis || !core || !dynamics || !synthesis) throw new Error("Report parts missing");
  const person = (birth: StoredBirthDetails, chart: StoredChart, context: typeof contextA): PairPerson => ({
    participantId: birth.participantId,
    subject: subjectOf(birth),
    chart: chart.data,
    discrepancies: findDiscrepancies(chart.data, context),
    notes: context?.additionalContext ?? null,
  });
  return {
    schemaVersion: PAIR_REPORT_SCHEMA_VERSION,
    product: "compatibility",
    kind: "order",
    isDemo: order.mode === "demo" || meta.is_demo,
    orderReference: order.reference,
    language: order.language,
    tradition: order.tradition,
    category: order.compatibilityCategory!,
    preparedOn: referenceDate(order).toISOString().slice(0, 10),
    people: [person(loaded.people[0]!, ca, contextA), person(loaded.people[1]!, cb, contextB)],
    shared: shared ?? { howKnown: null, knownDuration: null, hopes: null, sharedCircumstances: null },
    calculation: { provider: ca.provider, providerVersion: ca.providerVersion, calculationVersion: ca.calculationVersion, pairCalculationVersion: PAIR_CALCULATION_VERSION },
    analysis,
    interpretation: { pair_core: core, pair_dynamics: dynamics, pair_synthesis: synthesis, promptVersion: meta.prompt_version ?? PAIR_PROMPT_VERSION, provider: meta.provider, model: meta.model },
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
  log.error("report generation failed permanently", { orderId, code, product: order?.product });
  await alertOwner(
    "Report generation failed",
    `Order ${order?.reference ?? orderId} (${order?.product ?? "unknown product"}) could not be generated (${code}). The customer has been shown a support path and will not be charged again. Fix the cause, then press "Retry report generation" on the order in /admin (or run: npm run ops:retry-report -- ${order?.reference ?? orderId})`,
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
