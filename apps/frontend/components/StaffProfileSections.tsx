"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  User,
  Lock,
  Mail,
  Phone,
  CalendarDays,
  TrendingUp,
  ShoppingBag,
  Bell,
  Printer,
  HelpCircle,
  Info,
  LogOut,
  Truck,
  ShieldOff,
} from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/lib/auth.actions";
import { updateNotificationPreference, updateScreenshotProtectionPreference } from "@/lib/profile.actions";
import { APP_VERSION } from "@/lib/version";
import { InstallAppCard, PushNotificationCard } from "@/components/SettingsExtras";
import ThemeToggle from "@/components/ThemeToggle";

interface Props {
  email: string;
  phone: string;
  joinedDate: string;
  monthSales: number;
  monthOrders: number;
  notificationsEnabled: boolean;
  screenshotProtectionEnabled: boolean;
}

interface RowData {
  label: string;
  sub: string;
  icon: any;
  href?: string;
  toggleValue?: boolean;
  onToggle?: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      aria-pressed={checked}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Row({ row }: { row: RowData }) {
  const Icon = row.icon;
  const inner = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-700 dark:text-slate-300">
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
        <p className="truncate text-[12.5px] text-slate-500">{row.sub}</p>
      </div>
      {typeof row.toggleValue === "boolean" ? (
        <Toggle checked={row.toggleValue} onChange={row.onToggle!} />
      ) : row.href ? (
        <ChevronRight size={18} className="shrink-0 text-slate-400 dark:text-slate-600" strokeWidth={1.8} />
      ) : null}
    </>
  );

  if (row.href) {
    return (
      <Link
        href={row.href}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="flex w-full items-center gap-3 px-4 py-3 text-left">{inner}</div>;
}

function Section({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  rows,
}: {
  title: string;
  icon: any;
  isOpen: boolean;
  onToggle: () => void;
  rows: RowData[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--bg-surface)]">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Icon size={16} strokeWidth={2} />
        </div>
        <span className="flex-1 text-[13px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{title}</span>
        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`grid transition-all duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
            {rows.map((row, i) => (
              <Row key={i} row={row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffProfileSections({
  email,
  phone,
  joinedDate,
  monthSales,
  monthOrders,
  notificationsEnabled,
  screenshotProtectionEnabled,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ account: true });
  const [notifOn, setNotifOn] = useState(notificationsEnabled);
  const [savingNotif, setSavingNotif] = useState(false);
  const [screenshotProtectionOn, setScreenshotProtectionOn] = useState(screenshotProtectionEnabled);
  const [savingScreenshotProtection, setSavingScreenshotProtection] = useState(false);

  const toggleSection = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleNotifications = async () => {
    const next = !notifOn;
    setNotifOn(next); // optimistic
    setSavingNotif(true);
    try {
      await updateNotificationPreference(next);
    } catch (err) {
      console.error("Failed to update notification preference:", err);
      setNotifOn(!next); // revert on failure
    } finally {
      setSavingNotif(false);
    }
  };

  const toggleScreenshotProtection = async () => {
    const next = !screenshotProtectionOn;
    setScreenshotProtectionOn(next); // optimistic
    setSavingScreenshotProtection(true);
    try {
      await updateScreenshotProtectionPreference(next);
    } catch (err) {
      console.error("Failed to update screenshot protection preference:", err);
      setScreenshotProtectionOn(!next); // revert on failure
    } finally {
      setSavingScreenshotProtection(false);
    }
  };

  const sections = [
    {
      id: "account",
      title: "Account",
      icon: User,
      rows: [
        { label: "Edit profile", sub: "Name, photo, phone number", icon: User, href: "/staff/profile/edit" },
        { label: "Email", sub: email, icon: Mail },
        { label: "Phone number", sub: phone, icon: Phone },
        { label: "Change password", sub: "Update your login password", icon: Lock, href: "/change-password" },
        { label: "Member since", sub: joinedDate, icon: CalendarDays },
      ] as RowData[],
    },
    {
      id: "activity",
      title: "This Month",
      icon: TrendingUp,
      rows: [
        {
          label: "Sales this month",
          sub: `₦${monthSales.toLocaleString()} across ${monthOrders} order${monthOrders !== 1 ? "s" : ""}`,
          icon: TrendingUp,
        },
        { label: "Order history", sub: "View all your past orders", icon: ShoppingBag, href: "/staff/orders" },
        { label: "Consignment", sub: "Sign out or settle goods", icon: Truck, href: "/staff/consignment" },
      ] as RowData[],
    },
    {
      id: "preferences",
      title: "Preferences",
      icon: Bell,
      rows: [
        {
          label: "Notifications",
          sub: savingNotif ? "Saving..." : notifOn ? "On" : "Off",
          icon: Bell,
          toggleValue: notifOn,
          onToggle: toggleNotifications,
        },
        {
          label: "Printing",
          sub: "Use the Print button on the invoice page — your device handles the printer",
          icon: Printer,
        },
      ] as RowData[],
    },
    {
      id: "security",
      title: "Security",
      icon: ShieldOff,
      rows: [
        {
          label: "Screenshot Protection",
          sub: savingScreenshotProtection ? "Saving..." : screenshotProtectionOn ? "On" : "Off",
          icon: ShieldOff,
          toggleValue: screenshotProtectionOn,
          onToggle: toggleScreenshotProtection,
        },
      ] as RowData[],
    },
    {
      id: "support",
      title: "Support",
      icon: HelpCircle,
      rows: [
        { label: "Need help?", sub: "Contact your store owner or admin", icon: HelpCircle },
        { label: "App version", sub: APP_VERSION, icon: Info },
      ] as RowData[],
    },
  ];

  return (
    <>
      {sections.map((section) => (
        <Section
          key={section.id}
          title={section.title}
          icon={section.icon}
          isOpen={!!open[section.id]}
          onToggle={() => toggleSection(section.id)}
          rows={section.rows}
        />
      ))}

      <div className="space-y-3">
        <ThemeToggle />
        <PushNotificationCard />
        <InstallAppCard />
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3.5 text-[15px] font-semibold text-red-400 transition-colors hover:bg-red-500/[0.1] mt-4"
        >
          <LogOut size={17} strokeWidth={2} />
          Log out
        </button>
      </form>

      <p className="pb-2 pt-1 text-center text-[11.5px] text-slate-400 dark:text-slate-600">Staff Portal</p>
    </>
  );
}
