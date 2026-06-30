"use client";
import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function SalesDashboard({ data }: { data: any[] }) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'summary'>('bar');

  const processedData = useMemo(() => {
    let baseData: any[] = [];

    if (view === 'day') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      baseData = days.map(d => ({ name: d, sales: 0, fullDate: d, dayName: d }));
    } else if (view === 'week') {
      baseData = Array.from({ length: 5 }, (_, i) => ({ 
        name: `Wk ${i + 1}`, sales: 0, fullDate: `Week ${i + 1}` 
      }));
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      baseData = months.map(m => ({ name: m, sales: 0, fullDate: m, monthName: m }));
    }

    data.forEach(d => {
      const dateObj = new Date(d.date);
      if (isNaN(dateObj.getTime())) return;

      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });

      let key = "";
      if (view === 'day') key = dayName;
      else if (view === 'week') key = `Wk ${Math.ceil(dateObj.getDate() / 7)}`;
      else key = dateObj.toLocaleDateString('en-US', { month: 'short' });

      const found = baseData.find(item => item.name === key);
      if (found) {
        found.sales += Number(d.total);
        found.dayName = dayName;
        found.date = dateStr;
        found.month = monthName;
      }
    });
    return baseData;
  }, [data, view]);

  const totalSales = useMemo(() => processedData.reduce((acc, curr) => acc + curr.sales, 0), [processedData]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#0f1117] border border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-sm font-bold text-white mb-1">₦{item.sales.toLocaleString()}</p>
          <p className="text-xs text-slate-400">
            {view === 'day' && item.date}
            {view === 'week' && `${item.dayName || ''} - ${item.date || ''}`}
            {view === 'month' && `${item.month || ''} ${new Date().getFullYear()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex bg-slate-950 p-1 rounded-full">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 text-xs font-semibold rounded-full capitalize ${view === v ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{v}</button>
          ))}
        </div>
        <div className="flex bg-slate-950 p-1 rounded-full">
          {(['bar', 'line', 'summary'] as const).map((v) => (
            <button key={v} onClick={() => setChartType(v)} className={`px-4 py-1.5 text-xs font-semibold rounded-full capitalize ${chartType === v ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={customTooltip} cursor={{ fill: '#1e293b' }} />
              <Bar dataKey="sales" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {chartType === 'line' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={customTooltip} />
              <Line type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {chartType === 'summary' && (
          <div className="flex flex-col justify-center items-center h-full p-6 text-center bg-slate-900/50 rounded-3xl border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-2">Business Summary</h3>
            <p className="text-slate-400 text-sm">
              Your store has generated a total of <span className="text-indigo-400 font-bold">₦{totalSales.toLocaleString()}</span> in sales for this {view} period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}