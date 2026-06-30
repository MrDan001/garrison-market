import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Package, ClipboardList, LogOut, UserCircle, FileText, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/lib/auth.actions";

export default async function StaffDashboard() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: session.email },
    select: { fullName: true, role: true, status: true }
  });

  const userRole = staff?.role?.toLowerCase().trim();
  const userStatus = staff?.status?.toLowerCase().trim();

  if (!staff || userRole !== "staff") {
    redirect("/login");
  }

  if (userStatus === "suspended" || userStatus === "pending") {
    redirect("/pending/staff");
  }

  const navItems = [
    { title: "Inventory", desc: "Manage stock & checkout", href: "/staff/inventory", icon: Package, color: "text-blue-400" },
    { title: "Order History", desc: "View past sales", href: "/staff/orders", icon: History, color: "text-indigo-400" },
    { title: "Daily Report", desc: "Submit EOD summary", href: "/staff/report", icon: FileText, color: "text-amber-400" },
    { title: "My Profile", desc: "View account details", href: "/staff/profile", icon: UserCircle, color: "text-emerald-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0C10] p-4 sm:p-6 md:p-8">
      {/* Profile Header */}
      <header className="max-w-5xl mx-auto mb-6 md:mb-8 bg-gradient-to-r from-slate-900 to-slate-900/50 p-5 sm:p-6 md:p-8 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight">
            Welcome back, {staff.fullName}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-500 text-sm font-medium uppercase tracking-wider">{staff.status}</span>
          </div>
        </div>
        <div className="hidden md:block text-slate-600">
          <UserCircle size={48} strokeWidth={1.5} />
        </div>
      </header>

      {/* Navigation Grid */}
      <main className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {navItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group relative p-5 sm:p-6 rounded-3xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-800/50 active:scale-[0.98] transition-all duration-300 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 shrink-0 ${item.color}`}>
                <item.icon size={22} className="sm:hidden" />
                <item.icon size={24} className="hidden sm:block" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-white truncate">{item.title}</h2>
                <p className="text-sm text-slate-500 truncate">{item.desc}</p>
              </div>
            </div>
            <ChevronRight className="text-slate-700 group-hover:text-slate-400 transition-colors shrink-0" />
          </Link>
        ))}

        {/* Logout Button */}
        <form action={logoutAction} className="sm:col-span-2">
          <button
            type="submit"
            className="w-full flex items-center gap-4 p-5 sm:p-6 rounded-3xl border border-rose-900/20 bg-rose-950/5 hover:bg-rose-950/20 active:scale-[0.98] transition-all text-rose-400"
          >
            <LogOut size={22} className="shrink-0" />
            <div className="text-left">
              <h2 className="font-semibold">Logout</h2>
              <p className="text-sm text-rose-400/60">Sign out of your session</p>
            </div>
          </button>
        </form>
      </main>
    </div>
  );
}