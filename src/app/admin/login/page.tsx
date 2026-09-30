import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin/AdminLogin.client";
import { currentAdmin, isAdminEnabled } from "@/server/admin/auth";

export const metadata: Metadata = { title: "Owner sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (!isAdminEnabled()) notFound();
  if (await currentAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="eyebrow">Owner only</p>
      <h1 className="h-section mt-2 text-ink-950">Sign in</h1>
      <p className="mt-3 text-muted">We email a one-time code to the owner address. Nothing is shown to anyone else.</p>
      <div className="mt-8">
        <AdminLogin />
      </div>
    </div>
  );
}
