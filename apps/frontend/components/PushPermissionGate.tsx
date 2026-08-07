"use client";
// FILE: apps/frontend/components/PushPermissionGate.tsx

import { useEffect, useState } from "react";
import { Bell, BellOff, ShieldAlert, Loader2, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Mounted near the root of the owner layout (and the staff layout — see
 * app/staff/layout.tsx) so nothing under it renders until the visitor has
 * dealt with push permission. This is what makes the "New Feature 🎁" style
 * broadcasts in lib/broadcast.actions.ts actually reach people, instead of
 * only reaching whoever happened to already opt in from Settings.
 *
 * Deliberately renders nothing (`null`) — letting {children} through
 * untouched — in every state where blocking would be either pointless or
 * actively harmful:
 *   - not yet checked (avoids a flash of the gate before we know the real
 *     permission state)
 *   - unsupported browser/device (nothing to grant)
 *   - iOS Safari NOT running as an installed PWA (Notification.requestPermission
 *     exists here and silently never resolves granted — iOS only supports
 *     web push inside an installed PWA. Blocking here would hard-lock every
 *     iOS visitor out of their own dashboard with no way through — shown as
 *     an install prompt instead below, that's an actual next step, or
 *     admin/dev pages can simply choose not to mount this gate at all)
 *   - already granted + subscribed (the whole point — invisible from here on)
 *
 * The two states that DO block:
 *   - "default" (never been asked) — single CTA, no skip
 *   - "denied" — can't re-prompt (browser-enforced), so this shows how to
 *     re-enable manually plus an unavoidable "Continue anyway" escape
 *     hatch, since otherwise a past accidental "Block" permanently locks
 *     someone out of their own account.
 */
export default function PushPermissionGate({ children }: { children: React.ReactNode }) {
  const { isSupported, checked, permission, subscribed, busy, subscribe } = usePushNotifications();
  const { isInstalled: isPwaInstalled, checked: pwaChecked } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
  }, []);

  async function handleEnable() {
    setError(null);
    const ok = await subscribe();
    if (!ok) {
      // subscribe() already flips `permission` to whatever the browser
      // reported (e.g. "denied"), so the component re-renders into the
      // denied screen below on its own — this message only covers a
      // real failure (e.g. the push service rejected the subscription)
      // where permission still reads "granted".
      if (Notification.permission === "granted") {
        setError("Couldn't turn on notifications. Check your connection and try again.");
      }
    }
  }

  if (!checked || !pwaChecked) return null;
  if (!isSupported) return <>{children}</>;
  if (isIOS && !isPwaInstalled) return <>{children}</>;
  if (permission === "granted" && subscribed) return <>{children}</>;
  if (dismissed) return <>{children}</>;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-gate-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {permission === "denied" ? (
          <>
            <div className="flex flex-col items-center gap-2.5 px-6 pt-7 pb-4 text-center">
              <div className="h-11 w-11 rounded-full bg-rose-600/10 flex items-center justify-center">
                <BellOff size={20} className="text-rose-500" />
              </div>
              <h2 id="push-gate-title" className="text-base font-bold text-[var(--text-primary)]">
                Notifications Are Blocked
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                You'll miss order alerts, admin updates, and important announcements. To turn them back on, enable
                notifications for this site in your browser settings, then reload this page.
              </p>
            </div>
            <div className="px-6 pb-6 pt-1">
              <button
                onClick={() => setDismissed(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[var(--text-primary)] transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2.5 px-6 pt-7 pb-4 text-center">
              <div className="h-11 w-11 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Bell size={20} className="text-blue-500" />
              </div>
              <h2 id="push-gate-title" className="text-base font-bold text-[var(--text-primary)]">
                Turn On Notifications
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Garrison Market needs your permission to send order alerts, admin updates, and announcements — even
                when the app is closed. Please allow notifications to continue.
              </p>
            </div>
            <div className="px-6 pb-6 pt-1">
              {error && <p className="text-xs font-medium text-rose-400 mb-3 text-center">{error}</p>}
              <button
                onClick={handleEnable}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                {busy ? "Requesting…" : "Enable Notifications"}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-3">
                <ShieldAlert size={12} /> Required to access your dashboard
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Standalone card shown in place of the gate for iOS visitors who haven't
 * installed the app yet — surfaced by the layout alongside the gate (see
 * app/staff/layout.tsx / app/owner/layout.tsx) since the gate itself
 * intentionally passes iOS-non-PWA visitors straight through.
 */
export function IOSInstallNudge() {
  const { isInstalled: isPwaInstalled, checked } = usePwaInstall();
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
  }, []);

  if (!checked || !isIOS || isPwaInstalled || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[65] max-w-sm mx-auto rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl p-4 flex items-start gap-3">
      <div className="h-9 w-9 shrink-0 rounded-full bg-blue-600/10 flex items-center justify-center">
        <Smartphone size={16} className="text-blue-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)]">Install the App for Notifications</p>
        <p className="text-[12px] text-slate-500 mt-0.5">
          iPhone requires the app installed to your Home Screen first. Tap Share → Add to Home Screen, then open it
          from there.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-slate-400 hover:text-[var(--text-primary)] text-xs font-bold px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}