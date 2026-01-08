// Interactive Meeting Scheduling Flow for HOA
// Patients select time → Provider approval → Google Meet event creation

import prisma from '@/lib/prisma';
import { sendWhatsAppViaGateway } from '@/lib/whatsapp';
import { isGoogleMeetConfigured } from '@/lib/googleMeetApi';
import { createApprovalRequest, getPendingRequests } from './providerApproval';

export type SchedulingSession = {
  id: string;
  patientId: string;
  providerId: string;
  status: 'selecting_time' | 'awaiting_approval' | 'completed';
  selectedTime?: Date;
  reason?: string;
  meetingLink?: string;
  createdAt: Date;
  expiresAt: Date;
};

// Start interactive scheduling session
export async function startSchedulingSession(
  phoneE164: string,
  patientId: string,
  providerName?: string
): Promise<{session: SchedulingSession, message: string}> {
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
    status: 'selecting_time',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  };

  // Store session
  await storeSchedulingSession(session);

  // Generate time selection message (don't send directly)
  const message = `📅 *Schedule Your Appointment*

👩‍⚕️ *Provider:* ${provider.name}
📱 *Meeting Type:* Google Meet (provider approval required)

🔗 **How it works:**
• Tell me when you'd like to meet
• I'll send your request to ${provider.name}
• Provider will confirm via WhatsApp
• Once approved, I'll create the Google Meet event
• You'll receive the calendar invitation and Meet link

💡 *Examples:*
• "tomorrow at 2 PM"
• "today at 3:30 PM" 
• "next Monday at 10 AM"

📋 *Reply with your preferred time*
This session expires in 30 minutes

With care,
Luna ✨`;

  return { session, message };
}


// Process time selection and create approval request
export async function processTimeSelection(
  sessionId: string,
  phoneE164: string,
  preferredTime: string,
  reason?: string
): Promise<string> {
  const session = await getSchedulingSession(sessionId);
  if (!session || session.status !== 'selecting_time') {
    throw new Error('Invalid or expired session');
  }

  const provider = await findProviderById(session.providerId);
  if (!provider) {
    throw new Error('Provider not found');
  }

  // Parse requested time
  const requestedTime = parsePreferredTime(preferredTime);

  // Update session
  session.selectedTime = requestedTime;
  session.reason = reason;
  session.status = 'awaiting_approval';
  await storeSchedulingSession(session);

  // Create approval request
  await createApprovalRequest({
    patientPhone: phoneE164,
    patientName: await getPatientName(session.patientId),
    providerId: provider.id,
    providerName: provider.name,
    providerPhone: provider.phoneE164,
    providerEmail: provider.email,
    requestedTime: requestedTime,
    reason: reason,
  });

  // Generate confirmation message (don't send directly)
  const message = `✅ *Meeting Request Sent*

👩‍⚕️ *Provider:* ${provider.name}
📅 *Requested Time:* ${requestedTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}

🔗 **Next Steps:**
• Your request has been sent to ${provider.name}
• Provider will review and confirm via WhatsApp
• Once approved, you'll receive Google Meet link
• You'll get calendar invitation automatically

⏰ *Response Time:* Usually within a few hours

Need to make changes? Reply "reschedule" anytime!

With care,
Luna ✨`;

  return message;
}


// Helper functions
async function findProviderForScheduling(providerName?: string): Promise<any> {
  try {
    const whereClause = providerName 
      ? { user: { name: { contains: providerName, mode: 'insensitive' as const } } }
      : {};

    const provider = await prisma.providerProfile.findFirst({
      where: whereClause,
      include: {
        user: true
      },
      orderBy: { user: { name: 'asc' } }
    });

    if (!provider) {
      // Get any provider as fallback
      const fallbackProvider = await prisma.providerProfile.findFirst({
        include: {
          user: true
        }
      });
      
      if (!fallbackProvider) {
        return null;
      }

      return {
        ...fallbackProvider,
        name: fallbackProvider.user.name,
        email: fallbackProvider.user.email,
      };
    }

    return {
      ...provider,
      name: provider.user.name,
      email: provider.user.email,
    };
  } catch (error) {
    console.error('[Find Provider] Error:', error);
    return null;
  }
}

async function findProviderById(providerId: string): Promise<any> {
  try {
    const provider = await prisma.providerProfile.findFirst({
      where: { id: providerId },
      include: {
        user: true
      }
    });

    if (!provider) {
      return null;
    }

    return {
      ...provider,
      name: provider.user.name,
      email: provider.user.email,
    };
  } catch (error) {
    console.error('[Find Provider By ID] Error:', error);
    return null;
  }
}

async function getPatientName(patientId: string): Promise<string> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true }
    });
    
    if (patient) {
      return `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
    }
    
    return 'Patient';
  } catch {
    return 'Patient';
  }
}

// Parse preferred time string into Date
function parsePreferredTime(preferredTime: string): Date {
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

  // Handle "next [day]" expressions
  const dayMatch = preferredTime.match(/next\s+(\w+)/i);
  if (dayMatch) {
    const dayName = dayMatch[1].toLowerCase();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = daysOfWeek.indexOf(dayName);
    
    if (targetDay !== -1) {
      const nextDate = new Date(now);
      const currentDay = now.getDay();
      let daysUntilTarget = targetDay - currentDay;
      
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week
      }
      
      nextDate.setDate(now.getDate() + daysUntilTarget);
      
      const timeMatch = preferredTime.match(/(\d{1,2})\s*(:\s*\d{2})?\s*(am|pm)/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2].replace(':', '')) : 0;
        const period = timeMatch[3].toLowerCase();
        
        nextDate.setHours(
          period === 'pm' && hours !== 12 ? hours + 12 : hours,
          minutes,
          0,
          0
        );
      } else {
        nextDate.setHours(14, 0, 0, 0); // Default 2 PM
      }
      
      return nextDate;
    }
  }

  // Default to tomorrow at 2 PM if parsing fails
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(14, 0, 0, 0);
  return tomorrow;
}

// Session storage
async function storeSchedulingSession(session: SchedulingSession) {
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
    // Create new - only include patientId if it exists and is valid
    const createData: any = {
      url: `scheduling_session_${session.id}`,
      filename: `session_${session.id}.json`,
      contentType: 'application/json',
      title: 'Scheduling Session',
      typeCode: 'scheduling_session',
      metadata: {
        sessionId: session.id,
        sessionData: JSON.stringify(session),
        expiresAt: session.expiresAt.toISOString()
      }
    };
    
    // Only add patientId if it's a valid patient ID
    if (session.patientId && session.patientId !== '') {
      createData.patientId = session.patientId;
    }
    
    await prisma.document.create({
      data: createData
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
