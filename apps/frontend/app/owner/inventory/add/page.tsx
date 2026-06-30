import { addItemAction } from "@/lib/business.actions";
import { ArrowLeft, Package, Plus } from "lucide-react";
import Link from "next/link";

export default function AddInventoryItemPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#0f1117]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center gap-3">
        <Link
          href="/owner/inventory"
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors shrink-0"
          title="Back to Inventory"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <Package size={17} className="text-blue-500 shrink-0" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white leading-tight">
              Add New Item
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-tight">
              Add a product to your inventory
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 sm:px-8 py-8 sm:py-12">
        <form
          action={addItemAction}
          className="max-w-lg mx-auto bg-slate-900/40 border border-slate-800 p-6 sm:p-8 rounded-2xl space-y-5"
        >
          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Item Name
            </label>
            <input
              name="name"
              placeholder="e.g. Bottled Water"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-600 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-colors"
              required
            />
          </div>

          {/* Quantity + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Quantity
              </label>
              <input
                name="quantity"
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-600 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Price (₦)
              </label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-600 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-colors"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 py-3 rounded-xl font-bold text-sm text-white transition-colors mt-2"
          >
            <Plus size={16} />
            Save Item
          </button>
        </form>
      </div>
    </div>
  );
}
