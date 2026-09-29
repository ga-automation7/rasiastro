/**
 * Owner triage: overall health plus the orders that need attention.
 *   npm run ops:status
 */
import { fail, withDb } from "./lib/cli";
import { getHealthReport } from "../src/server/ops/health";

try {
  const health = await getHealthReport();
  console.log(`\nStatus: ${health.status.toUpperCase()} · mode: ${health.mode} · checkout available: ${health.checkoutAvailable ? "yes" : "NO"}`);
  console.log(`Providers: ${JSON.stringify(health.providers)} · PDF browser: ${health.pdfBrowser}`);
  for (const c of health.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.label}${c.ok ? "" : ` - ${c.detail}`}`);
  console.log(`Database: ${health.database.ok ? `ok (schema ${health.database.schemaVersion})` : "UNREACHABLE"}`);
  if (health.places) console.log(`Places: ${health.places.geonames} GeoNames, ${health.places.demo} demo`);

  await withDb(async (db) => {
    const problems = await db.query<{ reference: string; created_at: Date; payment_status: string; generation_status: string; delivery_status: string; last_error_code: string | null }>(
      `select o.reference, o.created_at, o.payment_status, o.generation_status, o.delivery_status, j.last_error_code
         from orders o left join report_jobs j on j.order_id = o.id
        where o.payment_status = 'needs_review'
           or o.generation_status = 'failed'
           or o.delivery_status = 'failed'
           or (o.payment_status = 'paid' and o.generation_status <> 'ready' and o.paid_at < now() - interval '30 minutes')
        order by o.created_at desc limit 50`,
    );
    console.log(`\nOrders needing attention: ${problems.length}`);
    for (const p of problems) {
      console.log(`  ${p.reference}  ${p.created_at.toISOString().slice(0, 16)}  payment=${p.payment_status} report=${p.generation_status} email=${p.delivery_status}${p.last_error_code ? ` error=${p.last_error_code}` : ""}`);
    }
    if (problems.length) {
      console.log("\nNext steps: payment needs_review -> check Cashfree dashboard (refund if duplicate/mismatch);");
      console.log("            report failed/stuck -> npm run ops:retry-report -- RA-XXXXXXXX");
      console.log("            email failed        -> npm run ops:resend-email -- RA-XXXXXXXX\n");
    }
  });
} catch (error) {
  fail((error as Error).message);
}
