import type { Metadata } from 'next';
import "./styles.css";

export const metadata: Metadata = {
  title: 'Garrison Market',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Garrison Market',
  },
};
// apps/frontend/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Add the attribute here */}
      <body className="antialiased" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}