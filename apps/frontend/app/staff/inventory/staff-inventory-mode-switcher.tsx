// FILE: apps/frontend/app/staff/inventory/staff-inventory-mode-switcher.tsx

"use client";

import { useState } from "react";
import { List, Scale as ScaleIcon } from "lucide-react";
import InventoryClient from "./inventory-client";
import StaffScaleLiveSell from "./staff-scale-live-sell";

// Only rendered for standard stores where the owner's admin-controlled
// scaleConsignmentEnabled override is on. List mode is the existing,
// completely unchanged staff inventory experience — Scale mode shows
// whatever the owner has signed out to this staff member today via
// consignment (see OwnerScaleOverridePanel / ownerSignOutScaleToStaffAction).
export default function StaffInventoryModeSwitcher({
  listItems,
  discountEnabled,
  scaleOpenConsignments,
  scaleHistory,
}: {
  listItems: any[];
  discountEnabled: boolean;
  scaleOpenConsignments: any[];
  scaleHistory: any[];
}) {
  const [mode, setMode] = useState<"list" | "scale">("list");

  return (
    <div>
      <div className="sticky top-0 z-30 bg-[var(--bg-app)]/90 backdrop-blur-xl px-4 pt-3 flex gap-2">
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
          {scaleOpenConsignments.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px]">
              {scaleOpenConsignments.length}
            </span>
          )}
        </button>
      </div>

      {mode === "list" ? (
        <InventoryClient initialItems={listItems} discountEnabled={discountEnabled} />
      ) : (
        <StaffScaleLiveSell openConsignments={scaleOpenConsignments} history={scaleHistory} />
      )}
    </div>
  );
}