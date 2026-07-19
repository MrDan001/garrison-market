"use client";
// app/owner/more/settings-dropdown.tsx

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Settings, ChevronDown, ChevronUp,
  Bell, Tag, Truck, CheckCircle2, Loader2, Lock, ChevronRight,
} from "lucide-react";
import {
  toggleDiscountAction,
  toggleNotificationsAction,
  toggleConsignmentAction,
} from "@/lib/settings.actions";
import { InstallAppCard, PushNotificationCard } from "@/components/SettingsExtras";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
  notificationsEnabled: boolean;
  discountEnabled: boolean;
  consignmentEnabled: boolean;
}

export default function SettingsDropdown({
  notificationsEnabled,
  discountEnabled,
  consignmentEnabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationsEnabled);
  const [discount, setDiscount] = useState(discountEnabled);
  const [consignment, setConsignment] = useState(consignmentEnabled);
  const [isPending, startTransition] = useTransition();
  const [lastChanged, setLastChanged] = useState<"notifications" | "discount" | "consignment" | null>(null);

  const handleToggleNotifications = () => {
    const newVal = !notifications;
    setNotifications(newVal);
    setLastChanged("notifications");
    startTransition(async () => {
      await toggleNotificationsAction(newVal);
      setLastChanged(null);
    });
  };

  const handleToggleDiscount = () => {
    const newVal = !discount;
    setDiscount(newVal);
    setLastChanged("discount");
    startTransition(async () => {
      await toggleDiscountAction(newVal);
      setLastChanged(null);
    });
  };

  const handleToggleConsignment = () => {
    const newVal = !consignment;
    setConsignment(newVal);
    setLastChanged("consignment");
    startTransition(async () => {
      await toggleConsignmentAction(newVal);
      setLastChanged(null);
    });
  };

  return (
    <div>
      {/* Settings Row — acts as toggle trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-200/30 hover:dark:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-medium">Settings</span>
        </div>
        {open ? (
          <ChevronUp size={18} className="text-slate-500 transition-transform" />
        ) : (
          <ChevronDown size={18} className="text-slate-500 transition-transform" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/40 px-4 py-4 space-y-4">

          {/* Section label */}
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Preferences
          </p>

          {/* Notifications toggle */}
          <ToggleRow
            icon={<Bell size={16} />}
            label="Notifications"
            description="Receive in-app alerts"
            value={notifications}
            loading={isPending && lastChanged === "notifications"}
            onToggle={handleToggleNotifications}
          />

          {/* Divider */}
          <div className="border-t border-slate-200/40 dark:border-slate-800/40" />

          {/* Section label */}
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Staff Permissions
          </p>

          {/* Discount toggle */}
          <ToggleRow
            icon={<Tag size={16} />}
            label="Allow Discounts"
            description="Staff can apply discounts at checkout"
            value={discount}
            loading={isPending && lastChanged === "discount"}
            onToggle={handleToggleDiscount}
            accent="emerald"
          />

          {discount && (
            <div className="flex items-center gap-2 text-emerald-500 text-xs font-medium bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={13} />
              Staff can now apply discounts on sales
            </div>
          )}

          {/* Consignment toggle */}
          <ToggleRow
            icon={<Truck size={16} />}
            label="Allow Consignment"
            description="Staff can sign out goods to third parties for resale"
            value={consignment}
            loading={isPending && lastChanged === "consignment"}
            onToggle={handleToggleConsignment}
            accent="violet"
          />

          {consignment && (
            <div className="flex items-center gap-2 text-violet-400 text-xs font-medium bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={13} />
              Staff can now sign out goods on consignment
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-200/40 dark:border-slate-800/40" />

          {/* Section label */}
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Security
          </p>

          <Link
            href="/change-password"
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/40 dark:bg-slate-950/40 hover:bg-slate-100 hover:dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                <Lock size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">Change Password</p>
                <p className="text-[11px] text-slate-500 leading-tight">Update your login password</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 dark:text-slate-600 shrink-0" />
          </Link>

          {/* Divider */}
          <div className="border-t border-slate-200/40 dark:border-slate-800/40" />

          {/* Section label */}
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
            Device
          </p>

          <ThemeToggle />
          <PushNotificationCard />
          <InstallAppCard />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  loading,
  onToggle,
  accent = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  loading: boolean;
  onToggle: () => void;
  accent?: "blue" | "emerald" | "violet";
}) {
  const onColor =
    accent === "emerald" ? "#059669" : accent === "violet" ? "#7c3aed" : "#2563eb";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">{label}</p>
          <p className="text-[11px] text-slate-500 leading-tight">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        aria-pressed={value}
        aria-label={`Toggle ${label}`}
        className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60"
        style={{ backgroundColor: value ? onColor : "#374151" }}
      >
        {loading ? (
          <Loader2
            size={12}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--text-primary)] animate-spin"
          />
        ) : (
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}
