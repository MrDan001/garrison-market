import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { User, Mail, ShieldCheck, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function StaffProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const staff = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      fullName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true
    }
  });

  if (!staff || staff.role.toLowerCase() !== "staff") redirect("/login");

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/staff/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 lg:mb-8 w-fit transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>

        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl">
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <User size={40} className="sm:hidden text-slate-500" />
              <User size={48} className="hidden sm:block text-slate-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white text-center break-words">{staff.fullName}</h1>
            <p className="text-slate-400 capitalize">{staff.role} Account</p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400">
                <Mail size={20} className="shrink-0" /> Email
              </div>
              <span className="text-white break-all sm:text-right">{staff.email}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400">
                <ShieldCheck size={20} className="shrink-0" /> Status
              </div>
              <span className="px-3 py-1 bg-emerald-950 text-emerald-400 rounded-lg text-sm font-bold capitalize shrink-0">
                {staff.status}
              </span>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400">
                <Clock size={20} className="shrink-0" /> Member Since
              </div>
              <span className="text-white shrink-0">
                {new Date(staff.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}