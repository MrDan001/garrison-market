// --- ADD THIS LINE AT THE VERY TOP OF THE FILE ---
export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth.actions";
import Link from "next/link";

export default async function StaffPendingPage() {
  const session = await getSessionUser() as { email: string; status: string; role: string } | null;  
  
  if (!session) redirect("/login");

  // If the owner reinstated them, this live query catches it instantly and pushes them through
  if (session.status?.toUpperCase() === "ACTIVE") {
    redirect("/staff/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        
        {/* Top Icon Circle Accent */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8 border bg-rose-950/20 border-rose-900/30 text-rose-500">
          <span className="text-3xl font-light">!</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold text-white tracking-tight mb-4">
          Account Suspended
        </h1>
        
        {/* Main Content Description */}
        <div className="text-slate-400 text-sm max-w-xs leading-relaxed mb-8">
          Your access has been restricted. Please contact support at 
          <a href="mailto:support@garrison.com" className="text-rose-500 hover:underline font-semibold ml-1">
            support@garrison.com
          </a>{" "}
          to resolve this matter.
        </div>

        {/* Status Badge Pill */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold tracking-wider uppercase mb-12 bg-rose-950/40 border-rose-900/30 text-rose-400">
          <span className="text-[10px] opacity-50 text-white tracking-widest font-medium">STATUS</span>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
          <span>SUSPENDED</span>
        </div>

        {/* Action Controls */}
        <div className="w-full space-y-3 px-4">
          <Link 
            href="/pending/staff"
            className="w-full flex items-center justify-center py-3.5 px-6 rounded-xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800/60 text-white font-medium text-sm transition-all"
          >
            Check Status
          </Link>

          <form action={logoutAction} className="w-full">
            <button 
              type="submit" 
              className="w-full py-2 px-6 text-slate-500 hover:text-slate-400 text-sm font-medium transition-colors"
            >
              Back to Login
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}