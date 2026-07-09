// 1. Add this to force fresh data fetching from the database
export const dynamic = "force-dynamic";

import { ArrowLeft, Camera } from "lucide-react";
import { updateProfileWithPhoto } from "@/lib/profile.actions";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function EditProfilePage() {
  const session = await getSessionUser();
  if (!session?.email) return null;
  
  const user = await prisma.user.findUnique({ where: { email: session.email } });

  return (
    <div className="fixed inset-0 bg-[#0a0c12] text-slate-200 flex flex-col">
      <header className="flex items-center gap-4 p-4 border-b border-slate-800">
        <a href="/owner/profile" className="p-2 -ml-2 hover:bg-slate-800 rounded-full"><ArrowLeft size={20} /></a>
        <h1 className="text-lg font-bold">Update Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Photo Upload Section */}
        <form action={updateProfileWithPhoto} className="space-y-6">
          <div className="flex justify-center py-4">
            <label className="relative cursor-pointer group">
              <div className="h-24 w-24 rounded-full bg-slate-800 flex items-center justify-center font-bold text-3xl overflow-hidden border-2 border-slate-700">
                {user?.image ? (
                  <img src={user.image} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  user?.fullName?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-[#0a0c12]">
                <Camera size={14} className="text-white" />
              </div>
              <input type="file" name="image" accept="image/*" className="hidden" />
            </label>
          </div>

          <div className="space-y-4">
            <InputField label="Full Name" name="fullName" defaultValue={user?.fullName || ""} />
            {/* 2. Fixed property name: Changed user?.phone to user?.phoneNumber */}
            <InputField label="Phone number" name="phone" defaultValue={user?.phoneNumber || ""} />
            <InputField label="Email" name="email" defaultValue={user?.email || ""} disabled />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 p-4 rounded-2xl font-bold mt-6 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20"
          >
            Save Changes
          </button>
        </form>
      </main>
    </div>
  );
}

function InputField({ label, name, defaultValue, disabled }: any) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl mt-1 text-sm focus:border-blue-500 outline-none transition-all disabled:opacity-50"
      />
    </div>
  );
}