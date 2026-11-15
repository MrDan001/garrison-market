import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import BusinessLocalizationForm from "./BusinessLocalizationForm";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const session = await getSessionUser();
  if (!session?.id || session.role !== "owner") redirect("/login");

  const owner = await prisma.user.findUnique({
    where: { id: session.id },
    select: { businessCountry: true, currencyCode: true },
  });
  if (!owner) redirect("/login");

  return (
    <main className="min-h-screen bg-[var(--bg-app)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/owner/profile" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[var(--text-primary)]">
          <ArrowLeft size={17} /> Back to More
        </Link>
        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-[var(--bg-surface)] p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3 text-blue-500"><Globe2 size={22} /></div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Business region & currency</h1>
              <p className="text-sm text-slate-500">Set the local settings used across your workspace.</p>
            </div>
          </div>
          <BusinessLocalizationForm initialCountry={owner.businessCountry} initialCurrency={owner.currencyCode} />
        </section>
      </div>
    </main>
  );
}
