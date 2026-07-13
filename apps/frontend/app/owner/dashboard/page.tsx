import { LayoutDashboard, Package, ShoppingCart, Settings, Activity, LogOut, TrendingUp, Store, Plus, Banknote, ClipboardList, AlertTriangle, PackageCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SalesChart from "@/components/SalesChart";
import { logoutAction } from "@/lib/auth.actions";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as any).digest === "string" &&
    (error as any).digest.startsWith("NEXT_REDIRECT")
  );
}

type ActivityItem =
  | { type: "sale"; id: string; date: Date; amount: number; staffName: string }
  | { type: "report"; id: string; date: Date; authorName: string; snippet: string }
  | { type: "alert"; id: string; date: Date; itemName: string; quantity: number; isOutOfStock: boolean }
  | { type: "restock"; id: string; date: Date; itemName: string; quantity: number };

export default async function OwnerDashboardPage() {
  try {
    const session = await getSessionUser();
    if (!session?.email) redirect("/login");

    const user = await prisma.user.findUnique({
      where: { email: session.email },
      select: {
        id: true,
        fullName: true,
        storeName: true,
        image: true,
        status: true,
        orders: {
          take: 5,
          orderBy: { date: "desc" },
          select: {
            id: true,
            total: true,
            date: true,
            staff: { select: { fullName: true } },
          },
        },
      },
    });

    if (!user || user.status !== "approved") redirect("/pending");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [salesData, activeProducts, todayAgg, recentReports, lowStockItems] = await Promise.all([
      prisma.order.findMany({
        where: { ownerId: user.id, date: { gte: ninetyDaysAgo } },
        select: { total: true, date: true },
        orderBy: { date: "asc" },
      }),
      prisma.inventory.count({ where: { ownerId: user.id } }),
      prisma.order.aggregate({
        where: { ownerId: user.id, date: { gte: todayStart } },
        _count: true,
        _sum: { total: true },
      }),
      // Recent staff report submissions
      prisma.report.findMany({
        where: { ownerId: user.id },
        take: 5,
        orderBy: { date: "desc" },
        select: {
          id: true,
          notes: true,
          date: true,
          author: { select: { fullName: true } },
        },
      }),
      // Items currently low or out of stock — ordered by last update as a
      // proxy for recency (no dedicated event log exists for this yet)
      prisma.inventory.findMany({
        where: { ownerId: user.id },
        select: { id: true, name: true, quantity: true, restockLevel: true, updatedAt: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const ordersToday = todayAgg._count;
    const todaySalesRevenue = Number(todayAgg._sum.total ?? 0);

    const serializedSalesData = salesData.map((d) => ({
      total: Number(d.total),
      date: d.date.toISOString(),
    }));

    const totalSales = serializedSalesData.reduce((acc, curr) => acc + curr.total, 0);

    // ── Build the merged activity feed ──
    const saleItems: ActivityItem[] = user.orders.map((order) => ({
      type: "sale",
      id: `sale-${order.id}`,
      date: order.date,
      amount: Number(order.total),
      staffName: order.staff?.fullName || "Owner",
    }));

    const reportItems: ActivityItem[] = recentReports.map((report) => ({
      type: "report",
      id: `report-${report.id}`,
      date: report.date,
      authorName: report.author?.fullName || "Staff",
      snippet: (report.notes ?? "").length > 60 ? (report.notes ?? "").slice(0, 60) + "…" : (report.notes ?? "Pending backfill"),    }));

    const alertItems: ActivityItem[] = lowStockItems
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

    // A "restock" is an EXISTING item (createdAt meaningfully earlier than
    // updatedAt — at least a minute apart, to exclude items that were just
    // added) that's now comfortably above its restock threshold. Without a
    // dedicated stock-change log, this is the best inference available from
    // current fields — genuinely accurate for real restocks, but can't
    // distinguish "owner bumped quantity" from "a bulk correction edit."
    const restockItems: ActivityItem[] = lowStockItems
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

    const firstName = user.fullName?.split(" ")[0] ?? "there";
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    return (
      <div className="min-h-screen bg-[#0a0c12] text-slate-200 pb-20 lg:pb-0">
        {/* ── Top Nav Bar ── */}
        <header className="sticky top-0 z-10 bg-[#0a0c12]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Store size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-none">Owner Portal</p>
              <p className="text-sm font-semibold text-white truncate leading-snug">{user.storeName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-slate-700">
              {user?.image ? (
                <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="bg-gradient-to-br from-blue-500 to-indigo-600 w-full h-full flex items-center justify-center">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-all duration-150">
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        {/* ── Page Body ── */}
        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">{greeting},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{firstName} 👋</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Today's Sales" value={`₦${todaySalesRevenue.toLocaleString()}`} sub="Since midnight" icon={<Banknote size={17} />} accent="emerald" />
            <StatCard title="Orders Today" value={ordersToday.toString()} sub="Transactions today" icon={<TrendingUp size={17} />} accent="blue" />
            <StatCard title="Active Products" value={activeProducts.toString()} sub="In inventory" icon={<Package size={17} />} accent="violet" />
            <StatCard title="Total Sales" value={`₦${totalSales.toLocaleString()}`} sub="Last 90 days gross" icon={<ShoppingCart size={17} />} accent="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <SalesChart data={serializedSalesData} />
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <h2 className="text-base font-semibold text-white mb-5">Recent Activity</h2>
                <div className="space-y-3">
                  {activityFeed.length > 0 ? (
                    activityFeed.map((item) => <ActivityRow key={item.id} item={item} />)
                  ) : (
                    <p className="text-slate-500 text-sm text-center py-4">No recent activity.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Sidebar Quick Access */}
            <div className="hidden lg:block p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl h-fit">
              <h2 className="text-base font-semibold text-white mb-5">Quick Access</h2>
              <div className="space-y-2">
                {[
                  { name: "Manage Staff", href: "/owner/staff", icon: LayoutDashboard, desc: "Add or suspend staff" },
                  { name: "Inventory", href: "/owner/inventory", icon: Package, desc: "View & update stock" },
                  { name: "Staff Reports", href: "/owner/report", icon: Activity, desc: "Review daily reports" },
                  { name: "Manage Profile", href: "/owner/profile", icon: Settings, desc: "Edit your account" },
                ].map((link) => (
                  <a key={link.name} href={link.href} className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700 transition-all group">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center transition-colors">
                      <link.icon size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{link.name}</p>
                      <p className="text-[11px] text-slate-500">{link.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* ── Mobile Native Nav ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-800 h-16 flex items-center justify-around z-50">
          <a href="/owner/staff" className="flex flex-col items-center text-slate-400 hover:text-white">
            <LayoutDashboard size={20} />
            <span className="text-[10px]">Staff</span>
          </a>
          <a href="/owner/inventory" className="flex flex-col items-center text-slate-400 hover:text-white">
            <Package size={20} />
            <span className="text-[10px]">Stock</span>
          </a>
          <a href="/owner/inventory/add" className="relative -top-6 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-600/30 border-4 border-[#0a0c12]">
            <Plus size={24} strokeWidth={3} />
          </a>
          <a href="/owner/report" className="flex flex-col items-center text-slate-400 hover:text-white">
            <Activity size={20} />
            <span className="text-[10px]">Reports</span>
          </a>
          <a href="/owner/profile" className="flex flex-col items-center text-slate-400 hover:text-white">
            <Settings size={20} />
            <span className="text-[10px]">Profile</span>
          </a>
        </nav>
      </div>
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return <div className="text-center p-8 text-slate-400">Error loading dashboard.</div>;
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.type === "sale") {
    return (
      <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Sale confirmed</p>
            <p className="text-[11px] text-slate-500 truncate">by {item.staffName}</p>
          </div>
        </div>
        <p className="text-sm font-bold text-emerald-400 shrink-0">₦{item.amount.toLocaleString()}</p>
      </div>
    );
  }

  if (item.type === "report") {
    return (
      <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <ClipboardList size={14} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">Report submitted</p>
            <p className="text-[11px] text-slate-500 truncate">by {item.authorName} — {item.snippet}</p>
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "restock") {
    return (
      <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <PackageCheck size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{item.itemName}</p>
            <p className="text-[11px] text-emerald-400 truncate">Restocked — {item.quantity} in stock</p>
          </div>
        </div>
      </div>
    );
  }

  // alert
  return (
    <div className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
      <div className="flex items-center gap-3 min-w-0">
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
    </div>
  );
}

const accentMap = {
  blue: { bg: "bg-blue-500/10", icon: "text-blue-400", border: "border-blue-500/20" },
  violet: { bg: "bg-violet-500/10", icon: "text-violet-400", border: "border-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-400", border: "border-emerald-500/20" },
};

function StatCard({ title, value, sub, icon, accent = "blue" }: any) {
  const colors = accentMap[accent as keyof typeof accentMap];
  return (
    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
        <div className={`h-8 w-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center ${colors.icon}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}