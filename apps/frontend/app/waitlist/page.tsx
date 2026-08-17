// FILE: apps/frontend/app/waitlist/page.tsx (NEW FILE)
//
// Public waitlist landing page. Server Component so the live counter is
// fetched fresh on every load rather than needing a client-side fetch.
// The signup form itself is a client component (WaitlistForm) since it
// needs interactivity (loading state, inline errors).
//
// Accepts an optional ?ref=CODE search param — this is what Stage 3
// will point the gated /register and existing /ref/[code] and affiliate
// links at, so referral attribution already works the moment this page
// exists, even before those redirects are wired up.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Oswald, Inter, IBM_Plex_Mono } from "next/font/google";
import { getWaitlistCount } from "@/lib/waitlist.actions";
import { isRegistrationOpen } from "@/lib/system-settings.actions";
import WaitlistForm from "./WaitlistForm";
import { Users } from "lucide-react";

// Forces this route to be rendered fresh on every request instead of
// statically cached. Necessary because this page and /register each
// redirect to the other based on the same DB flag — if both were
// statically cached, they revalidate on independent schedules and can
// disagree for a window after a toggle, producing a redirect loop
// (ERR_TOO_MANY_REDIRECTS) between the two stale cached copies.
export const dynamic = "force-dynamic";

const display = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Join the Waitlist",
  description: "Garrison Market is opening a limited number of new shops. Join the waitlist to be first in line.",
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const open = await isRegistrationOpen();
  if (open) {
    redirect("/register");
  }

  const { ref } = await searchParams;
  const count = await getWaitlistCount();

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]`}
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

      <main className="max-w-2xl mx-auto px-6 py-14">
        <div
          className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#E55345] mb-4"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <Users size={13} strokeWidth={2.5} />
          {count.toLocaleString()} shop owners already in line
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          Join Garrison Market Early Access
        </h1>
        <p className="text-sm text-[var(--text-primary)]/70 leading-relaxed mb-10 max-w-lg">
          0% fees for 1 months — track stock, staff, and sales from one dashboard. Join the
          waitlist and we'll email you the moment a spot opens — refer other shop owners with
          your personal link to move up the line.
        </p>

        <WaitlistForm referredByCode={ref || null} />
      </main>

      <footer
        className="border-t border-[var(--border-subtle)]/10 py-8 px-6 text-center text-[var(--text-primary)]/30 text-xs font-semibold uppercase tracking-wider mt-10"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        &copy; {new Date().getFullYear()} Garrison Market, a product of MifiTech.
      </footer>
    </div>
  );
}
