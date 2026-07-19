"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getOwnerBillingInfo, syncPaymentDirectly } from "@/lib/billing.actions";

function SuccessContent() {
  const searchParams = useSearchParams();
  // Paystack can send either 'reference' or 'trxref' depending on checkout config
  const reference = searchParams.get("reference") || searchParams.get("trxref");

  const [checking, setChecking] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let attempts = 0;
    
    const poll = async () => {
      attempts++;
      try {
        // 1. Direct Safe Sync Poke: If the webhook failed to deliver locally,
        // we forcefully sync the payment with Paystack directly on the server side.
        if (reference && attempts <= 2) {
          const syncResult = await syncPaymentDirectly(reference);
          if (syncResult && 'success' in syncResult && syncResult.success) {
            setActive(true);
            setChecking(false);
            return;
          }
        }

        // 2. Fallback check: re-evaluate subscription status
        const info = await getOwnerBillingInfo();
        if (!info.status.isLocked) {
          setActive(true);
          setChecking(false);
          return;
        }
      } catch (error) {
        console.error("Payment confirmation check failed:", error);
      }

      if (attempts < 8) {
        setTimeout(poll, 1500);
      } else {
        setChecking(false);
      }
    };

    poll();
  }, [reference]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 px-4 text-center">
      {checking ? (
        <>
          <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">Confirming your payment...</h1>
          <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
        </>
      ) : active ? (
        <>
          <CheckCircle2 className="text-emerald-500 mb-4" size={40} />
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">Payment confirmed</h1>
          <p className="text-sm text-slate-500 mb-6">Your subscription is now active. Welcome back!</p>
          <Link href="/owner/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
            Go to Dashboard
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">Still confirming...</h1>
          <p className="text-sm text-slate-500 mb-6">
            Your payment may still be processing. If this doesn't update in a minute, check your billing page.
          </p>
          <Link href="/owner/billing" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
            Check Billing Status
          </Link>
        </>
      )}
    </div>
  );
}

// Next.js App router requires client components using useSearchParams to be wrapped in a Suspense boundary
export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] text-slate-800 dark:text-slate-200 px-4 text-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">Loading status...</h1>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}