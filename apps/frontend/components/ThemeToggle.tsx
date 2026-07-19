"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.theme;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  if (!mounted) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] dark:border-white/[0.06] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-0.5">Appearance</h3>
        <p className="text-[12px] text-slate-500">
          {theme === "dark" ? "Dark mode" : "Light mode"}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={theme === "dark"}
        aria-label="Toggle dark mode"
        className="shrink-0 relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none"
        style={{ backgroundColor: theme === "dark" ? "#334155" : "#f59e0b" }}
      >
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
            theme === "dark" ? "translate-x-8" : "translate-x-1"
          }`}
        >
          {theme === "dark" ? (
            <Moon size={14} className="text-slate-300 dark:text-slate-700" />
          ) : (
            <Sun size={14} className="text-amber-500" />
          )}
        </span>
      </button>
    </div>
  );
}
