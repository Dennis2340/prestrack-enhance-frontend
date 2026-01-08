// Meeting scheduling tools for Luna AI agent
import prisma from '@/lib/prisma';
import { getCalendlyClient, isCalendlyConfigured, formatCalendlyDate, CalendlySchedulingLink } from '@/lib/calendly';
import { sendWhatsAppViaGateway } from '@/lib/whatsapp';
import GoogleMeetGenerator, { GoogleMeetLink } from '@/lib/googleMeet';
import { getGoogleMeetAPI, isGoogleMeetConfigured, createHOAMeeting, GoogleMeetResponse } from '@/lib/googleMeetApi';
import { createApprovalRequest, processProviderResponse, getPendingRequests, ApprovalRequestInput } from './providerApproval';

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

  try {
    // Get patient/visitor info
    const displayName = await getDisplayName(input.phoneE164, input.subjectType, input.subjectId);
    
    // Find provider by name or get default provider
    const provider = await findProvider(input.providerName);
    
    if (!provider) {
      throw new Error('No healthcare provider available for scheduling');
    }

    // Parse the requested time
    const requestedTime = parsePreferredTime(input.preferredTime);

    // Create approval request instead of instant meeting
    const approvalInput: ApprovalRequestInput = {
      patientPhone: input.phoneE164,
      patientName: displayName,
      providerId: provider.id,
      providerName: provider.name,
      providerPhone: provider.phoneE164,
      providerEmail: provider.email,
      requestedTime: requestedTime,
      reason: input.reason,
    };

    const approvalRequest = await createApprovalRequest(approvalInput);

    return {
      success: true,
      message: 'Meeting request sent to provider for approval',
      approvalRequestId: approvalRequest.id,
      status: 'pending_provider_approval'
    };

  } catch (error) {
    console.error('[Schedule Meeting] Error:', error);
    throw new Error('Failed to schedule meeting. Please try again later.');
  }
}

export async function getAvailableSlots(input: AvailableSlotsInput) {
  if (!/^\+\d{6,15}$/.test(input.phoneE164)) {
    throw new Error('Invalid phone number format');
  }

  try {
    const displayName = await getDisplayName(input.phoneE164, input.subjectType, input.subjectId);
    const provider = await findProvider(input.providerName);
    
    if (!provider) {
      throw new Error('No healthcare provider available');
    }

    let slotsMessage: string;

    // Try Calendly first, fallback to Google Meet info
    if (isCalendlyConfigured() && provider.calendlyUserUri) {
      try {
        const calendly = getCalendlyClient();
        
        // Default to tomorrow if no date provided
        const targetDate = input.date ? new Date(input.date) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        const startTime = formatCalendlyDate(new Date(targetDate.setHours(9, 0, 0, 0))); // 9 AM
        const endTime = formatCalendlyDate(new Date(targetDate.setHours(17, 0, 0, 0))); // 5 PM

        const availableSlots = await calendly.getAvailableTimeSlots(
          provider.calendlyUserUri,
          startTime,
          endTime
        );

        // Format available slots for WhatsApp
        slotsMessage = formatAvailableSlotsMessage(availableSlots, targetDate, provider.name);
      } catch (calendlyError) {
        console.error('[Available Slots] Calendly failed, showing Google Meet info:', calendlyError);
        slotsMessage = formatGoogleMeetInfo(provider.name, displayName);
      }
    } else if (isGoogleMeetConfigured()) {
      // Show Google Meet availability info
      slotsMessage = formatGoogleMeetAPIInfo(provider.name, displayName);
    } else {
      // Show Google Meet availability info
      slotsMessage = formatGoogleMeetInfo(provider.name, displayName);
    }

    await sendWhatsAppViaGateway({ 
      toE164: input.phoneE164, 
      body: slotsMessage 
    });

    return {
      success: true,
      message: 'Availability information sent'
    };

  } catch (error) {
    console.error('[Available Slots] Error:', error);
    throw new Error('Failed to check availability. Please try again later.');
  }
}

/**
 * Process provider confirmation/decline responses
 */
export async function handleProviderResponse(
  providerPhone: string,
  message: string
): Promise<{ success: boolean; response: string }> {
  try {
    // Parse the message for approval responses
    const confirmMatch = message.match(/CONFIRM\s+(approval-\d+-[a-z0-9]+)/i);
    const declineMatch = message.match(/DECLINE\s+(approval-\d+-[a-z0-9]+)/i);

    if (confirmMatch) {
      const requestId = confirmMatch[1];
      const result = await processProviderResponse(requestId, 'confirm', providerPhone);
      
      return {
        success: result.success,
        response: result.message
      };
    }

    if (declineMatch) {
      const requestId = declineMatch[1];
      const result = await processProviderResponse(requestId, 'decline', providerPhone);
      
      return {
        success: result.success,
        response: result.message
      };
    }

    // Check for provider asking for pending requests
    if (message.toLowerCase().includes('pending') || message.toLowerCase().includes('requests')) {
      const pendingRequests = await getPendingRequests(providerPhone);
      
      if (pendingRequests.length === 0) {
        return {
          success: true,
          response: 'You have no pending meeting requests.'
        };
      }

      let responseText = `📋 *Pending Meeting Requests*\n\n`;
      
      pendingRequests.forEach((request, index) => {
        const timeStr = request.requestedTime.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        
        responseText += `${index + 1}. ${request.patientName}\n`;
        responseText += `   📅 ${timeStr}\n`;
        responseText += `   📱 ${request.patientPhone}\n`;
        responseText += `   🆔 ${request.id}\n`;
        responseText += `   ⏰ Expires: ${request.expiresAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n\n`;
      });

      responseText += `Reply with "CONFIRM [ID]" or "DECLINE [ID]" to respond.`;

      return {
        success: true,
        response: responseText
      };
    }

    return {
      success: false,
      response: 'I didn\'t understand that. For meeting requests, reply with "CONFIRM [request-id]" or "DECLINE [request-id]", or say "pending" to see your requests.'
    };

  } catch (error) {
    console.error('[Handle Provider Response] Error:', error);
    return {
      success: false,
      response: 'Failed to process your response. Please try again.'
    };
  }
}

// Helper functions for message formatting
function formatMeetingMessage(
  displayName: string,
  provider: ProviderWithCalendly,
  meetingLink: string,
  meetingType: 'calendly' | 'google_meet',
  reason?: string,
  googleMeetEvent?: GoogleMeetResponse | null
): string {
  const meetingTypeText = meetingType === 'google_meet' 
    ? 'Google Meet (instant access)' 
    : 'Calendly scheduling link (choose your time)';

  let timeInfo = '';
  if (googleMeetEvent && meetingType === 'google_meet') {
    const startTime = new Date(googleMeetEvent.start.dateTime);
    const endTime = new Date(googleMeetEvent.end.dateTime);
    timeInfo = `
📅 *Time:* ${startTime.toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} - ${endTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }

  return `🗓️ *Meeting Scheduled*

Hello ${displayName}! 

Your consultation with ${provider.name} has been arranged:

📱 *Meeting Link:* ${meetingLink}
🔗 *Type:* ${meetingTypeText}
👩‍⚕️ *Provider:* ${provider.name}
${reason ? `📝 *Reason:* ${reason}` : ''}${timeInfo}

${meetingType === 'google_meet' 
  ? 'Click the link to join at your scheduled time. The meeting is already created and ready!'
  : 'Click the link to choose your preferred time slot.'
}

This link is ready to use! If you need any changes, just reply here.

With care,
Luna ✨`;
}

function formatProviderMessage(
  displayName: string,
  provider: ProviderWithCalendly,
  meetingLink: string,
  meetingType: 'calendly' | 'google_meet',
  googleMeetEvent?: GoogleMeetResponse | null
): string {
  const meetingTypeText = meetingType === 'google_meet' 
    ? 'Google Meet (API created)' 
    : 'Calendly (scheduling link)';

  let timeInfo = '';
  if (googleMeetEvent && meetingType === 'google_meet') {
    const startTime = new Date(googleMeetEvent.start.dateTime);
    const endTime = new Date(googleMeetEvent.end.dateTime);
    timeInfo = `
📅 *Time:* ${startTime.toLocaleString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} - ${endTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })}`;
  }

  return `📋 *New Appointment Scheduled*

👤 *Patient:* ${displayName}
👩‍⚕️ *Provider:* ${provider.name}
🔗 *Meeting Link:* ${meetingLink}
📱 *Type:* ${meetingTypeText}${timeInfo}

${meetingType === 'google_meet' 
  ? 'Google Meet event has been created and added to your calendar.'
  : 'Patient will book their preferred time via Calendly.'
}

Please update your calendar accordingly.

HOA Wellness Hub 🌸`;
}

// Helper function for Google Meet API availability info
function formatGoogleMeetAPIInfo(providerName: string, displayName: string): string {
  return `📅 *Availability Information*

Hello ${displayName}!

👩‍⚕️ *Provider:* ${providerName}
📱 *Meeting Type:* Google Meet (provider approval required)

🔗 **How it works:**
• I'll send your request to the provider
• Provider will confirm via WhatsApp
• Once approved, I'll create the Google Meet event
• You'll receive the calendar invitation and Meet link

📋 **Next Steps:**
1. Tell me when you'd like to meet (e.g., "tomorrow at 2 PM")
2. I'll send the request to ${providerName}
3. Provider will confirm and I'll create the meeting

💡 *Example:* "I'd like to schedule for tomorrow at 2 PM"

Ready to schedule? Just tell me your preferred time!

With care,
Luna ✨`;
}

// Helper function for Google Meet availability info (fallback)
function formatGoogleMeetInfo(providerName: string, displayName: string): string {
  return `📅 *Availability Information*

Hello ${displayName}!

👩‍⚕️ *Provider:* ${providerName}
📱 *Meeting Type:* Google Meet (provider approval required)

🔗 **How it works:**
• I'll send your request to the provider
• Provider will confirm via WhatsApp
• Once approved, I'll create the meeting link
• You'll receive the link instantly

📋 **Next Steps:**
1. Tell me when you'd like to meet (e.g., "tomorrow at 2 PM")
2. I'll send the request to ${providerName}
3. Provider will confirm and I'll create the meeting

💡 *Example:* "I'd like to schedule for tomorrow at 2 PM"

Ready to schedule? Just tell me your preferred time!

With care,
Luna ✨`;
}

// Helper functions for existing Calendly formatting
function formatAvailableSlotsMessage(availableSlots: any[], targetDate: Date, providerName: string): string {
  const dateStr = targetDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  if (availableSlots.length === 0) {
    return `📅 *Availability Check*

Hello! 

👩‍⚕️ *Provider:* ${providerName}
📅 *Date:* ${dateStr}

❌ No available slots found for this date.

💡 Try a different date or I can create an instant Google Meet link for you!

Just reply with your preferred date and time.

With care,
Luna ✨`;
  }

  let message = `📅 *Available Time Slots*

👩‍⚕️ *Provider:* ${providerName}
📅 *Date:* ${dateStr}

✅ Available times:\n\n`;

  availableSlots.forEach((slot, index) => {
    const time = new Date(slot.start_time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    message += `${index + 1}. ${time}\n`;
  });

  message += `\n💡 Reply with your preferred time number (e.g., "I want slot 2")
Or tell me "Google Meet" for instant access!

With care,
Luna ✨`;

  return message;
}

// Helper functions for display name and provider lookup
async function getDisplayName(phoneE164: string, subjectType: 'patient' | 'visitor', subjectId: string | null): Promise<string> {
  try {
    if (subjectType === 'patient' && subjectId) {
      const patient = await prisma.patient.findUnique({
        where: { id: subjectId },
        select: { firstName: true, lastName: true }
      });
      if (patient) {
        return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
      }
    }
    
    const visitor = await prisma.visitor.findFirst({
      where: { contacts: { some: { type: 'whatsapp', value: phoneE164 } } },
      select: { displayName: true }
    });
    
    return visitor?.displayName || 'Friend';
  } catch {
    return 'Friend';
  }
}

// Parse preferred time string into Date
function parsePreferredTime(preferredTime?: string): Date {
  if (!preferredTime) {
    // Default to tomorrow at 2 PM
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(14, 0, 0, 0); // 2 PM
    return tomorrow;
  }

  const now = new Date();
  const timeLower = preferredTime.toLowerCase();

  // Handle common time expressions
  if (timeLower.includes('tomorrow')) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Extract time if provided
    const timeMatch = preferredTime.match(/(\d{1,2})\s*(:\s*\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].replace(':', '')) : 0;
      const period = timeMatch[3].toLowerCase();
      
      tomorrow.setHours(
        period === 'pm' && hours !== 12 ? hours + 12 : hours,
        minutes,
        0,
        0
      );
    } else {
      tomorrow.setHours(14, 0, 0, 0); // Default 2 PM
    }
    
    return tomorrow;
  }

  if (timeLower.includes('today')) {
    const today = new Date();
    
    const timeMatch = preferredTime.match(/(\d{1,2})\s*(:\s*\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2].replace(':', '')) : 0;
      const period = timeMatch[3].toLowerCase();
      
      today.setHours(
        period === 'pm' && hours !== 12 ? hours + 12 : hours,
        minutes,
        0,
        0
      );
    } else {
      today.setHours(14, 0, 0, 0); // Default 2 PM
    }
    
    return today;
  }

  // Default to tomorrow at 2 PM if parsing fails
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(14, 0, 0, 0);
  return tomorrow;
}

interface ProviderWithCalendly {
  id: string;
  userId: string;
  phoneE164: string;
  notifyMedication: boolean;
  notifyEscalation: boolean;
  notificationCooldownMinutes: number;
  name: string;
  email: string;
  calendlyUserUri?: string;
  uri?: string;
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
      const fallbackProvider = await prisma.providerProfile.findFirst({
        include: {
          user: { select: { name: true, email: true } }
        }
      });
      
      if (!fallbackProvider) {
        return null;
      }
      
      // Try to get Calendly user URI by email for fallback
      let calendlyUserUri = null;
      if (fallbackProvider.user.email) {
        try {
          const calendly = getCalendlyClient();
          const calendlyUser = await calendly.getUserByEmail(fallbackProvider.user.email);
          calendlyUserUri = calendlyUser?.uri || null;
        } catch (error) {
          console.error('[Find Provider Fallback] Calendly lookup error:', error);
        }
      }

      return {
        ...fallbackProvider,
        name: fallbackProvider.user.name,
        email: fallbackProvider.user.email,
        calendlyUserUri: calendlyUserUri || fallbackProvider.user.email,
        uri: calendlyUserUri || `/users/${fallbackProvider.user.email}`
      };
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