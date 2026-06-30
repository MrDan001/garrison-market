// apps/frontend/app/admin/users/[id]/page.tsx
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

// Update the props to accept a Promise for params
export default async function OwnerDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // Await the params object before accessing properties
  const { id } = await params;

  const owner = await prisma.user.findUnique({
    where: { id: parseInt(id) },
  });

  if (!owner) notFound();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Owner Profile: {owner.email}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#161821] p-6 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold mb-4 text-slate-300">Personal Details</h2>
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">Full Name: <span className="text-slate-200">{owner.fullName || "N/A"}</span></p>
            <p className="text-slate-500 text-sm">Email: <span className="text-slate-200">{owner.email}</span></p>
            <p className="text-slate-500 text-sm">Phone: <span className="text-slate-200">{owner.phoneNumber || "N/A"}</span></p>
          </div>
        </div>

        <div className="bg-[#161821] p-6 rounded-xl border border-slate-800">
          <h2 className="text-lg font-semibold mb-4 text-slate-300">Account Status</h2>
          <div className="space-y-3">
            <p className="text-slate-500 text-sm">Role: <span className="text-slate-200 capitalize">{owner.role}</span></p>
            <p className="text-slate-500 text-sm">Status: <span className="text-green-400 font-bold">{owner.status.toUpperCase()}</span></p>
            <p className="text-slate-500 text-sm">Joined: <span className="text-slate-200">{owner.createdAt.toLocaleDateString()}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}