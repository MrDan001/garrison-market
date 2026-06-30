// apps/frontend/app/admin/layout.tsx
import { logoutAction } from "@/lib/auth.actions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0f1117] text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 p-6">
        <h2 className="mb-8 text-lg font-bold">Admin Panel</h2>
        <nav className="space-y-4">
          <a href="/admin/dashboard" className="block p-2 hover:bg-slate-800 rounded">Dashboard</a>
          <a href="/admin/users" className="block p-2 hover:bg-slate-800 rounded">Manage Users</a>
          <form action={logoutAction}>
            <button type="submit" className="text-red-400 p-2 hover:bg-red-950/30 rounded w-full text-left">
              Logout
            </button>
          </form>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}