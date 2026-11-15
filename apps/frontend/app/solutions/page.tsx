import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Business and Inventory Management Solutions",
  description: "Explore how Garrison Market helps businesses organize inventory, stock, sales, staff, expenses and multiple locations in one workspace.",
  alternates: { canonical: "https://gmstock.co/solutions" },
  openGraph: {
    type: "website",
    url: "https://gmstock.co/solutions",
    siteName: "Garrison Market",
    title: "Business and Inventory Management Solutions",
    description: "Explore inventory and business management solutions for owners and teams.",
  },
};

const solutions = [
  { href: "/solutions/inventory-management-software", title: "Inventory management software", text: "Organize products, quantities, prices and low-stock thresholds." },
  { href: "/solutions/stock-management-software", title: "Stock management software", text: "Keep stock records and sales activity connected." },
  { href: "/solutions/small-business-management-software", title: "Small business management software", text: "Bring inventory, staff, expenses and customer records together." },
  { href: "/solutions/retail-inventory-management", title: "Retail inventory management", text: "Manage products, store stock, sales and team access." },
  { href: "/solutions/multi-location-inventory-management", title: "Multi-location inventory management", text: "Review operations across the locations included in your plan." },
  { href: "/solutions/sales-staff-expense-management", title: "Sales, staff and expense management", text: "Keep sales records, team activity and business spending in one place." },
];

export default function SolutionsIndexPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <header className="border-b border-[var(--border-subtle)]">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-black tracking-tight">GARRISON MARKET</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="hover:underline">Sign in</Link>
            <Link href="/waitlist" className="rounded-md bg-[#E55345] px-4 py-2 font-bold text-white">Get started</Link>
          </div>
        </nav>
      </header>
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E55345]">Garrison Market</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">One connected workspace for inventory and everyday business operations</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Explore how Garrison Market helps owners and teams organize products, stock levels, sales, staff activity, expenses, customer records, invoices and reports.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {solutions.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--border-subtle)] p-6 transition-colors hover:border-[#E55345]">
              <h2 className="text-xl font-bold">{item.title} <span aria-hidden="true">→</span></h2>
              <p className="mt-3 leading-7 text-[var(--text-secondary)]">{item.text}</p>
            </Link>
          ))}
        </div>
        <div className="mt-14 border-t border-[var(--border-subtle)] pt-8 text-sm text-[var(--text-secondary)]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-3">·</span>
          <Link href="/security" className="hover:underline">Security</Link>
          <span className="mx-3">·</span>
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </div>
      </section>
    </main>
  );
}
