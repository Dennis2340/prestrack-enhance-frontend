// Escalation tool stubs. Replace with real implementation once schema is finalized.

export type CreateEscalationInput = {
  team: 'COMMERCIAL' | 'TECHNICAL' | 'COMPLIANCE_LEGAL'
  type: 'COMPLAINT' | 'REQUEST' | 'ENQUIRY'
  title: string
  summary: string
  phoneE164?: string | null
  customerContactId?: string | null
  conversationId?: string | null
}

export async function createEscalation(_input: CreateEscalationInput) {
  // TODO: implement once escalation schema exists
  throw new Error('createEscalation not implemented: define escalation schema first')
}

export async function updateEscalation(_input: { escalationId: string; note: string; alsoNotifyCustomer?: boolean; authorUserId: string }) {
  // TODO: implement once escalation schema exists
  throw new Error('updateEscalation not implemented: define escalation schema first')
}
