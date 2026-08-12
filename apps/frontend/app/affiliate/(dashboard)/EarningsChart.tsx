// FILE: apps/frontend/app/affiliate/EarningsChart.tsx

"use client";

export default function EarningsChart({
  series,
  maxValue,
}: {
  series: { label: string; total: number }[];
  maxValue: number;
}) {
  const width = 600;
  const height = 110;
  const step = width / (series.length - 1 || 1);

  const points = series.map((m, i) => {
    const x = i * step;
    const y = height - (m.total / maxValue) * (height - 20) - 5;
    return { x, y, ...m };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `0,${height} ${polylinePoints} ${width},${height}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-[110px] block">
        <polyline points={polylinePoints} fill="none" stroke="var(--text-primary)" strokeWidth="2.5" />
        <polygon points={areaPoints} fill="var(--text-primary)" opacity="0.06" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 0} fill="#E8A33D" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] uppercase tracking-wider opacity-40 font-semibold mt-1 px-0.5">
        {series.map((m) => (
          <span key={m.label}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}