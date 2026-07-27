// FILE: apps/frontend/app/page.tsx

"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
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
  Crown,
  Mail,
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

// --- 1. Layout-Stable Typewriter Component ---
function Typewriter({ text, speed = 15, active = false }: { text: string; speed?: number; active: boolean }) {
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    if (!active) {
      // Clear text when inactive so it can re-type next time
      setCurrentText("");
      return;
    }
    
    let i = 0;
    setCurrentText("");
    const timer = setInterval(() => {
      setCurrentText((prev) => text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [active, text, speed]);

  return (
    <span className="relative inline-block w-full">
      {/* Invisible text reserves exact space so layout never shifts */}
      <span className="invisible select-none pointer-events-none block">{text}</span>
      {/* Visible typing text */}
      <span className="absolute left-0 top-0 w-full block">{currentText}</span>
    </span>
  );
}

// --- 2. Scroll-driven Unfurl Wrapper with Repeatability ---
function ScrollUnfurl({ children, className = "" }: { children: (active: boolean) => React.ReactNode; className?: string }) {
  const [hasEntered, setHasEntered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Sets active to true when entering viewport, and false when it rolls completely out
        setHasEntered(entry.isIntersecting);
      },
      {
        threshold: 0.1, 
        rootMargin: "0px 0px -10% 0px", // Trigger when 10% of the element is within view
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={`${className} scroll-unfurl-element ${hasEntered ? "unrolled" : "rolled"}`}
    >
      {children(hasEntered)}
    </div>
  );
}

export default function HomePage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-x-hidden relative perspective-container`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[40%] right-10 w-[600px] h-[600px] bg-indigo-950/20 rounded-full blur-[140px] mix-blend-screen" />
        <div className="absolute bottom-[10%] left-10 w-[500px] h-[500px] bg-red-950/10 rounded-full blur-[130px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-30" />
      </div>

      {/* Ticker */}
      <div className="bg-[#E55345] text-[#0A0F1D] overflow-hidden whitespace-nowrap py-2 relative z-40 border-b border-[var(--border-subtle)]/20 shadow-[0_4px_20px_rgba(229,83,69,0.2)]">
        <div className="inline-flex animate-[scroll_18s_linear_infinite] hover:[animation-play-state:paused]">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="mx-6 text-xs font-black tracking-widest uppercase flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--bg-app)] inline-block" /> {item}
            </span>
          ))}
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 border-b border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="h-8 w-8 rounded-sm bg-[#F1EEE3] flex items-center justify-center transition-all duration-300 group-hover:bg-[#E55345] group-hover:rotate-12 group-hover:scale-110">
              <span className="text-[#0D1527] font-extrabold text-sm group-hover:text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>G</span>
            </div>
            <span className="font-extrabold tracking-tight text-[var(--text-primary)] group-hover:text-[#E55345] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
              GARRISON MARKET
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/login" className="text-sm font-semibold text-[var(--text-primary)]/80 hover:text-[var(--text-primary)] transition-all hover:scale-105">
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-xs sm:text-sm font-black uppercase tracking-wider bg-[#F1EEE3] text-[#0D1527] px-4 py-2 rounded-none border border-transparent hover:border-[#E55345] hover:bg-transparent hover:text-[#E55345] shadow-[0_4px_12px_rgba(241,238,227,0.1)] hover:shadow-[0_4px_20px_rgba(229,83,69,0.3)] transition-all duration-300"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content with Scroll-driven Unfurl Wrappers */}
      <main className="px-6 max-w-6xl mx-auto relative z-10">
        
        {/* Section 1: Hero */}
        <ScrollUnfurl>
          {(active) => (
            <section className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 sm:py-28">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#E55345] mb-6 bg-[#E55345]/10 px-3 py-1 rounded-sm border border-[#E55345]/30"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <Zap size={14} /> Built for shop owners, not IT departments
                </div>
                <h1
                  className="text-[2.8rem] sm:text-[4rem] lg:text-[4.6rem] leading-[0.9] font-black text-[var(--text-primary)] mb-8 tracking-tight uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  STOP RUNNING <br />YOUR SHOP <span className="text-[#E55345] relative inline-block hover-glitch shadow-[#E55345]/10">BLIND.</span>
                </h1>
                <p className="text-[var(--text-primary)]/70 text-lg max-w-md mb-10 leading-relaxed font-medium">
                  <Typewriter 
                    text="Garrison Market gives you one dashboard for stock, staff, and daily sales — so you know exactly what sold, who sold it, and what's running low, before it costs you a business day." 
                    active={active} 
                    speed={12}
                  />
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-3 bg-[#E55345] text-[#F1EEE3] hover:bg-[#c94337] px-8 py-5 rounded-none font-bold uppercase tracking-wider hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-5px_5px_0px_0px_rgba(241,238,227,0.9)] transition-all duration-300 w-full sm:w-auto text-sm"
                  >
                    Start Free Trial <ArrowUpRight size={18} />
                  </Link>
                  <Link href="/login" className="text-sm font-bold text-[var(--text-primary)] underline underline-offset-8 decoration-2 decoration-[#E55345]/50 hover:decoration-[#E55345] hover:text-[var(--text-primary)] transition text-center sm:text-left py-2">
                    I already have an account
                  </Link>
                </div>
                <p className="mt-4 text-xs font-semibold text-[var(--text-primary)]/50 uppercase tracking-wider">
                  14-day free trial · Full access to every feature · No card required
                </p>
              </div>

              {/* Signature Live Receipt Widget */}
              <div className="relative mx-auto max-w-sm w-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#E55345]/30 to-[#4f46e5]/30 rounded-lg blur-md opacity-75 animate-pulse" />
                <div className="relative bg-[var(--bg-surface)] rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] px-6 pt-6 pb-8 border border-[var(--border-subtle)]/15">
                  <div className="text-center mb-4 pb-4 border-b border-dashed border-[var(--border-subtle)]/20">
                    <p className="text-xs tracking-[0.3em] font-extrabold text-[#E55345]" style={{ fontFamily: "var(--font-mono)" }}>
                      LIVE ACTIVITY STREAM
                    </p>
                  </div>
                  <div className="space-y-3.5">
                    {receiptLines.map((line, i) => (
                      <p
                        key={i}
                        className={`text-xs leading-relaxed opacity-0 animate-[fadeIn_0.5s_ease-out_forwards] ${
                          line.warn ? "text-[#E55345] font-bold tracking-wide" : line.muted ? "text-[var(--text-primary)]/40" : "text-[var(--text-primary)]/80"
                    }`}
                        style={{ fontFamily: "var(--font-mono)", animationDelay: `${i * 0.25 + 0.1}s` }}
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-dashed border-[var(--border-subtle)]/20 flex justify-between px-1">
                    {Array.from({ length: 26 }).map((_, i) => (
                      <div key={i} className="w-[2px] h-6 bg-[#F1EEE3]/40" style={{ opacity: i % 3 === 0 ? 1 : 0.2 }} />
                    ))}
                  </div>
                </div>
                <div
                  className="h-4 -mt-1 relative z-10"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, transparent 8px, #11192E 8px), linear-gradient(-135deg, transparent 8px, #11192E 8px)",
                    backgroundPosition: "0 0, 0 0",
                    backgroundSize: "16px 16px, 16px 16px",
                    backgroundRepeat: "repeat-x, repeat-x",
                  }}
                />
              </div>
            </section>
          )}
        </ScrollUnfurl>

        {/* Section 2: Agitation (Problem vs Solution) */}
        <ScrollUnfurl>
          {(active) => (
            <section className="py-20 sm:py-28 border-t border-[var(--border-subtle)]/10 relative">
              <div className="text-center mb-16">
                <div
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#E55345] mb-4 bg-[#E55345]/10 px-3 py-1 border border-[#E55345]/20"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <TrendingDown size={14} /> The real cost of guessing
                </div>
                <h2
                  className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] tracking-tight uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Every notebook has a <span className="text-[#E55345] hover-glitch">blind spot.</span>
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[var(--bg-surface)]/80 backdrop-blur-sm border border-[#E55345]/30 rounded-none p-8 hover:border-[#E55345]/80 hover:shadow-[0_10px_30px_rgba(229,83,69,0.05)] transition-all duration-300 transform hover:-translate-y-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.25em] text-[#E55345] mb-6 flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
                    <span className="h-2 w-2 rounded-full bg-[#E55345]" /> The old way
                  </h3>
                  <ul className="space-y-5">
                    {painPoints.map((p, index) => (
                      <li key={p} className="flex items-start gap-3.5 text-sm text-[var(--text-primary)]/70 group">
                        <div className="p-1 rounded-sm bg-[#E55345]/10 group-hover:bg-[#E55345]/20 transition-colors">
                          <X size={14} className="text-[#E55345] shrink-0" />
                        </div>
                        <span className="group-hover:text-[var(--text-primary)] transition-colors">
                          <Typewriter text={p} active={active} speed={10 + index * 2} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-[var(--bg-surface)]/80 backdrop-blur-sm border border-emerald-500/30 rounded-none p-8 hover:border-emerald-500/80 hover:shadow-[0_10px_30px_rgba(16,185,129,0.05)] transition-all duration-300 transform hover:-translate-y-1">
                  <h3 className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 mb-6 flex items-center gap-2" style={{ fontFamily: "var(--font-mono)" }}>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> With Garrison Market
                  </h3>
                  <ul className="space-y-5">
                    {withGarrison.map((p, index) => (
                      <li key={p} className="flex items-start gap-3.5 text-sm text-[var(--text-primary)]/70 group">
                        <div className="p-1 rounded-sm bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                          <Check size={14} className="text-emerald-400 shrink-0" />
                        </div>
                        <span className="group-hover:text-[var(--text-primary)] transition-colors">
                          <Typewriter text={p} active={active} speed={10 + index * 2} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </ScrollUnfurl>

        {/* Section 3: Deep Features */}
        <section className="py-16 sm:py-24 border-t border-[var(--border-subtle)]/10 space-y-24">
          {deepFeatures.map((f, i) => (
            <ScrollUnfurl key={f.title}>
              {(active) => (
                <div className={`grid md:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                  <div className="space-y-5">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#E55345] bg-[#E55345]/10 px-3 py-1.5"
                         style={{ fontFamily: "var(--font-mono)" }}>
                      <f.icon size={14} /> {f.tag}
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                      {f.title}
                    </h3>
                    <p className="text-[var(--text-primary)]/70 leading-relaxed text-base">
                      <Typewriter text={f.desc} active={active} speed={12} />
                    </p>
                  </div>
                  
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)]/10 rounded-none p-6 shadow-2xl relative overflow-hidden group hover:border-[#E55345]/30 transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#E55345]/40 to-transparent animate-[scroll_4s_linear_infinite]" />
                    <div className="space-y-3.5">
                      {f.mock.map((row) => (
                        <div
                          key={row.label}
                          className="flex justify-between items-center px-4 py-3.5 rounded-none bg-[var(--bg-app)]/80 border border-[var(--border-subtle)]/5 hover:border-[var(--border-subtle)]/15 transition-all duration-200"
                        >
                          <span className="text-xs font-bold text-[var(--text-primary)]/70">{row.label}</span>
                          <span
                            className={`text-xs font-black uppercase tracking-wider ${
                              row.tone === "danger" 
                              ? "text-[#E55345] animate-pulse" 
                              : row.tone === "warn" 
                              ? "text-amber-400 font-bold" 
                              : "text-emerald-400"
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
              )}
            </ScrollUnfurl>
          ))}
        </section>

        {/* Section 4: Process Steps */}
        <ScrollUnfurl>
          {(active) => (
            <section className="py-20 sm:py-28 border-t border-[var(--border-subtle)]/10 relative">
              <h2
                className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] mb-16 text-center tracking-tight uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Three steps. That's it.
              </h2>
              <div className="grid md:grid-cols-3 gap-10">
                {steps.map((s, idx) => (
                  <div key={s.n} className="relative group p-6 border border-transparent hover:border-[var(--border-subtle)]/5 transition-all duration-300 hover:bg-[var(--bg-surface)]/30">
                    <div
                      className="text-7xl font-black text-[var(--text-primary)]/5 group-hover:text-[#E55345]/15 mb-4 transition-colors select-none"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {s.n}
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3 group-hover:text-[var(--text-primary)] transition-colors">{s.title}</h3>
                    <p className="text-sm text-[var(--text-primary)]/60 leading-relaxed min-h-[50px]">
                      <Typewriter text={s.desc} active={active} speed={15 + idx * 3} />
                    </p>
                    <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#E55345] group-hover:w-full transition-all duration-500" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </ScrollUnfurl>

{/* Section 5: Pricing */}
<ScrollUnfurl>
          {() => (
            <section className="py-20 sm:py-28 border-t border-[var(--border-subtle)]/10">
              <div className="border border-[var(--border-subtle)]/15 rounded-none p-8 md:p-16 bg-[var(--bg-surface)] shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#E55345]/5 via-transparent to-transparent pointer-events-none" />
                <h2
                  className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] mb-4 text-center tracking-tight uppercase"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Stop losing money guessing.
                </h2>
                <p className="text-center text-[var(--text-primary)]/50 mb-14 text-sm font-semibold uppercase tracking-wider">Cancel anytime. No card required to start.</p>

                <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                  {[
                    {
                      title: "Basic",
                      price: "₦---",
                      features: [
                        { text: "Up to 1 store", included: true },
                        { text: "2 staff accounts", included: true },
                        { text: "Up to 10 products", included: true },
                        { text: "Business summary chart", included: false },
                        { text: "Consignment management", included: false },
                      ],
                      plan: "basic",
                    },
                    {
                      title: "Premium",
                      price: "₦---",
                      features: [
                        { text: "Up to 2 stores", included: true },
                        { text: "4 staff accounts", included: true },
                        { text: "Up to 30 products", included: true },
                        { text: "Business summary chart", included: true },
                        { text: "Consignment management", included: true },
                      ],
                      plan: "premium",
                      popular: true,
                    },
                    {
                      title: "Max Package",
                      price: "Contact us",
                      features: [
                        { text: "Unlimited stores", included: true },
                        { text: "Unlimited staff accounts", included: true },
                        { text: "Unlimited products", included: true },
                        { text: "Business summary chart", included: true },
                        { text: "Consignment management", included: true },
                      ],
                      plan: "max",
                    },
                  ].map((plan) => (
                    <div key={plan.title} className={`bg-[var(--bg-app)] p-8 rounded-none border ${plan.popular ? 'border-[#E55345]' : plan.plan === 'max' ? 'border-amber-500/40' : 'border-[var(--border-subtle)]/10'} flex flex-col gap-8 relative`}>
                      {plan.popular && (
                        <span className="absolute -top-3.5 right-6 bg-[#E55345] text-[#F1EEE3] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-sm shadow-md">
                          POPULAR CHOICE
                        </span>
                      )}
                      {plan.plan === "max" && (
                        <span className="absolute -top-3.5 right-6 bg-amber-500 text-[#0D1527] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-sm shadow-md flex items-center gap-1">
                          <Crown size={11} /> UNLIMITED
                        </span>
                      )}
                      <div>
                        <div className="text-[var(--text-primary)]/50 text-xs font-bold uppercase tracking-widest mb-1.5">{plan.title}</div>
                        <div className="text-5xl font-black text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                          {plan.price}
                          {plan.plan !== "max" && <span className="text-sm font-normal text-[var(--text-primary)]/50">/mo</span>}
                        </div>
                        {plan.plan === "max" && (
                          <p className="text-xs text-[var(--text-primary)]/50 mt-1.5">Pricing negotiated directly with our team</p>
                        )}
                      </div>
                      <ul className="space-y-4 flex-1">
                        {plan.features.map((f) => (
                          <li key={f.text} className={`text-sm flex items-start gap-2.5 ${f.included ? 'text-[var(--text-primary)]/80' : 'text-[var(--text-primary)]/30 line-through'}`}>
                            <span className={f.included ? 'text-[#E55345] mt-0.5 font-black' : 'text-[var(--text-primary)]/30 mt-0.5 font-black'}>
                              {f.included ? '—' : '✕'}
                            </span> 
                            {f.text}
                          </li>
                        ))}
                      </ul>
                      {plan.plan === "max" ? (
                        <a
                          href="mailto:support@garrison.com"
                          className="w-full text-center py-4 rounded-none font-bold uppercase tracking-wider text-xs transition-all duration-300 bg-amber-500 text-[#0D1527] hover:bg-amber-400 flex items-center justify-center gap-2"
                        >
                          <Mail size={14} /> Contact Us
                        </a>
                      ) : (
                        <Link
                          href={`/register?plan=${plan.plan}`}
                          className={`w-full text-center py-4 rounded-none font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
                            plan.popular 
                            ? 'bg-[#E55345] text-[#F1EEE3] hover:bg-[#c94337] shadow-[0_4px_15px_rgba(229,83,69,0.3)]' 
                            : 'bg-[#F1EEE3] text-[#0D1527] hover:bg-[#E2DDD0]'
                          }`}
                        >
                          Choose {plan.title}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </ScrollUnfurl>

        {/* Section 6: FAQ */}
        <ScrollUnfurl>
          {() => (
            <section className="py-16 sm:py-24 border-t border-[var(--border-subtle)]/10">
              <h2
                className="text-4xl sm:text-5xl font-black text-[var(--text-primary)] mb-12 text-center tracking-tight uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Questions, answered.
              </h2>
              <div className="max-w-2xl mx-auto space-y-4">
                {faqs.map((f) => (
                  <details key={f.q} className="group bg-[var(--bg-surface)] border border-[var(--border-subtle)]/10 hover:border-[var(--border-subtle)]/25 rounded-none px-6 py-5 transition-all duration-300">
                    <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-bold text-[var(--text-primary)] select-none uppercase tracking-wide">
                      {f.q}
                      <ChevronDown size={16} className="text-[var(--text-primary)]/50 group-open:rotate-180 transition-transform shrink-0 ml-4" />
                    </summary>
                    <p className="text-sm text-[var(--text-primary)]/60 mt-4 leading-relaxed pl-1 border-l-2 border-[#E55345]">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </ScrollUnfurl>

        {/* Section 7: Final Call to Action */}
        <ScrollUnfurl>
          {(active) => (
            <section className="py-20 sm:py-28 border-t border-[var(--border-subtle)]/10">
              <div className="bg-[#E55345] rounded-none p-10 sm:p-20 text-center relative overflow-hidden shadow-2xl border border-red-500/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-60 pointer-events-none" />
                <ShieldAlert size={48} className="mx-auto mb-6 text-[#0A0F1D]" />
                <h2
                  className="text-4xl sm:text-6xl font-black text-[#0A0F1D] mb-6 tracking-tight uppercase leading-[0.95]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Every day on paper<br />is a day you're guessing.
                </h2>
                <p className="text-[#0A0F1D]/85 mb-10 max-w-lg mx-auto font-bold text-base sm:text-lg">
                  <Typewriter text="Set up your shop in minutes. No card required to start." active={active} speed={15} />
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-3 bg-[var(--bg-app)] text-[var(--text-primary)] px-10 py-5 rounded-none font-black uppercase tracking-wider text-sm hover:bg-[var(--bg-surface)] hover:shadow-[0_10px_30px_rgba(10,15,29,0.4)] transition-all duration-300"
                >
                  Start Free Trial <ArrowUpRight size={18} />
                </Link>
              </div>
            </section>
          )}
        </ScrollUnfurl>
      </main>

      <footer className="border-t border-[var(--border-subtle)]/10 py-16 px-6 bg-[var(--bg-app)] relative z-20">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-3 gap-10 mb-12 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-6 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
                <span className="text-[#0D1527] font-extrabold text-xs" style={{ fontFamily: "var(--font-display)" }}>G</span>
              </div>
              <span className="font-extrabold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>GARRISON MARKET</span>
            </div>
            <p className="text-[var(--text-primary)]/40 text-xs leading-relaxed max-w-xs">
              One dashboard for stock, staff, and sales. Built for the shop floor.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-4" style={{ fontFamily: "var(--font-mono)" }}>
              Product
            </h4>
            <ul className="space-y-3 text-[var(--text-primary)]/60 font-semibold text-xs">
              <li><Link href="/login" className="hover:text-[var(--text-primary)] transition">Sign in</Link></li>
              <li><Link href="/login?plan=standard" className="hover:text-[var(--text-primary)] transition">Standard plan</Link></li>
              <li><Link href="/login?plan=pro" className="hover:text-[var(--text-primary)] transition">Pro plan</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-4" style={{ fontFamily: "var(--font-mono)" }}>
              Contact
            </h4>
            <p className="text-[var(--text-primary)]/60 text-xs leading-relaxed font-semibold">Replace this with your real support email / WhatsApp line.</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-[var(--border-subtle)]/5 text-center text-[var(--text-primary)]/30 text-xs font-semibold uppercase tracking-wider">
          &copy; {new Date().getFullYear()} Garrison Market. Built for the shop floor.
        </div>
      </footer>

      {/* Dynamic Scroll-driven physics style adjustments */}
      <style>{`
        .perspective-container {
          perspective: 1600px;
          perspective-origin: 50% 10%;
        }

        /* Scroll-triggered unrolling physics */
        .scroll-unfurl-element {
          transform-origin: top center;
          transition: transform 1.6s cubic-bezier(0.12, 0.9, 0.28, 1.01), 
                      opacity 1.4s ease-out, 
                      filter 1.2s ease-out;
          will-change: transform, opacity, filter;
        }

        /* Rolled State (Curled up inside the screen) */
        .scroll-unfurl-element.rolled {
          opacity: 0;
          transform: rotateX(-85deg) translateY(-60px) scaleY(0.4);
          filter: blur(6px) brightness(0.4);
        }

        /* Unrolled State (Drapes flat downwards) */
        .scroll-unfurl-element.unrolled {
          opacity: 1;
          transform: rotateX(0deg) translateY(0px) scaleY(1);
          filter: blur(0px) brightness(1);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }

        .hover-glitch:hover {
          text-shadow: 
            0.05em 0 0 rgba(229, 83, 69, 0.75),
            -0.025em -0.05em 0 rgba(0, 255, 200, 0.75),
            0.025em 0.05em 0 rgba(110, 0, 255, 0.75);
          animation: glitch 500ms infinite;
        }

        @keyframes glitch {
          0% { text-shadow: 0.05em 0 0 rgba(229, 83, 69, 0.75), -0.025em -0.05em 0 rgba(0, 255, 200, 0.75); }
          50% { text-shadow: -0.05em -0.025em 0 rgba(229, 83, 69, 0.75), 0.025em 0.025em 0 rgba(110, 0, 255, 0.75); }
          100% { text-shadow: -0.025em 0 0 rgba(229, 83, 69, 0.75), -0.025em -0.05em 0 rgba(0, 255, 200, 0.75); }
        }

        @media (prefers-reduced-motion: reduce) {
          .scroll-unfurl-element { 
            transition: none !important;
            transform: none !important;
            opacity: 1 !important;
            filter: none !important;
          }
        }
      `}</style>
    </div>
  );
}