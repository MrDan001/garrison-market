"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sessionTimeoutLogoutAction } from "@/lib/auth.actions";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
const GUARDED_PREFIXES = ["/owner", "/staff", "/admin"];

export default function SessionTimeoutGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(Date.now());

  const isGuarded = GUARDED_PREFIXES.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!isGuarded) return;

    const doLogout = async () => {
      try {
        await sessionTimeoutLogoutAction();
      } catch {
        // sessionTimeoutLogoutAction redirects internally (throws NEXT_REDIRECT
        // under the hood) — if that somehow doesn't navigate, force it.
      }
      router.push("/login?reason=timeout");
    };

    const resetTimer = () => {
      // Throttle: only actually reset the underlying timeout at most once
      // every 5s, so a flurry of mousemove events doesn't thrash setTimeout.
      const now = Date.now();
      if (now - lastResetRef.current < 5000 && timerRef.current) return;
      lastResetRef.current = now;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, INACTIVITY_LIMIT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    // Also treat tab becoming visible again (e.g. after being backgrounded)
    // as a moment to re-check — if the tab was hidden for 6+ minutes,
    // resetTimer's own setTimeout will have already fired and logged out.
    const onVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isGuarded, pathname]);

  return null;
}
