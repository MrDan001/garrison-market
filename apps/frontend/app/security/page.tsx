// FILE: apps/frontend/app/security/page.tsx (NEW FILE)
//
// Public trust/security page at gmstock.co/security. Same fonts (Oswald
// display / Inter body / IBM Plex Mono labels) and CSS-variable color
// tokens as the landing page and LegalPageShell, so it reads as part of
// the same site. Unlike the legal pages, this isn't a contract — it's a
// plain-language account of how Garrison Market protects data, written
// for a shop owner deciding whether to trust the platform with their
// business, plus a responsible-disclosure channel for researchers.

import type { Metadata } from "next";
import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import {
  Lock,
  ShieldCheck,
  Database,
  KeyRound,
  CreditCard,
  Users,
  Server,
  Mail,
  ArrowUpRight,
} from "lucide-react";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Garrison Market protects your inventory, sales, and staff data — encryption, authentication, payments, and our vulnerability disclosure process.",
};

const sections = [
  {
    icon: Lock,
    n: "01",
    title: "Data in transit",
    body: "Every request between your device and Garrison Market — owner dashboard, staff app, or checkout — travels over TLS/HTTPS. Nothing moves in plain text.",
  },
  {
    icon: ShieldCheck,
    n: "02",
    title: "Pentest & vulnerability confirmation",
    body: null, // custom body below
  },
  {
    icon: Database,
    n: "03",
    title: "Data at rest",
    body: "Your records live in an isolated, access-controlled Postgres database with automatic encrypted backups. Every business's data is scoped to that business — no owner or staff account can see another tenant's data.",
  },
  {
    icon: KeyRound,
    n: "04",
    title: "Authentication",
    body: "Passwords are hashed with bcrypt and never stored in plain text. Sessions run on signed, expiring tokens, with automatic logout after a period of inactivity — so a stolen link or an idle tab can't be used to get into your account.",
  },
  {
    icon: CreditCard,
    n: "05",
    title: "Payments",
    body: "Card and transfer payments are handled directly by Paystack, a licensed payment processor. Garrison Market never sees or stores your customers' card details.",
  },
  {
    icon: Users,
    n: "06",
    title: "Role-based access",
    body: "Admin, owner, and staff roles are enforced on the server, not just hidden in the interface. Staff can only ever act within the store and permissions their owner has granted — there's no client-side toggle that gets around that.",
  },
  {
    icon: Server,
    n: "07",
    title: "Infrastructure",
    body: "Hosted on Vercel with automatic HTTPS, DDoS protection, and zero-downtime deploys. Database connections run through a pooled, access-controlled layer rather than being open to the app servers directly.",
  },
];

export default function SecurityPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="border-b border-[var(--border-subtle)]/10 py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-sm bg-[#F1EEE3] flex items-center justify-center shrink-0">
              <span className="text-[#0D1527] font-extrabold text-xs" style={{ fontFamily: "var(--font-display)" }}>
                G
              </span>
            </div>
            <span className="font-extrabold tracking-tight text-sm" style={{ fontFamily: "var(--font-display)" }}>
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
          Trust &amp; Security
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Security
        </h1>
        <p className="text-xs text-[var(--text-primary)]/50 mb-6">Last updated 13 August 2026</p>
        <p className="text-sm text-[var(--text-primary)]/70 leading-relaxed mb-12 max-w-2xl">
          Your inventory, your sales data, and your customers' information are protected the same way
          you'd protect them yourself. Here's exactly how — in plain language, not legal boilerplate.
        </p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.n} className="flex gap-4">
              <div className="shrink-0 pt-0.5">
                <div className="h-9 w-9 rounded-lg bg-[var(--text-primary)]/5 border border-[var(--border-subtle)]/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-[var(--text-primary)]/70" strokeWidth={2} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-bold text-[var(--text-primary)]/30"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s.n}
                  </span>
                  <h2 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {s.title}
                  </h2>
                </div>

                {s.n === "02" ? (
                  <div className="space-y-3 text-sm leading-relaxed text-[var(--text-primary)]/80">
                    <p>
                      Every vulnerability report gets an <strong>immediate, automated confirmation</strong> the
                      moment it's submitted — you're not left wondering if it reached anyone. A member of the
                      team then reviews it personally and follows up with a real update within 48 hours.
                    </p>
                    <p>
                      Security testing against Garrison Market is welcome. If you're probing the app —
                      authentication, the owner or staff dashboards, the API, or checkout — in good faith and
                      without accessing, modifying, or exfiltrating another business's real data, we won't treat
                      that as an attack. Out of scope: social engineering our team or customers, physical access
                      attempts, and anything intended to disrupt service for other users (denial-of-service).
                    </p>
                    <p>
                      Garrison Market is under continuous, active development, and security review is part of
                      that process on every release — new auth, payment, and access-control code is checked
                      before it ships. We're planning a formal third-party penetration test as the platform
                      scales, and we'll publish the outcome here once one has been completed. Until then, this
                      page reflects the safeguards actually in place today, not a claim of independent
                      certification.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-[var(--text-primary)]/80">{s.body}</p>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] p-6 sm:p-8">
          <p
            className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Found a vulnerability?
          </p>
          <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed mb-5 max-w-xl">
            Tell us before anyone else finds out. Email the details, including steps to reproduce, and
            we'll confirm receipt right away and keep you updated as we investigate and fix it. Please
            don't publicly disclose an issue before we've had a chance to address it.
          </p>
          <a
            href="mailto:officialsafebase@gmail.com?subject=Security%20report%20—%20Garrison%20Market"
            className="inline-flex items-center gap-2 text-sm font-bold bg-[var(--text-primary)] text-[var(--bg-app)] px-5 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            <Mail className="h-4 w-4" strokeWidth={2.5} />
            officialsafebase@gmail.com
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </a>
        </div>

        <nav className="mt-16 pt-8 border-t border-[var(--border-subtle)]/10">
          <p
            className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Also see
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold">
            <li>
              <Link href="/privacy" className="text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/dpa" className="text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition">
                Data Processing Agreement
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-[var(--text-primary)]/60 hover:text-[var(--text-primary)] transition">
                Terms of Service
              </Link>
            </li>
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
