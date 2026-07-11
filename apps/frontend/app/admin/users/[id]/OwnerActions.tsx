"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerStatus, deleteUser } from "@/lib/auth.actions";

export function OwnerActions({ email, status }: { email: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAction = (action: () => Promise<any>, navigateAfter?: string) => {
    startTransition(async () => {
      await action();
      if (navigateAfter) router.push(navigateAfter);
      else router.refresh();
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
