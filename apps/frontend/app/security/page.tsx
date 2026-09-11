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
  CircleCheck,
  CircleAlert,
} from "lucide-react";

const display = Oswald({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Garrison Market protects your inventory, sales, and staff data — encryption, authentication, payments, and vulnerability disclosure.",
};

const sections = [
  {
    icon: Lock,
    n: "01",
    title: "Data in transit",
    body: "Every request between your device and Garrison Market — owner dashboard, staff app, or checkout — travels over TLS/HTTPS.",
  },
  {
    icon: Database,
    n: "02",
    title: "Data at rest",
    body: "Business records live in an access-controlled Postgres database. Application access is scoped so one business is separated from another.",
  },
  {
    icon: KeyRound,
    n: "03",
    title: "Authentication",
    body: "Passwords are hashed with bcrypt and are not stored as plain text. Sessions use signed, expiring tokens with inactivity controls.",
  },
  {
    icon: CreditCard,
    n: "04",
    title: "Payments",
    body: "Card and transfer payments are handled by Paystack. Garrison Market does not store customer card details.",
  },
  {
    icon: Users,
    n: "05",
    title: "Role-based access",
    body: "Owner and staff permissions are enforced on the server. Interface visibility alone is not used as the security boundary.",
  },
  {
    icon: Server,
    n: "06",
    title: "Infrastructure",
    body: "The application is hosted on Vercel with HTTPS and managed infrastructure protections. Database connections use a controlled pooled layer.",
  },
];

export default function SecurityPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="border-b border-[var(--border-subtle)]/10 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F1EEE3]">
              <span
                className="text-xs font-extrabold text-[#0D1527]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                G
              </span>
            </div>
            <span
              className="truncate text-xs font-extrabold tracking-tight sm:text-sm"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GARRISON MARKET
            </span>
          </Link>

          <Link
            href="/"
            className="shrink-0 text-xs font-semibold text-[var(--text-primary)]/50 transition hover:text-[var(--text-primary)]"
          >
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-2xl">
          <p
            className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]/40 sm:text-[11px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Trust &amp; Security
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1
                className="text-3xl font-extrabold tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Security
              </h1>
              <p className="mt-1 text-[11px] text-[var(--text-primary)]/40">
                Reviewed 11 September 2026
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
              <CircleAlert className="h-3 w-3" />
              Pentest pending
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-[var(--text-primary)]/70 sm:mt-6">
            Here is how Garrison Market protects your inventory, sales, staff,
            and customer data — in plain language.
          </p>
        </div>

        <section
          aria-labelledby="assessment-heading"
          className="mt-8 overflow-hidden rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] sm:mt-10"
        >
          <div className="border-b border-[var(--border-subtle)]/10 px-4 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-primary)]/5">
                <ShieldCheck className="h-4 w-4 text-[var(--text-primary)]/75" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]/35"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  00 · Security assessment
                </p>
                <h2
                  id="assessment-heading"
                  className="mt-1 text-lg font-bold"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Third-party penetration test
                </h2>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-4 py-5 text-sm leading-6 text-[var(--text-primary)]/75 sm:px-6 sm:py-6">
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                <CircleAlert className="h-4 w-4" />
                Not yet completed
              </div>
              <p className="mt-2">
                Garrison Market is planning a formal independent penetration
                test as the platform scales. We will publish the assessment
                date, scope, findings, remediation status, and retest result
                here after completion.
              </p>
            </div>

            <div>
              <p>
                Responsible security testing is welcome. Researchers may test
                authentication, dashboards, APIs, and checkout in good faith,
                provided they do not access, modify, or exfiltrate another
                business's real data.
              </p>
              <p className="mt-3">
                Social engineering, physical access attempts, and denial-of-
                service activity are outside this disclosure process.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="controls-heading" className="mt-10 sm:mt-12">
          <div className="mb-4">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]/35"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              01–06 · Current controls
            </p>
            <h2
              id="controls-heading"
              className="mt-1 text-xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              How the platform is protected
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map((s) => (
              <article
                key={s.n}
                className="rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.025] p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/5">
                    <s.icon
                      className="h-4 w-4 text-[var(--text-primary)]/70"
                      strokeWidth={2}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-bold text-[var(--text-primary)]/30"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {s.n}
                      </span>
                      <h3
                        className="text-sm font-bold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]/70">
                      {s.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="disclosure-heading"
          className="mt-10 rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] p-5 sm:mt-12 sm:p-7"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-primary)]/5">
              <Mail className="h-4 w-4 text-[var(--text-primary)]/70" />
            </div>
            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]/35"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Responsible disclosure
              </p>
              <h2
                id="disclosure-heading"
                className="mt-1 text-lg font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Found a vulnerability?
              </h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--text-primary)]/75">
            Email the affected URL, steps to reproduce, impact, and any
            supporting evidence. Please give us a chance to investigate and
            remediate before publicly disclosing the issue.
          </p>

          <a
            href="mailto:support.gmstock@gmail.com?subject=Security%20report%20—%20Garrison%20Market"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-3 text-xs font-bold text-[var(--bg-app)] transition hover:opacity-90 sm:w-auto"
          >
            <Mail className="h-4 w-4" strokeWidth={2.5} />
            Report a vulnerability
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </a>
          <p className="mt-2 text-[11px] text-[var(--text-primary)]/35">
            support.gmstock@gmail.com
          </p>
        </section>

        <nav className="mt-10 border-t border-[var(--border-subtle)]/10 pt-7 sm:mt-12 sm:pt-8">
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]/35"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Also see
          </p>
          <ul className="grid gap-2 text-xs font-semibold sm:flex sm:flex-wrap sm:gap-x-6">
            <li>
              <Link
                href="/privacy"
                className="inline-flex min-h-10 items-center text-[var(--text-primary)]/60 transition hover:text-[var(--text-primary)]"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href="/dpa"
                className="inline-flex min-h-10 items-center text-[var(--text-primary)]/60 transition hover:text-[var(--text-primary)]"
              >
                Data Processing Agreement
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="inline-flex min-h-10 items-center text-[var(--text-primary)]/60 transition hover:text-[var(--text-primary)]"
              >
                Terms of Service
              </Link>
            </li>
          </ul>
        </nav>
      </main>

      <footer
        className="border-t border-[var(--border-subtle)]/10 px-4 py-7 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]/30 sm:px-6 sm:py-8 sm:text-xs"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        &copy; {new Date().getFullYear()} Garrison Market, a product of MifiTech.
      </footer>
    </div>
  );
}
