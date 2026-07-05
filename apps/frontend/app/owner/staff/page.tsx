import { UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getStaffData, toggleStaffStatus, deleteStaff } from "@/lib/auth.actions";

type StaffMember = {
  id: number;
  fullName: string | null;
  email: string;
  status: string;
  phoneNumber: string | null;
  role: string;
  ownerId: number | null;
};

export default async function ManageStaffPage() {
  const staffMembers = await getStaffData() as StaffMember[];

  return (
    <div className="min-h-screen bg-[#0f1117] p-8 text-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/owner/dashboard" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold">Manage Staff</h1>
        </div>
        <Link
          href="/owner/staff/register"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-semibold transition-all"
        >
          <UserPlus size={18} /> Add New Staff
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffMembers.map((staff: StaffMember) => (
          <div key={staff.id} className="border border-slate-800 bg-slate-900/50 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{staff.fullName}</h2>
                <p className="text-sm text-slate-500">{staff.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-md text-xs font-bold ${
                staff.status === 'active' ? 'bg-emerald-950 text-emerald-500' : 'bg-red-950 text-red-500'
              }`}>
                {staff.status}
              </span>
            </div>

            <button className="w-full py-2.5 mb-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
              VIEW DETAILS
            </button>

            <div className="flex gap-3">
              <form action={toggleStaffStatus.bind(null, staff.id, staff.status)} className="flex-1">
                <button className="w-full py-2.5 bg-rose-950/50 text-rose-200 hover:bg-rose-950/80 rounded-lg text-sm font-semibold transition-colors">
                  {staff.status === 'active' ? 'SUSPEND' : 'REINSTATE'}
                </button>
              </form>

              <form action={deleteStaff.bind(null, staff.id)} className="flex-1">
                <button className="w-full py-2.5 bg-red-950/50 text-red-200 hover:bg-red-950/80 rounded-lg text-sm font-semibold transition-colors">
                  DELETE
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}