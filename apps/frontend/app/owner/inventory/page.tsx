import { Package, Plus, Trash2, Minus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { updateInventoryQuantity } from "@/lib/business.actions";

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') redirect("/login");

  const items = await prisma.inventory.findMany({
    where: { ownerId: session.id },
    orderBy: { name: "asc" }
  });

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#0f1117]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/owner/dashboard"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-400 hover:text-white transition-colors shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <Package size={17} className="text-blue-500 shrink-0" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white leading-tight">
                Inventory
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-500 leading-tight">
                Manage your store stock
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/owner/inventory/add"
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-full text-[11px] sm:text-xs font-semibold transition-colors shrink-0"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">Add </span>Item
        </Link>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-8 py-6 sm:py-10">

        {items.length === 0 ? (
          <div className="max-w-4xl mx-auto mt-8 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <Package size={36} className="mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 font-medium text-sm">No items yet</p>
            <p className="text-slate-600 text-xs mt-1">Add your first product to get started.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Desktop table */}
            <table className="w-full text-left hidden sm:table">
              <thead className="bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Item Name</th>
                  <th className="px-5 py-3.5">Quantity</th>
                  <th className="px-5 py-3.5">Price (₦)</th>
                  <th className="px-5 py-3.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4 font-semibold text-white">{item.name}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <form action={updateInventoryQuantity.bind(null, item.id, -1)}>
                          <button type="submit" className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                            <Minus size={14} />
                          </button>
                        </form>
                        <span className="w-8 text-center font-mono text-sm font-bold text-white">
                          {item.quantity}
                        </span>
                        <form action={updateInventoryQuantity.bind(null, item.id, 1)}>
                          <button type="submit" className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                            <Plus size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-medium">
                      ₦{Number(item.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4">
                      <button className="h-7 w-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 hover:text-rose-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-slate-800/60">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ₦{Number(item.price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={updateInventoryQuantity.bind(null, item.id, -1)}>
                      <button type="submit" className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Minus size={14} />
                      </button>
                    </form>
                    <span className="w-7 text-center font-mono text-sm font-bold text-white">
                      {item.quantity}
                    </span>
                    <form action={updateInventoryQuantity.bind(null, item.id, 1)}>
                      <button type="submit" className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Plus size={14} />
                      </button>
                    </form>
                    <button className="h-8 w-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 transition-colors ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
