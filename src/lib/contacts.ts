import prisma from "./prisma";

export async function ensureVisitorByPhone(phoneE164: string, displayName?: string | null) {
  let visitor = await prisma.visitor.findFirst({
    where: {
      contacts: {
        some: { type: "whatsapp", value: phoneE164 },
      },
    },
  });
  if (!visitor) {
    visitor = await prisma.visitor.create({ data: { displayName: displayName || null } });
    await prisma.contactChannel.create({
      data: {
        ownerType: "visitor",
        type: "whatsapp",
        value: phoneE164,
        verified: true,
        preferred: true,
        visitorId: visitor.id,
      },
    });
  } else if (displayName && !visitor.displayName) {
    visitor = await prisma.visitor.update({ where: { id: visitor.id }, data: { displayName } });
  }
  return visitor;
}

export async function ensureVisitorConversation(visitorId: string) {
  let convo = await prisma.conversation.findFirst({
    where: { visitorId, subjectType: "visitor" },
    orderBy: { updatedAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { subjectType: "visitor", visitorId } });
  }
  return convo;
}
