import type { Metadata, Viewport } from 'next';
import Script from 'next/script'; // 👈 Imported Next.js Script component
import "./styles.css";

export const metadata: Metadata = {
  title: 'Garrison Market',
  description: 'Market management system for owners and staff',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Garrison Market',
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0c12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const themeAntiFlashScript = `
  try {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Next.js automatically injects metadata and viewport tags here. */}
      </head>
      <body
        className="antialiased bg-[#F1EEE3] text-[#16233D] dark:bg-[#0a0c12] dark:text-slate-200 transition-colors duration-200"
        suppressHydrationWarning={true}
      >
        {/* 
          Using native Next.js Script component with beforeInteractive strategy 
          placed here inside the body ensures it runs before React hydration kicks in,
          completely removing the "script tag while rendering" console error.
        */}
        <Script
          id="theme-anti-flash"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeAntiFlashScript }}
        />
        {children}
      </body>
    </html>
  );
}