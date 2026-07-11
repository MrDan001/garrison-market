export const revalidate = 3600;

import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import {
  Boxes,
  Users,
  ClipboardList,
  ArrowUpRight,
  X,
  Check,
  ShieldAlert,
  Zap,
  TrendingDown,
  ChevronDown,
} from "lucide-react";

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

const tickerItems = [
  "NO MORE PAPER LEDGERS",
  "NO MORE GUESSING STOCK",
  "NO MORE STAFF DISPUTES",
  "NO MORE LOST SALES",
  "NO MORE MIDNIGHT MATH",
];

const painPoints = [
  "You find out you're out of stock when a customer is standing in front of you",
  "Staff sales get scribbled on paper, then lost, then argued about",
  "You have no idea which staff member sold what, or when",
  "Restocking is a guess, not a number",
];

const withGarrison = [
  "A restock alert before you run out, every time",
  "Every sale logged instantly, tied to the staff member who made it",
  "A clear log of who sold what and when, no arguments",
  "A restock threshold you set once, and the app watches for you",
];

const deepFeatures = [
  {
    icon: Boxes,
    tag: "INVENTORY",
    title: "Know your stock before it runs out",
    desc: "Every product tracked with cost price, selling price, and category. Set a restock threshold once — the moment stock dips below it, you'll see the warning the second you open the dashboard. No more finding out from a disappointed customer.",
    mock: [
      { label: "Phone Chargers", value: "34 units", tone: "ok" },
      { label: "AirPods Case", value: "LOW STOCK", tone: "warn" },
      { label: "USB-C Cables", value: "0 — OUT", tone: "danger" },
    ],
  },
  {
    icon: Users,
    tag: "STAFF",
    title: "Give staff access, not the keys to the shop",
    desc: "Create a login for every staff member. See exactly who sold what, suspend a login instantly if you need to, and never wonder again who was on shift when a sale went missing.",
    mock: [
      { label: "Tokunbo — Active", value: "₦42,500 today", tone: "ok" },
      { label: "Amaka — Active", value: "₦18,000 today", tone: "ok" },
      { label: "David — Suspended", value: "No access", tone: "danger" },
    ],
  },
  {
    icon: ClipboardList,
    tag: "REPORTS",
    title: "Today's numbers, without chasing anyone",
    desc: "Staff submit a short end-of-day report from their phone. You see today's revenue, order count, and top movers the second it happens — not two days later when someone finally remembers.",
    mock: [
      { label: "Today's Sales", value: "₦186,400", tone: "ok" },
      { label: "Orders Today", value: "23", tone: "ok" },
      { label: "Reports Pending", value: "0", tone: "ok" },
    ],
  },
];

const steps = [
  { n: "01", title: "Add your stock", desc: "Name, quantity, cost price, selling price. Takes under a minute per item." },
  { n: "02", title: "Bring your staff in", desc: "Create a login for each staff member. They only see what they need to." },
  { n: "03", title: "Watch it run itself", desc: "Sales, stock, and reports update live. You just check the dashboard." },
];

const faqs = [
  {
    q: "Do I need to be technical to use this?",
    a: "No. If you can use WhatsApp, you can use Garrison Market. Everything is built for a phone screen first.",
  },
  {
    q: "What happens if I delete an item that's already been sold?",
    a: "It won't let you lose that history. Instead, it's automatically marked Out of Stock so your past sales records stay intact.",
  },
  {
    q: "Can my staff see everything I see?",
    a: "No. Staff get their own login with access to sell, view inventory, and submit reports — not your full dashboard or business numbers.",
  },
  {
    q: "What if I only have one product category right now?",
    a: "That's fine — start with what you have. You can add items, staff, and categories any time as you grow.",
  },
];

export default function HomePage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[#0D1527] text-[#F1EEE3] overflow-x-hidden`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Ticker */}
      <div className="bg-[#E55345] text-[#0D1527] overflow-hidden whitespace-nowrap py-2 relative z-40">
        <div className="inline-flex animate-[scroll_22s_linear_infinite]">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="mx-6 text-xs font-bold tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>
              {item} •
            </span>
          ))}
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 border-b border-[#F1EEE3]/10 bg-[#0D1527]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
              <span className="text-[#0D1527] font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>G</span>
            </div>
            <span className="font-bold tracking-tight text-[#F1EEE3]" style={{ fontFamily: "var(--font-display)" }}>
              GARRISON MARKET
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/login" className="text-sm font-medium text-[#F1EEE3]/80 hover:text-[#F1EEE3] transition hidden sm:block">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-xs sm:text-sm font-semibold bg-[#F1EEE3] text-[#0D1527] px-3 sm:px-4 py-2 rounded-sm hover:bg-[#E2DDD0] transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="px-6 max-w-6xl mx-auto">
        {/* Hero */}
        <section className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 sm:py-24">
          <div>
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E55345] mb-6"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <Zap size={14} /> Built for shop owners, not IT departments
            </div>
            <h1
              className="text-[2.6rem] sm:text-[3.6rem] lg:text-[4.2rem] leading-[0.95] font-bold text-[#F1EEE3] mb-8 tracking-tight uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              STOP RUNNING YOUR SHOP <span className="text-[#E55345]">BLIND.</span>
            </h1>
            <p className="text-[#F1EEE3]/70 text-lg max-w-md mb-10 leading-relaxed">
              Garrison Market gives you one dashboard for stock, staff, and daily sales —
              so you know exactly what sold, who sold it, and what's running low, before
              it costs you a sale.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-[#F1EEE3] text-[#0D1527] px-7 py-4 rounded-sm font-semibold hover:bg-[#E2DDD0] transition w-full sm:w-auto"
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

        {/* Agitation: problem vs solution */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E55345] mb-4"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <TrendingDown size={14} /> The real cost of guessing
            </div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#F1EEE3] tracking-tight uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Every notebook has a blind spot.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#16233D] border border-[#E55345]/20 rounded-sm p-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#E55345] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                The old way
              </h3>
              <ul className="space-y-4">
                {painPoints.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm text-[#F1EEE3]/70">
                    <X size={16} className="text-[#E55345] shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#16233D] border border-emerald-500/20 rounded-sm p-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                With Garrison Market
              </h3>
              <ul className="space-y-4">
                {withGarrison.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm text-[#F1EEE3]/70">
                    <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Deep feature sections, alternating */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10 space-y-20">
          {deepFeatures.map((f, i) => (
            <div key={f.title} className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E55345] mb-4"
                     style={{ fontFamily: "var(--font-mono)" }}>
                  <f.icon size={14} /> {f.tag}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#F1EEE3] mb-4 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {f.title}
                </h3>
                <p className="text-[#F1EEE3]/70 leading-relaxed max-w-md">{f.desc}</p>
              </div>
              <div className="bg-[#16233D] border border-[#F1EEE3]/10 rounded-sm p-6">
                <div className="space-y-3">
                  {f.mock.map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between items-center px-4 py-3 rounded-sm bg-[#0D1527]/60 border border-[#F1EEE3]/5"
                    >
                      <span className="text-xs text-[#F1EEE3]/70">{row.label}</span>
                      <span
                        className={`text-xs font-bold ${
                          row.tone === "danger" ? "text-[#E55345]" : row.tone === "warn" ? "text-amber-400" : "text-emerald-400"
                        }`}
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10">
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#F1EEE3] mb-14 text-center tracking-tight uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Three steps. That's it.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div
                  className="text-6xl font-bold text-[#F1EEE3]/10 mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {s.n}
                </div>
                <h3 className="text-lg font-bold text-[#F1EEE3] mb-2">{s.title}</h3>
                <p className="text-sm text-[#F1EEE3]/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10">
          <div className="border border-[#F1EEE3]/10 rounded-sm p-8 md:p-14 bg-[#16233D] shadow-sm">
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#F1EEE3] mb-3 text-center tracking-tight uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Stop losing money guessing.
            </h2>
            <p className="text-center text-[#F1EEE3]/60 mb-12 text-sm">Cancel anytime. No card required to start.</p>

            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              {[
                {
                  title: "Standard",
                  price: "₦---",
                  features: ["Up to 10 inventory items", "1 staff account", "Daily sales dashboard"],
                  plan: "standard",
                },
                {
                  title: "Pro",
                  price: "₦---",
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
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10">
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#F1EEE3] mb-12 text-center tracking-tight uppercase"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Questions, answered.
          </h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group bg-[#16233D] border border-[#F1EEE3]/10 rounded-sm px-6 py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-[#F1EEE3]">
                  {f.q}
                  <ChevronDown size={16} className="text-[#F1EEE3]/50 group-open:rotate-180 transition-transform shrink-0 ml-4" />
                </summary>
                <p className="text-sm text-[#F1EEE3]/60 mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final aggressive CTA */}
        <section className="py-16 sm:py-24 border-t border-[#F1EEE3]/10">
          <div className="bg-[#E55345] rounded-sm p-10 sm:p-16 text-center relative overflow-hidden">
            <ShieldAlert size={32} className="mx-auto mb-6 text-[#0D1527]" />
            <h2
              className="text-3xl sm:text-5xl font-bold text-[#0D1527] mb-6 tracking-tight uppercase leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Every day on paper<br />is a day you're guessing.
            </h2>
            <p className="text-[#0D1527]/80 mb-8 max-w-lg mx-auto">
              Set up your shop in minutes. No card required to start.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#0D1527] text-[#F1EEE3] px-8 py-4 rounded-sm font-bold hover:bg-[#16233D] transition"
            >
              Start managing your shop <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#F1EEE3]/10 py-14 px-6">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-8 mb-10 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
                <span className="text-[#0D1527] font-bold text-xs" style={{ fontFamily: "var(--font-display)" }}>G</span>
              </div>
              <span className="font-bold text-[#F1EEE3]" style={{ fontFamily: "var(--font-display)" }}>GARRISON MARKET</span>
            </div>
            <p className="text-[#F1EEE3]/50 text-xs leading-relaxed max-w-xs">
              One dashboard for stock, staff, and sales. Built for the shop floor.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#F1EEE3]/50 mb-3" style={{ fontFamily: "var(--font-mono)" }}>
              Product
            </h4>
            <ul className="space-y-2 text-[#F1EEE3]/60">
              <li><Link href="/login" className="hover:text-[#F1EEE3] transition">Sign in</Link></li>
              <li><Link href="/login?plan=standard" className="hover:text-[#F1EEE3] transition">Standard plan</Link></li>
              <li><Link href="/login?plan=pro" className="hover:text-[#F1EEE3] transition">Pro plan</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#F1EEE3]/50 mb-3" style={{ fontFamily: "var(--font-mono)" }}>
              Contact
            </h4>
            <p className="text-[#F1EEE3]/60 text-xs">Replace this with your real support email / WhatsApp line.</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-[#F1EEE3]/5 text-center text-[#F1EEE3]/40 text-xs">
          &copy; {new Date().getFullYear()} Garrison Market. Built for the shop floor.
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
