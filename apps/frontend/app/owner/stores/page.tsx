import { ArrowLeft, Store, Plus, ArrowRight, LayoutGrid, Package, Phone, Calendar } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface StoreType {
  id: number;
  name: string;
  phoneNumber: string | null;
  createdAt: Date;
  ownerId: number;
}

export default async function MyStoresPage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  // Fetch the owner along with their complete multi-store relationship array
  const ownerData = await prisma.user.findUnique({
    where: { email: session.email },
    include: {
      stores: {
        orderBy: { createdAt: "desc" }
      },
      _count: {
        select: { inventory: true, managedStaff: true }
      }
    }
  });

  if (!ownerData) redirect("/login");

  const firstName = ownerData.fullName?.split(" ")[0] ?? "Owner";

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-white mb-4 w-fit transition-colors text-sm">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <Store size={26} className="text-blue-500" />
              <h1 className="text-2xl font-bold text-white tracking-tight">My Stores Directory</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Welcome back, {firstName}. You are currently managing <span className="text-blue-400 font-semibold">{ownerData.stores.length} outlets</span>
            </p>
          </div>

          {/* Add Store Button */}
          <Link 
            href="/owner/stores/create" 
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/10 transition-colors w-full sm:w-auto"
          >
            <Plus size={14} /> Register New Location
          </Link>
        </div>

        {/* Global Overview Ribbon Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-900/20 border border-slate-800/80 rounded-2xl p-5">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Corporate Administrator</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{ownerData.fullName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Global Active Catalog</p>
            <p className="text-sm font-semibold text-blue-400 mt-0.5 flex items-center gap-1">
              <Package size={13} /> {ownerData._count.inventory} Stock Lines
            </p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Workforce</p>
            <p className="text-sm font-semibold text-emerald-400 mt-0.5">
              {ownerData._count.managedStaff} Registered Clerks
            </p>
          </div>
        </div>

        {/* Dynamic Storefront Cards List Section Grid */}
        {ownerData.stores.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
            <Store size={40} className="mx-auto mb-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-300">No outlets registered yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Get started by registering your first physical business branch to organize independent records.
            </p>
            <Link 
              href="/owner/store/create" 
              className="inline-block mt-4 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
            >
              Add first store outlet
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownerData.stores.map((store: StoreType) => (
              <div 
                key={store.id} 
                className="bg-[#1a1d24] border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group relative shadow-md shadow-black/20"
              >
                <div>
                  {/* Card Title & Icon Row */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                        {store.name}
                      </h2>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono uppercase tracking-wide inline-block mt-1">
                        ID: LOC-0{store.id}
                      </span>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-blue-400 transition-colors">
                      <Store size={16} />
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-5 space-y-2 border-t border-slate-800/60 pt-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-600" />
                      <span>{store.phoneNumber || "No active contact line phone"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-slate-600" />
                      <span>Opened: {new Date(store.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Lower Action Link Row */}
                <div className="mt-6 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-4">
                  <Link 
                    href={`/owner/inventory?storeId=${store.id}`} 
                    className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <LayoutGrid size={13} /> Manage Inventory
                  </Link>

                  <Link 
                    href={`/owner/dashboard?storeId=${store.id}`} 
                    className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-0.5 transition-all"
                  >
                    Enter Shop <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
