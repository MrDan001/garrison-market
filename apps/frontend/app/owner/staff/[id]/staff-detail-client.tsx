"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Calendar, Store, UserX, Trash2,
  ShieldCheck, TrendingUp, ChevronDown, Check,
} from "lucide-react";
import { toggleStaffStatus, deleteStaff } from "@/lib/auth.actions";
import { updateStaffStoreAction } from "@/lib/store.actions";

interface Staff {
  id: number;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  status: string;
  createdAt: string;
  image: string | null;
  staffStoreId: number | null;
}

export default function StaffDetailClient({
  staff,
  stores,
  currentStoreName,
  monthSales,
  monthOrders,
}: {
  staff: Staff;
  stores: { id: number; name: string }[];
  currentStoreName: string | null;
  monthSales: number;
  monthOrders: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStore, setSelectedStore] = useState(staff.staffStoreId ?? "");
  const [storeUpdated, setStoreUpdated] = useState(false);

  const isActive = staff.status.toLowerCase() === "active";

  const handleToggleStatus = () => {
    startTransition(async () => {
      await toggleStaffStatus(staff.id, staff.status);
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Permanently remove ${staff.fullName || "this staff member"}? This can't be undone.`)) return;
    startTransition(async () => {
      await deleteStaff(staff.id);
      router.push("/owner/staff");
    });
  };

  const handleStoreChange = (storeId: number) => {
    setSelectedStore(storeId);
    startTransition(async () => {
      try {
        await updateStaffStoreAction(staff.id, storeId);
        setStoreUpdated(true);
        setTimeout(() => setStoreUpdated(false), 2000);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Failed to update store assignment.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/owner/staff" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] w-fit transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Staff
        </Link>

        {/* Header card */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-[var(--text-primary)] overflow-hidden border-2 border-slate-300 dark:border-slate-700 shrink-0">
            {staff.image ? (
              <img src={staff.image} alt={staff.fullName || "Staff"} className="h-full w-full object-cover" />
            ) : (
              staff.fullName?.charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-primary)] truncate">{staff.fullName || "Unnamed Staff"}</h1>
            <p className="text-sm text-slate-500 truncate">{staff.email}</p>
            <span
              className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isActive
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50"
                  : "bg-rose-950/60 text-rose-400 border border-rose-900/50"
              }`}
            >
              {staff.status}
            </span>
          </div>
        </div>

        {/* This month stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp size={13} className="text-emerald-400" />
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Sales This Month</p>
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">₦{monthSales.toLocaleString()}</p>
          </div>
          <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={13} className="text-blue-400" />
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Orders This Month</p>
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">{monthOrders}</p>
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact</h2>
          <div className="flex items-center gap-3 text-sm">
            <Mail size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">{staff.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">{staff.phoneNumber || "Not provided"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar size={15} className="text-slate-400 dark:text-slate-600 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">Joined {new Date(staff.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>

        {/* Store assignment */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Store size={14} className="text-blue-400" />
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Store Assignment</h2>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            {currentStoreName ? (
              <>Currently assigned to <span className="text-blue-400 font-semibold">{currentStoreName}</span></>
            ) : (
              <span className="text-amber-400">Not assigned to any store yet — this staff member won't see any inventory until assigned.</span>
            )}
          </p>
          <div className="relative">
            <select
              value={selectedStore}
              onChange={(e) => handleStoreChange(Number(e.target.value))}
              disabled={isPending}
              className="w-full appearance-none bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-9 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
            >
              <option value="" disabled>Select a store...</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          {storeUpdated && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check size={13} /> Store assignment updated
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Actions</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleToggleStatus}
              disabled={isPending}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-amber-900/30 text-amber-400 hover:bg-amber-900/50"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
            >
              <UserX size={15} />
              {isActive ? "Suspend Staff" : "Reinstate Staff"}
            </button>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-900/30 text-red-300 hover:bg-red-900/50 text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Trash2 size={15} />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}