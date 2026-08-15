// FILE: apps/frontend/app/waitlist/thank-you/page.tsx (NEW FILE)
//
// Landed on right after a successful signup (see WaitlistForm's
// router.push). Reads the new signup's own referralCode back out of
// the ?ref= param to show them their queue position and personal
// referral link — bookmarkable/shareable on its own since none of this
// is sensitive (a queue position and a referral code are meant to be
// shown to the person who owns them, and the code itself is meant to
// be shared).

import type { Metadata } from "next";
import Link from "next/link";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import { getWaitlistSignupByReferralCode } from "@/lib/waitlist.actions";
import { CheckCircle2 } from "lucide-react";
import CopyLinkButton from "./CopyLinkButton";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = { title: "You're on the list" };

export default async function WaitlistThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const signup = ref ? await getWaitlistSignupByReferralCode(ref) : null;

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="border-b border-[var(--border-subtle)]/10 py-6 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-[#F1EEE3] flex items-center justify-center shrink-0">
            <span className="text-[#0D1527] font-extrabold text-xs" style={{ fontFamily: "var(--font-display)" }}>
              G
            </span>
          </div>
          <span className="font-extrabold tracking-tight text-sm" style={{ fontFamily: "var(--font-display)" }}>
            GARRISON MARKET
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-14 flex-1 w-full">
        {signup ? (
          <>
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
              You're on the list, {signup.fullName.split(" ")[0]}.
            </h1>
            <p className="text-sm text-[var(--text-primary)]/70 mb-8">
              You're currently number <span className="font-bold text-[var(--text-primary)]">{signup.position.toLocaleString()}</span> in
              line. We'll email you the moment a spot opens.
            </p>

            <div className="rounded-2xl border border-[var(--border-subtle)]/10 bg-[var(--text-primary)]/[0.03] p-6 sm:p-8">
              <p
                className="text-[11px] font-black uppercase tracking-widest text-[var(--text-primary)]/40 mb-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Move up the line
              </p>
              <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed mb-5">
                Share your personal link with other shop owners. Every person who joins through
                it moves you up in the queue.
              </p>
              <CopyLinkButton referralCode={signup.referralCode} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ fontFamily: "var(--font-display)" }}>
              You're on the waitlist.
            </h1>
            <p className="text-sm text-[var(--text-primary)]/70 mb-6">
              We'll email you the moment a spot opens.
            </p>
            <Link href="/waitlist" className="text-sm font-bold text-[#E55345] hover:underline">
              Back to the waitlist
            </Link>
          </>
        )}
      </main>

      <footer
        className="border-t border-[var(--border-subtle)]/10 py-8 px-6 text-center text-[var(--text-primary)]/30 text-xs font-semibold uppercase tracking-wider"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        &copy; {new Date().getFullYear()} Garrison Market, a product of MifiTech.
      </footer>
    </div>
  );
}