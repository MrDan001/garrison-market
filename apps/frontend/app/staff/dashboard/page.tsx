import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Store, FileText, History, ShoppingBag, TrendingUp, Clock, LogOut, Package, UserCircle, ClipboardList, AlertTriangle, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import StaffSupportBubble from "@/components/StaffSupportBubble";

type ActivityItem =
  | { type: "sale"; id: string; date: Date; amount: number }
  | { type: "report"; id: string; date: Date; authorName: string; snippet: string }
  | { type: "alert"; id: string; date: Date; itemName: string; quantity: number; isOutOfStock: boolean }
  | { type: "restock"; id: string; date: Date; itemName: string; quantity: number };

export default async function StaffDashboard() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, fullName: true, role: true, status: true, image: true, ownerId: true, notificationsEnabled: true },
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

  const [todayAgg, recentSales, recentReports, inventoryItems] = await Promise.all([
    prisma.order.aggregate({
      where: { staffId: staff.id, date: { gte: today } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: { staffId: staff.id },
      take: 5,
      orderBy: { date: "desc" },
      select: { id: true, total: true, date: true },
    }),
    prisma.report.findMany({
      where: { ownerId: staff.ownerId ?? undefined },
      take: 5,
      orderBy: { date: "desc" },
      select: { id: true, notes: true, date: true, author: { select: { fullName: true } } },
    }),
    prisma.inventory.findMany({
      where: { ownerId: staff.ownerId ?? undefined },
      select: { id: true, name: true, quantity: true, restockLevel: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const todayOrders = todayAgg._count;
  const todaySales = Number(todayAgg._sum.total ?? 0);

  const saleItems: ActivityItem[] = recentSales.map((order) => ({
    type: "sale",
    id: `sale-${order.id}`,
    date: order.date,
    amount: Number(order.total),
  }));

  const reportItems: ActivityItem[] = recentReports.map((report) => {
    const notes = report.notes ?? "Pending backfill";
    return {
      type: "report",
      id: `report-${report.id}`,
      date: report.date,
      authorName: report.author?.fullName || "Staff",
      snippet: notes.length > 60 ? notes.slice(0, 60) + "…" : notes,
    };
  });

  const alertItems: ActivityItem[] = inventoryItems
    .filter((item) => item.restockLevel != null && item.quantity <= item.restockLevel)
    .slice(0, 5)
    .map((item) => ({
      type: "alert",
      id: `alert-${item.id}`,
      date: item.updatedAt,
      itemName: item.name,
      quantity: item.quantity,
      isOutOfStock: item.quantity <= 0,
    }));

  const restockItems: ActivityItem[] = inventoryItems
    .filter((item) => {
      const isEstablished = item.updatedAt.getTime() - item.createdAt.getTime() > 60_000;
      const isHealthyNow = item.restockLevel == null || item.quantity > item.restockLevel;
      return isEstablished && isHealthyNow && item.quantity > 0;
    })
    .slice(0, 5)
    .map((item) => ({
      type: "restock",
      id: `restock-${item.id}`,
      date: item.updatedAt,
      itemName: item.name,
      quantity: item.quantity,
    }));

  const activityFeed = [...saleItems, ...reportItems, ...alertItems, ...restockItems]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  return (
    <div className="h-screen w-screen bg-[#0A0C10] text-slate-200 flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 bg-[#0a0c12]/80 backdrop-blur-xl border-b border-slate-800/50 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
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
            <NotificationBell notificationsEnabled={staff.notificationsEnabled} />

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
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-6 pb-28 md:pb-10">
        <div className="max-w-3xl mx-auto w-full">
          <div className="px-5 mb-6">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{greeting}</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">{firstName} 👋</h1>
          </div>

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

          <div className="px-5 mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

              <Link href="/staff/consignment" className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Truck size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Consignment</p>
                  <p className="text-[11px] text-slate-500">Sign out or settle goods</p>
                </div>
              </Link>

              {/* Desktop-only quick actions, since the bottom nav is hidden above md */}
              <Link href="/staff/inventory" className="hidden sm:flex bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-col gap-3 active:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sell</p>
                  <p className="text-[11px] text-slate-500">Open the inventory & cart</p>
                </div>
              </Link>

              <Link href="/staff/invoice" className="hidden sm:flex bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-col gap-3 active:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-slate-500/10 flex items-center justify-center">
                  <Package size={18} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Invoice</p>
                  <p className="text-[11px] text-slate-500">Print or share an invoice</p>
                </div>
              </Link>

              <Link href="/staff/profile" className="hidden sm:flex bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-col gap-3 active:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <UserCircle size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Profile</p>
                  <p className="text-[11px] text-slate-500">Account & preferences</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="px-5">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Activity</h2>
            <div className="space-y-3">
              {activityFeed.length > 0 ? (
                activityFeed.map((item) => <ActivityRow key={item.id} item={item} />)
              ) : (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
                  <ShoppingBag size={28} className="mx-auto mb-2 text-slate-700" />
                  <p className="text-slate-500 text-sm">No recent activity yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile only. On desktop, the Quick Actions grid above covers navigation instead. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d0f18]/95 backdrop-blur-xl border-t border-slate-800/50 px-4 py-2 z-50">
        <div className="flex items-end justify-around max-w-md mx-auto">
          <Link href="/staff/invoice" className="flex flex-col items-center gap-1 py-2 px-3 group">
            <div className="h-6 w-6 flex items-center justify-center">
              <Package size={22} className="text-slate-500 group-active:text-blue-400 transition-colors" />
            </div>
            <span className="text-[10px] text-slate-500 group-active:text-blue-400 transition-colors">Invoice</span>
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

      <StaffSupportBubble currentUserId={staff.id} />
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.type === "sale") {
    return (
      <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-200">Sale confirmed</p>
        </div>
        <p className="text-sm font-bold text-emerald-400 shrink-0">₦{item.amount.toLocaleString()}</p>
      </div>
    );
  }

  if (item.type === "report") {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <ClipboardList size={14} className="text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">Report submitted</p>
          <p className="text-[11px] text-slate-500 truncate">by {item.authorName} — {item.snippet}</p>
        </div>
      </div>
    );
  }

  if (item.type === "restock") {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <PackageCheck size={14} className="text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{item.itemName}</p>
          <p className="text-[11px] text-emerald-400 truncate">Restocked — {item.quantity} in stock</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.isOutOfStock ? "bg-rose-500/10" : "bg-amber-500/10"}`}>
        <AlertTriangle size={14} className={item.isOutOfStock ? "text-rose-400" : "text-amber-400"} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{item.itemName}</p>
        <p className={`text-[11px] truncate ${item.isOutOfStock ? "text-rose-400" : "text-amber-400"}`}>
          {item.isOutOfStock ? "Out of stock" : `Low stock — ${item.quantity} left`}
        </p>
      </div>
    </div>
  );
}