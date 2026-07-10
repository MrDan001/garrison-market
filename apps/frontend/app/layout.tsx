import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Garrison Market" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Safe anti-flash block using Next.js Script wrapper */}
        <Script id="theme-anti-flash" strategy="beforeInteractive">
          {`
            try {
              if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } catch (_) {}
          `}
        </Script>
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