"use client";

import { useTransition } from "react";
import { updateOwnerStatus, deleteUser } from "@/lib/auth.actions";

export function OwnerTable({ initialOwners }: { initialOwners: any[] }) {
  const [isPending, startTransition] = useTransition();

  const handleAction = (action: () => Promise<any>) => {
    startTransition(async () => {
      await action();
    });
  };

  return (
    <>
      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-4">
        {initialOwners.map((owner) => (
          <div key={owner.id} className="bg-[#161821] p-4 rounded-2xl border border-slate-800 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-white">{owner.fullName || "No Name"}</h3>
                <p className="text-[10px] text-slate-500">{owner.email}</p>
              </div>
              <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                owner.status === 'approved' ? 'bg-emerald-900/30 text-emerald-400' : 
                owner.status === 'declined' ? 'bg-red-900/30 text-red-400' : 
                owner.status === 'suspended' ? 'bg-rose-900/30 text-rose-400' : 'bg-amber-900/30 text-amber-400'
              }`}>{owner.status}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <a href={`/admin/users/${owner.id}`} className="col-span-2 text-center py-2 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-300">VIEW DETAILS</a>
              
              {owner.status === 'pending' && (
                <>
                  <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="py-2 bg-emerald-600 rounded-lg text-[10px] font-bold text-white">APPROVE</button>
                  <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'declined'))} className="py-2 bg-amber-700 rounded-lg text-[10px] font-bold text-white">DECLINE</button>
                </>
              )}
              {owner.status === 'approved' && (
                <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'suspended'))} className="py-2 bg-rose-900/50 rounded-lg text-[10px] font-bold text-rose-200">SUSPEND</button>
              )}
              {owner.status === 'suspended' && (
                <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="py-2 bg-blue-600 rounded-lg text-[10px] font-bold text-white">REINSTATE</button>
              )}
              <button onClick={() => handleAction(() => deleteUser(owner.email))} className="py-2 bg-red-900/50 rounded-lg text-[10px] font-bold text-red-200">DELETE</button>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block overflow-x-auto bg-[#0f1117] rounded-3xl border border-slate-800 shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#161821] text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <th className="p-4">Owner</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {initialOwners.map((owner) => (
              <tr key={owner.id} className="hover:bg-slate-800/20">
                <td className="p-4">
                  <div className="font-bold text-white">{owner.fullName}</div>
                  <div className="text-[10px] text-slate-500">{owner.email}</div>
                </td>
                <td className="p-4">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase`}>{owner.status}</span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <a href={`/admin/users/${owner.id}`} className="px-3 py-1 bg-slate-800 rounded text-[10px] text-slate-300 font-bold">VIEW</a>
                    {owner.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="px-3 py-1 bg-emerald-600 rounded text-[10px] text-white font-bold">APPROVE</button>
                        <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'declined'))} className="px-3 py-1 bg-amber-700 rounded text-[10px] text-white font-bold">DECLINE</button>
                      </>
                    )}
                    {owner.status === 'approved' && (
                      <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'suspended'))} className="px-3 py-1 bg-rose-900/50 rounded text-[10px] text-rose-200 font-bold">SUSPEND</button>
                    )}
                    {owner.status === 'suspended' && (
                      <button onClick={() => handleAction(() => updateOwnerStatus(owner.email, 'approved'))} className="px-3 py-1 bg-blue-600 rounded text-[10px] text-white font-bold">REINSTATE</button>
                    )}
                    <button onClick={() => handleAction(() => deleteUser(owner.email))} className="px-3 py-1 bg-red-900/50 rounded text-[10px] text-red-200 font-bold">DELETE</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}