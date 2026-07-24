"use client";
// app/owner/more/settings-dropdown.tsx

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Settings, ChevronDown, ChevronUp,
  Bell, Tag, Truck, CheckCircle2, Loader2, Lock, ChevronRight, ShieldOff, Scale, Smartphone, Moon,
} from "lucide-react";
import {
  toggleDiscountAction,
  toggleNotificationsAction,
  toggleConsignmentAction,
  toggleWastageVisibilityAction,
} from "@/lib/settings.actions";
import { updateScreenshotProtectionPreference } from "@/lib/profile.actions";
import { InstallAppCard, PushNotificationCard } from "@/components/SettingsExtras";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
  notificationsEnabled: boolean;
  discountEnabled: boolean;
  consignmentEnabled: boolean;
  screenshotProtectionEnabled: boolean;
  wastageVisibleToStaff: boolean;
}

export default function SettingsDropdown({
  notificationsEnabled,
  discountEnabled,
  consignmentEnabled,
  screenshotProtectionEnabled,
  wastageVisibleToStaff,
}: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationsEnabled);
  const [discount, setDiscount] = useState(discountEnabled);
  const [consignment, setConsignment] = useState(consignmentEnabled);
  const [screenshotProtection, setScreenshotProtection] = useState(screenshotProtectionEnabled);
  const [wastageVisible, setWastageVisible] = useState(wastageVisibleToStaff);
  const [isPending, startTransition] = useTransition();
  const [lastChanged, setLastChanged] = useState<
    "notifications" | "discount" | "consignment" | "screenshotProtection" | "wastageVisible" | null
  >(null);

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

  const handleToggleScreenshotProtection = () => {
    const newVal = !screenshotProtection;
    setScreenshotProtection(newVal);
    setLastChanged("screenshotProtection");
    startTransition(async () => {
      await updateScreenshotProtectionPreference(newVal);
      setLastChanged(null);
    });
  };

  const handleToggleWastageVisible = () => {
    const newVal = !wastageVisible;
    setWastageVisible(newVal);
    setLastChanged("wastageVisible");
    startTransition(async () => {
      await toggleWastageVisibilityAction(newVal);
      setLastChanged(null);
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] overflow-hidden shadow-sm transition-all">
      {/* Settings Row — Trigger Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">System Settings</h2>
            <p className="text-xs text-slate-500">Manage preferences, staff permissions & security</p>
          </div>
        </div>
        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-500 transition-transform">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* GROUP 1: General Preferences */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              General Preferences
            </p>
            <div className="bg-[var(--bg-surface)] border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-4 shadow-xs">
              <ToggleRow
                icon={<Bell size={16} />}
                label="App Notifications"
                description="Receive instant in-app alerts and updates"
                value={notifications}
                loading={isPending && lastChanged === "notifications"}
                onToggle={handleToggleNotifications}
                accent="blue"
              />
            </div>
          </div>

          {/* GROUP 2: Staff Permissions */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              Staff Permissions
            </p>
            <div className="bg-[var(--bg-surface)] border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-4 space-y-4 shadow-xs">
              <div>
                <ToggleRow
                  icon={<Tag size={16} />}
                  label="Allow Discounts"
                  description="Staff can apply price reductions at checkout"
                  value={discount}
                  loading={isPending && lastChanged === "discount"}
                  onToggle={handleToggleDiscount}
                  accent="emerald"
                />
                {discount && (
                  <div className="mt-2.5 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                    <CheckCircle2 size={13} className="shrink-0" />
                    Staff are authorized to apply item/cart discounts on sales
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <ToggleRow
                  icon={<Truck size={16} />}
                  label="Allow Consignment"
                  description="Staff can sign out inventory items to third parties"
                  value={consignment}
                  loading={isPending && lastChanged === "consignment"}
                  onToggle={handleToggleConsignment}
                  accent="violet"
                />
                {consignment && (
                  <div className="mt-2.5 flex items-center gap-2 text-violet-600 dark:text-violet-400 text-xs font-medium bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2">
                    <CheckCircle2 size={13} className="shrink-0" />
                    Staff are authorized to sign out goods on consignment
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <ToggleRow
                  icon={<Scale size={16} />}
                  label="Staff View Wastage Reports"
                  description="Let staff view monthly wastage totals & item history"
                  value={wastageVisible}
                  loading={isPending && lastChanged === "wastageVisible"}
                  onToggle={handleToggleWastageVisible}
                  accent="emerald"
                />
                {wastageVisible && (
                  <div className="mt-2.5 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                    <CheckCircle2 size={13} className="shrink-0" />
                    Staff can view full wastage logs and metrics
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GROUP 3: Security & Credentials */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              Security & Access
            </p>
            <div className="bg-[var(--bg-surface)] border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-4 space-y-3 shadow-xs">
              <ToggleRow
                icon={<ShieldOff size={16} />}
                label="Screenshot Protection"
                description="Blur screen elements to discourage capture on device"
                value={screenshotProtection}
                loading={isPending && lastChanged === "screenshotProtection"}
                onToggle={handleToggleScreenshotProtection}
                accent="violet"
              />

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <Link
                  href="/change-password"
                  className="w-full flex items-center justify-between gap-3 p-2.5 -mx-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                      <Lock size={16} />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">Change Password</p>
                      <p className="text-[11px] text-slate-500 leading-tight">Update your current login password</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              </div>
            </div>
          </div>

          {/* GROUP 4: Appearance & Device */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
              App Appearance & Device
            </p>
            <div className="bg-[var(--bg-surface)] border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                    <Moon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">Theme Mode</p>
                    <p className="text-[11px] text-slate-500 leading-tight">Switch between light and dark themes</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <PushNotificationCard />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3">
                <InstallAppCard />
              </div>
            </div>
          </div>

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
        <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
          {icon}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight">{label}</p>
          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={loading}
        aria-pressed={value}
        aria-label={`Toggle ${label}`}
        className="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 cursor-pointer shadow-inner"
        style={{ backgroundColor: value ? onColor : "#374151" }}
      >
        {loading ? (
          <Loader2
            size={12}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white animate-spin"
          />
        ) : (
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}