"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SPLASH_KEY = "garrison-splash-shown";
const SPLASH_DURATION = 1400; // ms visible before fading out
const FADE_DURATION = 400; // ms fade transition

export default function AppSplash({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (!alreadyShown) {
      setVisible(true);
      sessionStorage.setItem(SPLASH_KEY, "1");

      const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION);
      const removeTimer = setTimeout(() => setVisible(false), SPLASH_DURATION + FADE_DURATION);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) setMounted(true);
  }, [visible]);

  return (
    <>
      {visible && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0c12] transition-opacity duration-[400ms] ${
            fadingOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="animate-splash-pop">
            <Image
              src="/icon-512x512.png"
              alt="Garrison Market"
              width={112}
              height={112}
              className="rounded-3xl shadow-2xl shadow-emerald-500/20"
              priority
            />
          </div>
          <div className="mt-6 flex gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-splash-dot [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-splash-dot [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-splash-dot [animation-delay:300ms]" />
          </div>
        </div>
      )}
      {mounted && children}

      <style>{`
        @keyframes splash-pop {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-splash-pop {
          animation: splash-pop 550ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .animate-splash-dot {
          animation: splash-dot 1.1s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}