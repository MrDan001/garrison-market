import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { getSessionUser, generateSessionToken, signToken } from "@/lib/auth";
import { validatePassword } from "@/lib/password-validation";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current and new password are required." },
        { status: 400 }
      );
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { message: passwordCheck.error },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // SECURITY: rotate the session token on every password change, not
    // just the password hash. Without this, a cookie stolen before the
    // change (e.g. via a compromised device or session fixation) would
    // stay valid afterward — the exact scenario someone is usually
    // guarding against when they change their password. Rotating here
    // invalidates every other active session, including a stolen one,
    // the same way a fresh login already does.
    const newSessionToken = generateSessionToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, currentSessionToken: newSessionToken, lastActivityAt: new Date() },
    });

    const newToken = await signToken(user.id, user.role, newSessionToken);
    const response = NextResponse.json({ message: "Password changed successfully." }, { status: 200 });
    response.cookies.set("session-token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ message: "An unexpected error occurred." }, { status: 500 });
  }
}