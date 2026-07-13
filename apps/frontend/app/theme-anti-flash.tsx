"use client";

import { useServerInsertedHTML } from "next/navigation";

const themeAntiFlashScript = `
  try {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_) {}
`;

export function ThemeAntiFlashScript() {
  useServerInsertedHTML(() => (
    <script
      id="theme-anti-flash"
      dangerouslySetInnerHTML={{ __html: themeAntiFlashScript }}
    />
  ));
  return null;
}