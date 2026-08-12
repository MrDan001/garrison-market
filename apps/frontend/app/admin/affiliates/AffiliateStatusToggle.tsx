// FILE: apps/frontend/app/admin/affiliates/AffiliateStatusToggle.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAffiliateStatusAction } from "@/lib/affiliate.actions";

export default function AffiliateStatusToggle({ affiliateId, status }: { affiliateId: number; status: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setLoading(true);
    const next = status === "suspended" ? "active" : "suspended";
    await updateAffiliateStatusAction(affiliateId, next);
    setLoading(false);
    router.refresh();
  }

  const isSuspended = status === "suspended";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit transition disabled:opacity-50 ${
        isSuspended ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
      }`}
      title={isSuspended ? "Click to reactivate" : "Click to suspend"}
    >
      {loading ? "..." : isSuspended ? "Suspended" : "Active"}
    </button>
  );
}