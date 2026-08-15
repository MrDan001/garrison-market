// apps/frontend/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { isActiveForRole } from '@/lib/auth';

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

async function getPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; role: string };
  } catch {
    return null;
  }
}

// SECURITY (Stage 1 — session audit): the JWT only proves someone had
// valid credentials at the moment it was issued. It says nothing about
// whether the account is still active *right now*. Before this, a
// suspended or declined account kept full access for however long its
// session lasted, and only actually got cut off on the specific pages
// that happened to check `status` themselves. This checks the database
// on every request instead, so suspending someone takes effect on their
// very next click, not on whichever page next remembers to ask.
//
// This is deliberately independent of the currentSessionToken /
// lastActivityAt mechanism in lib/auth.ts and lib/auth.actions.ts
// (single-device enforcement + 5-minute inactivity timeout) — that
// mechanism catches idle sessions and logins-elsewhere, but does NOT by
// itself react to an account being suspended mid-session while still
// active. The two are complementary, not redundant.
//
// proxy.ts runs on the Node.js runtime by default in Next 16 (not Edge),
// which is what makes a real Postgres query here possible at all.
//
// isActiveForRole is imported from lib/auth.ts rather than defined here —
// see that file for what "active" means per role and why it's shared with
// lib/debt.actions.ts / lib/business.actions.ts too.

async function getLiveStatus(userId: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status ?? null;
  } catch {
    // DB unreachable: fail closed for this check rather than silently
    // skipping it — treat as inactive and send to login. The role/token
    // check above still already ran, so this only affects the new layer.
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session-token')?.value;

  const payload = token ? await getPayload(token) : null;

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = payload.role?.toLowerCase();

  const isUnderPrefix = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (isUnderPrefix('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isUnderPrefix('/owner') && role !== 'owner') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isUnderPrefix('/staff') && role !== 'staff') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const status = await getLiveStatus(payload.userId);

  if (!isActiveForRole(role, status)) {
    // Owner and staff each already have a dedicated "here's why you're
    // blocked" screen (declined/suspended/pending messaging) — route
    // there instead of straight to /login so that screen still shows.
    // Admin has no equivalent screen and, per prisma/seed.ts, is only
    // ever created with status "approved" — falls back to /login.
    if (role === 'owner') {
      return NextResponse.redirect(new URL('/pending', request.url));
    }
    if (role === 'staff') {
      return NextResponse.redirect(new URL('/pending/staff', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/owner/:path*', '/staff/:path*'],
};