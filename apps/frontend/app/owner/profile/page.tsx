// app/owner/more/page.tsx
import {
  ChevronRight, Store, LayoutDashboard,
  Activity, CreditCard, Users, Receipt,
  Settings, LogOut, ArrowLeft, History,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { logoutAction } from "@/lib/auth.actions";
import SettingsDropdown from "./settings-dropdown";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
      notificationsEnabled: true,
      discountEnabled: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="fixed inset-0 bg-[#0a0c12] text-slate-200 flex flex-col pb-20">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-slate-800">
        <a
          href="/owner/dashboard"
          className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-lg font-bold">More</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {/* Profile Card */}
        <a
          href="/owner/profile/edit"
          className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center gap-4 hover:border-slate-600 transition-all block"
        >
          <div className="flex items-center gap-4 w-full">
            <div className="h-14 w-14 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold overflow-hidden border border-slate-700 shrink-0">
              {user.image ? (
                <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user.fullName?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white truncate">{user.fullName}</h2>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <ChevronRight size={20} className="text-slate-600 shrink-0" />
          </div>
        </a>

        {/* Business section */}
        <MenuSection
          title="Business"
          items={[
            { label: "Customers",  icon: Users,          href: "/owner/customers" },
            { label: "Invoices",   icon: Receipt,        href: "/owner/invoices" },
            { label: "Expenses",   icon: CreditCard,     href: "/owner/expenses" },
            { label: "Reports",    icon: Activity,       href: "/owner/report" },
            { label: "History",    icon: History,        href: "/owner/history" },
          ]}
        />

        {/* Account section — Settings row is the inline dropdown */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Account</h3>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl divide-y divide-slate-800">
            <a href="/owner/stores" className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <Store size={18} className="text-slate-400" />
                <span className="text-sm font-medium">My Stores</span>
              </div>
              <ChevronRight size={18} className="text-slate-600" />
            </a>
            <a href="/owner/staff" className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} className="text-slate-400" />
                <span className="text-sm font-medium">Staff</span>
              </div>
              <ChevronRight size={18} className="text-slate-600" />
            </a>

            {/* ── Inline Settings Dropdown ── */}
            <SettingsDropdown
              notificationsEnabled={user.notificationsEnabled}
              discountEnabled={user.discountEnabled}
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl divide-y divide-slate-800">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className="text-slate-400" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <ChevronRight size={18} className="text-slate-600" />
          </a>
        ))}
      </div>
    </div>
  );
}
