import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import StaffRegistrationForm from "@/components/StaffRegistrationForm";

export default async function AddStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const owner = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, storeName: true, role: true }
  });

  if (!owner || owner.role !== "owner") {
    redirect("/dashboard");
  }

  const { storeId: storeIdParam } = await searchParams;
  const storeId = storeIdParam ? parseInt(storeIdParam, 10) : null;

  // Confirm the store actually belongs to this owner, and get its display name
  let storeName = owner.storeName ?? "your store";
  if (storeId && !isNaN(storeId)) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId: owner.id },
      select: { name: true },
    });
    if (store) storeName = store.name;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 py-12">
      <div className="w-full max-w-[450px] rounded-[2.5rem] border border-slate-800 bg-slate-900/40 backdrop-blur-3xl shadow-2xl p-8 md:p-12">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Add Staff</h1>
          <p className="text-sm text-slate-500 mt-2">
            Register a new team member for <span className="text-blue-400 font-medium">{storeName}</span>
          </p>
        </div>

        <StaffRegistrationForm storeId={storeId} />
      </div>
    </div>
  );
}