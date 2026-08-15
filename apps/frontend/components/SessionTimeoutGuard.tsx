"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sessionTimeoutLogoutAction } from "@/lib/auth.actions";
import { INACTIVITY_LIMIT_MS } from "@/lib/session-config";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
const GUARDED_PREFIXES = ["/owner", "/staff", "/admin"];

export default function SessionTimeoutGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(Date.now());
  // Wall-clock time of the last real activity, independent of the
  // throttled setTimeout above. Needed because a locked screen or
  // backgrounded/fully-closed tab can suspend or destroy the setTimeout
  // entirely (mobile browsers routinely freeze JS on screen lock) — this
  // ref lets us recompute actual elapsed idle time from scratch whenever
  // the tab comes back, rather than trusting a timer that may never have
  // run.
  const lastActivityRef = useRef<number>(Date.now());

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

    const armTimer = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLogout, Math.max(delayMs, 0));
    };

    const resetTimer = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      // Throttle: only actually reset the underlying timeout at most once
      // every 5s, so a flurry of mousemove events doesn't thrash setTimeout.
      if (now - lastResetRef.current < 5000 && timerRef.current) return;
      lastResetRef.current = now;
      armTimer(INACTIVITY_LIMIT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    // Note: none of this is what actually secures the session — the
    // server enforces the same 5-minute limit against lastActivityAt on
    // every request (see getSessionUser() in lib/auth.ts), which is what
    // catches the case this timer can't: a locked screen or a fully
    // closed-and-reopened tab, where this component (and its setTimeout)
    // doesn't even exist to fire. This is purely a client-side UX nicety
    // — it just redirects proactively instead of waiting for the next
    // server round-trip to bounce the user.
    //
    // On tab becoming visible again, recompute actual elapsed idle time
    // rather than blindly restarting the countdown — otherwise someone
    // who steps away, locks their screen, and glances back periodically
    // could keep the session alive indefinitely without ever being
    // "active".
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_LIMIT_MS) {
        doLogout();
      } else {
        armTimer(INACTIVITY_LIMIT_MS - elapsed);
      }
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
