// FILE: apps/frontend/app/affiliate/promote/QRCodeCard.tsx
//
// Needs a new dependency: `npm install qrcode` (and `npm install -D
// @types/qrcode` for TS). Nothing else in the codebase generates QR
// codes, so this is the one new package this whole feature needs.

"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeCard({ link }: { link: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      link,
      { width: 220, margin: 2, color: { dark: "#16233D", light: "#F1EEE3" } },
      (err) => setReady(!err)
    );
  }, [link]);

  function handleDownload() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "garrison-market-affiliate-qr.png";
    a.click();
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/15 p-5 flex items-center gap-5 flex-wrap">
      <canvas ref={canvasRef} className="rounded-lg border border-[var(--border-subtle)]/10" />
      <div className="flex-1 min-w-[180px]">
        <div className="text-[11px] uppercase tracking-widest opacity-50 font-bold mb-1">QR code</div>
        <p className="text-sm opacity-60 mb-3">Print it and paste it at your stall — anyone who scans it lands straight on your link.</p>
        <button
          onClick={handleDownload}
          disabled={!ready}
          className="bg-[var(--text-primary)] text-[var(--bg-app)] px-4 py-2.5 rounded-xl text-xs font-semibold hover:opacity-85 transition disabled:opacity-40"
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}