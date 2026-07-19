import {
  ChevronRight, Store, LayoutDashboard,
  Activity, CreditCard, Users, Receipt,
  Settings, LogOut, ArrowLeft, History,
  MessageSquare, Zap, Clock, Calendar // Added for Subscription UI
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { logoutAction } from "@/lib/auth.actions";
import { getOwnerBillingInfo } from "@/lib/billing.actions"; // Imported to fetch current live subscription metrics
import SettingsDropdown from "./settings-dropdown";
import OwnerAnnouncementForm from "@/components/OwnerAnnouncementForm";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  // 1. Fetch current plan configuration limits & expiry data via your server action helper
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
    },
  });

  if (!user) redirect("/login");

  // Format expiration date nicely
  const expiryDateString = currentPeriodEnd 
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "N/A";

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

        {/* Brand New Feature: Interactive Active Subscription Card */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Subscription Info</h3>
          <a href="/owner/billing" className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 flex items-center justify-between hover:border-blue-400 dark:hover:border-blue-700 transition-all block">
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
            <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Manage</span>
              <ChevronRight size={16} />
            </div>
          </a>
        </div>

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

        {/* Account section — Settings row is the inline dropdown */}
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