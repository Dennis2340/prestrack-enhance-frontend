# ANC DAK Compliance + FHIR Export (MVP)

This document summarizes the changes made to move the ANC flows toward DAK compliance and provide minimal FHIR export.

## What changed (high level)

- Standardized codes/value sets (`src/lib/fhir/codes.ts`).
- Server-side decision support for IPTp/TT with validation (`anc/contact`).
- Tightened validation schema for labs/danger signs (`src/lib/validation/anc.ts`).
- Indicators enhanced for scheduling and coverage (`anc/indicators`).
- UI warnings for IPTp/TT timing in ANC panel (`AncPanel.tsx`).
- FHIR export endpoints (Encounter, Observation, Immunization, Bundle).
- Consent enforcement for outbound messages and audit logging of escalations.

## Files touched

- Codes/Value sets: `src/lib/fhir/codes.ts`
- Validation: `src/lib/validation/anc.ts`
- ANC contact API: `src/app/api/admin/patients/[id]/anc/contact/route.ts`
- Indicators API: `src/app/api/admin/patients/[id]/anc/indicators/route.ts`
- UI Panel: `src/components/patients/AncPanel.tsx`
- FHIR mappers: `src/lib/fhir/map.ts`
- FHIR endpoints:
  - `src/app/api/fhir/patients/[id]/encounters/route.ts`
  - `src/app/api/fhir/patients/[id]/observations/route.ts`
  - `src/app/api/fhir/patients/[id]/immunizations/route.ts`
  - `src/app/api/fhir/patients/[id]/bundle/route.ts`
- Consent schema: `prisma/schema.prisma` (ContactChannel.consent)
- Consent checks: `src/app/api/admin/patients/[id]/message/route.ts`, `src/app/api/admin/visitors/[id]/message/route.ts`
- Escalation audit logs: `src/lib/agent/tools/medical.ts`, `src/app/api/admin/escalations/update/route.ts`
- Audit listing endpoint: `src/app/api/admin/patients/[id]/audit/route.ts`

## UI behavior to verify

- ANC Panel (`src/components/patients/AncPanel.tsx`):
  - When selecting IPTp "Given today":
    - Shows amber warning if GA < 13 weeks, or if last IPTp < 28 days (uses indicators).
  - When selecting TT "Given today":
    - Shows amber warning if last TT < 28 days.
  - On submit, server rules enforce and block invalid actions with clear 400 messages.

- Indicators Summary Tile:
  - Displays contacts count, IPTp and TT dose counts, last Hb value/date.
  - Behind the scenes, the indicators endpoint now exposes `lmp`, `edd`, `lastIptpDate`, `lastTtDate`, and `screening` flags to power warnings and dashboards.

## Server-side rules (DAK-aligned)

- IPTp:
  - Minimum GA: ≥ 13 weeks.
  - Dose spacing: ≥ 28 days since last IPTp.
- TT:
  - Dose spacing: ≥ 28 days since last TT.
- Vitals validation:
  - Weight: 1–300 kg; Fundal height: 1–60 cm; FHR: 60–220 bpm.
- First ANC contact requires baseline screening:
  - HIV, Syphilis, Hemoglobin (Hb), Malaria RDT.

Implemented in: `src/app/api/admin/patients/[id]/anc/contact/route.ts`

## Codes and Value Sets

- LOINC codes in `src/lib/fhir/codes.ts`:
  - Systolic BP: 8480-6, Diastolic BP: 8462-4, Heart rate: 8867-4, Hemoglobin: 718-7.
- Units include `mm[Hg]` for BP.
- `VALUE_SETS` for HIV/Syphilis/Malaria RDT outcomes: `positive|negative|invalid|unknown`.
- `DANGER_SIGNS` enumeration retained.

## Indicators API

- Endpoint: `GET /api/admin/patients/{id}/anc/indicators`
- Returns: `encountersCount`, `iptpCount`, `ttCount`, `lastHb`, `lastHbAt`, `lastIptpDate`, `lastTtDate`, `lmp`, `edd`, `screening` flags.

## FHIR Export API

- Encounters: `GET /api/fhir/patients/{id}/encounters` (supports `?limit=`)
- Observations: `GET /api/fhir/patients/{id}/observations`
- Immunizations: `GET /api/fhir/patients/{id}/immunizations`
- Bundle (all above): `GET /api/fhir/patients/{id}/bundle`
- Mapping functions in `src/lib/fhir/map.ts`.

Notes: We use minimal FHIR structures sufficient for basic exchange. Extend mappings as needed.

## Consent + Audit

- Schema: `ContactChannel.consent Boolean @default(true)` (requires migration).
- Enforcement: outbound WhatsApp to patients/visitors requires a consented channel.
- Audit logs:
  - When agent creates an escalation Document, a system `CommMessage` is recorded.
  - When providers update/close an escalation, another system `CommMessage` is recorded.
- Audit listing endpoint: `GET /api/admin/patients/{id}/audit` provides recent messages and escalation documents.

## Setup / Migration

1) Install deps and generate client
```bash
npm i
npx prisma generate
```
2) Apply migration (adds `ContactChannel.consent`)
```bash
# create & run a migration (adjust to your workflow)
npx prisma migrate dev -n add-consent-to-contact-channel
```

## Quick test checklist

- Validation
  - First ANC contact without baseline labs → 400 error listing missing tests.
  - IPTp at <13 weeks or <28 days since last → 400 with message.
  - TT <28 days since last → 400 with message.

- UI warnings
  - In `AncPanel`, selecting IPTp/TT "Given today" shows amber non-blocking warnings when out-of-window.

- FHIR
  - `GET /api/fhir/patients/{id}/bundle` returns resources for that patient.

- Consent
  - Set a patient WhatsApp `ContactChannel.consent=false` and try `POST /api/admin/patients/{id}/message` → should refuse until a consented channel exists.

- Audit
  - Trigger agent escalation → system `CommMessage` logged.
  - Update escalation via `POST /api/admin/escalations/update` (status/note) → system `CommMessage` logged.
  - `GET /api/admin/patients/{id}/audit` shows recent messages and escalation docs.

## Future extensions

- Add pagination to Observations/Immunizations endpoints and date filters.
- Expand FHIR mappings (e.g., DocumentReference for escalations, Condition, Procedure if needed).
- Add conditional validations for more DAK rules (e.g., GA-specific measurements, anemia management follow-up).
- Facility-level indicators (coverage: ANC1+, ANC4+, IPTp3+).
