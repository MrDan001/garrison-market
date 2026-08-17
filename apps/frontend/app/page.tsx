// FILE: apps/frontend/app/page.tsx (REPLACED — Stage 4 of the 100-day
// waitlist gate)
//
// Thin Server Component wrapper, same pattern as app/register/page.tsx
// from Stage 2: fetch the registration gate status server-side, pass
// it down as a prop, and let the actual homepage (now HomeClient.tsx,
// unchanged otherwise) render every CTA accordingly. Every
// "Get started"/"Start Free Trial"/"Choose {plan}" button on the page
// automatically shows "Join the waitlist" and points at /waitlist
// while the gate is closed, and reverts to normal the moment an admin
// reopens it — nothing on this page needs manual editing either way.
//
// "Become an affiliate" links are untouched — the affiliate program
// stays open the whole time, per your instruction.

import { isRegistrationOpen } from "@/lib/system-settings.actions";
import HomeClient from "./HomeClient";

// Reads the same gate flag as /register, /waitlist, and /login for
// its CTAs — force-dynamic so it can't serve stale cached buttons
// after a toggle.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const registrationOpen = await isRegistrationOpen();
  return <HomeClient registrationOpen={registrationOpen} />;
}
