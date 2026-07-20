import type { Metadata, Viewport } from 'next';
import { ThemeAntiFlashScript } from './theme-anti-flash';
import SessionTimeoutGuard from '@/components/SessionTimeoutGuard';
import ScreenshotGuard from '@/components/ScreenshotGuard';
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
        <ThemeAntiFlashScript />
      </head>
      <body
        className="antialiased bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-200"
        suppressHydrationWarning={true}
      >
        {children}
        <SessionTimeoutGuard />
        <ScreenshotGuard />
      </body>
    </html>
  );
}