// apps/frontend/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

async function getPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: number; role: string };
  } catch {
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

  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/owner') && role !== 'owner') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname.startsWith('/staff') && role !== 'staff') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/owner/:path*', '/staff/:path*'],
};