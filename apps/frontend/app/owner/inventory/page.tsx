import { Package, Plus, Trash2, Minus, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";
import { updateInventoryQuantity } from "@/lib/business.actions";
import InventorySearch from "./inventory-search";

export const dynamic = "force-dynamic";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  price: number | string;
};

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') redirect("/login");

  const items: InventoryItem[] = await prisma.inventory.findMany({
    where: { ownerId: session.id },
    orderBy: { name: "asc" }
  });

  const serialized = JSON.parse(JSON.stringify(items));

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
          <InventorySearch items={serialized} />
        )}
      </div>
    </div>
  );
}