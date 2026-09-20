import { getSessionUser } from "@/lib/auth";

export async function requireMarketingAdmin() {
  const session = await getSessionUser();

  if (!session?.email || session.role?.toLowerCase() !== "admin") {
    throw new Error("Unauthorized");
  }

  return session;
}
