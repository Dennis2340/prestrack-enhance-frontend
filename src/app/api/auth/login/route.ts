import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { signJwt, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, email: true, passwordHash: true },
    });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash as string);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = signJwt({ sub: user.id, role: user.role, email: user.email });
    const res = NextResponse.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
    // Set httpOnly cookie for server-side authenticated requests
    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}
