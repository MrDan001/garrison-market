// FILE: apps/frontend/components/LegalPageShell.tsx (NEW FILE)
//
// Shared chrome for the five legal pages — Terms, Privacy, DPA, Refund
// Policy, MSA. Same fonts (Oswald display / Inter body / IBM Plex Mono
// labels) and CSS-variable color tokens as the public landing page
// (app/page.tsx), so these read as part of the same site instead of a
// bolted-on template. Each page supplies its own clauses as children via
// the exported LegalSection helper; this file only owns the shell, the
// "Last updated" line, and the cross-links between the five documents.

import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/dpa", label: "Data Processing Agreement" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/msa", label: "Master Service Agreement" },
];

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-lg font-bold text-[var(--text-primary)] mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function LegalPageShell({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="border-b border-[var(--border-subtle)]/10 py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-sm bg-[#F1EEE3] flex items-center justify-center shrink-0">
              <span
                className="text-[#0D1527] font-extrabold text-xs"
                style={{ fontFamily: "var(--font-display)" }}
              >
                G
              </span>
            </div>
            <span
              className="font-extrabold tracking-tight text-sm"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GARRISON MARKET
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[var(--text-primary)]/50 hover:text-[var(--text-primary)] transition"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p
          className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Legal
        </p>
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        <p className="text-xs text-[var(--text-primary)]/50 mb-2">Last updated {lastUpdated}</p>
        {intro && (
          <p className="text-sm text-[var(--text-primary)]/70 leading-relaxed mb-10 max-w-2xl">{intro}</p>
        )}
        {!intro && <div className="mb-10" />}

        <div className="space-y-10 text-sm leading-relaxed text-[var(--text-primary)]/80">{children}</div>

        <nav className="mt-16 pt-8 border-t border-[var(--border-subtle)]/10">
          <p
            className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Also see
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold">
            {LEGAL_PAGES.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <footer
        className="border-t border-[var(--border-subtle)]/10 py-8 px-6 text-center text-[var(--text-primary)]/30 text-xs font-semibold uppercase tracking-wider"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        &copy; {new Date().getFullYear()} Garrison Market, a product of MifiTech.
      </footer>
    </div>
  );
}