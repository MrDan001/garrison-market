import React from "react";
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  ShieldCheck,
  Building2,
  Gem,
  Activity,
  Zap,
  Sparkles,
  Ticket
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuperAdminGodModeDashboard() {
  // 1. Enforce strict Admin-level system authorization boundary
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    redirect("/login");
  }

  // 2. High-performance multi-tenant aggregation data pipeline
  const [
    revenueAgg,
    tenantMetrics,
    lowStockCount,
    staffCount,
    unverifiedOwnersCount,
    masterTenantLedger
  ] = await Promise.all([
    // Aggregate Platform Gross Volume & average ticket metrics
    prisma.order.aggregate({
      _sum: { total: true },
      _avg: { total: true },
      _count: { id: true }
    }),
    // Split count of active, verified business entities
    prisma.user.groupBy({
      by: ["status"],
      where: { role: "owner" },
      _count: { id: true }
    }),
    // Count system-wide inventory exceptions matching low replenishment benchmarks
    prisma.inventory.count({
      where: {
        restockLevel: { not: null },
        quantity: { lte: prisma.inventory.fields.restockLevel }
      }
    }),
    // Extract cluster scale of operating staff globally
    prisma.user.count({ where: { role: "staff" } }),
    // Flag unverified accounts that require security clearance
    prisma.user.count({ where: { role: "owner", status: "pending" } }),
    // Deep telemetry fetch across the top operating tenants with relational calculations
    prisma.user.findMany({
      where: { role: "owner" },
      take: 5,
      orderBy: { id: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        referralCode: true, 
        createdAt: true,
        _count: {
          select: {
            stores: true,
            inventory: true,
          }
        }
      }
    })
  ]);

  // 3. Compute High-Level Platform Intelligence Metrics Safely
  const grossPlatformVolume = Number(revenueAgg._sum.total ?? 0);
  const totalOrdersCount = revenueAgg._count.id;
  const averageTicketValue = Number(revenueAgg._avg.total ?? 0);

  const totalOwners = tenantMetrics.reduce((acc, curr) => acc + curr._count.id, 0);
  const approvedOwners = tenantMetrics.find(m => m.status?.toLowerCase() === "approved")?._count.id ?? 0;
  
  // Calculate synthetic premium conversion index based on platform validation metrics
  const premiumConversionRate = totalOwners > 0 ? ((approvedOwners / totalOwners) * 100).toFixed(1) : "0.0";

  const stats = [
    {
      name: "Gross Platform Volume",
      value: `₦${grossPlatformVolume.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`,
      meta: `Avg. Ticket: ₦${averageTicketValue.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      name: "Tenant Ecosystem Footprint",
      value: totalOwners.toLocaleString(),
      meta: `${staffCount} active terminals linked`,
      icon: Users,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      name: "Platform Conversion Index",
      value: `${premiumConversionRate}%`,
      meta: `${approvedOwners} premium operations verified`,
      icon: Gem,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      name: "System Stock Stress Level",
      value: lowStockCount.toString(),
      meta: "Global inventory exceptions triggered",
      icon: AlertTriangle,
      color: lowStockCount > 10 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-900 dark:text-slate-100 p-6 sm:p-8 space-y-8 selection:bg-blue-500/30">
      
      {/* GODMODE Command Header */}
      <div className="relative p-6 rounded-3xl overflow-hidden border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/40 to-indigo-950/30 backdrop-blur-md">
        <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
          <Sparkles size={140} className="text-blue-400 animate-pulse" />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <Zap size={10} className="animate-bounce" /> Root Authorization: Active
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl flex items-center gap-2">
              <ShieldCheck className="text-blue-500 h-8 w-8" /> Control Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Cross-cluster platform analytical dashboard monitoring transactional velocities, multi-tenant operations infrastructure, and global system health telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Global Engine State</p>
              <p className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 justify-end">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" /> Nominal Ops
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Infrastructure Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div 
              key={i} 
              className={`p-5 rounded-2xl bg-slate-100/40 dark:bg-slate-900/40 border flex flex-col justify-between hover:scale-[1.01] transition-all duration-200 ${stat.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{stat.name}</span>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-950/20 dark:bg-white/5">
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{stat.value}</span>
                <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400 font-medium">
                  {stat.meta}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Analytical Core */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Data Core: Multi-Tenant Telemetry Ledger */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Enterprise Tenant Telemetry Ledger</h3>
                  <p className="text-[11px] text-slate-500">Live profiling of registered store operators, custom referral codes, and cluster footprints.</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3">Tenant Profile</th>
                    <th className="pb-3">Referral Token</th>
                    <th className="pb-3 text-center">Outlets Linked</th>
                    <th className="pb-3 text-center">Catalog SKUs</th>
                    <th className="pb-3 text-right">Cluster State</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-200/40 dark:divide-slate-800/20">
                  {masterTenantLedger.map((owner) => (
                    <tr key={owner.id} className="group hover:bg-blue-500/5 transition-colors">
                      <td className="py-3.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-400 transition-colors">
                          {owner.fullName || "Anonymous Operator"}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 italic">
                          {owner.email}
                        </p>
                      </td>
                      {/* Truncated Upper Case Store-Name Referral Token Column Mapping */}
                      <td className="py-3.5 font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        <div 
                          className="inline-flex items-center gap-1 bg-slate-200 dark:bg-slate-800/80 px-2 py-0.5 rounded font-black tracking-wider text-[10px] border border-slate-300 dark:border-slate-700 max-w-[160px] truncate"
                          title={owner.referralCode || "NONE"}
                        >
                          <Ticket size={10} className="text-indigo-400 shrink-0" />
                          <span className="truncate">
                            {owner.referralCode 
                              ? (owner.referralCode.length > 16 
                                  ? `${owner.referralCode.substring(0, 12)}...` 
                                  : owner.referralCode)
                              : "NONE"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {owner._count.stores}
                        </span>
                      </td>
                      <td className="py-3.5 text-center font-mono font-medium text-slate-600 dark:text-slate-400">
                        {owner._count.inventory.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          owner.status?.toLowerCase() === "approved" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : owner.status?.toLowerCase() === "pending" 
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {owner.status || "UNKNOWN"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Data Core: Platform Risk & Health Stream */}
        <div className="p-6 rounded-2xl bg-slate-100/40 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Activity size={18} className="text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">System Risk Mitigations</h3>
                <p className="text-[11px] text-slate-500">Live automated integrity checks flag operational exceptions.</p>
              </div>
            </div>
            
            <div className="space-y-3.5">
              {[
                { 
                  title: "Tenant Validation Check", 
                  desc: "Unverified organizational profiles pending manual authorization clearance loops.",
                  metric: `${unverifiedOwnersCount} Security Tasks`,
                  status: unverifiedOwnersCount > 0 ? "warning" : "nominal"
                },
                { 
                  title: "Platform Transaction Depth", 
                  desc: "Total absolute data points stored for computational platform-wide orders execution.",
                  metric: `${totalOrdersCount.toLocaleString()} Orders Monitored`,
                  status: "nominal"
                },
                { 
                  title: "Replenishment Run Rate", 
                  desc: "Platform warehouses showing volatile threshold limits below active safety counts.",
                  metric: `${lowStockCount} SKUs Vulnerable`,
                  status: lowStockCount > 20 ? "critical" : "nominal"
                },
              ].map((item, i) => (
                <div 
                  key={i}
                  className={`p-4 rounded-xl border transition-all ${
                    item.status === "critical" 
                      ? "bg-rose-500/5 border-rose-500/20" 
                      : item.status === "warning" 
                      ? "bg-amber-500/5 border-amber-500/20" 
                      : "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{item.title}</p>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      item.status === "critical" ? "bg-rose-400 animate-ping" : item.status === "warning" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                    }`} />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{item.desc}</p>
                  <p className="text-[10px] font-mono font-black tracking-wider uppercase text-blue-400 dark:text-blue-400 mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                    {item.metric}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}