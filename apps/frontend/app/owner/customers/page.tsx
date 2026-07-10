import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import { Users, ArrowLeft, ShieldAlert, BookOpen, Clock, Sparkles } from "lucide-react";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export default function CustomerComingSoonPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[#0D1527] text-[#F1EEE3] flex flex-col`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Top Context Navigation */}
      <header className="border-b border-[#F1EEE3]/10 bg-[#0D1527]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#F1EEE3]/60 hover:text-[#F1EEE3] transition group"
          >
            <ArrowLeft size={16} className="transform group-hover:-translate-x-0.5 transition" />
            Back to Dashboard
          </Link>
          <div className="text-xs uppercase tracking-[0.2em] text-[#F1EEE3]/40" style={{ fontFamily: "var(--font-mono)" }}>
            Section // 04
          </div>
        </div>
      </header>

      {/* Main Focus Area */}
      <main className="flex-1 max-w-4xl mx-auto px-6 flex flex-col justify-center py-16 w-full">
        <section className="grid md:grid-cols-5 gap-12 items-center">

          {/* Text Information */}
          <div className="md:col-span-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E55345] mb-6"
                 style={{ fontFamily: "var(--font-mono)" }}>
              <Sparkles size={14} /> Feature Pipeline
            </div>

            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight text-[#F1EEE3] mb-6 uppercase leading-[1.05]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Customer Ledgers <br />
              <span className="text-[#F1EEE3]/40">Are on the way.</span>
            </h1>

            <p className="text-[#F1EEE3]/70 text-base leading-relaxed mb-8 max-w-md">
              We are building a clean, paperless ledger system to map every sale straight to a customer profile. No more manual notebooks or lost phone numbers.
            </p>

            <div className="h-[1px] w-full bg-dashed bg-[#F1EEE3]/10 mb-8" />

            {/* Feature Teasers */}
            <div className="space-y-4">
              {[
                {
                  icon: BookOpen,
                  title: "Debt & Credit Tracking",
                  desc: "Log part-payments and balances instantly. Know who owes what at a single glance.",
                },
                {
                  icon: Clock,
                  title: "Purchase Timelines",
                  desc: "See exactly what a customer bought last week or last month to personalize service.",
                },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="mt-1 p-2 rounded bg-[#16233D] border border-[#F1EEE3]/10 text-[#E55345]">
                    <item.icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F1EEE3]">{item.title}</h3>
                    <p className="text-xs text-[#F1EEE3]/60 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive UI Placeholder Card */}
          <div className="md:col-span-2 relative">
            <div className="bg-[#16233D] border border-[#F1EEE3]/10 rounded-sm p-6 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)]">

              {/* Card Header styling mimicking real app module */}
              <div className="flex items-center justify-between pb-4 border-b border-dashed border-[#F1EEE3]/10 mb-6">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#F1EEE3]/40" />
                  <span className="text-xs uppercase font-medium tracking-wider text-[#F1EEE3]/60" style={{ fontFamily: "var(--font-mono)" }}>
                    Directory_v2
                  </span>
                </div>
                <span className="h-2 w-2 rounded-full bg-[#E55345] animate-pulse" />
              </div>

              {/* Wireframe lines mimicking hidden content */}
              <div className="space-y-4 opacity-25 select-none pointer-events-none">
                <div className="h-4 bg-[#F1EEE3] rounded-sm w-2/3" />
                <div className="h-3 bg-[#F1EEE3] rounded-sm w-1/2" />
                <div className="space-y-2 pt-2">
                  <div className="h-8 bg-[#0D1527] rounded-sm w-full" />
                  <div className="h-8 bg-[#0D1527] rounded-sm w-full" />
                  <div className="h-8 bg-[#0D1527] rounded-sm w-full" />
                </div>
              </div>

              {/* Overlay Announcement Badge */}
              <div className="absolute inset-0 bg-[#16233D]/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                <div className="h-10 w-10 rounded-full bg-[#0D1527] border border-[#F1EEE3]/10 flex items-center justify-center mb-3 shadow-md">
                  <ShieldAlert size={18} className="text-[#E55345]" />
                </div>
                <div className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                  Under Construction
                </div>
                <p className="text-[11px] text-[#F1EEE3]/60 max-w-[180px] leading-normal">
                  This workspace module is currently being compiled.
                </p>
              </div>

            </div>

            {/* Decorative accent details behind the card */}
            <div className="absolute -bottom-2 -right-2 h-full w-full border border-dashed border-[#F1EEE3]/5 rounded-sm -z-10 pointer-events-none" />
          </div>

        </section>
      </main>

      {/* Simplified Footer matching branding */}
      <footer className="py-8 text-center text-[#F1EEE3]/30 text-xs border-t border-[#F1EEE3]/5">
        Garrison Market Core // Customer Module Pipeline
      </footer>
    </div>
  );
}
