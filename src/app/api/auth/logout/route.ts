import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  try {
    res.cookies.set("auth_token", "", { expires: new Date(0), path: "/" });
  } catch {}
  return res;
}

export async function GET() {
  // Support GET for convenience; redirect to home after clearing cookie
  const res = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
  try {
    res.cookies.set("auth_token", "", { expires: new Date(0), path: "/" });
  } catch {}
  return res;
}
