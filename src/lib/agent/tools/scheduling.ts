// Meeting scheduling tools for Luna AI agent
import prisma from '@/lib/prisma';
import { getCalendlyClient, isCalendlyConfigured, formatCalendlyDate, CalendlySchedulingLink } from '@/lib/calendly';
import { sendWhatsAppViaGateway } from '@/lib/whatsapp';

export type ScheduleMeetingInput = {
  phoneE164: string;
  providerName?: string;
  preferredTime?: string;
  reason?: string;
  subjectType: 'patient' | 'visitor';
  subjectId: string | null;
};

export type AvailableSlotsInput = {
  phoneE164: string;
  providerName?: string;
  date?: string; // YYYY-MM-DD format
  subjectType: 'patient' | 'visitor';
  subjectId: string | null;
};

export async function scheduleMeeting(input: ScheduleMeetingInput) {
  if (!/^\+\d{6,15}$/.test(input.phoneE164)) {
    throw new Error('Invalid phone number format');
  }

  if (!isCalendlyConfigured()) {
    throw new Error('Meeting scheduling is not available at the moment');
  }

  try {
    // Get patient/visitor info
    const displayName = await getDisplayName(input.phoneE164, input.subjectType, input.subjectId);
    
    // Find provider by name or get default provider
    const provider = await findProvider(input.providerName);
    
    if (!provider) {
      throw new Error('No healthcare provider available for scheduling');
    }

    // Create a single-use scheduling link
    const calendly = getCalendlyClient();
    const schedulingLink = await calendly.createSchedulingLink({
      max_event_count: 1,
      owner: provider.calendlyUserUri || provider.uri,
      owner_type: 'users',
    });

    // Log the scheduling request
    await logSchedulingRequest(input, schedulingLink, displayName, provider);

    // Send WhatsApp message with scheduling link
    const message = `🗓️ *Meeting Scheduling Request*

Hello ${displayName}! 

I've arranged a scheduling link for your consultation:

📅 *Click here to book your appointment:*
${schedulingLink.url}

${input.reason ? `*Reason:* ${input.reason}` : ''}

This link is valid for one booking only. If you need assistance, just reply here!

With care,
Luna ✨`;

    await sendWhatsAppViaGateway({ 
      toE164: input.phoneE164, 
      body: message 
    });

    return {
      success: true,
      schedulingUrl: schedulingLink.url,
      providerName: provider.name,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

  } catch (error: any) {
    console.error('[Scheduling] Error:', error);
    
    // Send error message via WhatsApp
    const errorMessage = `❌ *Scheduling Error*

I'm having trouble setting up your appointment right now. 

Please try again later or contact our support team directly.

Error: ${error.message || 'Unknown error'}

Luna ✨`;

    await sendWhatsAppViaGateway({ 
      toE164: input.phoneE164, 
      body: errorMessage 
    });

    throw error;
  }
}

export async function getAvailableSlots(input: AvailableSlotsInput) {
  if (!/^\+\d{6,15}$/.test(input.phoneE164)) {
    throw new Error('Invalid phone number format');
  }

  if (!isCalendlyConfigured()) {
    throw new Error('Meeting scheduling is not available at the moment');
  }

  try {
    const displayName = await getDisplayName(input.phoneE164, input.subjectType, input.subjectId);
    const provider = await findProvider(input.providerName);
    
    if (!provider) {
      throw new Error('No healthcare provider available');
    }

    const calendly = getCalendlyClient();
    
    // Default to tomorrow if no date provided
    const targetDate = input.date ? new Date(input.date) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startTime = formatCalendlyDate(new Date(targetDate.setHours(9, 0, 0, 0))); // 9 AM
    const endTime = formatCalendlyDate(new Date(targetDate.setHours(17, 0, 0, 0))); // 5 PM

    const availableSlots = await calendly.getAvailableTimeSlots(
      provider.calendlyUserUri || provider.uri,
      startTime,
      endTime
    );

    // Format available slots for WhatsApp
    const slotsMessage = formatAvailableSlotsMessage(availableSlots, targetDate, provider.name);

    await sendWhatsAppViaGateway({ 
      toE164: input.phoneE164, 
      body: slotsMessage 
    });

    return {
      success: true,
      availableSlots,
      date: targetDate.toISOString().split('T')[0],
      providerName: provider.name,
    };

  } catch (error: any) {
    console.error('[Available Slots] Error:', error);
    
    const errorMessage = `❌ *Availability Check Error*

I couldn't check availability right now. Please try again later.

Luna ✨`;

    await sendWhatsAppViaGateway({ 
      toE164: input.phoneE164, 
      body: errorMessage 
    });

    throw error;
  }
}

// Helper functions
async function getDisplayName(phoneE164: string, subjectType: string, subjectId: string | null): Promise<string> {
  try {
    if (subjectType === 'patient' && subjectId) {
      const patient = await prisma.patient.findUnique({
        where: { id: subjectId },
        select: { firstName: true, lastName: true }
      });
      if (patient) {
        return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Friend';
      }
    }

    // Try to find by contact channel
    const contact = await prisma.contactChannel.findFirst({
      where: { type: 'whatsapp', value: phoneE164 },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        visitor: { select: { displayName: true } }
      }
    });

    if (contact?.patient) {
      return [contact.patient.firstName, contact.patient.lastName].filter(Boolean).join(' ') || 'Friend';
    }
    
    if (contact?.visitor?.displayName) {
      return contact.visitor.displayName;
    }

    return 'Friend';
  } catch {
    return 'Friend';
  }
}

interface ProviderWithCalendly {
  id: string;
  userId: string;
  phoneE164: string;
  notifyMedication: boolean;
  notifyEscalation: boolean;
  notificationCooldownMinutes: number;
  user: {
    name: string;
    email: string;
  };
  calendlyUserUri?: string;
  uri?: string;
  name?: string;
  email?: string;
}

async function findProvider(providerName?: string): Promise<ProviderWithCalendly | null> {
  try {
    const whereClause = providerName 
      ? { user: { name: { contains: providerName, mode: 'insensitive' as const } } }
      : {};

    const provider = await prisma.providerProfile.findFirst({
      where: whereClause,
      include: {
        user: { select: { name: true, email: true } }
      },
      orderBy: { user: { name: 'asc' } }
    });

    if (!provider) {
      // Get any provider as fallback
      return await prisma.providerProfile.findFirst({
        include: {
          user: { select: { name: true, email: true } }
        }
      });
    }

    // Try to get Calendly user URI by email
    let calendlyUserUri = null;
    if (provider.user.email) {
      try {
        const calendly = getCalendlyClient();
        const calendlyUser = await calendly.getUserByEmail(provider.user.email);
        calendlyUserUri = calendlyUser?.uri || null;
      } catch (error) {
        console.error('[Find Provider] Calendly lookup error:', error);
      }
    }

    return {
      ...provider,
      name: provider.user.name,
      email: provider.user.email,
      calendlyUserUri: calendlyUserUri || provider.user.email, // Use Calendly URI if found
      uri: calendlyUserUri || `/users/${provider.user.email}` // Use actual Calendly URI
    };
  } catch (error) {
    console.error('[Find Provider] Error:', error);
    return null;
  }
}

async function logSchedulingRequest(
  input: ScheduleMeetingInput,
  schedulingLink: CalendlySchedulingLink,
  displayName: string,
  provider: ProviderWithCalendly
) {
  try {
    // Create a document to track the scheduling request
    await prisma.document.create({
      data: {
        url: schedulingLink.url,
        filename: `scheduling_request_${Date.now()}.json`,
        contentType: 'application/json',
        title: 'Meeting Scheduling Request',
        typeCode: 'scheduling_request',
        patientId: input.subjectType === 'patient' ? input.subjectId || undefined : undefined,
        metadata: {
          phoneE164: input.phoneE164,
          displayName,
          providerName: provider.name,
          providerEmail: provider.email,
          preferredTime: input.preferredTime,
          reason: input.reason,
          schedulingLinkUri: schedulingLink.uri,
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });

    // Log in conversation if exists
    const conversation = await prisma.conversation.findFirst({
      where: {
        subjectType: input.subjectType as any,
        [input.subjectType === 'patient' ? 'patientId' : 'visitorId']: input.subjectId,
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (conversation) {
      await prisma.commMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'outbound',
          via: 'whatsapp',
          body: `Scheduling link sent for ${provider.name} consultation: ${schedulingLink.url}`,
          senderType: 'system',
          meta: {
            type: 'scheduling_request',
            providerName: provider.name,
            schedulingUrl: schedulingLink.url,
          },
        } as any,
      });
    }
  } catch (error) {
    console.error('[Log Scheduling] Error:', error);
    // Don't throw - logging errors shouldn't break the flow
  }
}

function formatAvailableSlotsMessage(slots: any[], date: Date, providerName: string): string {
  const dateStr = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!slots || slots.length === 0) {
    return `📅 *Available Appointments*

No available slots found for ${dateStr} with ${providerName}.

Would you like me to:
1. Check a different date?
2. Send you a general scheduling link to choose your own time?

Just let me know! 🌸

Luna ✨`;
  }

  const slotsList = slots.slice(0, 6).map((slot, index) => {
    const startTime = new Date(slot.start_time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${index + 1}. ${startTime}`;
  }).join('\n');

  return `📅 *Available Appointments with ${providerName}*

*${dateStr}:*

${slotsList}

${slots.length > 6 ? `... and ${slots.length - 6} more slots` : ''}

Would you like me to:
1. Book a specific time?
2. Send you a scheduling link to choose?

Just reply with your preference! 🌸

Luna ✨`;
}
