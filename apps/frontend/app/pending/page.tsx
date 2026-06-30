import { Clock, LogIn, AlertCircle, RefreshCw } from "lucide-react";
import { getSessionUser } from "@/lib/auth.actions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";

// Detects a Next.js redirect "error" by its digest, since isRedirectError
// is no longer publicly exported in Next 16.
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as any).digest === "string" &&
    (error as any).digest.startsWith("NEXT_REDIRECT")
  );
}

// 1. Define the shape of your user
interface UserStatus {
  fullName: string | null;
  status: string;
}

export default async function PendingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  // 2. Explicitly type the variable
  let user: UserStatus | null = null;

  try {
    user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { status: true, fullName: true }
    });

    if (!user) {
      const cookieStore = await cookies();
      cookieStore.delete("session-token");
      redirect("/login");
    }

    if (user.status === "approved") {
      redirect("/owner/dashboard");
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Error checking user status:", error);
  }

  const isDeclined = user?.status === "declined";
  const isSuspended = user?.status === "suspended";

  const getStatusContent = () => {
    if (isDeclined) return {
      title: "Application Declined",
      text: "Unfortunately, your application did not meet our requirements. Please check your email for details.",
      color: "red"
    };
    if (isSuspended) return {
        title: "Account Suspended",
        text: (
          <>
            Your access has been restricted. Please contact support at 
            <a href="mailto:support@garrison.com" className="text-rose-500 hover:underline ml-1 font-semibold">
              support@garrison.com 
            </a>{" "}
            to resolve this matter.
          </>
        ),
        color: "rose"
      };
    return {
      title: "Awaiting Verification",
      text: (
        <>
          Welcome, <strong>{user?.fullName || 'Partner'}</strong>! <br /><br />
          Our team is giving your store a personal review. 
          <span className="block mt-2 text-slate-500 italic">You are not just another account—we want to make sure you have the best start possible.</span>
        </>
      ),
      color: "amber"
    };
  };

  const content = getStatusContent();

  async function refreshStatus() {
    "use server";
    revalidatePath("/pending");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 font-sans text-slate-200">
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className={`absolute top-[10%] left-[20%] h-[500px] w-[500px] rounded-full blur-[150px] transition-colors duration-1000 ${isDeclined ? 'bg-red-900/10' : isSuspended ? 'bg-rose-900/10' : 'bg-amber-900/10'}`} />
      </div>

      <div className="w-full max-w-[420px] rounded-[2.5rem] border border-slate-800 bg-slate-900/30 backdrop-blur-3xl shadow-2xl p-10 text-center">
        <div className={`mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] shadow-inner ${isDeclined ? 'bg-red-950/30 text-red-500' : isSuspended ? 'bg-rose-950/30 text-rose-500' : 'bg-amber-950/30 text-amber-500'}`}>
          {isDeclined || isSuspended ? <AlertCircle size={44} strokeWidth={1.5} /> : <Clock size={44} strokeWidth={1.5} className="animate-pulse" />}
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">{content.title}</h1>
        
        <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-[300px] mx-auto">{content.text}</p>

        <div className="flex items-center justify-center gap-3 py-3 px-6 mb-8 bg-slate-950/50 rounded-full border border-slate-800">
  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Status</span>
  
  <div className="flex items-center gap-2">
    {/* Solid dot */}
    <div className={`h-2 w-2 rounded-full ${
      isDeclined || isSuspended ? 'bg-red-500' : 'bg-amber-500'
    }`} />
    
    {/* Serious, solid-background label */}
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
      isDeclined || isSuspended ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-400'
    }`}>
      {user?.status?.toUpperCase() || "PENDING"}
    </span>
  </div>
</div>

        <div className="flex flex-col gap-3">
          <form action={refreshStatus}>
            <button className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] border border-slate-700/50 text-white font-semibold rounded-2xl transition-all">
              <RefreshCw size={18} className="text-slate-400" /> Check Status
            </button>
          </form>

          <a href="/login" className="w-full flex items-center justify-center gap-2 py-4 bg-transparent hover:bg-slate-800/40 border border-transparent text-slate-400 hover:text-white font-semibold rounded-2xl transition-all">
            <LogIn size={18} /> Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}