"use client";

import { Download, CheckCircle2, Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function InstallAppCard() {
  const { isInstallable, isInstalled, checked, install } = usePwaInstall();

  if (!checked) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Install App</h3>
        {isInstalled && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <CheckCircle2 size={12} /> Installed
          </span>
        )}
      </div>

      {isInstalled ? (
        <>
          <div className="flex items-center gap-2 text-[13px] text-emerald-400 mb-4">
            <CheckCircle2 size={15} />
            App is installed and running in standalone mode
          </div>
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500/40 text-white/70 font-semibold text-sm py-3 cursor-not-allowed"
          >
            <Download size={16} /> Already Installed
          </button>
        </>
      ) : (
        <>
          <button
            onClick={install}
            disabled={!isInstallable}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition-colors"
          >
            <Download size={16} /> {isInstallable ? "Install App" : "Install Not Available Yet"}
          </button>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            💡 If the install prompt doesn't appear, use "Add to Home Screen" from your browser menu.
          </p>
          <p className="text-[11px] text-slate-500 mt-1">📱 On iOS: Tap Share → Add to Home Screen</p>
          <p className="text-[11px] text-slate-500">📱 On Android: Tap Menu (⋮) → Install App</p>
        </>
      )}
    </div>
  );
}

export function PushNotificationCard() {
  const { isSupported, checked, permission, subscribed, busy, subscribe, unsubscribe } = usePushNotifications();

  if (!checked) return null;
  if (!isSupported || permission === "unsupported") return null;

  const isLiveAndEnabled = permission === "granted" && subscribed;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-0.5">Push Notifications</h3>
          <p className="text-[12px] text-slate-500">
            Get notified instantly — even when the app is closed, just like a native app
          </p>
        </div>

        {isLiveAndEnabled ? (
          <button
            onClick={unsubscribe}
            disabled={busy}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl px-3 py-2 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Enabled
          </button>
        ) : permission === "denied" ? (
          <span className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            <BellOff size={14} /> Blocked
          </span>
        ) : (
          <button
            onClick={subscribe}
            disabled={busy}
            className="shrink-0 flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 rounded-xl px-3 py-2 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Enable Notifications
          </button>
        )}
      </div>
      {permission === "denied" && (
        <p className="text-[11px] text-slate-500 mt-2">
          Notifications are blocked in your browser settings. Enable them from your browser's site settings to receive alerts.
        </p>
      )}
    </div>
  );
}