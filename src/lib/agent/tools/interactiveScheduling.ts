// Interactive Meeting Scheduling Flow for HOA
// Patients check availability boxes → System generates meeting links → Links shared with doctor & patient

import prisma from '@/lib/prisma';
import { getCalendlyClient, formatCalendlyDate } from '@/lib/calendly';
import { sendWhatsAppViaGateway } from '@/lib/whatsapp';

export type SchedulingSession = {
  id: string;
  patientId: string;
  providerId: string;
  status: 'selecting_dates' | 'selecting_times' | 'confirming' | 'completed';
  selectedDates: string[];
  selectedTimeSlot?: {
    date: string;
    time: string;
    providerUri: string;
  };
  meetingLink?: string;
  createdAt: Date;
  expiresAt: Date;
};

export type AvailabilityBox = {
  date: string;
  timeSlots: Array<{
    time: string;
    available: boolean;
    providerUri: string;
  }>;
};

// Start interactive scheduling session
export async function startSchedulingSession(
  phoneE164: string,
  patientId: string,
  providerName?: string
): Promise<SchedulingSession> {
  const sessionId = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Find provider
  const provider = await findProviderForScheduling(providerName);
  if (!provider) {
    throw new Error('No healthcare provider available');
  }

  const session: SchedulingSession = {
    id: sessionId,
    patientId,
    providerId: provider.id,
    status: 'selecting_dates',
    selectedDates: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  };

  // Store session (you could use Redis or database)
  await storeSchedulingSession(session);

  // Send availability boxes to patient
  await sendAvailabilityBoxes(phoneE164, provider, session);

  return session;
}

// Send availability boxes (date selection)
export async function sendAvailabilityBoxes(
  phoneE164: string,
  provider: any,
  session: SchedulingSession
) {
  const calendly = getCalendlyClient();
  
  // Get next 7 days of availability
  const availabilityBoxes: AvailabilityBox[] = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    
    try {
      const timeSlots = await getProviderTimeSlots(
        calendly,
        provider.calendlyUserUri || provider.uri,
        checkDate
      );
      
      availabilityBoxes.push({
        date: checkDate.toISOString().split('T')[0], // YYYY-MM-DD
        timeSlots: timeSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          providerUri: slot.providerUri
        }))
      });
    } catch (error) {
      console.error(`[Availability] Error for ${checkDate}:`, error);
    }
  }

  // Format WhatsApp message with checkboxes
  const message = formatAvailabilityBoxesMessage(availabilityBoxes, provider.name, session.id);
  
  await sendWhatsAppViaGateway({ 
    toE164: phoneE164, 
    body: message 
  });
}

// Process patient's date selection
export async function processDateSelection(
  sessionId: string,
  phoneE164: string,
  selectedDates: string[]
): Promise<void> {
  const session = await getSchedulingSession(sessionId);
  if (!session || session.status !== 'selecting_dates') {
    throw new Error('Invalid or expired session');
  }

  session.selectedDates = selectedDates;
  session.status = 'selecting_times';
  await storeSchedulingSession(session);

  // Send time slots for selected dates
  await sendTimeSlotsForDates(phoneE164, session);
}

// Send time slots for selected dates
export async function sendTimeSlotsForDates(
  phoneE164: string,
  session: SchedulingSession
) {
  const calendly = getCalendlyClient();
  const provider = await findProviderById(session.providerId);
  
  let timeSlotsMessage = `⏰ *Available Time Slots*\n\n`;
  
  for (const date of session.selectedDates) {
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    
    timeSlotsMessage += `📅 *${dateStr}*\n`;
    
    try {
      const timeSlots = await getProviderTimeSlots(
        calendly,
        provider.calendlyUserUri || provider.uri,
        dateObj
      );
      
      const availableSlots = timeSlots.filter(slot => slot.available);
      
      if (availableSlots.length === 0) {
        timeSlotsMessage += `❌ No available slots\n\n`;
      } else {
        availableSlots.forEach((slot, index) => {
          timeSlotsMessage += `${index + 1}. ${slot.time}\n`;
        });
        timeSlotsMessage += '\n';
      }
    } catch (error) {
      timeSlotsMessage += `❌ Error checking availability\n\n`;
    }
  }
  
  timeSlotsMessage += `💡 *Reply with your preferred time slot number*\n\nExample: "I want slot 2"\n\nOr reply "back" to select different dates.`;

  await sendWhatsAppViaGateway({ 
    toE164: phoneE164, 
    body: timeSlotsMessage 
  });
}

// Process time slot selection and create meeting
export async function processTimeSlotSelection(
  sessionId: string,
  phoneE164: string,
  timeSlotIndex: number
): Promise<void> {
  const session = await getSchedulingSession(sessionId);
  if (!session || session.status !== 'selecting_times') {
    throw new Error('Invalid or expired session');
  }

  const calendly = getCalendlyClient();
  const provider = await findProviderById(session.providerId);
  
  // Find the selected time slot
  const selectedDate = session.selectedDates[0]; // For simplicity, use first selected date
  const timeSlots = await getProviderTimeSlots(
    calendly,
    provider.calendlyUserUri || provider.uri,
    new Date(selectedDate)
  );
  
  const selectedSlot = timeSlots.filter(slot => slot.available)[timeSlotIndex - 1];
  
  if (!selectedSlot) {
    throw new Error('Invalid time slot selection');
  }

  // Create the meeting link
  const schedulingLink = await calendly.createSchedulingLink({
    max_event_count: 1,
    owner: selectedSlot.providerUri,
    owner_type: 'users',
  });

  // Update session
  session.selectedTimeSlot = {
    date: selectedDate,
    time: selectedSlot.time,
    providerUri: selectedSlot.providerUri
  };
  session.meetingLink = schedulingLink.url;
  session.status = 'completed';
  await storeSchedulingSession(session);

  // Send confirmation with meeting link
  await sendMeetingConfirmation(phoneE164, session, provider, schedulingLink);
}

// Send meeting confirmation
async function sendMeetingConfirmation(
  phoneE164: string,
  session: SchedulingSession,
  provider: any,
  schedulingLink: any
) {
  const confirmationMessage = `✅ *Appointment Scheduled!*

🗓️ *Date:* ${new Date(session.selectedTimeSlot!.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })}
⏰ *Time:* ${session.selectedTimeSlot!.time}
👩‍⚕️ *Provider:* ${provider.name}

📱 *Meeting Link:* ${schedulingLink.url}

🔗 *Share this link with your provider*
The same link has been sent to ${provider.name} for their records.

⚠️ *Important:* 
- This link is valid for one booking only
- Please save the link for your appointment
- You'll receive reminders before the appointment

Need to reschedule? Just reply "reschedule" anytime!

With care,
Luna ✨`;

  await sendWhatsAppViaGateway({ 
    toE164: phoneE164, 
    body: confirmationMessage 
  });

  // Also notify the provider
  await notifyProvider(provider, session, schedulingLink);
}

// Notify provider about the scheduled meeting
async function notifyProvider(
  provider: any,
  session: SchedulingSession,
  schedulingLink: any
) {
  const providerMessage = `📋 *New Appointment Scheduled*

👤 *Patient:* HOA Patient
📅 *Date:* ${new Date(session.selectedTimeSlot!.date).toLocaleDateString()}
⏰ *Time:* ${session.selectedTimeSlot!.time}
🔗 *Meeting Link:* ${schedulingLink.url}

The patient has received the scheduling link and can join the meeting.

Please update your calendar accordingly.

HOA Wellness Hub 🌸`;

  // Send to provider if they have WhatsApp
  if (provider.phoneE164) {
    await sendWhatsAppViaGateway({ 
      toE164: provider.phoneE164, 
      body: providerMessage 
    });
  }
}

interface ProviderWithCalendlyForScheduling {
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

// Helper functions
async function findProviderForScheduling(providerName?: string): Promise<ProviderWithCalendlyForScheduling | null> {
  const whereClause = providerName 
    ? { user: { name: { contains: providerName, mode: 'insensitive' as const } } }
    : {};

  return await prisma.providerProfile.findFirst({
    where: whereClause,
    include: {
      user: { select: { name: true, email: true } }
    },
    orderBy: { user: { name: 'asc' } }
  });
}

async function findProviderById(providerId: string): Promise<ProviderWithCalendlyForScheduling | null> {
  return await prisma.providerProfile.findFirst({
    where: { id: providerId },
    include: {
      user: { select: { name: true, email: true } }
    }
  });
}

async function getProviderTimeSlots(
  calendly: any,
  providerUri: string,
  date: Date
) {
  const startTime = formatCalendlyDate(new Date(date.setHours(9, 0, 0, 0)));
  const endTime = formatCalendlyDate(new Date(date.setHours(17, 0, 0, 0)));
  
  try {
    const availableTimes = await calendly.getAvailableTimeSlots(
      providerUri,
      startTime,
      endTime
    );
    
    // Format into time slots
    return availableTimes.map((slot: any) => ({
      time: new Date(slot.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      available: true,
      providerUri: slot.user || providerUri
    }));
  } catch (error) {
    console.error('[Time Slots] Error:', error);
    return [];
  }
}

function formatAvailabilityBoxesMessage(
  boxes: AvailabilityBox[],
  providerName: string,
  sessionId: string
): string {
  let message = `📅 *Select Available Dates*\n\n`;
  message += `👩‍⚕️ *Provider:* ${providerName}\n\n`;
  message += `📋 *Check the boxes for dates that work for you:*\n\n`;
  
  boxes.forEach((box, index) => {
    const dateObj = new Date(box.date);
    const dateStr = dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    const hasSlots = box.timeSlots.some(slot => slot.available);
    const status = hasSlots ? '✅' : '❌';
    
    message += `${index + 1}. ${status} ${dateStr}\n`;
  });
  
  message += `\n💡 *Reply with the numbers of your preferred dates*\n`;
  message += `Example: "1, 3, 5" or "I want dates 1 and 3"\n\n`;
  message += `📱 This session expires in 30 minutes`;
  
  return message;
}

// Session storage (you could replace with Redis)
async function storeSchedulingSession(session: SchedulingSession) {
  // For now, store in memory or database
  // In production, use Redis with TTL
  
  // First check if document exists
  const existingDoc = await prisma.document.findFirst({
    where: { url: `scheduling_session_${session.id}` }
  });
  
  if (existingDoc) {
    // Update existing
    await prisma.document.update({
      where: { id: existingDoc.id },
      data: {
        metadata: {
          ...JSON.parse(existingDoc.metadata?.toString() || '{}'),
          sessionData: JSON.stringify(session),
          expiresAt: session.expiresAt.toISOString()
        },
        updatedAt: new Date()
      }
    });
  } else {
    // Create new
    await prisma.document.create({
      data: {
        url: `scheduling_session_${session.id}`,
        filename: `session_${session.id}.json`,
        contentType: 'application/json',
        title: 'Scheduling Session',
        typeCode: 'scheduling_session',
        patientId: session.patientId,
        metadata: {
          sessionId: session.id,
          sessionData: JSON.stringify(session),
          expiresAt: session.expiresAt.toISOString()
        }
      }
    });
  }
}

async function getSchedulingSession(sessionId: string): Promise<SchedulingSession | null> {
  try {
    const doc = await prisma.document.findFirst({
      where: {
        url: `scheduling_session_${sessionId}`,
        typeCode: 'scheduling_session'
      }
    });
    
    if (!doc) return null;
    
    const sessionData = doc.metadata as any;
    const session = JSON.parse(sessionData.sessionData || '{}') as SchedulingSession;
    
    // Check if expired
    if (new Date() > new Date(session.expiresAt)) {
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}
