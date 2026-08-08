"use client";

import { useEffect, useState } from "react";
import { X, Plus, Check, Ban, Tag, Loader2 } from "lucide-react";
import { getProductCategories, createProductCategoryAction } from "@/lib/category.actions";

type CategoryOption = { id: number; name: string; itemCount: number };

export default function CategoryPickerModal({
  selectedCategoryId,
  onSelect,
  onClose,
}: {
  selectedCategoryId: number | null;
  onSelect: (id: number | null, name: string | null) => void;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductCategories().then((list) => {
      if (!cancelled) {
        setCategories(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddCategory = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    const result = await createProductCategoryAction(trimmed);
    setAdding(false);
    if (!result.success) {
      setAddError(result.error);
      return;
    }
    setCategories((prev) => [...prev, result.category].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setShowAddForm(false);
    // Select it immediately — the whole point of adding one mid-flow is to use it right away.
    onSelect(result.category.id, result.category.name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-picker-title"
    >
      <div className="w-full sm:max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-2xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom sm:zoom-in duration-200">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Tag size={16} className="text-blue-500" />
            </div>
            <h2 id="category-picker-title" className="text-base font-bold text-[var(--text-primary)]">
              Select Category
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-1">
          {showAddForm ? (
            <div className="mb-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name"
                className="w-full bg-[var(--bg-app)] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              {addError && <p className="text-xs text-rose-500 font-semibold">{addError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={adding || !newName.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white text-xs font-bold transition-colors"
                >
                  {adding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName("");
                    setAddError(null);
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[var(--text-primary)] text-xs font-bold hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-3 rounded-xl border-2 border-dashed border-blue-500/40 text-blue-500 text-sm font-bold hover:bg-blue-500/5 transition-colors"
            >
              <Plus size={16} /> Add New Category
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelect(null, null)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
          >
            <div className="h-9 w-9 rounded-xl bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
              <Ban size={16} />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-[var(--text-primary)]">No Category</span>
            {selectedCategoryId === null && <Check size={18} className="text-emerald-500 shrink-0" />}
          </button>

          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id, cat.name)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-500">
                  <Tag size={16} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{cat.name}</p>
                  <p className="text-[11px] text-slate-500">{cat.itemCount} item{cat.itemCount === 1 ? "" : "s"}</p>
                </div>
                {selectedCategoryId === cat.id && <Check size={18} className="text-emerald-500 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}