# PresTrack Frontend

A modern platform for managing pregnancy care, patient interactions, secure payments, and data insights — built with Next.js.

---

## ⚙️ Agentic Capabilities (Current Focus)

PresTrack now centers on two agentic features:

- **Agentic WhatsApp Agent**
  - Listens on WhatsApp, understands patient intents, and responds contextually.
  - Can capture media, create conversations, and respect channel consent.
  - Extensible toolset for actions (e.g., fetching patient context, triggering workflows).

- **Agentic Escalation**
  - When danger signs or clinician-needed issues are detected, the agent creates a medical escalation `Document`.
  - Providers are notified; updates/closures are logged as system timeline entries (`CommMessage`).
  - Audit endpoint exposes recent messages and escalations per patient.

Key endpoints and files:
- `POST` agent tools: `src/lib/agent/tools/medical.ts` (creates escalation, provider notify, audit log)
- Audit listing: `GET /api/admin/patients/{id}/audit`
- WhatsApp send wrapper: `src/lib/whatsapp.ts`
- Consent check in outbound messaging: `ContactChannel.consent` (see Prisma schema)

## 🚀 Quick Start (Agentic Only)

- Install deps: `npm install`
- DB up: set `DATABASE_URL` in `.env`
- Dev server: `npm run dev`
- Optional: run `npx prisma migrate dev -n add-consent-to-contact-channel` to add `ContactChannel.consent`.

## 🔌 Core Agentic Endpoints

- Escalation tool: see `src/lib/agent/tools/medical.ts`
- Audit listing: `GET /api/admin/patients/{id}/audit`

## ✅ Consent & Audit

- Per-channel consent: `ContactChannel.consent` (Prisma schema).
- Outbound WhatsApp checks consent in patient/visitor message routes.
- System audit logs (`CommMessage`) on escalation create/update.
- View: `GET /api/admin/patients/{id}/audit`.

## 🪪 License

MIT — see [LICENSE](./LICENSE).
