"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerStatus, deleteUser, extendSubscriptionAction } from "@/lib/auth.actions";
import { CalendarPlus } from "lucide-react";

// Added productsSold to the TypeScript interface
interface OwnerActionsProps {
  email: string;
  status: string;
  productsSold?: string | null;
  ownerId?: number;
}

export function OwnerActions({ email, status, productsSold, ownerId }: OwnerActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState("7");
  const [extendMsg, setExtendMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleAction = (action: () => Promise<any>, navigateAfter?: string) => {
    startTransition(async () => {
      await action();
      if (navigateAfter) router.push(navigateAfter);
      else router.refresh();
    });
  };

  const handleExtend = () => {
    if (!ownerId) return;
    const n = parseInt(days, 10);
    if (!n || n <= 0) {
      setExtendMsg("Enter a valid number of days.");
      return;
    }
    startTransition(async () => {
      const result = await extendSubscriptionAction(ownerId, n);
      setExtendMsg(result.success ? `Added ${n} day(s).` : result.error || "Failed to extend.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <button
            disabled={isPending}
            onClick={() => handleAction(() => updateOwnerStatus(email, "approved"))}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={() => handleAction(() => updateOwnerStatus(email, "declined"))}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Decline
          </button>
        </>
      )}
      {status === "approved" && (
        <button
          disabled={isPending}
          onClick={() => handleAction(() => updateOwnerStatus(email, "suspended"))}
          className="px-4 py-2 bg-rose-900/50 hover:bg-rose-900/70 disabled:opacity-50 rounded-lg text-xs font-bold text-rose-200 transition-colors"
        >
          Suspend
        </button>
      )}
      {status === "suspended" && (
        <button
          disabled={isPending}
          onClick={() => handleAction(() => updateOwnerStatus(email, "approved"))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
        >
          Reinstate
        </button>
      )}
      {ownerId && (
        <div className="flex items-center gap-2 w-full mt-1 pt-3 border-t border-slate-800">
          <CalendarPlus size={14} className="text-slate-500 shrink-0" />
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          />
          <button
            disabled={isPending}
            onClick={handleExtend}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white transition-colors"
          >
            Add Days (Manual)
          </button>
          {extendMsg && <span className="text-[11px] text-slate-400">{extendMsg}</span>}
        </div>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (window.confirm("Permanently delete this owner account? This can't be undone.")) {
            handleAction(() => deleteUser(email), "/admin/users");
          }
        }}
        className="px-4 py-2 bg-red-900/50 hover:bg-red-900/70 disabled:opacity-50 rounded-lg text-xs font-bold text-red-200 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}