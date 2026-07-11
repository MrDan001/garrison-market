import type { Metadata, Viewport } from 'next';
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
        {/* You only need custom tags if they are not supported by the Metadata API. */}

        {/*
          NOTE: switched from next/script's <Script strategy="beforeInteractive">
          to a plain raw <script> tag here. This is the standard pattern for
          anti-flash/theme scripts (used by libraries like next-themes) —
          browsers execute <script> tags in <head> synchronously during HTML
          parsing, which is what actually prevents the flash. next/script's
          beforeInteractive strategy was throwing a render error under this
          Next 16 + Turbopack combination regardless of children vs
          dangerouslySetInnerHTML, so this sidesteps it entirely.
        */}
        <script
          id="theme-anti-flash"
          dangerouslySetInnerHTML={{ __html: themeAntiFlashScript }}
        />
      </head>
      <body
        className="antialiased bg-[#F1EEE3] text-[#16233D] dark:bg-[#0a0c12] dark:text-slate-200 transition-colors duration-200"
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
