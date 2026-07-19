"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Unlocking your shop floor...",
  "Pulling today's numbers...",
  "Almost there...",
];

export default function LoadingScreen({ label }: { label?: string }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bg-app)] animate-in fade-in duration-300">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {/* Outer pulsing ring */}
        <span className="absolute inset-0 rounded-full border-2 border-[#E55345]/30 animate-ping" style={{ animationDuration: "1.6s" }} />
        {/* Spinning ring */}
        <span
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#E55345] border-r-[#E55345]/40"
          style={{ animation: "gm-spin 0.9s linear infinite" }}
        />
        {/* Logo mark, gently breathing */}
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-sm bg-[#F1EEE3] text-[#0D1527] shadow-lg"
          style={{ animation: "gm-pulse 1.6s ease-in-out infinite" }}
        >
          <span className="text-lg font-bold tracking-tighter" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
            G
          </span>
        </div>
      </div>

      <p className="mt-6 text-sm font-semibold text-[var(--text-primary)]/70 tracking-wide transition-opacity duration-300">
        {label || MESSAGES[msgIndex]}
      </p>

      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#E55345]"
            style={{ animation: `gm-bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes gm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes gm-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes gm-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
