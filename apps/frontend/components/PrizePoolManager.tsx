// FILE: apps/frontend/components/PrizePoolManager.tsx (NEW FILE — Fix C3)
//
// Self-fetching client component, same pattern as ClockInOutCard etc.
// Handles the full CRUD loop for a store's spin prize pool. Kept as one
// component rather than splitting list/form apart — the form only ever
// edits one prize at a time and the interactions are simple enough that
// splitting it out would add indirection without real benefit.

"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import type { SpinPrizeOption } from "@prisma/client";
import {
  listPrizeOptions,
  createPrizeOption,
  updatePrizeOption,
  deletePrizeOption,
  type PrizeOptionInput,
} from "@/lib/rush-prizes.actions";

type PrizeOption = SpinPrizeOption;

const KIND_LABELS: Record<string, string> = {
  xp_boost: "XP Boost",
  badge: "Badge / Title",
  streak_shield: "Streak Shield",
  cash: "Cash",
  gift: "Gift",
};

const EMPTY_FORM: PrizeOptionInput = {
  label: "",
  kind: "badge",
  xpAmount: null,
  cashAmount: null,
  giftDescription: null,
  weight: 10,
  active: true,
};

function describeValue(prize: PrizeOption): string | null {
  if (!prize) return null;
  if (prize.kind === "xp_boost") return `+${prize.xpAmount ?? 0} XP`;
  if (prize.kind === "cash") return `₦${(prize.cashAmount ?? 0).toLocaleString()}`;
  if (prize.kind === "gift") return prize.giftDescription;
  return null;
}

export default function PrizePoolManager() {
  const [prizes, setPrizes] = useState<PrizeOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PrizeOptionInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  async function refresh() {
    const result = await listPrizeOptions();
    setPrizes(result);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(prize: NonNullable<PrizeOption>) {
    setEditingId(prize.id);
    setForm({
      label: prize.label,
      kind: prize.kind as PrizeOptionInput["kind"],
      xpAmount: prize.xpAmount,
      cashAmount: prize.cashAmount,
      giftDescription: prize.giftDescription,
      weight: prize.weight,
      active: prize.active,
    });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setError(null);
  }

  function handleSave() {
    startTransition(async () => {
      const result = editingId ? await updatePrizeOption(editingId, form) : await createPrizeOption(form);
      if (result.success) {
        closeForm();
        await refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete(id: number) {
    setListError(null);
    startTransition(async () => {
      const result = await deletePrizeOption(id);
      if (!result.success) setListError(result.error ?? "Couldn't delete that prize.");
      await refresh();
    });
  }

  function handleToggleActive(prize: NonNullable<PrizeOption>) {
    setListError(null);
    startTransition(async () => {
      const result = await updatePrizeOption(prize.id, {
        label: prize.label,
        kind: prize.kind as PrizeOptionInput["kind"],
        xpAmount: prize.xpAmount,
        cashAmount: prize.cashAmount,
        giftDescription: prize.giftDescription,
        weight: prize.weight,
        active: !prize.active,
      });
      if (!result.success) setListError(result.error ?? "Couldn't update that prize.");
      await refresh();
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-4" />
        <div className="h-16 w-full bg-white/10 rounded-xl mb-3" />
        <div className="h-16 w-full bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (!prizes) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-sm text-fuchsia-200/70">
        Couldn't load the prize pool.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-fuchsia-300" /> Spin Prize Pool
        </h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-fuchsia-300/15 text-fuchsia-200 hover:bg-fuchsia-300/25 transition-colors"
        >
          <Plus size={14} /> Add Prize
        </button>
      </div>
      <p className="text-xs text-fuchsia-200/70 mb-4">
        Every prize staff can win from the daily spin. Cash and gift prizes need to be settled with staff manually —
        see Settlements.
      </p>

      {listError && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-2.5 mb-3">
          {listError}
        </p>
      )}

      <div className="space-y-2">
        {prizes.map((prize) => (
          <div
            key={prize.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              prize.active ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-white/[0.02] opacity-50"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{prize.label}</p>
              <p className="text-[11px] text-fuchsia-200/60">
                {KIND_LABELS[prize.kind]}
                {describeValue(prize) ? ` · ${describeValue(prize)}` : ""} · weight {prize.weight}
                {!prize.active && " · off the wheel"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleActive(prize)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                {prize.active ? "Turn off" : "Turn on"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => openEditForm(prize)}
                className="p-1.5 rounded-lg text-fuchsia-200 hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Edit prize"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDelete(prize.id)}
                className="p-1.5 rounded-lg text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                aria-label="Delete prize"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="mt-4 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/[0.06] p-4 space-y-3">
          <p className="text-xs font-bold text-fuchsia-200 uppercase tracking-wider">
            {editingId ? "Edit prize" : "New prize"}
          </p>

          <div>
            <label className="block text-[11px] text-fuchsia-200/70 mb-1">Name</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. ₦2,000 Cash Prize"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
            />
          </div>

          <div>
            <label className="block text-[11px] text-fuchsia-200/70 mb-1">Type</label>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as PrizeOptionInput["kind"] })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
            >
              <option value="badge" className="bg-slate-900">Badge / Title</option>
              <option value="xp_boost" className="bg-slate-900">XP Boost</option>
              <option value="streak_shield" className="bg-slate-900">Streak Shield</option>
              <option value="cash" className="bg-slate-900">Cash</option>
              <option value="gift" className="bg-slate-900">Gift</option>
            </select>
          </div>

          {form.kind === "xp_boost" && (
            <div>
              <label className="block text-[11px] text-fuchsia-200/70 mb-1">XP amount</label>
              <input
                type="number"
                min={1}
                value={form.xpAmount ?? ""}
                onChange={(e) => setForm({ ...form, xpAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
              />
            </div>
          )}

          {form.kind === "cash" && (
            <div>
              <label className="block text-[11px] text-fuchsia-200/70 mb-1">Amount (₦)</label>
              <input
                type="number"
                min={1}
                value={form.cashAmount ?? ""}
                onChange={(e) => setForm({ ...form, cashAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
              />
            </div>
          )}

          {form.kind === "gift" && (
            <div>
              <label className="block text-[11px] text-fuchsia-200/70 mb-1">Gift description</label>
              <input
                type="text"
                value={form.giftDescription ?? ""}
                onChange={(e) => setForm({ ...form, giftDescription: e.target.value })}
                placeholder="e.g. Bag of rice"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-fuchsia-200/70 mb-1">Odds weight (higher = more common)</label>
            <input
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-300/50"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-fuchsia-200/80">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-white/20"
            />
            On the wheel
          </label>

          {error && <p className="text-xs text-red-300">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-fuchsia-300/15 text-fuchsia-200 hover:bg-fuchsia-300/25 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}