// FILE: apps/frontend/app/login/page.tsx (REPLACED — Stage 4 of the
// 100-day waitlist gate)
//
// Thin Server Component wrapper, same pattern as app/page.tsx and
// app/register/page.tsx. Fetches the registration gate status and
// passes it to the actual login page (now LoginClient.tsx, unchanged
// otherwise) so its "Don't have an account?" link automatically points
// at /waitlist and says "Join the waitlist" while the gate is closed.
// Logging in itself is completely unaffected either way.

import { isRegistrationOpen } from "@/lib/system-settings.actions";
import LoginClient from "./LoginClient";

// Reads the same gate flag as /register and /waitlist for its
// "Register now" / "Join the waitlist" link — force-dynamic so it
// can't serve a stale cached link after a toggle.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const registrationOpen = await isRegistrationOpen();
  return <LoginClient registrationOpen={registrationOpen} />;
}
