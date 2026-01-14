import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";

export interface AuthUser {
  sub: string;
  role: "admin" | "provider";
  email?: string | null;
}


export function getAuthFromRequest(req: NextRequest): AuthUser | null {
  // Prefer httpOnly cookie set by login
  const cookie = req.cookies.get("auth_token")?.value;
  const header = req.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
  const token = cookie || bearer || null;
  if (!token) return null;
  const payload = verifyJwt<AuthUser>(token);
  return payload;
}

export function requireAuth(req: NextRequest): { user: AuthUser } | NextResponse {
  const user = getAuthFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}
