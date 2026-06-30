"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calendar, ShieldCheck } from "lucide-react";

export default function HistoryList({ reports = [] }: { reports?: any[] }) {
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>({});

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const parseReportContent = (content: string) => {
    if (!content) return { items: [], notes: "No content available.", totalSales: 0 };

    // 1. Extract total sales from the content string (e.g., "TOTAL SALES: ₦1,050")
    const totalMatch = content.match(/TOTAL SALES:\s*₦?\s*([\d,]+)/i);
    const totalSales = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : 0;

    // 2. Clean content for items/notes parsing
    const cleanedContent = content.replace(/TOTAL SALES:\s*₦?[\d,]+\.?\s*/i, "");
    
    const itemsSegmentMatch = cleanedContent.match(/ITEMS:\s*(.*?)\.\s*NOTES:/i);
    let parsedItems: any[] = [];
    
    if (itemsSegmentMatch) {
      const rawItems = itemsSegmentMatch[1].split(" | ");
      parsedItems = rawItems.map((itemStr) => {
        const namePart = itemStr.split(" (")[0];
        // Clean prices by removing non-numeric chars
        const priceRaw = itemStr.match(/Price:\s*₦([\d,]+)/)?.[1] || "0";
        const qtyRaw = itemStr.match(/Qty:\s*(\d+)/)?.[1] || "1";
        const totalRaw = itemStr.match(/Total:\s*₦([\d,]+)/)?.[1] || "0";
        
        return { 
          name: namePart, 
          price: priceRaw.replace(/,/g, ''), 
          quantity: qtyRaw, 
          total: totalRaw.replace(/,/g, '') 
        };
      });
    }

    const notesMatch = content.match(/NOTES:\s*([\s\S]*)$/i);
    let cleanNotes = notesMatch ? notesMatch[1].replace(/ITEMS:[\s\S]*?NOTES:/gi, "").trim() : "No feedback provided.";
    
    return { 
      items: parsedItems, 
      notes: cleanNotes.replace(/^NOTES:\s*/i, "").trim(),
      totalSales 
    };
  };

  const safeReports = reports || [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {safeReports.length > 0 ? (
        safeReports.map((report) => {
          const isExpanded = !!expandedRows[report.id];
          const parsed = parseReportContent(report.content || "");

          return (
            <div key={report.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div onClick={() => toggleRow(report.id)} className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-semibold">
                    {report.author?.fullName?.charAt(0) || "S"}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{report.author?.fullName || "Staff"}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={12} /> {new Date(report.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${report.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {report.status}
                </span>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-900 bg-[#0f111a] p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-7 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Report Narrative</h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#131622]">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-[#161a29] text-slate-400 uppercase">
                          <tr><th className="p-3">Item</th><th className="p-3 text-center">Price</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {parsed.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-3">{item.name}</td>
                              <td className="p-3 text-center">₦{Number(item.price).toLocaleString()}</td>
                              <td className="p-3 text-center font-bold text-blue-400">{item.quantity}</td>
                              <td className="p-3 text-right font-bold text-white">₦{Number(item.total).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mt-4">Staff Feedback</h4>
                    <div className="p-3 bg-[#090a10] border border-slate-800 rounded-xl text-xs text-slate-300">{parsed.notes}</div>
                  </div>

                  <div className="md:col-span-5 bg-gradient-to-br from-[#141829] to-[#0d0f18] p-5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><ShieldCheck size={13} /> Finalized Audit</span>
                    <div className="mt-4">
                      <p className="text-xs text-slate-400">Total Audited Sales</p>
                      {/* Using the parsed totalSales instead of report.staffTotalSales */}
                      <p className="text-3xl font-black text-white">₦{parsed.totalSales.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          No reports found.
        </div>
      )}
    </div>
  );
}