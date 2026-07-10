export const revalidate = 3600; // static marketing page — cache it, no need to rebuild per-request

import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import { Boxes, Users, ClipboardList, ArrowUpRight } from "lucide-react";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const receiptLines = [
  { text: "GARRISON MARKET — TILL #02", muted: true },
  { text: "PHONE CHARGERS ......... 34 IN STOCK", muted: false },
  { text: "AIRPODS CASE ........... LOW STOCK", warn: true },
  { text: "SALE #0231  ₦4,500 ..... TOKUNBO", muted: false },
  { text: "RESTOCK ALERT: HEADSETS", warn: true },
  { text: "REPORT SUBMITTED — 18:02", muted: false },
];

export default function HomePage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[#0D1527] text-[#F1EEE3]`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-[#F1EEE3]/10 bg-[#0D1527]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
              <span className="text-[#0D1527] font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>G</span>
            </div>
            <span className="font-bold tracking-tight text-[#F1EEE3]" style={{ fontFamily: "var(--font-display)" }}>
              GARRISON MARKET
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-[#F1EEE3]/80 hover:text-[#F1EEE3] transition">Sign in</Link>
            <Link
              href="/login"
              className="text-sm font-semibold bg-[#F1EEE3] text-[#0D1527] px-4 py-2 rounded-sm hover:bg-[#E2DDD0] transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
        {/* Hero */}
        <section className="grid lg:grid-cols-2 gap-16 items-center mb-32">
          <div>
            <div className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-[#E55345] mb-6"
                 style={{ fontFamily: "var(--font-mono)" }}>
              Built for shop owners, not IT departments
            </div>
            <h1
              className="text-[3.2rem] sm:text-[4.2rem] leading-[0.95] font-bold text-[#F1EEE3] mb-8 tracking-tight uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              EVERY ITEM.<br />EVERY SALE.<br />ACCOUNTED FOR.
            </h1>
            <p className="text-[#F1EEE3]/70 text-lg max-w-md mb-10 leading-relaxed">
              Garrison Market gives you one dashboard for stock, staff, and daily sales —
              so you know exactly what sold, who sold it, and what's running low, without
              chasing anyone down for a paper report.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[#F1EEE3] text-[#0D1527] px-7 py-4 rounded-sm font-semibold hover:bg-[#E2DDD0] transition"
              >
                Start managing your shop <ArrowUpRight size={18} />
              </Link>
              <Link href="/login" className="text-sm font-semibold text-[#F1EEE3] underline underline-offset-4 hover:text-[#E2DDD0] transition">
                I already have an account
              </Link>
            </div>
          </div>

          {/* Signature element: live receipt */}
          <div className="relative mx-auto max-w-sm w-full">
            <div className="bg-[#16233D] rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] px-6 pt-6 pb-8 relative overflow-hidden border border-[#F1EEE3]/10">
              <div className="text-center mb-4 pb-4 border-b border-dashed border-[#F1EEE3]/20">
                <p className="text-xs tracking-[0.3em] text-[#F1EEE3]/50" style={{ fontFamily: "var(--font-mono)" }}>
                  DAILY ACTIVITY
                </p>
              </div>
              <div className="space-y-3">
                {receiptLines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-xs leading-relaxed opacity-0 animate-[fadeIn_0.6s_ease-out_forwards] ${
                      line.warn ? "text-[#E55345] font-semibold" : line.muted ? "text-[#F1EEE3]/40" : "text-[#F1EEE3]/80"
                    }`}
                    style={{ fontFamily: "var(--font-mono)", animationDelay: `${i * 0.35 + 0.2}s` }}
                  >
                    {line.text}
                  </p>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-dashed border-[#F1EEE3]/20 flex justify-center gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-[3px] h-6 bg-[#F1EEE3]/70" style={{ opacity: i % 3 === 0 ? 1 : 0.2 }} />
                ))}
              </div>
            </div>
            
            {/* Torn edge — No mixed shorthand properties to prevent React re-render conflicts */}
            <div
              className="h-4 -mt-1"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, transparent 8px, #16233D 8px), linear-gradient(-135deg, transparent 8px, #16233D 8px)",
                backgroundPosition: "0 0, 0 0",
                backgroundSize: "16px 16px, 16px 16px",
                backgroundRepeat: "repeat-x, repeat-x",
              }}
            />
          </div>
        </section>

        {/* Features — price tags */}
        <section className="mb-32">
          <h2
            className="text-3xl font-bold text-[#F1EEE3] mb-12 text-center tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            WHAT'S ON THE DASHBOARD
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Boxes,
                title: "Inventory that warns you",
                desc: "Track every product with cost and selling price. Get a restock alert before you run out, not after.",
              },
              {
                icon: Users,
                title: "Staff accounts you control",
                desc: "Create logins for each staff member, suspend one instantly if needed, and see who sold what.",
              },
              {
                icon: ClipboardList,
                title: "Reports without the paperwork",
                desc: "Staff submit end-of-day summaries in the app. You see today's revenue the moment it happens.",
              },
            ].map((f) => (
              <div key={f.title} className="relative bg-[#16233D] rounded-sm p-8 pt-10 border border-[#F1EEE3]/10 shadow-sm">
                <div className="absolute -top-3 left-8 h-6 w-6 rounded-full bg-[#0D1527] border border-[#F1EEE3]/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-[#F1EEE3]/20" />
                </div>
                <f.icon className="text-[#E55345] mb-4" size={28} strokeWidth={1.75} />
                <h3 className="text-lg font-bold text-[#F1EEE3] mb-2">{f.title}</h3>
                <p className="text-[#F1EEE3]/70 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="border border-[#F1EEE3]/10 rounded-sm p-8 md:p-14 bg-[#16233D] shadow-sm">
          <h2
            className="text-3xl font-bold text-[#F1EEE3] mb-3 text-center tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            PICK YOUR PLAN
          </h2>
          <p className="text-center text-[#F1EEE3]/60 mb-12 text-sm">Cancel anytime. No card required to start.</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {[
              {
                title: "Standard",
                price: "₦25,000",
                features: ["Up to 10 inventory items", "1 staff account", "Daily sales dashboard"],
                plan: "standard",
              },
              {
                title: "Pro",
                price: "₦35,000",
                features: ["Up to 20 inventory items", "2 staff accounts", "Full staff management"],
                plan: "pro",
              },
            ].map((plan) => (
              <div key={plan.title} className="bg-[#0D1527] p-8 rounded-sm border border-[#F1EEE3]/10 flex flex-col gap-6">
                <div>
                  <div className="text-[#F1EEE3]/60 text-sm font-semibold uppercase tracking-wider mb-1">{plan.title}</div>
                  <div className="text-4xl font-bold text-[#F1EEE3]" style={{ fontFamily: "var(--font-display)" }}>
                    {plan.price}
                    <span className="text-sm font-normal text-[#F1EEE3]/50">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm flex items-start gap-2 text-[#F1EEE3]/80">
                      <span className="text-[#E55345] mt-0.5">—</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/login?plan=${plan.plan}`}
                  className="w-full text-center py-4 rounded-sm bg-[#F1EEE3] text-[#0D1527] font-semibold hover:bg-[#E2DDD0] transition"
                >
                  Choose {plan.title}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="py-10 text-center text-[#F1EEE3]/40 text-sm border-t border-[#F1EEE3]/10">
        &copy; {new Date().getFullYear()} Garrison Market. Built for the shop floor.
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}