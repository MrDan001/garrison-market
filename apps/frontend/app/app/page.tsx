import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function AppEntryPage() {
  const session = await getSessionUser();

  if (!session) redirect("/login");

  const role = (session.role ?? "").toLowerCase();
  if (role === "admin") redirect("/admin/dashboard");
  if (role === "staff") redirect("/staff/dashboard");
  if (role === "owner") redirect("/owner/dashboard");

  redirect("/login");
}
