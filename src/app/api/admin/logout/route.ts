import { signOutAdmin } from "@/server/admin/auth";
import { assertSameOrigin, json, withErrors } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = withErrors("admin.logout", async () => {
  await assertSameOrigin();
  await signOutAdmin();
  return json({ ok: true });
});
