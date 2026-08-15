// FILE: apps/frontend/lib/session-config.ts
//
// Deliberately its own file with zero server-only imports (no
// "next/headers", no prisma) so it's safe to import from both server code
// (lib/auth.ts, lib/auth.actions.ts) and "use client" components
// (components/SessionTimeoutGuard.tsx) without pulling server-only code
// into the client bundle.

// How long a session may sit idle before it's treated as expired. This is
// enforced authoritatively on the server (see getSessionUser() in
// lib/auth.ts) — the client-side timer in SessionTimeoutGuard is only a UX
// nicety that redirects proactively; it is not what actually protects the
// session.
export const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
