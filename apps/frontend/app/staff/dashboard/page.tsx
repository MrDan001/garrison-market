import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Store, FileText, History, ShoppingBag, TrendingUp, Clock, LogOut, Package, UserCircle } from "lucide-react";
import Link from "next/link";

export default async function StaffDashboard() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: session.email },
    select: { fullName: true, role: true, status: true, image: true },
  });

  const userRole = staff?.role?.toLowerCase().trim();
  const userStatus = staff?.status?.toLowerCase().trim();

  if (!staff || userRole !== "staff") redirect("/login");
  if (userStatus === "suspended" || userStatus === "pending") redirect("/pending/staff");

  const nameParts = staff.fullName?.split(" ") ?? ["Staff"];
  const firstName = nameParts[0] ?? "Staff";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Merged into ONE aggregate query instead of count() + findMany() ──
  const todayAgg = await prisma.order.aggregate({
    where: { staffId: session.id, date: { gte: today } },
    _count: true,
    _sum: { total: true },
  });

  const todayOrders = todayAgg._count;
  // NOTE: dropped the `(o: { total: number | string })` annotation — Prisma's
  // aggregate _sum.total is typed as Decimal | null, not number | string,
  // which is what caused the compile error. Number() handles the conversion.
  const todaySales = Number(todayAgg._sum.total ?? 0);

  return (
    <div className="h-screen w-screen bg-[#0A0C10] text-slate-200 flex flex-col overflow-hidden">
      {/* ── Top Nav Bar (Staff Portal Theme) ── */}
      <header className="sticky top-0 z-50 bg-[#0a0c12]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <Store size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 leading-none">Staff Portal</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm font-semibold text-white truncate leading-none">{staff.fullName}</p>

              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-slate-700">
            {staff?.image ? (
              <img src={staff.image} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="bg-gradient-to-br from-emerald-500 to-teal-600 w-full h-full flex items-center justify-center uppercase">
                {firstName.charAt(0)}
              </span>
            )}
          </div>

          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-all duration-150"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </Link>
        </div>
      </header>

      {/* Main scrollable content container */}
      <div className="flex-1 overflow-y-auto pt-6 pb-28">
        {/* Profile Greetings Block inside body */}
        <div className="px-5 mb-6">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{greeting}</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">{firstName} 👋</h1>
        </div>

        {/* Today's Stats */}
        <div className="px-5 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-emerald-400" />
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Today's Sales</p>
              </div>
              <p className="text-xl font-bold text-white">₦{todaySales.toLocaleString()}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-blue-400" />
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Orders Today</p>
              </div>
              <p className="text-xl font-bold text-white">{todayOrders}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-5 mb-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/staff/report" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-800 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <FileText size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Daily Report</p>
                <p className="text-[11px] text-slate-500">Submit EOD summary</p>
              </div>
            </Link>

            <Link href="/staff/orders" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-800 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <History size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Order History</p>
                <p className="text-[11px] text-slate-500">View past sales</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="px-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Today's Activity</h2>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
            {todayOrders === 0 ? (
              <>
                <ShoppingBag size={28} className="mx-auto mb-2 text-slate-700" />
                <p className="text-slate-500 text-sm">No sales yet today</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-emerald-400 mb-1">₦{todaySales.toLocaleString()}</p>
                <p className="text-slate-400 text-sm">{todayOrders} order{todayOrders !== 1 ? "s" : ""} processed today</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0d0f18]/95 backdrop-blur-xl border-t border-slate-800/50 px-4 py-2 z-50">
        <div className="flex items-end justify-around max-w-md mx-auto">
          <Link href="/staff/inventory" className="flex flex-col items-center gap-1 py-2 px-3 group">
            <div className="h-6 w-6 flex items-center justify-center">
              <Package size={22} className="text-slate-500 group-active:text-blue-400 transition-colors" />
            </div>
            <span className="text-[10px] text-slate-500 group-active:text-blue-400 transition-colors">Inventory</span>
          </Link>

          <Link href="/staff/orders" className="flex flex-col items-center gap-1 py-2 px-3 group">
            <div className="h-6 w-6 flex items-center justify-center">
              <History size={22} className="text-slate-500 group-active:text-indigo-400 transition-colors" />
            </div>
            <span className="text-[10px] text-slate-500 group-active:text-indigo-400 transition-colors">Orders</span>
          </Link>

          <Link href="/staff/inventory" className="flex flex-col items-center gap-1 -mt-6">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-95 transition-transform border-4 border-[#0d0f18]">
              <ShoppingBag size={26} className="text-white" />
            </div>
            <span className="text-[10px] text-blue-400 font-bold mt-0.5">SELL</span>
          </Link>

          <Link href="/staff/report" className="flex flex-col items-center gap-1 py-2 px-3 group">
            <div className="h-6 w-6 flex items-center justify-center">
              <FileText size={22} className="text-slate-500 group-active:text-amber-400 transition-colors" />
            </div>
            <span className="text-[10px] text-slate-500 group-active:text-amber-400 transition-colors">Report</span>
          </Link>

          <Link href="/staff/profile" className="flex flex-col items-center gap-1 py-2 px-3 group">
            <div className="h-6 w-6 flex items-center justify-center">
              <UserCircle size={22} className="text-slate-500 group-active:text-emerald-400 transition-colors" />
            </div>
            <span className="text-[10px] text-slate-500 group-active:text-emerald-400 transition-colors">Profile</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
