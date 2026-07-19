import { ArrowLeft, Plus, Shield, UserX, Trash2, Mail, Phone, Store } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { toggleStaffStatus, deleteStaff } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ManageStaffPage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  // 1. Fetch user profile details
  const user = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, status: true }
  });

  if (!user || user.status !== "approved") redirect("/pending");

  // 2. Safely read the active store cookie
  const cookieStore = await cookies();
  const activeStoreCookie = cookieStore.get("activeStoreId")?.value;
  const activeStoreId = activeStoreCookie ? parseInt(activeStoreCookie, 10) : null;

  if (!activeStoreId || isNaN(activeStoreId)) {
    redirect("/owner/stores");
  }

  // 3. Confirm store ownership and fetch store name
  const activeStore = await prisma.store.findFirst({
    where: { id: activeStoreId, ownerId: user.id },
    select: { name: true }
  });

  if (!activeStore) {
    redirect("/owner/stores");
  }

  // 4. Fetch ONLY the staff members assigned to THIS specific active store
  const staffMembers = await prisma.user.findMany({
    where: {
      ownerId: user.id,          // Must be managed under this owner
      role: "staff",             // Must be a staff account
      staffStoreId: activeStoreId // Crucial: scoped strictly to the active store!
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
    }
  });

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-4 w-fit transition-colors text-sm">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <Shield size={26} className="text-blue-500" />
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Manage Staff</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Currently viewing workforce roster for <span className="text-blue-400 font-semibold">{activeStore.name}</span>
            </p>
          </div>

          {/* Add Staff Button - Links to a registration page pre-filled or configured for this store */}
          <Link 
            href={`/owner/staff/register?storeId=${activeStoreId}`} 
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/10 transition-colors w-full sm:w-auto"
          >
            <Plus size={14} /> Add New Staff Member
          </Link>
        </div>

        {/* Staff Directory Cards */}
        {staffMembers.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-100/10 dark:bg-slate-900/10">
            <UserX size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No staff registered for this location</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Staff registration will assign newly invited accounts directly to <span className="text-slate-600 dark:text-slate-400">{activeStore.name}</span>.
            </p>
            <Link 
              href={`/owner/staff/register?storeId=${activeStoreId}`}
              className="inline-block mt-4 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
            >
              Add first staff member
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffMembers.map((staff) => (
              <div 
                key={staff.id} 
                className="bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 hover:border-slate-300 hover:dark:border-slate-700 transition-all flex flex-col justify-between group relative shadow-md shadow-black/20"
              >
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-[var(--text-primary)] truncate">
                        {staff.fullName || "Unnamed Staff"}
                      </h2>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-mono uppercase tracking-wide inline-block mt-1.5 ${
                        staff.status === "active" 
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50" 
                          : "bg-amber-950/60 text-amber-400 border border-amber-900/50"
                      }`}>
                        {staff.status}
                      </span>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
                      <Store size={15} className="text-slate-500" />
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="mt-5 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400 dark:text-slate-600" />
                      <span className="truncate">{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 dark:text-slate-600" />
                      <span>{staff.phoneNumber || "No contact number configured"}</span>
                    </div>
                  </div>
                </div>

                {/* Administration Action Buttons */}
                <div className="mt-6 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
                  <Link
                    href={`/owner/staff/${staff.id}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 hover:bg-slate-200 hover:dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    View Details
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {/* Suspend / Activate — bound server action, not an API route */}
                    <form action={toggleStaffStatus.bind(null, staff.id, staff.status)}>
                      <button 
                        type="submit" 
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-amber-500/80 hover:bg-amber-500/5 hover:text-amber-400 transition-all cursor-pointer"
                      >
                        {staff.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </form>

                    {/* Delete — bound server action, not an API route */}
                    <form action={deleteStaff.bind(null, staff.id)}>
                      <button 
                        type="submit" 
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-rose-500/80 hover:bg-rose-500/5 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}