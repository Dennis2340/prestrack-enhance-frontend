// Provider approval workflow for HOA scheduling
// Handles provider confirmation before creating meetings

import prisma from '@/lib/prisma';
import { sendWhatsAppViaGateway } from '@/lib/whatsapp';
import { createHOAMeeting, GoogleMeetResponse } from '@/lib/googleMeetApi';

function hydratePendingMeetingRequest(req: any): PendingMeetingRequest {
  const hydrated: any = { ...(req || {}) };
  if (hydrated.requestedTime && !(hydrated.requestedTime instanceof Date)) hydrated.requestedTime = new Date(hydrated.requestedTime);
  if (hydrated.createdAt && !(hydrated.createdAt instanceof Date)) hydrated.createdAt = new Date(hydrated.createdAt);
  if (hydrated.expiresAt && !(hydrated.expiresAt instanceof Date)) hydrated.expiresAt = new Date(hydrated.expiresAt);
  return hydrated as PendingMeetingRequest;
}

async function ensurePatientIdForPhone(phoneE164: string): Promise<string> {
  const cc = await prisma.contactChannel.findFirst({
    where: { type: 'whatsapp', value: phoneE164, patientId: { not: null } },
    select: { patientId: true } as any,
  });
  if (cc?.patientId) return cc.patientId as any;

  const created = await prisma.patient.create({
    data: {
      firstName: null,
      lastName: null,
      contacts: {
        create: {
          ownerType: 'patient' as any,
          type: 'whatsapp',
          value: phoneE164,
          verified: true,
          preferred: true,
        },
      },
    },
    select: { id: true },
  });
  return created.id;
}

export interface PendingMeetingRequest {
  id: string;
  patientPhone: string;
  patientName: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  providerEmail: string;
  requestedTime: Date;
  reason?: string;
  status: 'pending' | 'confirmed' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  meetingLink?: string;
  googleMeetEventId?: string;
}

export interface ApprovalRequestInput {
  patientPhone: string;
  patientName: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  providerEmail: string;
  requestedTime: Date;
  reason?: string;
}

/**
 * Create a pending meeting request and notify provider
 */
export async function createApprovalRequest(input: ApprovalRequestInput): Promise<PendingMeetingRequest> {
  const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiry

  // Store the approval request in database (using Document model)
  const approvalRequest: PendingMeetingRequest = {
    id: requestId,
    patientPhone: input.patientPhone,
    patientName: input.patientName,
    providerId: input.providerId,
    providerName: input.providerName,
    providerPhone: input.providerPhone,
    providerEmail: input.providerEmail,
    requestedTime: input.requestedTime,
    reason: input.reason,
    status: 'pending',
    createdAt: new Date(),
    expiresAt: expiresAt,
  };

  const patientIdForDoc = await ensurePatientIdForPhone(input.patientPhone);

  // Persist first (never lose the request even if WhatsApp gateway is down)
  const createdDoc = await prisma.document.create({
    data: {
      typeCode: 'meeting_approval',
      url: requestId,
      filename: requestId,
      contentType: 'application/json',
      patientId: patientIdForDoc,
      metadata: approvalRequest as any,
    },
    select: { id: true },
  });

  // Send WhatsApp notifications (best-effort)
  let providerSendOk = true;
  let patientSendOk = true;
  let providerSendError: string | null = null;
  let patientSendError: string | null = null;
  try {
    const providerMessage = formatProviderApprovalMessage(approvalRequest);
    await sendWhatsAppViaGateway({ toE164: input.providerPhone, body: providerMessage });
  } catch (e: any) {
    providerSendOk = false;
    providerSendError = e?.message || 'Failed to send provider approval message';
    console.error('[Create Approval Request] Provider WhatsApp send failed:', providerSendError);
  }
  try {
    const patientMessage = formatPatientAcknowledgmentMessage(approvalRequest);
    await sendWhatsAppViaGateway({ toE164: input.patientPhone, body: patientMessage });
  } catch (e: any) {
    patientSendOk = false;
    patientSendError = e?.message || 'Failed to send patient acknowledgment';
    console.error('[Create Approval Request] Patient WhatsApp send failed:', patientSendError);
  }

  // Record send outcome for debugging/admin UI
  try {
    await prisma.document.update({
      where: { id: createdDoc.id },
      data: {
        metadata: {
          ...(approvalRequest as any),
          delivery: {
            provider: { ok: providerSendOk, error: providerSendError },
            patient: { ok: patientSendOk, error: patientSendError },
          },
        } as any,
      },
    });
  } catch {
    // ignore
  }

  return approvalRequest;
}

/**
 * Process provider response (confirm/decline)
 */
export async function processProviderResponse(
  requestId: string,
  response: 'confirm' | 'decline',
  providerPhone: string
): Promise<{ success: boolean; message: string; meetingLink?: string }> {
  try {
    // Retrieve the approval request
    const document = await prisma.document.findFirst({
      where: {
        typeCode: 'meeting_approval',
        url: requestId,
      },
    });

    if (!document) {
      return { success: false, message: 'Approval request not found' };
    }

    const approvalRequest = hydratePendingMeetingRequest(document.metadata as any);

    // Verify provider phone matches
    if (approvalRequest.providerPhone !== providerPhone) {
      return { success: false, message: 'Unauthorized: Provider phone mismatch' };
    }

    // Check if request is still pending and not expired
    if (approvalRequest.status !== 'pending') {
      return { success: false, message: `Request already ${approvalRequest.status}` };
    }

    if (Date.now() > approvalRequest.expiresAt.getTime()) {
      // Update status to expired
      await updateApprovalStatus(requestId, 'expired');
      return { success: false, message: 'Approval request has expired' };
    }

    if (response === 'decline') {
      // Update status to declined
      await updateApprovalStatus(requestId, 'declined');
      
      // Notify patient of decline
      const declineMessage = formatDeclineMessage(approvalRequest);
      await sendWhatsAppViaGateway({
        toE164: approvalRequest.patientPhone,
        body: declineMessage,
      });

      return { success: true, message: 'Meeting request declined' };
    }

    // Provider confirmed - create the meeting
    const googleMeetEvent = await createHOAMeeting(
      approvalRequest.patientName,
      approvalRequest.providerName,
      approvalRequest.requestedTime,
      30, // 30 minutes
      undefined, // patient email (we don't have it)
      approvalRequest.providerEmail,
      approvalRequest.reason
    );

    // Update approval request with meeting details
    const updatedRequest = {
      ...approvalRequest,
      status: 'confirmed' as const,
      meetingLink: googleMeetEvent.hangoutLink,
      googleMeetEventId: googleMeetEvent.id,
    };

    await updateApprovalRequest(requestId, updatedRequest);

    // Send final meeting link to patient
    const confirmationMessage = formatConfirmationMessage(updatedRequest, googleMeetEvent);
    await sendWhatsAppViaGateway({
      toE164: approvalRequest.patientPhone,
      body: confirmationMessage,
    });

    // Send confirmation to provider
    const providerConfirmationMessage = formatProviderConfirmationMessage(updatedRequest, googleMeetEvent);
    await sendWhatsAppViaGateway({
      toE164: approvalRequest.providerPhone,
      body: providerConfirmationMessage,
    });

    return {
      success: true,
      message: 'Meeting confirmed and link sent',
      meetingLink: googleMeetEvent.hangoutLink,
    };

  } catch (error) {
    console.error('[Process Provider Response] Error:', error);
    return { success: false, message: 'Failed to process provider response' };
  }
}

/**
 * Get pending approval requests for a provider
 */
export async function getPendingRequests(providerPhone: string): Promise<PendingMeetingRequest[]> {
  try {
    const documents = await prisma.document.findMany({
      where: {
        typeCode: 'meeting_approval',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents
      .map(doc => hydratePendingMeetingRequest(doc.metadata as any))
      .filter(request => 
        request.providerPhone === providerPhone &&
        request.status === 'pending' && 
        Date.now() <= request.expiresAt.getTime()
      );

  } catch (error) {
    console.error('[Get Pending Requests] Error:', error);
    return [];
  }
}

// Helper functions for message formatting
function formatProviderApprovalMessage(request: PendingMeetingRequest): string {
  const timeStr = request.requestedTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `📋 *New Meeting Request*

👤 *Patient:* ${request.patientName}
📱 *Patient Phone:* ${request.patientPhone}
📅 *Requested Time:* ${timeStr}
${request.reason ? `📝 *Reason:* ${request.reason}` : ''}

🔔 *Action Required:*
Please confirm or decline this meeting request.

Reply with:
• "YES" to approve
• "NO" to decline

⏰ *Expires in 2 hours*

HOA Wellness Hub 🌸`;
}

function formatPatientAcknowledgmentMessage(request: PendingMeetingRequest): string {
  const timeStr = request.requestedTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `📅 *Meeting Request Received*

Hello ${request.patientName}!

Your consultation request has been sent to ${request.providerName}:

📅 *Requested Time:* ${timeStr}
👩‍⚕️ *Provider:* ${request.providerName}
${request.reason ? `📝 *Reason:* ${request.reason}` : ''}

🔄 *Status:* Awaiting provider confirmation

The provider will review your request and confirm shortly. You'll receive the meeting link once approved.

⏰ *Response expected within 2 hours*

With care,
Prestrack ✨`;
}

function formatConfirmationMessage(request: PendingMeetingRequest, googleMeetEvent: GoogleMeetResponse): string {
  const startTime = new Date(googleMeetEvent.start.dateTime);
  const endTime = new Date(googleMeetEvent.end.dateTime);

  return `🎉 *Meeting Confirmed!*

Hello ${request.patientName}!

Your consultation with ${request.providerName} has been approved:

📱 *Meeting Link:* ${googleMeetEvent.hangoutLink}
📅 *Time:* ${startTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} - ${endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}
👩‍⚕️ *Provider:* ${request.providerName}

🔗 *Click the link to join your meeting at the scheduled time.*

The meeting has been added to the calendar and is ready to go!

With care,
Prestrack ✨`;
}

function formatProviderConfirmationMessage(request: PendingMeetingRequest, googleMeetEvent: GoogleMeetResponse): string {
  const startTime = new Date(googleMeetEvent.start.dateTime);
  const endTime = new Date(googleMeetEvent.end.dateTime);

  return `✅ *Meeting Confirmed*

Your consultation with ${request.patientName} has been scheduled:

📱 *Meeting Link:* ${googleMeetEvent.hangoutLink}
📅 *Time:* ${startTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} - ${endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}
👤 *Patient:* ${request.patientName}

📋 *Meeting created and added to your calendar.*

HOA Wellness Hub 🌸`;
}

function formatDeclineMessage(request: PendingMeetingRequest): string {
  return `❌ *Meeting Request Declined*

Hello ${request.patientName}!

Unfortunately, your consultation request with ${request.providerName} for ${request.requestedTime.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} has been declined.

💡 *Next Steps:*
• Try scheduling for a different time
• Contact our support team for assistance

We apologize for any inconvenience.

With care,
Prestrack ✨`;
}

// Helper functions for database operations
async function updateApprovalStatus(requestId: string, status: 'confirmed' | 'declined' | 'expired'): Promise<void> {
  // First get the current document to preserve other metadata
  const document = await prisma.document.findFirst({
    where: {
      typeCode: 'meeting_approval',
      url: requestId,
    },
  });

  if (document && document.metadata) {
    const currentMetadata = document.metadata as unknown as PendingMeetingRequest;
    const updatedMetadata = { ...currentMetadata, status: status };
    
    await prisma.document.updateMany({
      where: {
        typeCode: 'meeting_approval',
        url: requestId,
      },
      data: {
        metadata: updatedMetadata as any, // Cast to any for Prisma JSON compatibility
      },
    });
  }
}

async function updateApprovalRequest(requestId: string, updatedRequest: PendingMeetingRequest): Promise<void> {
  await prisma.document.updateMany({
    where: {
      typeCode: 'meeting_approval',
      url: requestId,
    },
    data: {
      metadata: updatedRequest as any, // Cast to any for Prisma JSON compatibility
    },
  });
}
