export type SendWhatsAppViaGatewayParams = {
  toE164: string; // phone number in E.164 format, e.g. "+2327xxxxxxx"
  body: string; // message text
};

// Format to E.164 (defaults to Sierra Leone +232 when country code missing)
export function formatE164(phone?: string | null) {
  if (!phone) return undefined;
  const cleaned = String(phone).replace(/[^0-9]/g, "");
  if (!cleaned) return undefined;
  if (cleaned.startsWith("232")) return `+${cleaned}`;
  return `+232${cleaned}`;
}

export function derivePhoneFromEmail(email?: string | null) {
  if (!email) return undefined;
  // Convention: whatsapp_<phone>@domain
  const match = email.match(/^whatsapp_([^@]+)@/i);
  if (match && match[1]) {
    return match[1];
  }
  return undefined;
}

export async function sendWhatsAppViaGateway({ toE164, body }: SendWhatsAppViaGatewayParams) {
  const base = (process.env.WHATSAPP_GATEWAY_URL || "https://prestrack-client.onrender.com").replace(/\/+$/, "");

  const url = `${base}/send-whatsapp`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneE164: toE164,
        message: body,
        
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[sendWhatsAppViaGateway] Gateway request failed", {
        url,
        toE164,
        status: res.status,
        responseBody: text,
      });
      throw new Error(`Gateway error ${res.status}: ${text}`);
    }

    return res.json().catch(() => ({}));
  } catch (e: any) {
    console.log(e)
    console.error("[sendWhatsAppViaGateway] Unexpected error", {
      url,
      toE164,
      message: e?.message || String(e),
    });
    throw e;
  }
}
