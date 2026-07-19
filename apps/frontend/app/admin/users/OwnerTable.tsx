"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerStatus, deleteUser } from "@/lib/auth.actions";

interface OwnerType {
  id: number;
  fullName: string | null;
  email: string;
  status: string;
  role: string;
}

export function OwnerTable({ initialOwners }: { initialOwners: OwnerType[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAction = (action: () => Promise<any>) => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await action();
        router.refresh(); // Invalidate Next.js Client Router Layout Memory Cache
      } catch (err) {
        console.error("Action execution failed:", err);
      }
    });
  };

  return (
    <div className={isPending ? "opacity-60 pointer-events-none transition-opacity" : "transition-opacity"}>
      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-4">
        {initialOwners.map((owner) => {
          const cleanStatus = owner.status.toLowerCase().trim();
          return (
            <div key={owner.id} className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">{owner.fullName || "No Name"}</h3>
                  <p className="text-[10px] text-slate-500">{owner.email}</p>
                </div>
                <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                  cleanStatus === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 
                  cleanStatus === 'declined' ? 'bg-red-900/30 text-red-400' : 
                  cleanStatus === 'suspended' ? 'bg-rose-900/30 text-rose-400' : 'bg-amber-900/30 text-amber-400'
                }`}>{cleanStatus}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <a href={`/admin/users/${owner.id}`} className="col-span-2 text-center py-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300">VIEW DETAILS</a>
                
                {cleanStatus === 'pending' && (
                  <>
                    <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="py-2 bg-emerald-600 rounded-lg text-[10px] font-bold text-white cursor-pointer">APPROVE</button>
                    <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'declined'))} className="py-2 bg-amber-700 rounded-lg text-[10px] font-bold text-white cursor-pointer">DECLINE</button>
                  </>
                )}
                {cleanStatus === 'approved' && (
                  <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'suspended'))} className="py-2 bg-rose-900/50 rounded-lg text-[10px] font-bold text-rose-200 cursor-pointer">SUSPEND</button>
                )}
                {cleanStatus === 'suspended' && (
                  <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="py-2 bg-blue-600 rounded-lg text-[10px] font-bold text-white cursor-pointer">REINSTATE</button>
                )}
                <button onClick={() => handleAction(() => deleteUser(owner.email))} className="py-2 bg-red-900/50 rounded-lg text-[10px] font-bold text-red-200 cursor-pointer">DELETE</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block overflow-x-auto bg-[var(--bg-app)] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--bg-surface)] text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <th className="p-4">Owner</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {initialOwners.map((owner) => {
              const cleanStatus = owner.status.toLowerCase().trim();
              return (
                <tr key={owner.id} className="hover:bg-slate-200/20 hover:dark:bg-slate-800/20">
                  <td className="p-4">
                    <div className="font-bold text-[var(--text-primary)]">{owner.fullName || "No Name"}</div>
                    <div className="text-[10px] text-slate-500">{owner.email}</div>
                  </td>
                  <td className="p-4">
                     <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                       cleanStatus === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 
                       cleanStatus === 'declined' ? 'bg-red-900/30 text-red-400' : 
                       cleanStatus === 'suspended' ? 'bg-rose-900/30 text-rose-400' : 'bg-amber-900/30 text-amber-400'
                     }`}>{cleanStatus}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <a href={`/admin/users/${owner.id}`} className="px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded text-[10px] text-slate-700 dark:text-slate-300 font-bold">VIEW</a>
                      {cleanStatus === 'pending' && (
                        <>
                          <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="px-3 py-1 bg-emerald-600 rounded text-[10px] text-white font-bold cursor-pointer">APPROVE</button>
                          <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'declined'))} className="px-3 py-1 bg-amber-700 rounded text-[10px] text-white font-bold cursor-pointer">DECLINE</button>
                        </>
                      )}
                      {cleanStatus === 'approved' && (
                        <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'suspended'))} className="px-3 py-1 bg-rose-900/50 rounded text-[10px] text-rose-200 font-bold cursor-pointer">SUSPEND</button>
                      )}
                      {cleanStatus === 'suspended' && (
                        <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="px-3 py-1 bg-blue-600 rounded text-[10px] text-white font-bold cursor-pointer">REINSTATE</button>
                      )}
                      <button onClick={() => handleAction(() => deleteUser(owner.email))} className="px-3 py-1 bg-red-900/50 rounded text-[10px] text-red-200 font-bold cursor-pointer">DELETE</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
