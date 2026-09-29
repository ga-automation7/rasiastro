import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { orderNotAccessible } from "@/server/errors";
import { requireOrderAccess, withErrors } from "@/server/http";
import { getOrder } from "@/server/orders/repository";
import { getStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

/**
 * PDF download for an authorised browser only. Supabase storage: a 60-second signed
 * URL (the bucket itself is private). Local storage: streamed from disk.
 */
export const GET = withErrors("orders.pdf", async (_request: Request, context: { params: Promise<{ orderId: string }> }) => {
  const { orderId } = await context.params;
  await requireOrderAccess(orderId);
  const db = await getDb();
  const order = await getOrder(db, orderId);
  const rows = await db.query<{ key: string | null }>(`select pdf_storage_key as key from reports where order_id = $1::uuid`, [orderId]);
  const key = rows[0]?.key;
  if (!order || !key) throw orderNotAccessible();
  const filename = `RasiAstro-${order.reference}.pdf`;
  const storage = getStorage();
  const signed = await storage.signedDownloadUrl(key, filename, 60);
  if (signed) return NextResponse.redirect(signed, { status: 302, headers: PRIVATE_HEADERS });
  const bytes = await storage.get(key);
  if (!bytes) throw orderNotAccessible();
  return new Response(Buffer.from(bytes), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
});
