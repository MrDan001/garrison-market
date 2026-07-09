import { Package, Plus, ArrowLeft, ShoppingCart, Home, BarChart3, ReceiptText, User, Search, Edit2 } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth.actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Explicitly define the Inventory model type structure for TypeScript
interface InventoryItem {
  id: number | string;
  name: string;
  quantity: number;
  price: any; 
  image: string | null;
  ownerId: number | string;
}

export default async function OwnerInventoryPage() {
  const session = await getSessionUser();
  if (!session || session.role !== 'owner') redirect("/login");

  // Fetch items from the database with strict payload selections
  const items = await prisma.inventory.findMany({
    where: { ownerId: session.id },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      image: true, // Guarantees the image database link string is queried
      ownerId: true,
    },
    orderBy: { name: "asc" }
  }) as InventoryItem[]; 

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Inventory</h1>
        </div>
        <Link href="/owner/inventory/add" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-semibold">
          <Plus size={13} /> Add Item
        </Link>
      </div>

      {/* Inventory Grid */}
      <div className="p-4 grid grid-cols-2 gap-4 max-w-5xl mx-auto">
        {items.map((item: InventoryItem) => {
          const isOutOfStock = item.quantity <= 0;
          
          return (
            <Link 
              key={item.id} 
              href={`/owner/inventory/${item.id}/edit`} 
              className="bg-[#1a1d24] rounded-2xl overflow-hidden border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col relative group"
            >
              {/* Image Container with Out of Stock overlay */}
              <div className="aspect-square bg-slate-950 relative overflow-hidden">
                {item.image ? (
                  /* Changed back to standard native img element to fix the Next.js local proxy timeout */
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-700">
                    <Package size={40} />
                  </div>
                )}
                
                {/* Visual indicator absolute badges */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10">
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                      Out of Stock
                    </span>
                  </div>
                )}

                {/* Edit overlay prompt visible on desktop hover */}
                <div className="absolute top-2 right-2 p-1.5 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Edit2 size={12} className="text-blue-400" />
                </div>
              </div>

              {/* Text Sizing Block */}
              <div className="p-3 flex-1 flex flex-col justify-between">
                <h2 className="font-semibold text-sm truncate text-white">{item.name}</h2>
                <div className="flex justify-between items-center mt-2">
                  <p className={`text-xs ${isOutOfStock ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>
                    Qty: {item.quantity}
                  </p>
                  <p className="text-xs font-bold text-blue-400">₦{Number(item.price.toString()).toLocaleString()}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center mt-20 text-slate-500 px-6">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>No inventory items found. Add your first product to get started.</p>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A0C10]/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 pb-2 z-50 md:hidden">
        <Link href="/owner/dashboard" className="flex flex-col items-center gap-1 text-slate-500">
          <Home size={22} />
          <span className="text-[10px]">Home</span>
        </Link>
        <Link href="/owner/report" className="flex flex-col items-center gap-1 text-slate-500">
          <BarChart3 size={22} />
          <span className="text-[10px]">Stats</span>
        </Link>
        
        <Link href="/owner/inventory" className="flex flex-col items-center justify-center -mt-10">
          <div className="bg-blue-500 p-4 rounded-full shadow-lg shadow-blue-500/20 border-4 border-[#0A0C10]">
            <Package size={28} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-blue-400 mt-1">Inventory</span>
        </Link>

        <Link href="/owner/orders" className="flex flex-col items-center gap-1 text-slate-500">
          <ReceiptText size={22} />
          <span className="text-[10px]">Orders</span>
        </Link>
        <Link href="/owner/profile" className="flex flex-col items-center gap-1 text-slate-500">
          <User size={22} />
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
