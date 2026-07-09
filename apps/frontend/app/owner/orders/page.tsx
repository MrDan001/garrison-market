import React from 'react';

export default function OwnerOrdersComingSoon() {
  return (
    <div className="min-h-screen bg-[#0b101b] flex items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-[#131b2e] border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        
        {/* Icon / Badge */}
        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 text-2xl font-bold">
          📦
        </div>

        {/* Headings */}
        <span className="text-xs font-semibold tracking-widest text-blue-400 uppercase bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/50">
          Work in Progress
        </span>
        <h1 className="text-2xl font-bold mt-4 mb-2 text-slate-100">
          Order Management
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          We are currently building a powerful dashboard for you to track, manage, and fulfill customer orders. This feature will be launching soon!
        </p>

        {/* Action Button */}
        <a
          href="/owner/dashboard"
          className="inline-block w-full py-3 px-4 bg-slate-100 hover:bg-white text-slate-900 font-semibold rounded-xl transition duration-200 text-sm shadow-sm"
        >
          Return to Dashboard
        </a>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-xs text-slate-500">
          &copy; 2026 GARRISON MARKET
        </div>

      </div>
    </div>
  );
}