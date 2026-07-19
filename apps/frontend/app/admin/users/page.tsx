import prisma from "@/lib/prisma";
import { OwnerTable } from "./OwnerTable";

export const dynamic = "force-dynamic";
export default async function ManageUsersPage() {
  const owners = await prisma.user.findMany({
    where: { role: 'owner' },
    orderBy: { id: 'desc' } // Shows newest owners first
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