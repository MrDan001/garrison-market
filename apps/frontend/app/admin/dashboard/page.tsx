"use client";

import React from "react";
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  Truck, 
  ClipboardList 
} from "lucide-react";

// Mock data for display purposes
const stats = [
  {
    name: "Total Revenue",
    value: "₦4,850,000",
    change: "+12.5%",
    changeType: "positive",
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10",
  },
  {
    name: "Active Consignments",
    value: "42",
    change: "+4 today",
    changeType: "positive",
    icon: Truck,
    color: "text-indigo-400 bg-indigo-500/10",
  },
  {
    name: "Low Stock Items",
    value: "8",
    change: "Requires action",
    changeType: "negative",
    icon: AlertTriangle,
    color: "text-amber-400 bg-amber-500/10",
  },
  {
    name: "Active Staff",
    value: "14",
    change: "3 on duty",
    changeType: "neutral",
    icon: Users,
    color: "text-blue-400 bg-blue-500/10",
  },
];

const recentConsignments = [
  { id: "CS-9082", supplier: "Alhaji Musa Ltd", items: 120, status: "Pending", date: "Today, 02:40 PM" },
  { id: "CS-9081", supplier: "Shedrack & Sons", items: 45, status: "Received", date: "Today, 11:15 AM" },
  { id: "CS-9080", supplier: "Garrison Farms", items: 300, status: "Processing", date: "Yesterday" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Welcome back. Here is what is happening at Garrison Market today.
          </p>
        </div>
        <div className="flex gap-2.5 mt-4 sm:mt-0">
          <button className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all">
            Export Report
          </button>
          <button className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20">
            Create Consignment
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div 
              key={i} 
              className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700/80 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{stat.name}</span>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-black text-white">{stat.value}</span>
                <p className={`text-[11px] mt-1 font-semibold ${
                  stat.changeType === "positive" ? "text-emerald-400" : 
                  stat.changeType === "negative" ? "text-rose-400 animate-pulse" : "text-slate-400"
                }`}>
                  {stat.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Table List */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Incoming Consignments</h3>
              </div>
              <button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors">
                View All <ArrowUpRight size={12} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3">ID</th>
                    <th className="pb-3">Supplier</th>
                    <th className="pb-3">Qty</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-800/40">
                  {recentConsignments.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-800/10">
                      <td className="py-3.5 font-mono text-slate-300 font-bold">{item.id}</td>
                      <td className="py-3.5 text-slate-200">{item.supplier}</td>
                      <td className="py-3.5 text-slate-400">{item.items} units</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === "Received" ? "bg-emerald-500/10 text-emerald-400" :
                          item.status === "Processing" ? "bg-blue-500/10 text-blue-400" :
                          "bg-amber-500/10 text-amber-400"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-500 text-right">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Activities or Notifications list */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <div className="flex items-center gap-2 mb-5">
            <Package size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white">System Actions Checklist</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { label: "Approve Musa Ltd consignment invoices", done: false },
              { label: "Update safety stock threshold configurations", done: true },
              { label: "Verify newly registered staff profiles", done: false },
              { label: "Generate weekly warehouse audit reports", done: false },
            ].map((task, i) => (
              <label 
                key={i} 
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  task.done 
                    ? "bg-slate-900/20 border-slate-900 line-through text-slate-600" 
                    : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 text-slate-300"
                }`}
              >
                <input 
                  type="checkbox" 
                  defaultChecked={task.done} 
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-slate-950" 
                />
                <span className="text-xs leading-normal">{task.label}</span>
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}