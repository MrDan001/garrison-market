// 1. Update your getSessionUser import line at the top to target your primary actions file:
import { getSessionUser } from "@/lib/auth.actions"; 
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, History, ShoppingBag, FileText, CircleUser, Mail, ChevronRight } from "lucide-react";
import StaffProfileSections from "@/components/StaffProfileSections";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  approved: "bg-emerald-500/10 text-emerald-400",
  pending: "bg-amber-500/10 text-amber-400",
  suspended: "bg-rose-500/10 text-rose-400",
};

export default async function StaffProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      role: true,
      status: true,
      image: true,
      createdAt: true,
      notificationsEnabled: true,
      screenshotProtectionEnabled: true,
    },
  });

  if (!staff || staff.role.toLowerCase() !== "staff") redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthAgg = await prisma.order.aggregate({
    where: { staffId: staff.id, date: { gte: monthStart } },
    _sum: { total: true },
    _count: true,
  });

  const monthSales = Number(monthAgg._sum.total ?? 0);
  const monthOrders = monthAgg._count;
  const statusKey = staff.status.toLowerCase();

  // Create an explicit primitive string copy of the date to prevent any memory reference leakage
  const safeJoinedDate = String(staff.createdAt.toLocaleDateString("en-NG"));

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-900 dark:text-slate-100 flex flex-col">
      <div className="border-b border-white/[0.06] px-5 pb-4 pt-4">
        <div className="max-w-2xl mx-auto w-full">
          <Link href="/staff/dashboard" className="text-[13px] text-slate-500 hover:text-slate-700 hover:dark:text-slate-300 transition-colors">
            ‹ Back
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold text-[var(--text-primary)] overflow-hidden">
                {staff.image ? (
                  <img src={staff.image} alt={staff.fullName || "Staff"} className="h-full w-full object-cover" />
                ) : (
                  staff.fullName?.charAt(0).toUpperCase() || "?"
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-[var(--text-primary)]">{staff.fullName}</p>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 capitalize">{staff.role} Account</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyles[statusKey] || "bg-slate-500/10 text-slate-600 dark:text-slate-400"}`}>
                {staff.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 md:pb-10">
        <div className="max-w-2xl mx-auto w-full space-y-4">
          <Link
            href="/staff/messages"
            className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[var(--bg-surface)] px-4 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Mail size={16} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Messages</p>
                <p className="text-[11.5px] text-slate-500">Announcements from the Admin Desk</p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-400 dark:text-slate-600" strokeWidth={1.8} />
          </Link>

          <StaffProfileSections
            email={staff.email}
            phone={staff.phoneNumber || "Not set"}
            joinedDate={safeJoinedDate} // ✅ Safe primitive string mapping
            monthSales={monthSales}
            monthOrders={monthOrders}
            notificationsEnabled={staff.notificationsEnabled}
            screenshotProtectionEnabled={staff.screenshotProtectionEnabled}
          />
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around border-t border-white/[0.06] bg-[var(--bg-app)] px-2 py-2.5">
        <Link href="/staff/dashboard" className="flex flex-col items-center gap-1">
          <Package size={22} strokeWidth={1.8} className="text-slate-500" />
          <span className="text-[10.5px] text-slate-500">Home</span>
        </Link>
        <Link href="/staff/orders" className="flex flex-col items-center gap-1">
          <History size={22} strokeWidth={1.8} className="text-slate-500" />
          <span className="text-[10.5px] text-slate-500">Orders</span>
        </Link>
        <Link href="/staff/inventory" className="flex flex-col items-center gap-1 -mt-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-blue-500/30">
            <ShoppingBag size={20} className="text-[var(--text-primary)]" strokeWidth={2} />
          </div>
          <span className="text-[10.5px] font-semibold text-blue-400">Sell</span>
        </Link>
        <Link href="/staff/report" className="flex flex-col items-center gap-1">
          <FileText size={22} strokeWidth={1.8} className="text-slate-500" />
          <span className="text-[10.5px] text-slate-500">Report</span>
        </Link>
        <Link href="/staff/profile" className="flex flex-col items-center gap-1">
          <CircleUser size={22} strokeWidth={1.8} className="text-blue-400" />
          <span className="text-[10.5px] font-semibold text-blue-400">Profile</span>
        </Link>
      </nav>
    </div>
  );
}