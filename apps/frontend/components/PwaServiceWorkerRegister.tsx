"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js as early as possible, app-wide.
 *
 * This has nothing to do with rendering — it exists purely so the browser's
 * PWA install criteria are met (Chrome/Edge/Android require a registered,
 * controlling service worker before `beforeinstallprompt` will ever fire).
 * Without this, the "Install App" button in owner/staff settings can never
 * become enabled, no matter what usePwaInstall does.
 */
export default function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}