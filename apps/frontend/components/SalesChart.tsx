"use client";
import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Award, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function SalesDashboard({ 
  data, 
  analyticsData = [] 
}: { 
  data: any[]; 
  analyticsData?: any[]; 
}) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'summary'>('bar');

  // Existing chart logic
  const processedData = useMemo(() => {
    let baseData: any[] = [];
    if (view === 'day') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      baseData = days.map(d => ({ name: d, sales: 0, fullDate: d, dayName: d }));
    } else if (view === 'week') {
      baseData = Array.from({ length: 5 }, (_, i) => ({ name: `Wk ${i + 1}`, sales: 0, fullDate: `Week ${i + 1}` }));
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      baseData = months.map(m => ({ name: m, sales: 0, fullDate: m, monthName: m }));
    }

    data.forEach(d => {
      const dateObj = new Date(d.date);
      if (isNaN(dateObj.getTime())) return;
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      let key = view === 'day' ? dayName : view === 'week' ? `Wk ${Math.ceil(dateObj.getDate() / 7)}` : dateObj.toLocaleDateString('en-US', { month: 'short' });
      const found = baseData.find(item => item.name === key);
      if (found) found.sales += Number(d.total);
    });
    return baseData;
  }, [data, view]);

  const totalSales = useMemo(() => processedData.reduce((acc, curr) => acc + curr.sales, 0), [processedData]);

  // ── ADVANCED ANALYTICS ENGINE ──
  const analytics = useMemo(() => {
    const staffMap: Record<string, { revenue: number; orders: number }> = {};
    const productMap: Record<number, { name: string; unitsSold: number; revenue: number; currentStock: number; restockLevel: number | null }> = {};
    let unattributedSalesVolume = 0;

    analyticsData.forEach(item => {
      const qty = item.quantity || 0;
      const price = Number(item.priceAtTime || 0);
      const totalItemRevenue = qty * price;

      // 1. Staff Evaluation
      const staffName = item.order?.staff?.fullName || "Owner / Unattributed Account";
      if (!item.order?.staff?.fullName) unattributedSalesVolume += totalItemRevenue;
      
      if (!staffMap[staffName]) staffMap[staffName] = { revenue: 0, orders: 0 };
      staffMap[staffName].revenue += totalItemRevenue;
      staffMap[staffName].orders += 1;

      // 2. Product Matrix Evaluation
      const invId = item.inventoryId;
      if (invId) {
        if (!productMap[invId] && item.inventory) {
          productMap[invId] = {
            name: item.inventory.name || `Product ID: ${invId}`,
            unitsSold: 0,
            revenue: 0,
            currentStock: item.inventory.quantity || 0,
            restockLevel: item.inventory.restockLevel ?? null
          };
        }
        if (productMap[invId]) {
          productMap[invId].unitsSold += qty;
          productMap[invId].revenue += totalItemRevenue;
        }
      }
    });

    // Compile & Rank items
    const staffRanking = Object.entries(staffMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    const productRanking = Object.values(productMap);
    const topProducts = [...productRanking].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const lowProducts = [...productRanking].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);

    // Contextual Audit & Error Catching
    const errors: string[] = [];
    const solutions: string[] = [];

    if (unattributedSalesVolume > totalSales * 0.25 && totalSales > 0) {
      errors.push(`High Unattributed Volume: Over 25% of recent store sales are processed under admin/owner fallbacks instead of unique staff handles.`);
      solutions.push(`Enforce individual shift terminal pin logins for your sales team to stop internal inventory shrinkage or untrackable register balancing errors.`);
    }

    const highDemandStockout = topProducts.some(p => p.currentStock <= (p.restockLevel || 0));
    if (highDemandStockout) {
      errors.push(`Stock Shortage Crisis: One or more of your top 5 best-selling core products have fallen below safe inventory buffers.`);
      solutions.push(`Set up an emergency restock order or configure proactive vendor automated workflows for high-velocity items immediately.`);
    }

    const deadStockCount = lowProducts.filter(p => p.unitsSold === 0 || (p.revenue < totalSales * 0.02)).length;
    if (deadStockCount >= 3 && productRanking.length > 8) {
      errors.push(`Dead Capital Binding: At least 3 products are exhibiting critically low market velocities, tying up free working cash flow.`);
      solutions.push(`Run a targeted clearance promotional bundling scheme with top performing inventory to turn stale assets back into active cash.`);
    }

    return {
      bestStaff: staffRanking[0] || { name: "No records found", revenue: 0, orders: 0 },
      topProducts,
      lowProducts,
      errors,
      solutions
    };
  }, [analyticsData, totalSales]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-app)] border border-slate-300 dark:border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-sm font-bold text-[var(--text-primary)] mb-1">₦{payload[0].value.toLocaleString()}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{view === 'day' ? 'Daily Sales Total' : view === 'week' ? 'Weekly Output' : 'Monthly Accumulation'}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-8">
      {/* Chart Headers Control Structure */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Performance Metrics</h3>
          <p className="text-xs text-slate-500">Visual data analytics and cross-system audits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-full border border-slate-200/40 dark:border-slate-800/40">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${view === v ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}>{v}</button>
            ))}
          </div>
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-full border border-slate-200/40 dark:border-slate-800/40">
            {(['bar', 'line', 'summary'] as const).map((v) => (
              <button key={v} onClick={() => setChartType(v)} className={`px-4 py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${chartType === v ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-white'}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Conditional Render Viewport */}
      {chartType !== 'summary' ? (
        /* Regular Chart Display Mode */
        <div className="h-64 w-full bg-slate-50/20 dark:bg-slate-950/20 rounded-2xl p-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={processedData}>
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={customTooltip} cursor={{ fill: '#1e293b', opacity: 0.3 }} />
                <Bar dataKey="sales" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={processedData}>
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip content={customTooltip} />
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        /* Expanded Summary Dashboard Mode */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Main Total Summary Card */}
          <div className="flex flex-col justify-center items-center py-8 px-6 text-center bg-slate-50/40 dark:bg-slate-950/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Total {view} Turnover</h4>
            <p className="text-4xl font-black text-[var(--text-primary)] tracking-tight">₦{totalSales.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">Aggregated processing tracking for the configured dashboard view boundaries.</p>
          </div>

          {/* ── CORE BUSINESS INTELLIGENCE PANELS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Panel 1: Top Staff Tracker */}
            <div className="p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <Award size={18} />
                  <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300">Top Monthly Attributed Staff</h4>
                </div>
                <p className="text-lg font-bold text-[var(--text-primary)] truncate">{analytics.bestStaff.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Generated <span className="text-emerald-400 font-semibold">₦{analytics.bestStaff.revenue.toLocaleString()}</span> across {analytics.bestStaff.orders} custom invoice records.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 text-[11px] text-slate-500">
                Ranks performance by gross counter receipts.
              </div>
            </div>

            {/* Panel 2: Best Selling Catalog Products */}
            <div className="p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/30">
              <div className="flex items-center gap-2 text-blue-400 mb-3">
                <TrendingUp size={18} />
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300">Top 5 Best-Selling Lines</h4>
              </div>
              <div className="space-y-2.5">
                {analytics.topProducts.length > 0 ? (
                  analytics.topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs min-w-0 gap-2">
                      <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{p.name}</span>
                      <span className="font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded shrink-0 font-bold">
                        {p.unitsSold} units
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 dark:text-slate-600 text-xs py-2">No product logs parsed.</p>
                )}
              </div>
            </div>

            {/* Panel 3: Low Velocity Risk Products */}
            <div className="p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/30">
              <div className="flex items-center gap-2 text-rose-400 mb-3">
                <TrendingDown size={18} />
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300">Bottom 5 Low-Velocity items</h4>
              </div>
              <div className="space-y-2.5">
                {analytics.lowProducts.length > 0 ? (
                  analytics.lowProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs min-w-0 gap-2">
                      <span className="text-slate-700 dark:text-slate-300 truncate font-medium">{p.name}</span>
                      <span className="font-mono bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded shrink-0 font-bold">
                        {p.unitsSold} sold
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 dark:text-slate-600 text-xs py-2">No low velocity lines logged.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── DIAGNOSTICS & SYSTEM AUDIT ENGINE ── */}
          <div className="p-6 rounded-xl border border-amber-500/10 bg-gradient-to-b from-amber-500/[0.02] to-transparent space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert size={18} />
              <h4 className="text-sm font-bold tracking-wide">Deep Store Diagnostic Audit</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Detected Bottlenecks List */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Detected Irregularities</p>
                {analytics.errors.length > 0 ? (
                  analytics.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50/40 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-100 dark:border-slate-900">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      <p>{err}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/10 p-3 rounded-lg border border-emerald-900/30">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <p>Data audit clean. No structural anomalies detected in current processing stream.</p>
                  </div>
                )}
              </div>

              {/* Business Solutions Panel */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Recommended Actions</p>
                {analytics.solutions.length > 0 ? (
                  analytics.solutions.map((sol, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-blue-950/10 p-3 rounded-lg border border-blue-900/30">
                      <CheckCircle2 size={15} className="text-blue-400 shrink-0 mt-0.5" />
                      <p>{sol}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic p-3">Maintain active operational protocols. Monitor stock adjustments closely next week.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}