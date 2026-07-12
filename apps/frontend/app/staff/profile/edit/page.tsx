import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import StaffProfileEditForm from "@/components/StaffProfileEditForm";

export const dynamic = "force-dynamic";

export default async function StaffProfileEditPage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  const staff = await prisma.user.findUnique({ where: { email: session.email } });
  if (!staff || staff.role.toLowerCase() !== "staff") redirect("/login");

  return (
    <StaffProfileEditForm
      initialFullName={staff.fullName || ""}
      initialPhone={staff.phoneNumber || ""}
      initialEmail={staff.email}
      initialImage={staff.image}
    />
  );
}
