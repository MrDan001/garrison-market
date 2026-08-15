// FILE: apps/frontend/app/admin/layout.tsx
//
// SECURITY (Stage 3 — session/access audit): this was previously a "use
// client" component with no session check at all, relying entirely on
// proxy.ts as the only thing standing between an unauthenticated request
// and every /admin/* page. Owner and staff each already had this same
// server-side check at the layout level as a second, independent layer
// (see app/owner/layout.tsx, app/staff/layout.tsx) — admin was the one
// section missing it. Same auth pattern as those two now.
//
// The interactive nav shell (sidebar, mobile drawer, header) needs
// usePathname/useState, which requires a client component — it's been
// moved as-is into ./AdminShell.tsx so this file can be a plain async
// server component that runs the check before anything renders.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();

  if (!session?.email) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/login");
  }

  return <AdminShell>{children}</AdminShell>;
}