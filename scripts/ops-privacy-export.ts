/**
 * Privacy access request: collects the personal data held for one email address into
 * a JSON file, so you can answer "what do you hold about me?" requests.
 *
 *   npm run ops:privacy-export -- someone@example.com
 *
 * Before sending the file, confirm the requester controls that email address (for
 * example: reply from it, or quote an order reference). The file contains personal
 * data: it is written to exports/ (never committed), send it privately, then delete
 * it. Report text and PDFs are listed by reference; the customer can open them with
 * their secure link, or you can attach the PDF from storage.
 *
 * For deletion requests use: npm run ops:delete-order -- RA-XXXXXXXX --yes
 */
import fs from "node:fs";
import path from "node:path";
import { fail, positional, withDb } from "./lib/cli";

try {
  await withDb(async (db) => {
    const email = (positional()[0] ?? fail("Give the requester's email, e.g. npm run ops:privacy-export -- someone@example.com")).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("That does not look like an email address.");

    const orders = await db.query<Record<string, unknown> & { id: string; reference: string }>(
      `select id, reference, created_at, mode, product, compatibility_category, tradition, report_language, package_code,
              total_amount_paise, payment_status, paid_at, generation_status, report_ready_at, delivery_status,
              report_email, payer_phone, consent_processing_at, consent_version, adult_confirmed_at, third_party_permission_at,
              delete_after, personal_data_deleted_at
         from orders where lower(report_email) = $1 order by created_at`,
      [email],
    );
    const result = [];
    for (const order of orders) {
      const participants = await db.query(
        `select b.participant, b.participant_id, b.subject_name, b.birth_date::text as birth_date, b.time_certainty,
                to_char(b.birth_time_local, 'HH24:MI') as birth_time_local, b.time_window_minutes, b.place_name, b.place_region,
                b.place_country_name, b.timezone_id, c.known_moon_sign, c.known_nakshatra, c.known_pada, c.known_ascendant,
                c.other_known_details, c.additional_context
           from birth_details b left join order_context c on c.order_id = b.order_id and c.participant = b.participant
          where b.order_id = $1::uuid order by b.participant`,
        [order.id],
      );
      const questions = await db.query(`select position, question from order_questions where order_id = $1::uuid order by position`, [order.id]);
      const shared = await db.query(`select how_known, known_duration, hopes, shared_circumstances from compatibility_context where order_id = $1::uuid`, [order.id]);
      const payments = await db.query(
        `select provider, provider_order_id, attempt, amount_paise, currency, status, created_at, verified_at from payments where order_id = $1::uuid order by attempt`,
        [order.id],
      );
      const report = await db.query(`select created_at, language, (pdf_storage_key is not null) as has_pdf from reports where order_id = $1::uuid`, [order.id]);
      const deliveries = await db.query(`select kind, status, created_at, sent_at from deliveries where order_id = $1::uuid order by created_at`, [order.id]);
      result.push({ order, participants, questions, sharedContext: shared[0] ?? null, payments, report: report[0] ?? null, emails: deliveries });
    }

    const dir = path.join("exports", "privacy");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `privacy-export-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`);
    const body = {
      generatedAt: new Date().toISOString(),
      requesterEmail: email,
      note: "Personal data Rasi Astro holds for this email address. Compatibility orders include the other person's details as provided by the purchaser.",
      orders: result,
    };
    fs.writeFileSync(file, JSON.stringify(body, null, 2), "utf8");
    console.log(`${orders.length} order(s) found. Written to ${file}`);
    console.log("Verify the requester's identity before sending. Delete the file after sending it.");
  });
} catch (error) {
  fail((error as Error).message);
}
