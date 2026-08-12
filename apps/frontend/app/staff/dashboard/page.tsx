// FILE: apps/frontend/app/staff/dashboard/page.tsx (UPDATED)
//
// Two things changed from the original: the RushCard import/render (see
// below), and a new badge chip in the header — pulls the most recent
// entry from RushProfile.badges via getRushProfile() and renders it under
// the staff's name, next to the "online" dot, only when one was won
// today (it expires at midnight, same as the rest of Rush's daily
// resets — see the comment above latestBadgeWonToday below).
// Everything else is untouched, including the locked-out billing screen
// (which intentionally does NOT get a RushCard or badge chip — no game
// access while the store itself is locked).

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Store, FileText, History, ShoppingBag, TrendingUp, Clock, LogOut, Package, UserCircle, ClipboardList, AlertTriangle, PackageCheck, ShoppingCart, Truck, Lock, Scale as ScaleIcon, HandCoins, CreditCard, Award } from "lucide-react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import StaffSupportBubble from "@/components/StaffSupportBubble";
import AdminAnnouncementGate from "@/components/AdminAnnouncementGate";
// FIXED: Changed to a named import to resolve TS2613
import { TrialBanner } from "@/components/TrialBanner"; 
// FIXED: Use the single shared billing calculation (handles trialEndsAt vs
// currentPeriodEnd correctly) instead of a duplicated, incorrect local
// calculation that only looked at currentPeriodEnd — which is null while
// an owner is still trialing, causing staff to see the wrong day count.
import { getBillingStatus } from "@/lib/subscription-guard";
import { getActiveStore } from "@/lib/store-context";
import RushCard from "@/components/RushCard";
import { getRushProfile } from "@/lib/rush.actions";

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
    select: { id: true, fullName: true, role: true, status: true, image: true, ownerId: true, notificationsEnabled: true, staffStoreId: true },
  });

  const userRole = staff?.role?.toLowerCase().trim();
  const userStatus = staff?.status?.toLowerCase().trim();

  if (!staff || userRole !== "staff") redirect("/login");
  if (userStatus === "suspended" || userStatus === "pending") redirect("/pending/staff");

  const [activeStore, rushProfile] = await Promise.all([getActiveStore(), getRushProfile()]);
  const isScaleStore = activeStore?.storeType === "scale";

  // Header badge chip — most recent entry from RushProfile.badges (an
  // append-only JSON array written in rush-rewards.actions.ts whenever a
  // "badge"-kind spin prize is won). No profile yet, or a profile that's
  // never won a badge, just means no chip — this never blocks the header.
  //
  // Expires at end of day: badges here are meant as daily flair ("Today's
  // MVP Title" and the like), not a permanent trophy case, so the chip
  // only shows if wonAt falls on today's calendar date. Same server
  // local wall-clock assumption as every other daily reset in Rush (see
  // startOfToday() in rush-clock.actions.ts) — no cron job needed, this
  // just naturally stops matching once the date rolls over.
  const badgesWon = Array.isArray(rushProfile?.badges)
    ? (rushProfile!.badges as { label: string; wonAt: string }[])
    : [];
  const latestBadgeEntry = badgesWon.length > 0 ? badgesWon[badgesWon.length - 1] : null;
  const latestBadgeWonToday =
    !!latestBadgeEntry && new Date(latestBadgeEntry.wonAt).toDateString() === new Date().toDateString();
  const latestBadge = latestBadgeWonToday ? latestBadgeEntry!.label : null;

  // Stage 3: the Wastage tile below was hardcoded to native scale-only
  // stores. Merged stores (standard store + the admin-only
  // scaleConsignmentEnabled override) can log wastage too now (Stages
  // 1-2), so the tile needs to show for them as well.
  let isMergedScale = false;
  if (!isScaleStore && staff.ownerId) {
    const ownerFlag = await prisma.user.findUnique({
      where: { id: staff.ownerId },
      select: { scaleConsignmentEnabled: true },
    });
    isMergedScale = !!ownerFlag?.scaleConsignmentEnabled;
  }
  const showWastageTile = isScaleStore || isMergedScale;

  // FIXED: getBillingStatus already resolves staff -> owner internally and
  // correctly picks trialEndsAt while trialing, or currentPeriodEnd once
  // paid — same logic the owner-side billing page uses, so the numbers
  // always match between owner and staff views.
  const billingStatus = await getBillingStatus(staff.ownerId ?? staff.id);

  const nameParts = staff.fullName?.split(" ") ?? ["Staff"];
  const firstName = nameParts[0] ?? "Staff";

  // Greeting based on server/local estimation
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // FIX: Safe Localized Midnight Construction (Avoids UTC reset shifts)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // If the owner's subscription/trial has expired, don't even bother
  // fetching dashboard data — staff should see a full lockout screen, not
  // sales figures or quick actions they can no longer act on.
  if (billingStatus.isLocked) {
    return (
      <div className="h-screen w-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-50 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 flex-shrink-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                <Store size={15} className="text-[var(--text-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 leading-none">Staff Portal</p>
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-none mt-0.5">{staff.fullName}</p>
              </div>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition-all duration-150"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-sm w-full text-center">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
              <Lock size={26} className="text-rose-400" />
            </div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] mb-2">Store access is locked</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              This store's subscription or free trial has ended. Sales, reports, and inventory actions are
              paused until the store owner renews. Please contact your store owner to reactivate access.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      where: {
        ownerId: staff.ownerId ?? undefined,
        OR: [{ storeId: staff.staffStoreId }, { storeId: null }],
      },
      take: 5,
      orderBy: { date: "desc" },
      select: { id: true, notes: true, date: true, author: { select: { fullName: true } } },
    }),
    // OPTIMIZATION: Limits pulled rows to prevent server timeouts on massive inventories
    prisma.inventory.findMany({
      where: {
        ownerId: staff.ownerId ?? undefined,
        OR: [{ storeId: staff.staffStoreId }, { storeId: null }],
      },
      select: { id: true, name: true, quantity: true, restockLevel: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 100, 
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
    <div className="h-screen w-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Store size={15} className="text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 leading-none">Staff Portal</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-none">{staff.fullName}</p>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </div>
              {latestBadge && (
                <div className="flex items-center gap-1 mt-1">
                  <Award size={10} className="text-amber-500 shrink-0" />
                  <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate leading-none">
                    {latestBadge}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationBell notificationsEnabled={staff.notificationsEnabled} userRole="staff" />

            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-[var(--text-primary)] shrink-0 overflow-hidden border border-slate-300 dark:border-slate-700">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition-all duration-150"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </Link>
          </div>
        </div>
      </header>

      <TrialBanner
        isLocked={billingStatus.isLocked}
        subscriptionStatus={billingStatus.subscriptionStatus}
        trialDaysLeft={billingStatus.trialDaysLeft}
        isOwner={false}
      />

      <div className="flex-1 overflow-y-auto pt-6 pb-28 md:pb-10">
        <div className="max-w-3xl mx-auto w-full">
          <div className="px-5 mb-6">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{greeting}</p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{firstName} 👋</h1>
          </div>

          <div className="px-5 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Today's Sales</p>
                </div>
                <p className="text-xl font-bold text-[var(--text-primary)]">₦{todaySales.toLocaleString()}</p>
              </div>
              <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-blue-400" />
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Orders Today</p>
                </div>
                <p className="text-xl font-bold text-[var(--text-primary)]">{todayOrders}</p>
              </div>
            </div>
          </div>

          {/* Rush entry point — sits between the stat grid and Quick
              Actions, styled deliberately outside the app's normal
              palette so it reads as a doorway rather than another
              utility widget. Renders nothing if Rush data can't be
              resolved. */}
          <div className="px-5 mb-6">
            <RushCard role="staff" />
          </div>

          <div className="px-5 mb-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link href="/staff/report" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <FileText size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Daily Report</p>
                  <p className="text-[11px] text-slate-500">Submit EOD summary</p>
                </div>
              </Link>

              <Link href="/staff/orders" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <History size={18} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Order History</p>
                  <p className="text-[11px] text-slate-500">View past sales</p>
                </div>
              </Link>

              <Link href="/staff/consignment" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Truck size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Consignment</p>
                  <p className="text-[11px] text-slate-500">Sign out or settle goods</p>
                </div>
              </Link>

              <Link href="/staff/debts" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <HandCoins size={18} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Debtors</p>
                  <p className="text-[11px] text-slate-500">Log part-payment balances</p>
                </div>
              </Link>

              <Link href="/staff/expenses" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <CreditCard size={18} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Expenses</p>
                  <p className="text-[11px] text-slate-500">Log today's store spend</p>
                </div>
              </Link>

              {showWastageTile && (
                <Link href="/staff/wastage" className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <ScaleIcon size={18} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Log Wastage</p>
                    <p className="text-[11px] text-slate-500">Report trimming, spillage, spoilage</p>
                  </div>
                </Link>
              )}

              <Link href="/staff/inventory" className="hidden sm:flex bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ShoppingBag size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Sell</p>
                  <p className="text-[11px] text-slate-500">Open the inventory & cart</p>
                </div>
              </Link>

              <Link href="/staff/invoice" className="hidden sm:flex bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-slate-500/10 flex items-center justify-center">
                  <Package size={18} className="text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Invoice</p>
                  <p className="text-[11px] text-slate-500">Print or share an invoice</p>
                </div>
              </Link>

              <Link href="/staff/profile" className="hidden sm:flex bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 active:bg-slate-200 active:dark:bg-slate-800 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <UserCircle size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Profile</p>
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
                <div className="bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
                  <ShoppingBag size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-slate-500 text-sm">No recent activity yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-app)]/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 px-4 py-2 z-50">
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
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-95 transition-transform border-4 border-[var(--border-subtle)]">
              <ShoppingBag size={26} className="text-[var(--text-primary)]" />
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
      <AdminAnnouncementGate />
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  if (item.type === "sale") {
    return (
      <div className="flex justify-between items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">Sale confirmed</p>
        </div>
        <p className="text-sm font-bold text-emerald-400 shrink-0">₦{item.amount.toLocaleString()}</p>
      </div>
    );
  }

  if (item.type === "report") {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <ClipboardList size={14} className="text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">Report submitted</p>
          <p className="text-[11px] text-slate-500 truncate">by {item.authorName} — {item.snippet}</p>
        </div>
      </div>
    );
  }

  if (item.type === "restock") {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <PackageCheck size={14} className="text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.itemName}</p>
          <p className="text-[11px] text-emerald-400 truncate">Restocked — {item.quantity} in stock</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 min-w-0">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.isOutOfStock ? "bg-rose-500/10" : "bg-amber-500/10"}`}>
        <AlertTriangle size={14} className={item.isOutOfStock ? "text-rose-400" : "text-amber-400"} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.itemName}</p>
        <p className={`text-[11px] truncate ${item.isOutOfStock ? "text-rose-400" : "text-amber-400"}`}>
          {item.isOutOfStock ? "Out of stock" : `Low stock — ${item.quantity} left`}
        </p>
      </div>
    </div>
  );
}