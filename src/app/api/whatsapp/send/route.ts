import { NextResponse } from "next/server";
import { formatE164, sendWhatsAppViaGateway } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { to, toE164, body } = payload || {};
    if (!body || typeof body !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'body'" }, { status: 400 });
    }

    const finalTo = typeof toE164 === "string" && toE164.trim()
      ? toE164.trim()
      : formatE164(typeof to === "string" ? to : undefined);

    if (!finalTo) {
      return NextResponse.json({ error: "Missing recipient: provide 'toE164' or a valid 'to'" }, { status: 400 });
    }

    const result = await sendWhatsAppViaGateway({ toE164: finalTo, body });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error: any) {
    console.error("/api/whatsapp/send error:", error);
    return NextResponse.json({ error: error?.message || "Internal Error" }, { status: 500 });
  }
}
