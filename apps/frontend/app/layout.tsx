import type { Metadata, Viewport } from 'next';
import { ThemeAntiFlashScript } from './theme-anti-flash';
import SessionTimeoutGuard from '@/components/SessionTimeoutGuard';
import ScreenshotGuard from '@/components/ScreenshotGuard';
import PwaServiceWorkerRegister from '@/components/PwaServiceWorkerRegister';
import "./styles.css";

const siteUrl = 'https://gmstock.co';
const siteDescription =
  'Garrison Market is an all-in-one inventory and sales management app for shop and market owners. Track stock by piece or by weight (kg, g, L, ml), manage staff and multiple stores, process sales, generate daily reports, and handle consignments and wastage — all from your phone.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Garrison Market — Inventory & Sales Management',
    template: '%s | Garrison Market',
  },
  description: siteDescription,
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
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Garrison Market',
    title: 'Garrison Market — Inventory & Sales Management',
    description: siteDescription,
    images: [
      {
        url: '/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Garrison Market',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Garrison Market — Inventory & Sales Management',
    description: siteDescription,
    images: ['/icon-512x512.png'],
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
        <PwaServiceWorkerRegister />
        {children}
        <SessionTimeoutGuard />
        <ScreenshotGuard />
      </body>
    </html>
  );
}