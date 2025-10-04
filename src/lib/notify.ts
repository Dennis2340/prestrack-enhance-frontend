import { sendWhatsAppViaGateway } from "./whatsapp";

export async function sendWhatsAppMessage(toE164: string, text: string) {
  if (!toE164 || !/^\+\d{6,15}$/.test(toE164)) {
    throw new Error("sendWhatsAppMessage: invalid E.164 phone");
  }
  const body = String(text || "").trim();
  if (!body) throw new Error("sendWhatsAppMessage: empty text");
  return sendWhatsAppViaGateway({ toE164, body });
}
