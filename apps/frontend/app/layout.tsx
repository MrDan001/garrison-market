import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ThemeAntiFlashScript } from './theme-anti-flash';
import SessionTimeoutGuard from '@/components/SessionTimeoutGuard';
import ScreenshotGuard from '@/components/ScreenshotGuard';
import PwaServiceWorkerRegister from '@/components/PwaServiceWorkerRegister';
import OptionalInstallPrompt from '@/components/OptionalInstallPrompt';
import "./styles.css";

const siteUrl = 'https://gmstock.co';
const siteDescription =
  'Garrison Market is a global inventory and business management platform for owners and teams. Organize products and stock levels, manage sales, staff, expenses, customer records and invoices, and review business reports across supported locations in one connected workspace.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Garrison Market — Inventory & Business Management',
    template: '%s | Garrison Market',
  },
  description: siteDescription,
  keywords: [
    'inventory management software',
    'stock management software',
    'small business management software',
    'retail inventory management',
    'multi-location inventory management',
    'business management software',
    'staff management software',
    'sales tracking',
    'expense tracking',
    'customer management',
    'multi-location inventory',
  ],
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
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1963555827654763');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1963555827654763&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body
        className="antialiased bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-200"
        suppressHydrationWarning={true}
      >
        <PwaServiceWorkerRegister />
        <OptionalInstallPrompt />
        {children}
        <SessionTimeoutGuard />
        <ScreenshotGuard />
      </body>
    </html>
  );
}
