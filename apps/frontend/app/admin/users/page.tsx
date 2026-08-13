import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OwnerTable } from "./OwnerTable";

export const dynamic = "force-dynamic";
export default async function ManageUsersPage() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    redirect("/login");
  }

  // Explicit select — this list ships to the client as props, so only the
  // fields OwnerTable actually needs go over the wire. The previous
  // unscoped findMany() pulled every column, including the bcrypt
  // password hash, into the page's initial payload.
  const owners = await prisma.user.findMany({
    where: { role: 'owner' },
    orderBy: { id: 'desc' }, // Shows newest owners first
    select: { id: true, fullName: true, email: true, status: true, role: true },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">Manage Owners</h1>
      </div>
      
      <OwnerTable initialOwners={owners} />
    </div>
  );
}