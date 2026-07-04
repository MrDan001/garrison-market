import { LayoutDashboard, Package, ShoppingCart, Settings, Activity, LogOut, TrendingUp, Store } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import prisma from "@/lib/prisma";
import SalesChart from "@/components/SalesChart";
import { logoutAction } from "@/lib/auth.actions";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  try {
    const session = await getSessionUser();
    if (!session?.email) redirect("/login");

    const user = await prisma.user.findUnique({
      where: { email: session.email },
      include: {
        managedStaff: { select: { fullName: true } },
        orders: {
          take: 5,
          orderBy: { date: "desc" },
          include: { staff: { select: { fullName: true } } },
        },
      },
    });

    if (!user || user.status !== "approved") redirect("/pending");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [salesData, activeProducts, ordersToday] = await Promise.all([
      prisma.order.findMany({
        where: { ownerId: user.id, date: { gte: ninetyDaysAgo } },
        select: { total: true, date: true },
        orderBy: { date: "asc" },
      }),
      prisma.inventory.count({ where: { ownerId: user.id } }),
      prisma.order.count({
        where: {
          ownerId: user.id,
          date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const serializedSalesData = salesData.map((d: { total: number; date: Date }) => ({      total: Number(d.total),
      date: d.date.toISOString(),
    }));

    const totalSales = serializedSalesData.reduce(
      (acc: number, curr: { total: number; date: string }) => acc + curr.total,
      0
    );

    // Get first name only
    const firstName = user.fullName?.split(" ")[0] ?? "there";

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    return (
      <div className="min-h-screen bg-[#0a0c12] text-slate-200">

        {/* ── Top Nav Bar ── */}
        <header className="sticky top-0 z-10 bg-[#0a0c12]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Store identity */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Store size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-none">Owner Portal</p>
              <p className="text-sm font-semibold text-white truncate leading-snug">
                {user.storeName}
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Avatar */}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>

            {/* Logout — form so it triggers the server action */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 transition-all duration-150"
                title="Sign out"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        {/* ── Page Body ── */}
        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">

          {/* Welcome block */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">{greeting},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {firstName} 👋
              </h1>
            </div>
            <p className="text-xs text-slate-600 sm:text-right">
              Last updated: {new Date().toLocaleDateString("en-NG", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Sales"
              value={`₦${totalSales.toLocaleString()}`}
              sub="Last 90 days"
              icon={<ShoppingCart size={17} />}
              accent="blue"
            />
            <StatCard
              title="Active Products"
              value={activeProducts.toString()}
              sub="In inventory"
              icon={<Package size={17} />}
              accent="violet"
            />
            <StatCard
              title="Orders Today"
              value={ordersToday.toString()}
              sub="Since midnight"
              icon={<TrendingUp size={17} />}
              accent="emerald"
            />
          </div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Sales chart */}
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-semibold text-white">Sales Performance</h2>
                  <span className="text-[11px] text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">
                    90-day view
                  </span>
                </div>
                <SalesChart data={serializedSalesData} />
              </div>

              {/* Live activity */}
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <h2 className="text-base font-semibold text-white mb-5">Recent Activity</h2>
                <div className="space-y-3">
                  {user.orders.length > 0 ? (
user.orders.map((order: { id: number; total: number | { toString(): string }; staff: { fullName: string | null } | null }) => (                      <div
                        key={order.id}
                        className="flex justify-between items-center px-4 py-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <ShoppingCart size={14} className="text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">Sale confirmed</p>
                            <p className="text-[11px] text-slate-500">
                              by {order.staff?.fullName || "Owner"}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-emerald-400">
                          ₦{Number(order.total).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-slate-500 text-sm">No recent activity.</p>
                      <p className="text-slate-600 text-xs mt-1">Sales will appear here as they come in.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — Quick nav */}
            <div className="p-6 sm:p-8 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <h2 className="text-base font-semibold text-white mb-5">Quick Access</h2>
              <div className="space-y-2">
                {[
                  { name: "Manage Profile",  href: "/owner/profile",   icon: Settings,       desc: "Edit your account" },
                  { name: "Inventory",       href: "/owner/inventory", icon: Package,        desc: "View & update stock" },
                  { name: "Manage Staff",    href: "/owner/staff",     icon: LayoutDashboard,desc: "Add or suspend staff" },
                  { name: "Staff Reports",   href: "/owner/report",    icon: Activity,       desc: "Review daily reports" },
                ].map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700 transition-all group"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center transition-colors">
                      <link.icon size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {link.name}
                      </p>
                      <p className="text-[11px] text-slate-500">{link.desc}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Sign out shortcut at bottom of sidebar */}
              <div className="mt-6 pt-5 border-t border-slate-800/60">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-800/60 hover:border-rose-500/40 hover:bg-rose-500/5 text-slate-500 hover:text-rose-400 transition-all group"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 group-hover:bg-rose-500/10 flex items-center justify-center transition-colors">
                      <LogOut size={15} className="group-hover:text-rose-400 transition-colors" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Sign out</p>
                      <p className="text-[11px] text-slate-600">End your session</p>
                    </div>
                  </button>
                </form>
              </div>
            </div>

          </div>
        </main>
      </div>
    );
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("DASHBOARD_ERROR:", error);
    return (
      <div className="min-h-screen bg-[#0a0c12] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Error loading dashboard.</p>
          <p className="text-slate-600 text-xs mt-1">Please check server logs.</p>
        </div>
      </div>
    );
  }
}

// ── Stat Card Component ──
const accentMap = {
  blue:    { bg: "bg-blue-500/10",    icon: "text-blue-400",    border: "border-blue-500/20" },
  violet:  { bg: "bg-violet-500/10",  icon: "text-violet-400",  border: "border-violet-500/20" },
  emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-400", border: "border-emerald-500/20" },
};

function StatCard({
  title,
  value,
  sub,
  icon,
  accent = "blue",
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: "blue" | "violet" | "emerald";
}) {
  const colors = accentMap[accent];
  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <div className={`h-8 w-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center ${colors.icon}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
