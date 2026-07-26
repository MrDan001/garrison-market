import {
  ChevronRight, Store, LayoutDashboard,
  Activity, CreditCard, Users, Receipt,
  LogOut, ArrowLeft, History,
  MessageSquare, Zap, Calendar, Gift, ChevronDown, UserPlus, Scale as ScaleIcon
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { logoutAction } from "@/lib/auth.actions";
import { getOwnerBillingInfo } from "@/lib/billing.actions"; 
import { getActiveStore } from "@/lib/store-context";
import SettingsDropdown from "./settings-dropdown";
import OwnerAnnouncementForm from "@/components/OwnerAnnouncementForm";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  const activeStore = await getActiveStore();
  const isScaleStore = activeStore?.storeType === "scale";

  const billingInfo = await getOwnerBillingInfo();
  const { isLocked, plan, currentPeriodEnd } = billingInfo.status;

  const user = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
      notificationsEnabled: true,
      discountEnabled: true,
      consignmentEnabled: true,
      screenshotProtectionEnabled: true,
      wastageVisibleToStaff: true,
      scaleConsignmentEnabled: true,
      referralCode: true,
      referrals: {
        where: { role: "owner" },
        select: {
          id: true,
          fullName: true,
          storeName: true,
          status: true,
          subscriptionStatus: true,
          hasTriggeredReferralReward: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) redirect("/login");

  const expiryDateString = currentPeriodEnd 
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "N/A";

  const shortCode = user.referralCode || "NO_CODE_YET";

  const referredList = user.referrals;
  const rewardedCount = referredList.filter((r) => r.hasTriggeredReferralReward).length;

  return (
    <div className="fixed inset-0 bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col pb-20 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-4 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
        <a href="/owner/dashboard" className="p-2 -ml-2 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 rounded-full transition-colors text-slate-600 dark:text-slate-400">
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">More Menu</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 max-w-2xl mx-auto w-full">
        
        {/* Profile Card */}
        <a href="/owner/profile/edit" className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-4 hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-xs block">
          <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 shadow-inner">
            {user.image ? (
              <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              user.fullName?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[var(--text-primary)] truncate">{user.fullName}</h2>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 shrink-0">
            <ChevronRight size={18} />
          </div>
        </a>

        {/* Subscription + Growth & Rewards — Combined Dropdown */}
        <details className="group rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] overflow-hidden shadow-xs">
          <summary className="list-none cursor-pointer flex items-center justify-between p-4 sm:p-5 select-none hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${isLocked ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                <Zap size={18} className={!isLocked ? "fill-blue-500 dark:fill-blue-400" : ""} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Subscription & Rewards</h3>
                <p className="text-xs text-slate-500">
                  <span className="capitalize font-medium">{plan || "Free / Trial"}</span> plan &middot; {referredList.length} referral{referredList.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 transition-transform duration-200 group-open:rotate-180 shrink-0">
              <ChevronDown size={18} />
            </div>
          </summary>

          <div className="p-4 sm:p-5 space-y-5 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40">
            
            {/* Subscription Info Card */}
            <a href="/owner/billing" className="p-4 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 flex items-center justify-between hover:border-blue-500/40 transition-all block shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-xl shrink-0 ${isLocked ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  <Zap size={20} className={!isLocked ? "fill-blue-500 dark:fill-blue-400 animate-pulse" : ""} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)] capitalize">
                      {plan || "Free / Trial"} Plan
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isLocked ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                      {isLocked ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <Calendar size={13} />
                    <span>Expires: <strong className="text-[var(--text-primary)]">{expiryDateString}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                <span>Manage</span>
                <ChevronRight size={16} />
              </div>
            </a>

            {/* Growth & Rewards Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Gift size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Invite & Earn Plan Days</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Share your unique code. For each owner who signs up and secures subscription, you gain <strong className="text-emerald-600 dark:text-emerald-400">+7 premium days</strong> added to your period end.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Referral Code</p>
                  <div className="mt-1 flex items-center justify-between">
                    <code className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded select-all cursor-pointer">
                      {shortCode}
                    </code>
                    <span className="text-[10px] text-slate-400 italic">Click to copy</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subscribed Referrals</p>
                    <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                      {rewardedCount} Active Enterprise{rewardedCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="h-7 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                    +{rewardedCount * 7} Days
                  </div>
                </div>
              </div>

              {/* Referred clients list */}
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  People You've Referred ({referredList.length})
                </p>

                {referredList.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[var(--bg-surface)] border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500">
                    <UserPlus size={16} className="shrink-0 text-slate-400" />
                    <span>No one has signed up with your code yet. Share it to start earning free days.</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-200/60 dark:divide-slate-800/60 overflow-hidden bg-[var(--bg-surface)]">
                    {referredList.map((r) => {
                      const joinedDate = new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      let badgeLabel = "Pending Approval";
                      let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

                      if (r.hasTriggeredReferralReward) {
                        badgeLabel = "Reward Earned";
                        badgeClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                      } else if (r.status?.toLowerCase() === "approved") {
                        badgeLabel = "Approved · Awaiting Sub";
                        badgeClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                      } else if (r.status?.toLowerCase() === "declined") {
                        badgeLabel = "Declined";
                        badgeClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
                      }

                      return (
                        <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {r.fullName || "Unnamed Owner"}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {r.storeName || "No store name"} &middot; {joinedDate}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </details>

        {/* Business section */}
        <MenuSection
          title="Business Management"
          items={[
            { label: "Customers",  icon: Users,          href: "/owner/customers" },
            { label: "Invoices",   icon: Receipt,        href: "/owner/invoices" },
            { label: "Expenses",   icon: CreditCard,     href: "/owner/expenses" },
            { label: "Reports",    icon: Activity,       href: "/owner/report" },
            { label: "History",    icon: History,        href: "/owner/history" },
            { label: "Consignments", icon: Store,         href: "/owner/consignments" },
            ...(isScaleStore || user?.scaleConsignmentEnabled ? [{ label: "Wastage Reports", icon: ScaleIcon, href: "/owner/wastage" }] : []),
          ]}
        />

        {/* Announcement section */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Communication</h3>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-4 shadow-xs">
            <OwnerAnnouncementForm />
          </div>
        </div>

        {/* Account section */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Account & Organization</h3>
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] divide-y divide-slate-200/60 dark:divide-slate-800/60 overflow-hidden shadow-xs">
            <a href="/owner/stores" className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors group">
              <div className="flex items-center gap-3.5">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                  <Store size={16} />
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">My Stores</span>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
            
            <a href="/owner/staff" className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors group">
              <div className="flex items-center gap-3.5">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                  <LayoutDashboard size={16} />
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">Staff Management</span>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a href="/owner/support" className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors group">
              <div className="flex items-center gap-3.5">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                  <MessageSquare size={16} />
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)]">Help & Support</span>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Inline Settings Dropdown */}
            <SettingsDropdown
              notificationsEnabled={user.notificationsEnabled}
              discountEnabled={user.discountEnabled}
              consignmentEnabled={user.consignmentEnabled}
              screenshotProtectionEnabled={user.screenshotProtectionEnabled}
              wastageVisibleToStaff={user.wastageVisibleToStaff}
            />
          </div>
        </div>

        {/* Sign out */}
        <div className="pt-2 pb-6 px-1">
          <form action={logoutAction}>
            <button className="flex items-center gap-2.5 text-rose-500 font-semibold text-sm hover:text-rose-600 transition-colors">
              <LogOut size={16} />
              Sign Out of Account
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}

function MenuSection({
  title,
  items,
}: {
  title: string;
  items: { label: string; icon: any; href: string }[];
}) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">{title}</h3>
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] divide-y divide-slate-200/60 dark:divide-slate-800/60 overflow-hidden shadow-xs">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors group">
            <div className="flex items-center gap-3.5">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                <item.icon size={16} />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>
        ))}
      </div>
    </div>
  );
}