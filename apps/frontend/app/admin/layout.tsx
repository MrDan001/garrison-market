"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, // <-- Added Support icon
  Mail,
  Bell, // <-- Broadcast icon
  LogOut, 
  Menu, 
  X, 
  ShieldAlert,
  Code2, // <-- Dev Assistant icon
  Handshake, // <-- Affiliates icon
  ListChecks, // <-- Waitlist icon
} from "lucide-react";
import { logoutAction } from "@/lib/auth.actions";
import NotificationBell from "@/components/NotificationBell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Added Support Tickets route pointing to /admin/support
  const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Manage Users", href: "/admin/users", icon: Users },
    { name: "Support Tickets", href: "/admin/support", icon: MessageSquare }, 
    { name: "Messages", href: "/admin/messages", icon: Mail },
    { name: "Broadcast", href: "/admin/broadcast", icon: Bell },
    { name: "Dev Assistant", href: "/admin/dev-assistant", icon: Code2 },
    { name: "Affiliates", href: "/admin/affiliates", icon: Handshake },
    { name: "Waitlist", href: "/admin/waitlist", icon: ListChecks },
  ];

  // Helper to determine active section name for the header
  const getHeaderLabel = (path: string) => {
    if (path === "/admin/dashboard") return "System Overview";
    if (path === "/admin/support") return "Support Desk";
    if (path === "/admin/users") return "Account Configurations";
    if (path === "/admin/messages/staff") return "Staff Messages";
    if (path === "/admin/messages") return "Owner Messages";
    if (path === "/admin/broadcast") return "Push Broadcast";
    if (path === "/admin/dev-assistant") return "Dev Assistant";
    if (path === "/admin/affiliates") return "Affiliate Program";
    return "Admin Console";
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      
      {/* --- SIDEBAR (Desktop) --- */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-100 dark:border-slate-900 bg-[var(--bg-app)]/40 backdrop-blur-md p-6">
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ShieldAlert size={16} className="text-blue-400" />
          </div>
          <h2 className="text-sm font-black tracking-wider text-[var(--text-primary)] uppercase">Garrison Market</h2>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/admin/messages" && pathname.startsWith("/admin/messages"));
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/10"
                    : "text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] hover:bg-slate-100/50 hover:dark:bg-slate-900/50 border border-transparent"
                }`}
              >
                <Icon size={16} />
                {item.name}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 dark:border-slate-900 pt-4">
          <form action={logoutAction}>
            <button 
              type="submit" 
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all border border-transparent"
            >
              <LogOut size={16} />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* --- SIDEBAR (Mobile Drawer Overlay) --- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          
          <aside className="relative flex w-64 flex-col bg-[var(--bg-app)] p-6 border-r border-slate-100 dark:border-slate-900 h-full">
            <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ShieldAlert size={16} className="text-blue-400" />
                </div>
                <h2 className="text-sm font-black tracking-wider text-[var(--text-primary)] uppercase">Garrison</h2>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-1.5">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href === "/admin/messages" && pathname.startsWith("/admin/messages"));
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/10"
                        : "text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] hover:bg-slate-100/50 hover:dark:bg-slate-900/50"
                    }`}
                  >
                    <Icon size={16} />
                    {item.name}
                  </a>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 dark:border-slate-900 pt-4">
              <form action={logoutAction}>
                <button 
                  type="submit" 
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* --- MAIN CONTENT CONTAINER --- */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        
        {/* Universal Header */}
        <header className="h-16 border-b border-slate-100/80 dark:border-slate-900/80 px-6 sm:px-8 flex items-center justify-between bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-30">
          <button 
            onClick={() => setMobileOpen(true)} 
            className="md:hidden h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-[var(--text-primary)]"
          >
            <Menu size={16} />
          </button>
          
          <div className="hidden md:block text-xs font-bold text-slate-500 uppercase tracking-widest">
            {getHeaderLabel(pathname)}
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {/* Unified Notification Bell */}
            <NotificationBell notificationsEnabled={true} userRole="admin" />
            
            {/* Admin Profile Miniature */}
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center text-xs font-bold text-blue-400">
              AD
            </div>
          </div>
        </header>

        {/* Dynamic Page Children */}
        <main className="flex-1">
          {children}
        </main>
      </div>

    </div>
  );
}