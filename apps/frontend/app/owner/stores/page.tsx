import { ArrowLeft, Store, Plus, ArrowRight, LayoutGrid, Package, Phone, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { switchStoreAction } from "@/lib/store.actions";
import { getActiveStoreId } from "@/lib/store-context";

export const dynamic = "force-dynamic";

interface StoreType {
  id: number;
  name: string;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  productsSold: string | null;
  createdAt: Date;
  ownerId: number;
}

export default async function MyStoresPage() {
  const session = await getSessionUser();
  if (!session?.email) redirect("/login");

  const ownerData = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      id: true,
      fullName: true,
      storeName: true,
      phoneNumber: true,
      _count: {
        select: { inventory: true, managedStaff: true }
      }
    }
  });

  if (!ownerData) redirect("/login");

  let stores = await prisma.store.findMany({
    where: {
      OR: [
        { ownerId: ownerData.id },
        { name: ownerData.storeName || `${ownerData.fullName || "Owner"}'s Main Store` }
      ]
    },
    orderBy: { createdAt: "asc" }
  });

  if (stores.length === 0) {
    const mainStoreName = ownerData.storeName || `${ownerData.fullName || "Owner"}'s Main Store`;

    const newMainStore = await prisma.store.create({
      data: {
        name: mainStoreName,
        ownerId: ownerData.id,
        phoneNumber: ownerData.phoneNumber || null,
      }
    });

    stores = [newMainStore];
  } else {
    const missingLinkStores = stores.filter(store => store.ownerId !== ownerData.id);
    if (missingLinkStores.length > 0) {
      await prisma.store.updateMany({
        where: {
          id: { in: missingLinkStores.map(s => s.id) }
        },
        data: {
          ownerId: ownerData.id
        }
      });
    }
  }

  const firstName = ownerData.fullName?.split(" ")[0] ?? "Owner";
  const activeStoreId = await getActiveStoreId();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Navigation Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link href="/owner/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[var(--text-primary)] mb-4 w-fit transition-colors text-sm">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Store size={20} className="text-[var(--text-primary)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">My Stores</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Welcome back, {firstName} — managing <span className="text-blue-400 font-semibold">{stores.length} outlet{stores.length !== 1 ? "s" : ""}</span>
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/owner/stores/create"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/10 transition-all w-full sm:w-auto active:scale-95"
          >
            <Plus size={14} /> Register New Location
          </Link>
        </div>

        {/* Overview Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Administrator</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{ownerData.fullName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Catalog</p>
            <p className="text-sm font-semibold text-blue-400 mt-1 flex items-center gap-1.5">
              <Package size={14} /> {ownerData._count.inventory} items
            </p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Team Size</p>
            <p className="text-sm font-semibold text-emerald-400 mt-1">
              {ownerData._count.managedStaff} staff
            </p>
          </div>
        </div>

        {/* Store Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((store: StoreType, index: number) => {
            const locationParts = [store.address, store.city, store.state].filter(Boolean);
            const location = locationParts.length > 0 ? locationParts.join(", ") : null;
            const isActive = store.id === activeStoreId;

            return (
              <div
                key={store.id}
                className={`bg-gradient-to-br from-[#1a1d24] to-[#15171d] border rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col justify-between group relative ${
                  isActive
                    ? "border-emerald-500/70 shadow-lg shadow-emerald-600/10 ring-1 ring-emerald-500/30"
                    : "border-slate-200/80 dark:border-slate-800/80 hover:border-blue-600/40 hover:shadow-blue-600/5"
                }`}
              >
                {isActive && (
                  <span className="absolute -top-2.5 left-5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    ● Currently Viewing
                  </span>
                )}
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-[var(--text-primary)] truncate group-hover:text-blue-400 transition-colors">
                        {store.name}
                      </h2>
                      <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide inline-block mt-1.5">
                        {index === 0 ? "★ Main Outlet" : `Location ${index + 1}`}
                      </span>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400 group-hover:text-blue-400 group-hover:border-blue-600/30 transition-colors">
                      <Store size={17} />
                    </div>
                  </div>

                  {/* What they sell — badge style */}
                  {store.productsSold && (
                    <div className="mt-3 flex items-start gap-1.5">
                      <Package size={12} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/80 leading-snug line-clamp-2">{store.productsSold}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="mt-4 space-y-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-slate-400 dark:text-slate-600 shrink-0 mt-0.5" />
                      <span className={location ? "" : "text-slate-400 dark:text-slate-600 italic"}>{location || "No location on file"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      <span className={store.phoneNumber ? "" : "text-slate-400 dark:text-slate-600 italic"}>{store.phoneNumber || "No contact number"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      <span>Opened {new Date(store.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-4">
                  <Link
                    href={`/owner/inventory?storeId=${store.id}`}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
                  >
                    <LayoutGrid size={13} /> Manage Inventory
                  </Link>

                  {isActive ? (
                    <Link
                      href="/owner/dashboard"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-lg transition-colors group/enter"
                    >
                      Enter Store <ArrowRight size={13} className="group-hover/enter:translate-x-0.5 transition-transform" />
                    </Link>
                  ) : (
                    <form action={switchStoreAction.bind(null, store.id)}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-2 rounded-lg transition-colors group/enter"
                      >
                        Enter Store <ArrowRight size={13} className="group-hover/enter:translate-x-0.5 transition-transform" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}