import prisma from "@/lib/prisma";
import { ensureVisitorByPhone, ensureVisitorConversation } from "@/lib/contacts";

export async function createVisitorForPhone(phoneE164: string, fullName?: string | null) {
  if (!/^\+\d{6,15}$/.test(phoneE164)) throw new Error("invalid E.164 phone");
  const visitor = await ensureVisitorByPhone(phoneE164, fullName || null);
  const convo = await ensureVisitorConversation(visitor.id);
  return { visitorId: visitor.id, conversationId: convo.id };
}

export async function lookupVisitorByPhone(phoneE164: string) {
  if (!/^\+\d{6,15}$/.test(phoneE164)) throw new Error("invalid E.164 phone");
  const visitor = await prisma.visitor.findFirst({
    where: { contacts: { some: { type: "whatsapp", value: phoneE164 } } },
  });
  if (!visitor) return { exists: false } as const;
  const convo = await prisma.conversation.findFirst({
    where: { visitorId: visitor.id },
    orderBy: { updatedAt: "desc" },
  });
  return { exists: true, visitorId: visitor.id, conversationId: convo?.id || null } as const;
}
