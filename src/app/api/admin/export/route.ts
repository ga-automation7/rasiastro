import { requireAdmin } from "@/server/admin/auth";
import { parseFilters } from "@/server/admin/filters";
import { getDb } from "@/server/db";
import { buildOwnerCsv } from "@/server/exports/csv";
import { buildOwnerWorkbook } from "@/server/exports/xlsx";
import { withErrors } from "@/server/http";
import { log } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIVATE = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

/** Owner-only download of ALL records matching the dashboard filters (not just one page). */
export const GET = withErrors("admin.export", async (request: Request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const filters = parseFilters(url.searchParams);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const stamp = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const db = await getDb();
  if (format === "csv") {
    const { csv, count } = await buildOwnerCsv(db, filters);
    log.info("admin export", { format, count });
    return new Response(csv, {
      headers: { ...PRIVATE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rasi-astro-orders-${stamp}.csv"` },
    });
  }
  const { buffer, counts } = await buildOwnerWorkbook(db, filters);
  log.info("admin export", { format, count: counts.orders ?? 0 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      ...PRIVATE,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rasi-astro-orders-${stamp}.xlsx"`,
    },
  });
});
