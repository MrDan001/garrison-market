import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Store, Phone, Mail, Calendar, Package } from "lucide-react";
import { OwnerActions } from "./OwnerActions";

export default async function OwnerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const owner = await prisma.user.findUnique({
    where: { id: parseInt(id) },
  });

  if (!owner) notFound();

  const statusStyles: Record<string, string> = {
    approved: "bg-emerald-900/30 text-emerald-400 border-emerald-500/20",
    declined: "bg-red-900/30 text-red-400 border-red-500/20",
    suspended: "bg-rose-900/30 text-rose-400 border-rose-500/20",
    pending: "bg-amber-900/30 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to owners
      </Link>

      {/* Header card with photo + status */}
      <div className="bg-[#161821] rounded-2xl border border-slate-800 p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold text-white overflow-hidden border-2 border-slate-700 shrink-0">
          {owner.image ? (
            <img src={owner.image} alt={owner.fullName || "Owner"} className="h-full w-full object-cover" />
          ) : (
            owner.fullName?.charAt(0).toUpperCase() || "?"
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">{owner.fullName || "No Name Provided"}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusStyles[owner.status] || statusStyles.pending}`}>
              {owner.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm">{owner.email}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Contact */}
        <div className="bg-[#161821] p-6 rounded-2xl border border-slate-800">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Contact</h2>
          <div className="space-y-3">
            <InfoRow icon={Mail} label="Email" value={owner.email} />
            <InfoRow icon={Phone} label="Phone" value={owner.phoneNumber || "Not provided"} />
            <InfoRow icon={Calendar} label="Joined" value={owner.createdAt.toLocaleDateString()} />
          </div>
        </div>

        {/* Shop details — the key info for approval decisions */}
        <div className="bg-[#161821] p-6 rounded-2xl border border-slate-800">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Shop Details</h2>
          <div className="space-y-3">
            <InfoRow icon={Store} label="Shop name" value={owner.storeName || "Not provided"} />
            <InfoRow
              icon={MapPin}
              label="Location"
              value={
                [owner.shopAddress, owner.shopCity, owner.shopState].filter(Boolean).join(", ") || "Not provided"
              }
            />
            <InfoRow icon={Package} label="Sells" value={owner.productsSold || "Not provided"} />
          </div>
        </div>
      </div>

      {/* Approve / decline / suspend / delete actions */}
      <div className="bg-[#161821] p-6 rounded-2xl border border-slate-800">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Actions</h2>
        <OwnerActions email={owner.email} status={owner.status} />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} className="text-slate-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200">{value}</p>
      </div>
    </div>
  );
}
