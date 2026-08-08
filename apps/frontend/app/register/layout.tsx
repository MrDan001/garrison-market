// FILE: apps/frontend/app/register/layout.tsx

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Account',
  description:
    'Get started with Garrison Market. Create a free account and start tracking stock, staff, and sales for your shop today.',
  alternates: {
    canonical: 'https://gmstock.co/register',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}