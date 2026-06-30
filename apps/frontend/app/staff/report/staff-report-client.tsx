"use client";
import { useState } from "react";
import { submitDailyReport } from "@/lib/business.actions";
import { FileText, Clock, ChevronDown, ChevronUp } from "lucide-react";

export default function StaffReportClient({ staffId, reports, sales }: any) {
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const allSoldItems = sales.flatMap((s: any) => s.items);
  const totalValue = sales.reduce((sum: number, s: any) => sum + Number(s.total), 0);

  const handleSubmit = async () => {
    if (!complaint.trim()) {
      alert("Please enter your report notes before submitting.");
      return;
    }

    setLoading(true);

    const itemizedList = allSoldItems
      .map((i: any) => `${i.inventory?.name} (Price: ₦${Number(i.priceAtTime).toLocaleString()}, Qty: ${i.quantity}, Total: ₦${(Number(i.priceAtTime) * i.quantity).toLocaleString()})`)
      .join(" | ");

    const content = `TOTAL SALES: ₦${totalValue.toLocaleString()}. ITEMS: ${itemizedList}. NOTES: ${complaint}`;

    try {
      await submitDailyReport(staffId, content);
      setComplaint("");
      window.location.reload();
    } catch (e) {
      alert("Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case 'declined': return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      default: return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-5 sm:p-6 text-center shadow-lg shadow-blue-900/20">
        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Total Sales Today</p>
        <h1 className="text-3xl sm:text-5xl font-bold text-white mt-2">₦{totalValue.toLocaleString()}</h1>
      </div>

      <div className="bg-[#11131a] border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-5 sm:mb-6">Daily Summary & Submission</h2>

        <div className="space-y-5 sm:space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Itemized List</label>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-2">
              {allSoldItems.length === 0 && (
                <p className="text-slate-500 text-sm italic p-3">No sales yet today.</p>
              )}
              {allSoldItems.map((item: any, idx: number) => (
                <div key={idx} className="bg-[#0a0c10] border border-slate-700 rounded-xl p-3 flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{item.inventory?.name || "N/A"}</p>
                    <p className="text-xs text-slate-500">₦{Number(item.priceAtTime).toLocaleString()} × {item.quantity}</p>
                  </div>
                  <span className="font-bold text-white text-sm shrink-0 ml-3">
                    ₦{(Number(item.priceAtTime) * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-[#0a0c10] border border-slate-700 rounded-2xl p-4 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="pb-3 px-2">Item</th>
                    <th className="pb-3 px-2">Price</th>
                    <th className="pb-3 px-2">Qty</th>
                    <th className="pb-3 px-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allSoldItems.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                      <td className="py-3 px-2">{item.inventory?.name || "N/A"}</td>
                      <td className="py-3 px-2">₦{Number(item.priceAtTime).toLocaleString()}</td>
                      <td className="py-3 px-2">{item.quantity}</td>
                      <td className="py-3 px-2 font-bold text-white">₦{(Number(item.priceAtTime) * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <textarea
            className="w-full h-24 bg-[#0a0c10] border border-slate-700 rounded-2xl p-4 text-slate-200 outline-none focus:border-blue-500 transition-colors"
            placeholder="Type your notes here..."
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 sm:py-5 bg-white hover:bg-slate-200 active:scale-[0.98] disabled:bg-slate-800 text-black rounded-2xl font-bold transition-all"
          >
            {loading ? "Submitting..." : "Submit Full Daily Report"}
          </button>
        </div>
      </div>

      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full py-4 flex items-center justify-center gap-2 bg-[#11131a] border border-slate-800 rounded-2xl font-semibold text-slate-400 hover:text-white active:scale-[0.98] transition-all"
      >
        {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        {showHistory ? "Hide Report History" : "View Report History"}
      </button>

      {showHistory && (
        <div className="space-y-3 animate-in fade-in duration-500">
          {reports.length === 0 && (
            <p className="text-slate-500 text-sm italic text-center py-4">No reports submitted today.</p>
          )}
          {reports.map((r: any) => (
            <div key={r.id} className="bg-[#11131a] p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-300 leading-tight line-clamp-3 sm:line-clamp-none">{r.content}</p>
                  <p className="text-[9px] text-slate-500 mt-1"><Clock size={10} className="inline mr-1" /> {new Date(r.date).toLocaleTimeString()}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-[9px] font-bold border shrink-0 ${getStatusStyle(r.status)}`}>
                {r.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}