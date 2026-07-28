import { LayoutDashboard, Package, ShoppingCart, Settings, Activity, LogOut, TrendingUp, Store, Plus, Banknote } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SalesChart from "@/components/SalesChart";
import { getBillingStatus } from "@/lib/subscription-guard";
import { TrialBanner, PremiumFeatureLock } from "@/components/TrialBanner";
import { logoutAction } from "@/lib/auth.actions";
import NotificationBell from "@/components/NotificationBell";
import { getActiveStoreId } from "@/lib/store-context";

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

    // 1. Retrieve the user profile
    const user = await prisma.user.findUnique({
      where: { email: session.email },
      select: {
        id: true,
        fullName: true,
        storeName: true,
        image: true,
        status: true,
        notificationsEnabled: true,
      },
    });

    if (!user || user.status !== "approved") redirect("/pending");

    const billingStatus = await getBillingStatus(user.id);

    // 2. Resolve the active store the same way /owner/stores does — falls
    // back to the owner's oldest store when no "activeStoreId" cookie has
    // been set yet (e.g. a brand-new account that's never switched stores),
    // instead of bouncing them back to /owner/stores for having no cookie.
    const activeStoreId = await getActiveStoreId();

    if (!activeStoreId) {
      redirect("/owner/stores");
    }

    // 3. Confirm store belongs to this owner
    const activeStore = await prisma.store.findFirst({
      where: { id: activeStoreId, ownerId: user.id },
      select: { name: true }
    });

    if (!activeStore) {
      redirect("/owner/stores");
    }

    // ── Timezone-Safe Start of Today for Nigeria/WAT (UTC+1) ──
    const now = new Date();
    const localTime = new Date(now.getTime() + 1 * 60 * 60 * 1000); 
    const todayStart = new Date(Date.UTC(localTime.getUTCFullYear(), localTime.getUTCMonth(), localTime.getUTCDate(), 0, 0, 0, 0));
    todayStart.setTime(todayStart.getTime() - 1 * 60 * 60 * 1000); 

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Boundary for monthly analytics
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // NOTE: storeId is nullable to support legacy pre-multi-store records.
    const orderMatchQuery = {
      ownerId: user.id,
      OR: [
        { storeId: activeStoreId },
        { storeId: null }
      ]
    };

    // 4. Run scoped database queries using database limits to avoid server timeouts
    const [
      salesData, 
      activeProducts, 
      activeScaleProducts,
      todayOrdersList, 
      recentReports, 
      lowStockItems, 
      recentOrders,
      monthOrderItems
    ] = await Promise.all([
      prisma.order.findMany({
        where: { ...orderMatchQuery, date: { gte: ninetyDaysAgo } },
        select: { total: true, date: true },
        orderBy: { date: "asc" },
      }),
      prisma.inventory.count({
        where: { ownerId: user.id, OR: [{ storeId: activeStoreId }, { storeId: null }] }
      }),
      // Scale (weight/volume) products — counted separately since they live
      // in their own table, then added to activeProducts below so the
      // dashboard's "Active Products" stat reflects BOTH inventory types,
      // not just the standard/list one.
      prisma.scaleInventory.count({
        where: { ownerId: user.id, OR: [{ storeId: activeStoreId }, { storeId: null }] }
      }),
      prisma.order.findMany({
        where: { ...orderMatchQuery, date: { gte: todayStart } },
        select: { total: true, paymentMethod: true },
      }),
      prisma.report.findMany({
        where: { ownerId: user.id, OR: [{ storeId: activeStoreId }, { storeId: null }] },
        take: 5,
        orderBy: { date: "desc" },
        select: {
          id: true,
          notes: true,
          date: true,
          author: { select: { fullName: true } },
        },
      }),
      prisma.inventory.findMany({
        where: { ownerId: user.id, OR: [{ storeId: activeStoreId }, { storeId: null }] },
        select: { id: true, name: true, quantity: true, restockLevel: true, updatedAt: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 150, 
      }),
      prisma.order.findMany({
        where: { ...orderMatchQuery },
        take: 5,
        orderBy: { date: "desc" },
        select: {
          id: true,
          total: true,
          date: true,
          staff: { select: { fullName: true } },
        },
      }),
      // New Query to pull this month's line items for custom analytics panel
      prisma.orderItem.findMany({
        where: {
          order: {
            storeId: activeStoreId,
            date: { gte: currentMonthStart }
          }
        },
        select: {
          quantity: true,
          priceAtTime: true,
          inventoryId: true,
          inventory: {
            select: { name: true, quantity: true, restockLevel: true }
          },
          order: {
            select: {
              staff: {
                select: { id: true, fullName: true }
              }
            }
          }
        }
      })
    ]);

    // Compute Calculations safely
    const ordersToday = todayOrdersList.length;
    const todaySalesRevenue = todayOrdersList.reduce((sum, order) => sum + Number(order.total), 0);

    // Combined count so the "Active Products" stat reflects the store's
    // full catalog regardless of storeType — standard (list) items plus
    // scale (weight/volume) items.
    const totalProducts = activeProducts + activeScaleProducts;
    
    const cashSalesToday = todayOrdersList
      .filter(o => o.paymentMethod?.toLowerCase().trim() === "cash")
      .reduce((sum, order) => sum + Number(order.total), 0);

    const transferSalesToday = todayOrdersList
      .filter(o => o.paymentMethod?.toLowerCase().trim() === "transfer")
      .reduce((sum, order) => sum + Number(order.total), 0);

    const serializedSalesData = salesData.map((d) => ({
      total: Number(d.total),
      date: d.date.toISOString(),
    }));

    // FIXED: Safely maps and converts the Prisma Decimal object inside monthOrderItems to a plain JSON JavaScript number
    const serializedMonthOrderItems = monthOrderItems.map((item) => ({
      ...item,
      priceAtTime: typeof item.priceAtTime === "object" && item.priceAtTime !== null
        ? Number(item.priceAtTime.toString())
        : Number(item.priceAtTime || 0)
    }));

    const totalSales = serializedSalesData.reduce((acc, curr) => acc + curr.total, 0);

    // ── Build the merged activity feed ──
    const saleItems: ActivityItem[] = recentOrders.map((order) => ({
      type: "sale",
      id: `sale-${order.id}`,
      date: order.date,
      amount: Number(order.total),
      staffName: order.staff?.fullName || "Owner Account",
    }));

    const reportItems: ActivityItem[] = recentReports.map((report) => ({
      type: "report",
      id: `report-${report.id}`,
      date: report.date,
      authorName: report.author?.fullName || "Staff Profile",
      snippet: (report.notes ?? "").length > 60 ? (report.notes ?? "").slice(0, 60) + "…" : (report.notes ?? "Pending backfill"),
    }));

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
      <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 pb-20 lg:pb-0">
        <header className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Store size={15} className="text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-none">Owner Portal</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate mt-0.5 leading-none">{activeStore.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationBell notificationsEnabled={user?.notificationsEnabled ?? true} userRole="owner" />

            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] shrink-0 overflow-hidden border border-slate-300 dark:border-slate-700">
              {user?.image ? (
                <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="bg-gradient-to-br from-blue-500 to-indigo-600 w-full h-full flex items-center justify-center">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <form action={logoutAction}>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition-all duration-150">
                <LogOut size={13} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <TrialBanner
          isLocked={billingStatus.isLocked}
          subscriptionStatus={billingStatus.subscriptionStatus}
          trialDaysLeft={billingStatus.trialDaysLeft}
          isOwner={true}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <p className="text-sm text-slate-500">{greeting},</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">{firstName} 👋</h1>
            </div>
          </div>

          {/* Aggregated Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Today's Revenue" value={`₦${todaySalesRevenue.toLocaleString()}`} sub={`Cash: ₦${cashSalesToday.toLocaleString()} | Transfer: ₦${transferSalesToday.toLocaleString()}`} icon={<Banknote size={17} />} accent="emerald" />
            <StatCard title="Orders Today" value={ordersToday.toString()} sub="Transactions today" icon={<TrendingUp size={17} />} accent="blue" />
            <StatCard title="Active Products" value={totalProducts.toString()} sub="In inventory" icon={<Package size={17} />} accent="violet" />
            <StatCard title="90-Day Revenue" value={`₦${totalSales.toLocaleString()}`} sub="Last 90 days gross" icon={<ShoppingCart size={17} />} accent="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl">
                {/* FIXED: Uses serializedMonthOrderItems to resolve plain object runtime limits */}
                {billingStatus.plan === "premium" ? (
                  <SalesChart data={serializedSalesData} analyticsData={serializedMonthOrderItems} />
                ) : (
                  <PremiumFeatureLock featureName="Business Summary Chart" isOwner={true}>
                    <SalesChart data={serializedSalesData} analyticsData={serializedMonthOrderItems} />
                  </PremiumFeatureLock>
                )}
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl">
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h2>
                <div className="space-y-3">
                  {activityFeed.length > 0 ? (
                    activityFeed.map((item) => <ActivityRow key={item.id} item={item} />)
                  ) : (
                    <p className="text-slate-500 text-sm text-center py-4">No recent activity.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden lg:block p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl h-fit">
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-5">Quick Access</h2>
              <div className="space-y-2">
                {[
                  { name: "Manage Staff", href: "/owner/staff", icon: LayoutDashboard, desc: "Add or suspend staff" },
                  { name: "Inventory", href: "/owner/inventory", icon: Package, desc: "View & update stock" },
                  { name: "Staff Reports", href: "/owner/report", icon: Activity, desc: "Review daily reports" },
                  { name: "Manage Profile", href: "/owner/profile", icon: Settings, desc: "Edit your account" },
                ].map((link) => (
                  <a key={link.name} href={link.href} className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-950/60 hover:bg-slate-200/60 hover:dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 hover:dark:border-slate-700 transition-all group">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center transition-colors">
                      <link.icon size={16} className="text-slate-600 dark:text-slate-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{link.name}</p>
                      <p className="text-[11px] text-slate-500">{link.desc}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around z-50">
          <a href="/owner/staff" className="flex flex-col items-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
            <LayoutDashboard size={20} />
            <span className="text-[10px]">Staff</span>
          </a>
          <a href="/owner/inventory" className="flex flex-col items-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
            <Package size={20} />
            <span className="text-[10px]">Stock</span>
          </a>
          <a href="/owner/inventory/add" className="relative -top-6 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-600/30 border-4 border-[var(--border-subtle)]">
            <Plus size={24} strokeWidth={3} />
          </a>
          <a href="/owner/report" className="flex flex-col items-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
            <Activity size={20} />
            <span className="text-[10px]">Reports</span>
          </a>
          <a href="/owner/profile" className="flex flex-col items-center text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
            <Settings size={20} />
            <span className="text-[10px]">Profile</span>
          </a>
        </nav>
      </div>
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error(error);
    return <div className="text-center p-8 text-slate-600 dark:text-slate-400">Error loading dashboard.</div>;
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const getTheme = () => {
    switch (item.type) {
      case "sale":
        return { accent: "border-emerald-500", bg: "bg-emerald-950/20", text: "text-emerald-400", label: "SALE" };
      case "report":
        return { accent: "border-blue-500", bg: "bg-blue-950/20", text: "text-blue-400", label: "REPORT" };
      case "restock":
        return { accent: "border-indigo-500", bg: "bg-indigo-950/20", text: "text-indigo-400", label: "RESTOCK" };
      case "alert":
        const isOutOfStock = "isOutOfStock" in item && item.isOutOfStock;
        return {
          accent: isOutOfStock ? "border-rose-500" : "border-amber-500",
          bg: isOutOfStock ? "bg-rose-950/20" : "bg-amber-950/20",
          text: isOutOfStock ? "text-rose-400" : "text-amber-400",
          label: isOutOfStock ? "CRITICAL" : "LOW STOCK"
        };
      default:
        return { accent: "border-slate-500", bg: "bg-slate-50/20 dark:bg-slate-950/20", text: "text-slate-600 dark:text-slate-400", label: "INFO" };
    }
  };

  const t = getTheme();

  return (
    <div className={`relative flex items-center justify-between py-3 pl-4 border-l-4 ${t.accent} ${t.bg} hover:brightness-125 transition-all duration-300 min-w-0 gap-4`}>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className={`text-[9px] font-bold tracking-[0.2em] ${t.text} uppercase`}>
          {t.label}
        </span>
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
          {item.type === "sale" && item.staffName}
          {item.type === "report" && item.authorName}
          {item.type === "restock" && item.itemName}
          {item.type === "alert" && item.itemName}
        </span>
        {item.type === "report" && (
          <p className="text-[11px] text-slate-600 dark:text-slate-400 italic truncate mt-0.5">{item.snippet}</p>
        )}
      </div>

      <div className="pr-4 text-right shrink-0">
        <span className={`block font-mono text-xs font-bold ${t.text}`}>
          {item.type === "sale" ? `+₦${item.amount.toLocaleString()}` : 
           item.type === "alert" && "isOutOfStock" in item ? (item.isOutOfStock ? "EMPTY" : `${item.quantity} UNITS`) :
           item.type === "restock" ? `${item.quantity} UNITS` :
           "REVIEW"}
        </span>
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter block mt-0.5">
          {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
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
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
        <div className={`h-8 w-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center ${colors.icon}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  );
}