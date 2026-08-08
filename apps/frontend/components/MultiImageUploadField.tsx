"use client";

import { useRef } from "react";
import { UploadCloud } from "lucide-react";

const SLOT_LABELS = ["Main", "Image 2", "Image 3"];

export default function MultiImageUploadField({
  previews,
  onChange,
}: {
  /** Length-3 array of preview URLs (data: URLs for a newly picked file, or
   *  an existing https: URL when editing). Null = empty slot. */
  previews: (string | null)[];
  onChange: (index: number, file: File | null) => void;
}) {
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onChange(index, file);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Product Images</label>
      <div className="grid grid-cols-3 gap-3">
        {SLOT_LABELS.map((label, i) => (
          <div key={label}>
            <p className="text-[11px] text-slate-500 mb-1 text-center">{label}</p>
            <input
              type="file"
              ref={inputRefs[i]}
              onChange={(e) => handleFileChange(i, e)}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => inputRefs[i].current?.click()}
              className="aspect-square border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-[var(--bg-surface)] cursor-pointer transition-all relative overflow-hidden group"
            >
              {previews[i] ? (
                <div className="absolute inset-0 w-full h-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                  <img src={previews[i]!} alt={`${label} preview`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[var(--text-primary)] rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UploadCloud size={12} />
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={18} className="group-hover:text-blue-500 transition-colors" />
                  <span className="text-[10px] mt-1 text-center px-1">Add Image</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}