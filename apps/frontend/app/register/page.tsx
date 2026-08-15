// FILE: apps/frontend/app/register/page.tsx (REPLACED — Stage 2 of the
// 100-day waitlist gate)
//
// This used to BE the registration form directly. It's now a thin
// Server Component gate: check the registration flag, redirect to
// /waitlist if closed, otherwise render the actual form (moved,
// unchanged, to RegisterForm.tsx). This runs server-side before any of
// the form's client JS ever ships to the browser — someone hitting
// /register while the gate is closed never even downloads the form.
//
// This is the ONE place all public entry points funnel through: the
// homepage's "Get started" links, the login page's "Register" link,
// and app/ref/[code]/route.ts (the owner referral redirect) all point
// at this same URL, so gating it here closes every one of them at
// once — no need to touch any of those files individually.
//
// This is the UX layer, not the security boundary. The actual,
// authoritative block lives in registerOwnerAction() itself
// (lib/auth.actions.ts), which checks the same flag independently —
// see that function for why a page-level redirect alone is never
// enough (a direct call to the underlying Server Action would bypass
// it entirely otherwise).

import { redirect } from "next/navigation";
import { isRegistrationOpen } from "@/lib/system-settings.actions";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const open = await isRegistrationOpen();
  if (!open) {
    redirect("/waitlist");
  }

  return <RegisterForm />;
}