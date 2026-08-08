// FILE: apps/frontend/app/login/layout.tsx

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to Garrison Market to manage your shop\u2019s inventory, staff, sales, and daily reports from your phone.',
  alternates: {
    canonical: 'https://gmstock.co/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}