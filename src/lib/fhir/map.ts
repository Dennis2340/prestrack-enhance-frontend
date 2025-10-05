// Minimal FHIR structures we emit (typed loosely to avoid dragging full FHIR typings)
export type FhirReference = { reference: string, display?: string }
export type FhirCoding = { system?: string, code?: string, display?: string }
export type FhirCodeableConcept = { coding?: FhirCoding[], text?: string }

export function toFhirEncounter(enc: any, patient: any) {
  return {
    resourceType: 'Encounter',
    id: enc.id,
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: `Patient/${patient.id}`, display: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || undefined },
    period: { start: enc.date.toISOString(), end: enc.date.toISOString() },
  }
}

export function toFhirObservation(obs: any, patient: any, enc: any) {
  const code: FhirCodeableConcept = { coding: [] }
  if (obs.codeSystem && obs.code) {
    code.coding!.push({ system: obs.codeSystem, code: obs.code })
  }
  return {
    resourceType: 'Observation',
    id: obs.id,
    status: 'final',
    code,
    subject: { reference: `Patient/${patient.id}`, display: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || undefined },
    encounter: { reference: `Encounter/${enc.id}` },
    effectiveDateTime: enc.date.toISOString(),
    ...(obs.valueQuantity ? { valueQuantity: obs.valueQuantity } : {}),
    ...(obs.valueCodeableConcept ? { valueCodeableConcept: obs.valueCodeableConcept } : {}),
    ...(obs.note ? { note: [{ text: obs.note }] } : {}),
  }
}

export function toFhirImmunization(im: any, patient: any) {
  const code: FhirCodeableConcept = { coding: [] }
  if (im.vaccineSystem && im.vaccineCode) {
    code.coding!.push({ system: im.vaccineSystem, code: im.vaccineCode })
  }
  return {
    resourceType: 'Immunization',
    id: im.id,
    status: 'completed',
    vaccineCode: code,
    patient: { reference: `Patient/${patient.id}`, display: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || undefined },
    occurrenceDateTime: im.occurrenceDateTime.toISOString(),
    lotNumber: im.lotNumber || undefined,
  }
}
