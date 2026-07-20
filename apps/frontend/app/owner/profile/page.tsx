import {
  ChevronRight, Store, LayoutDashboard,
  Activity, CreditCard, Users, Receipt,
  LogOut, ArrowLeft, History,
  MessageSquare, Zap, Calendar, Gift, ChevronDown, UserPlus
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { logoutAction } from "@/lib/auth.actions";
import { getOwnerBillingInfo } from "@/lib/billing.actions"; 
import SettingsDropdown from "./settings-dropdown";
import OwnerAnnouncementForm from "@/components/OwnerAnnouncementForm";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

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
      // 👇 The real, stored referral token — generated once at registration
      // and guaranteed unique. Do NOT recompute this from the store name;
      // the store name can be renamed later and would drift out of sync
      // with the code that was actually matched against at signup.
      referralCode: true,
      // 👇 Full list of owners this user referred, so we can show more
      // than just a count.
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
    <div className="fixed inset-0 bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 flex flex-col pb-20">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
        <a href="/owner/dashboard" className="p-2 -ml-2 hover:bg-slate-200 hover:dark:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-lg font-bold">More</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {/* Profile Card */}
        <a href="/owner/profile/edit" className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:border-slate-400 hover:dark:border-slate-600 transition-all block">
          <div className="flex items-center gap-4 w-full">
            <div className="h-14 w-14 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0">
              {user.image ? (
                <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user.fullName?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[var(--text-primary)] truncate">{user.fullName}</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{user.email}</p>
            </div>
            <ChevronRight size={20} className="text-slate-400 dark:text-slate-600 shrink-0" />
          </div>
        </a>

        {/* Subscription + Growth & Rewards — combined dropdown */}
        <details className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 overflow-hidden">
          <summary className="list-none cursor-pointer flex items-center justify-between p-4 select-none">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${isLocked ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'}`}>
                <Zap size={18} className={!isLocked ? "fill-blue-500 dark:fill-blue-400" : ""} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Subscription & Rewards</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {plan || "Free / Trial"} plan &middot; {referredList.length} referral{referredList.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <ChevronDown size={18} className="text-slate-400 dark:text-slate-600 transition-transform duration-200 group-open:rotate-180 shrink-0" />
          </summary>

          <div className="px-4 pb-4 pt-1 space-y-5 border-t border-slate-200 dark:border-slate-800">
            {/* Subscription Info */}
            <a href="/owner/billing" className="mt-4 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 flex items-center justify-between hover:border-blue-400 dark:hover:border-blue-700 transition-all block">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${isLocked ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'}`}>
                  <Zap size={22} className={!isLocked ? "fill-blue-500 dark:fill-blue-400 animate-pulse" : ""} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)] capitalize">
                      {plan || "Free / Trial"} Plan
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isLocked ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                      {isLocked ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-400">
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

            {/* Growth & Rewards */}
            <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 via-transparent to-transparent dark:from-emerald-950/10 space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0">
                  <Gift size={22} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Invite & Earn Plan Days</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                    Share your code. For each store owner who signs up and secures verification using this code, you gain <strong className="text-emerald-500 dark:text-emerald-400">+7 premium days</strong> added directly to your current period end.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Your Referral Code</p>
                  <div className="mt-1 flex items-center justify-between">
                    <code className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded select-all cursor-pointer tracking-wider">
                      {shortCode}
                    </code>
                    <span className="text-[10px] text-slate-400 italic">Double-click to select</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Subscribed Referrals</p>
                    <p className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                      {rewardedCount} Active Enterprise{rewardedCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="h-7 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                    +{rewardedCount * 7} Days Earned
                  </div>
                </div>
              </div>

              {/* Referred clients list */}
              <div className="pt-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  People You've Referred ({referredList.length})
                </p>

                {referredList.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <UserPlus size={16} className="shrink-0" />
                    <span>No one has signed up with your code yet. Share it to start earning days.</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                    {referredList.map((r) => {
                      const joinedDate = new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      let badgeLabel = "Pending Approval";
                      let badgeClass = "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

                      if (r.hasTriggeredReferralReward) {
                        badgeLabel = "Reward Earned";
                        badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
                      } else if (r.status?.toLowerCase() === "approved") {
                        badgeLabel = "Approved · Awaiting Subscription";
                        badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
                      } else if (r.status?.toLowerCase() === "declined") {
                        badgeLabel = "Declined";
                        badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400";
                      }

                      return (
                        <div key={r.id} className="p-3 flex items-center justify-between gap-3 bg-slate-100/40 dark:bg-slate-900/40">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                              {r.fullName || "Unnamed Owner"}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {r.storeName || "No store name"} &middot; Joined {joinedDate}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap shrink-0 ${badgeClass}`}>
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
          title="Business"
          items={[
            { label: "Customers",  icon: Users,          href: "/owner/customers" },
            { label: "Invoices",   icon: Receipt,        href: "/owner/invoices" },
            { label: "Expenses",   icon: CreditCard,     href: "/owner/expenses" },
            { label: "Reports",    icon: Activity,       href: "/owner/report" },
            { label: "History",    icon: History,        href: "/owner/history" },
            { label: "Consignments", icon: Store,         href: "/owner/consignments" },
          ]}
        />

        {/* Announcement section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Communication</h3>
          <OwnerAnnouncementForm />
        </div>

        {/* Account section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Account</h3>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl divide-y divide-slate-800">
            <a href="/owner/stores" className="flex items-center justify-between p-4 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <Store size={18} className="text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium">My Stores</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 dark:text-slate-600" />
            </a>
            
            <a href="/owner/staff" className="flex items-center justify-between p-4 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} className="text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium">Staff</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 dark:text-slate-600" />
            </a>

            {/* Support Link */}
            <a href="/owner/support" className="flex items-center justify-between p-4 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare size={18} className="text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium">Support</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 dark:text-slate-600" />
            </a>

            {/* Inline Settings Dropdown */}
            <SettingsDropdown
              notificationsEnabled={user.notificationsEnabled}
              discountEnabled={user.discountEnabled}
              consignmentEnabled={user.consignmentEnabled}
              screenshotProtectionEnabled={user.screenshotProtectionEnabled}
            />
          </div>
        </div>

        {/* Sign out */}
        <div className="px-2">
          <form action={logoutAction}>
            <button className="flex items-center gap-3 text-rose-400 font-medium hover:text-rose-300 transition-colors">
              <LogOut size={18} />
              Sign Out
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
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">{title}</h3>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/40 backdrop-blur-xl divide-y divide-slate-800">
        {items.map((item) => (
          <a key={item.label} href={item.href} className="flex items-center justify-between p-4 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-3">
              <item.icon size={18} className="text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <ChevronRight size={18} className="text-slate-400 dark:text-slate-600" />
          </a>
        ))}
      </div>
    </div>
  );
}