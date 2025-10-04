import prisma from "./prisma";
import { sendWhatsAppViaGateway, formatE164 } from "./whatsapp";
import bcrypt from "bcryptjs";

export type InviteCommon = {
  phoneE164: string;
  message?: string;
  name?: string; // free text, used where applicable
};

export type InvitePatientParams = InviteCommon & {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | Date | null; // ISO string or Date
  sex?: string | null;
  externalId?: string | null;
  identifiers?: any | null; // JSON payload
  address?: any | null; // JSON payload
};

export type InviteVisitorParams = InviteCommon & {
  displayName?: string | null;
};

export type InviteProviderParams = InviteCommon & {
  specialty?: string | null;
  email?: string | null;
  password?: string | null;
};

function assertE164(phoneE164?: string) {
  if (!phoneE164 || !/^\+\d{6,15}$/.test(phoneE164)) {
    throw new Error("phoneE164 required (E.164, e.g. +15551234567)");
  }
}

async function ensurePatientConversation(patientId: string) {
  let convo = await prisma.conversation.findFirst({
    where: { patientId, subjectType: "patient" },
    orderBy: { updatedAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { subjectType: "patient", patientId },
    });
  }
  return convo;
}

async function ensureVisitorConversation(visitorId: string) {
  let convo = await prisma.conversation.findFirst({
    where: { visitorId, subjectType: "visitor" },
    orderBy: { updatedAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: { subjectType: "visitor", visitorId },
    });
  }
  return convo;
}

export async function invitePatient(params: InvitePatientParams) {
  const phoneE164 = formatE164(params.phoneE164) || params.phoneE164;
  assertE164(phoneE164);
  const welcome =
    params.message?.trim() ||
    "Hi! This is your clinic on WhatsApp. You can reply with your question to get started.";

  // Upsert Patient
  const patient = await prisma.patient.create({
    data: {
      firstName: params.firstName || params.name || null,
      lastName: params.lastName || null,
      dateOfBirth: params.dateOfBirth ? new Date(params.dateOfBirth as any) : null,
      sex: params.sex || null,
      externalId: params.externalId || null,
      identifiers: params.identifiers ?? null,
      address: params.address ?? null,
    },
  });

  // Upsert ContactChannel
  await prisma.contactChannel.upsert({
    where: {
      // composite not enforced in schema; emulate via unique by id. Use search + create if needed.
      id: `${patient.id}_wa`,
    },
    update: { value: phoneE164, verified: true, ownerType: "patient", patientId: patient.id },
    create: {
      id: `${patient.id}_wa`,
      ownerType: "patient",
      type: "whatsapp",
      value: phoneE164,
      verified: true,
      preferred: true,
      patientId: patient.id,
    },
  });

  // Send message via gateway
  await sendWhatsAppViaGateway({ toE164: phoneE164, body: welcome });

  // Ensure conversation and persist outbound message
  const convo = await ensurePatientConversation(patient.id);
  const saved = await prisma.commMessage.create({
    data: {
      conversationId: convo.id,
      direction: "outbound",
      via: "whatsapp",
      body: welcome,
      senderType: "system",
    },
  });

  return { patientId: patient.id, conversationId: convo.id, messageId: saved.id };
}

export async function inviteVisitor(params: InviteVisitorParams) {
  const phoneE164 = formatE164(params.phoneE164) || params.phoneE164;
  assertE164(phoneE164);
  const welcome =
    params.message?.trim() ||
    "Hi! This is your clinic on WhatsApp. You can reply with your question to get started.";

  const visitor = await prisma.visitor.create({
    data: { displayName: params.displayName || params.name || null },
  });

  await prisma.contactChannel.upsert({
    where: { id: `${visitor.id}_wa` },
    update: { value: phoneE164, verified: true, ownerType: "visitor", visitorId: visitor.id },
    create: {
      id: `${visitor.id}_wa`,
      ownerType: "visitor",
      type: "whatsapp",
      value: phoneE164,
      verified: true,
      preferred: true,
      visitorId: visitor.id,
    },
  });

  await sendWhatsAppViaGateway({ toE164: phoneE164, body: welcome });

  const convo = await ensureVisitorConversation(visitor.id);
  const saved = await prisma.commMessage.create({
    data: {
      conversationId: convo.id,
      direction: "outbound",
      via: "whatsapp",
      body: welcome,
      senderType: "system",
    },
  });

  return { visitorId: visitor.id, conversationId: saved.conversationId, messageId: saved.id };
}

export async function inviteProvider(params: InviteProviderParams) {
  const phoneE164 = formatE164(params.phoneE164) || params.phoneE164;
  assertE164(phoneE164);
  const loginBase = (process.env.NEXT_PUBLIC_ABSOLUTE_URL || "http://localhost:3000").replace(/\/?$/, "");
  const loginUrl = `${loginBase}/login`;

  // Prepare credentials
  const email = (params.email || `provider_${phoneE164.replace("+", "")}@wa.local`).trim();
  const rawPassword = params.password?.trim() || null;
  let passwordHash: string | undefined = undefined;
  if (rawPassword) {
    // Hash password (bcryptjs)
    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(rawPassword, salt);
  }

  // Compose default WhatsApp message if not provided
  const welcome = (params.message?.trim()) || (
    rawPassword
      ? `Hello! Your provider account has been created.\n\nLogin: ${loginUrl}\nEmail: ${email}\nPassword: ${rawPassword}\n\nYou will receive updates here on WhatsApp.`
      : `Hello! Your provider account has been created.\n\nLogin: ${loginUrl}\nEmail: ${email}\n\nYou will receive updates here on WhatsApp.`
  );

  // Upsert provider User + profile
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: params.name || null, role: "provider", ...(passwordHash ? { passwordHash } : {}) } as any });
  } else if (params.name && !user.name) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name: params.name } });
  }

  // If password provided for existing user, update hash
  if (user && passwordHash) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }

  const existingProfile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
  if (!existingProfile) {
    await prisma.providerProfile.create({ data: { userId: user.id, phoneE164, notifyMedication: true, notifyEscalation: true } });
  } else if (existingProfile.phoneE164 !== phoneE164) {
    await prisma.providerProfile.update({ where: { userId: user.id }, data: { phoneE164 } });
  }

  // Also create a Visitor record for logging the WhatsApp invite conversation
  const visitor = await prisma.visitor.create({ data: { displayName: params.name || null } });
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

  await sendWhatsAppViaGateway({ toE164: phoneE164, body: welcome });
  const convo = await ensureVisitorConversation(visitor.id);
  const saved = await prisma.commMessage.create({
    data: {
      conversationId: convo.id,
      direction: "outbound",
      via: "whatsapp",
      body: welcome,
      senderType: "system",
    },
  });

  return { userId: user.id, providerVisitorId: visitor.id, conversationId: convo.id, messageId: saved.id, email };
}
