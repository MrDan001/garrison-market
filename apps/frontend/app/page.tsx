export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import Link from "next/link";
import { ShieldCheck, Terminal, ArrowRight, Database, BarChart3, ShieldAlert, ChevronRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050608] text-slate-200 selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050608]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Terminal size={16} className="text-white" />
            </div>
            <span className="font-bold text-white tracking-wider">GARRISON</span>
          </div>
          <Link href="/login" className="text-sm font-medium hover:text-indigo-400 transition">Sign In</Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-24">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-8">
            <ShieldCheck size={14} /> Enterprise Terminal Ecosystem
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight">
            Manage Inventories With <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400">Absolute Control.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
            A hardened, decentralized terminal architecture for real-time store metrics, automated audit trails, and instant authorization.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all hover:scale-105">
            Launch System Terminal <ArrowRight size={18} />
          </Link>
        </section>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-24">
          <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02]">
            <Database className="text-indigo-400 mb-4" size={32} />
            <h3 className="text-xl font-bold text-white mb-2">Immutable Infrastructure</h3>
            <p className="text-slate-400">Every operation is cryptographically logged and stored across a decentralized node network.</p>
          </div>
          <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02]">
            <BarChart3 className="text-pink-400 mb-4" size={32} />
            <h3 className="text-xl font-bold text-white mb-2">Real-Time Metrics</h3>
            <p className="text-slate-400">Track catalog consistency and terminal throughput with sub-second latency.</p>
          </div>
        </div>

        {/* Pricing Table */}
       {/* Pricing Table */}
       <section className="border border-white/5 rounded-3xl p-8 md:p-12 bg-gradient-to-b from-white/[0.03] to-transparent">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">Enterprise Deployment</h2>
          
          {/* Centered 2-column grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              { title: "Standard", price: "₦25,000", features: ["10 Items", "1 Staff", "Manage Staff"] },
              { title: "Pro", price: "₦35,000", features: ["20 Items", "2 Staffs", "Manage Full Staff"] },
            ].map((plan) => (
              <div key={plan.title} className="bg-[#0A0C10] p-8 rounded-2xl border border-white/5 flex flex-col gap-6">
                <div>
                  <div className="text-slate-400 mb-1">{plan.title}</div>
                  <div className="text-4xl font-bold text-white">{plan.price}<span className="text-sm font-normal text-slate-500">/mo</span></div>
                </div>
                <ul className="space-y-4 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="text-sm flex items-center gap-3 text-slate-300">
                      <ChevronRight size={16} className="text-indigo-500"/> {f}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-4 rounded-xl border border-white/10 hover:bg-white hover:text-black font-semibold transition">
                  Select Plan
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="py-12 text-center text-slate-600 text-sm border-t border-white/5">
        &copy; {new Date().getFullYear()} Garrison Market Inc. All terminal operations are fully audited.
      </footer>
    </div>
  );
}