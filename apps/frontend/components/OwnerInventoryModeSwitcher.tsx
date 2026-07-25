// FILE: apps/frontend/components/OwnerInventoryModeSwitcher.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Scale as ScaleIcon, Users } from "lucide-react";
import InventoryGrid from "@/components/InventoryGrid";
import OwnerScaleInventoryGrid from "@/components/OwnerScaleInventoryGrid";
import OwnerScaleConsignmentPanel from "@/components/OwnerScaleConsignmentPanel";

// Stage 2: now three tabs instead of two.
// - List: unchanged, existing InventoryGrid.
// - Scale: product management only (add/edit/delete scale items), shown
//   as a card grid — OwnerScaleInventoryGrid. No sign-out flow here.
// - Consignment: the daily sign-out-to-staff workflow, OwnerScaleConsignmentPanel.
//   The owner can only pick from items already added on the Scale tab —
//   there's no "add new item" capability on this tab.
export default function OwnerInventoryModeSwitcher({
  listItems,
  scaleItems,
  staff,
  staffStock,
}: {
  listItems: any[];
  scaleItems: any[];
  staff: any[];
  staffStock: any[];
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [mode, setMode] = useState<"list" | "scale" | "consignment">(
    initialTab === "scale" || initialTab === "consignment" ? initialTab : "list"
  );

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <div className="sticky top-0 z-30 bg-[var(--bg-app)]/90 backdrop-blur-xl px-4 pt-3 pb-2 flex gap-2 border-b border-slate-200/50 dark:border-slate-800/50">
        <button
          onClick={() => setMode("list")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            mode === "list" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
          }`}
        >
          <List size={13} /> List
        </button>
        <button
          onClick={() => setMode("scale")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            mode === "scale" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
          }`}
        >
          <ScaleIcon size={13} /> Scale
        </button>
        <button
          onClick={() => setMode("consignment")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            mode === "consignment" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
          }`}
        >
          <Users size={13} /> Consignment
        </button>
      </div>

      {mode === "list" && <InventoryGrid items={listItems} />}

      {mode === "scale" && <OwnerScaleInventoryGrid items={scaleItems} />}

      {mode === "consignment" && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 pt-4">
          <Link
            href="/owner/dashboard"
            className="inline-flex items-center text-[10px] text-slate-500 hover:text-[var(--text-primary)] transition-colors mb-3"
          >
            ← Back to Dashboard
          </Link>
          <OwnerScaleConsignmentPanel items={scaleItems} staff={staff} staffStock={staffStock} />
        </div>
      )}
    </div>
  );
}