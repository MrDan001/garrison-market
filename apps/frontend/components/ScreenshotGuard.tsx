"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { getScreenshotProtectionEnabled } from "@/lib/profile.actions";

const GUARDED_PREFIXES = ["/owner", "/staff", "/admin"];

/**
 * Best-effort screenshot deterrent for users who've turned this on in their
 * profile settings. IMPORTANT — this is a deterrent, not a real block:
 * browsers have no API to actually prevent OS-level screenshots (Snipping
 * Tool, a phone's hardware screenshot combo, an external camera, etc). What
 * this *can* do:
 *   - Blur the screen the moment the tab/window loses focus or is hidden —
 *     this covers the common cases of screen-recording software (which
 *     triggers a visibility/focus change) and the OS app-switcher preview
 *     on mobile (which is itself effectively a screenshot).
 *   - Discourage right-click "save image"/inspect shortcuts.
 *   - Show a brief warning flash if PrintScreen is pressed (many browsers
 *     do surface this as a keydown, though it's not guaranteed and doesn't
 *     stop the OS from having already captured the frame).
 */
export default function ScreenshotGuard() {
  const pathname = usePathname();
  const [armed, setArmed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGuarded = GUARDED_PREFIXES.some((p) => pathname?.startsWith(p));

  // Check the user's saved preference whenever they land on a guarded route.
  useEffect(() => {
    if (!isGuarded) {
      setArmed(false);
      return;
    }
    let cancelled = false;
    getScreenshotProtectionEnabled()
      .then((enabled) => {
        if (!cancelled) setArmed(enabled);
      })
      .catch(() => {
        if (!cancelled) setArmed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuarded, pathname]);

  useEffect(() => {
    if (!armed) return;

    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVisibility = () => setHidden(document.visibilityState !== "visible");
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        setFlash(true);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setFlash(false), 2500);
      }
    };

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setHidden(false);
      setFlash(false);
    };
  }, [armed]);

  if (!armed || (!hidden && !flash)) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-3 bg-[var(--bg-app)]/95 backdrop-blur-xl text-center px-6">
      <ShieldOff size={28} className="text-slate-400" />
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        {flash && !hidden ? "Screenshots are discouraged on this account" : "Content hidden"}
      </p>
      <p className="text-xs text-slate-500 max-w-xs">
        {flash && !hidden
          ? "This device flagged a screenshot attempt. Please avoid sharing sensitive business data."
          : "Return to this tab to keep viewing."}
      </p>
    </div>
  );
}
