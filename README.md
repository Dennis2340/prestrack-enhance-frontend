# PresTrack Frontend

A modern platform for managing pregnancy care, patient interactions, secure payments, and data insights — built with Next.js.

---

## 📖 Overview

PresTrack is a powerful health and finance dashboard tailored for pregnancy care clinics, health professionals, and patients. It combines real-time chat support, secure payment handling, role-based access control, and intelligent data analytics — all presented in a beautiful and responsive UI.

Whether you're a **health professional**, **clinic administrator**, or an **expecting parent**, PresTrack empowers you to manage everything from a single dashboard.

---

## 🔑 Key Features

- 🧑‍⚕️ **Patient Support Portal** – Personalized support and live chat with health professionals or AI assistants.
- 🩺 **Health Professional Dashboard** – Manage patient interactions, medical records, and appointments.
- 🏥 **Clinic Management** – Admin tools for overseeing operations, transactions, and user permissions.
- 💬 **Real-time Chat** – Instant messaging using Socket.io for seamless communication.
- 🧠 **Data Analytics** – Track patient metrics, financial insights, and performance data.
- 🔐 **Secure Authentication** – Role-based access using Kinde Auth.
- 🎨 **Dark/Light Mode** – Customizable UI with theme toggling support.

---

## 🌐 Live Preview

🚧 **Coming Soon** – Hosted demo

---

## ✅ Prerequisites

- [Node.js](https://nodejs.org/) 18.x or later
- [npm](https://www.npmjs.com/) 9.x or later
- [PostgreSQL](https://www.postgresql.org/) database

---

## 🚀 Setup and Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd prestrack-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/prestrack"
DIRECT_URL="postgresql://username:password@localhost:5432/prestrack"

# Kinde Auth
KINDE_CLIENT_ID="your-kinde-client-id"
KINDE_CLIENT_SECRET="your-kinde-client-secret"
KINDE_ISSUER_URL="https://your-subdomain.kinde.com"
KINDE_SITE_URL="http://localhost:3000"
KINDE_POST_LOGOUT_REDIRECT_URL="http://localhost:3000"
KINDE_POST_LOGIN_REDIRECT_URL="http://localhost:3000/dashboard"

# Socket.io (for real-time chat)
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

# Business Configuration
NEXT_PUBLIC_BUSINESS_ID="your-business-id"
NEXT_PUBLIC_BUSINESS_NAME="PresTrack"
NEXT_PUBLIC_CHATBOT_ID="your-chatbot-id"
```

### 4. Set up the database schema

```bash
npx prisma db push
```

### 5. Generate Prisma Client

```bash
npx prisma generate
```

---

## 🔧 Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

---

## 📂 Project Structure

```bash
prisma/             # Prisma schema and migrations
src/
  └── app/          # Next.js App Router structure
  └── components/   # Reusable UI components
  └── db/           # Prisma DB client
  └── lib/          # Utility functions and shared logic
  └── models/       # Data models for business logic
config/             # Global app configuration
```

---

## 📊 Data Analytics

PresTrack includes built-in analytics tools to help administrators and health professionals:

- 📈 Track patient health trends and history
- 💰 Monitor payment status and financial metrics
- 💬 Analyze real-time chat performance (average response time, resolution rate)
- 📤 Export reports for auditing and administrative decisions

---

## 🔐 Authentication & Roles

| Role     | Access Capabilities                                   |
|----------|--------------------------------------------------------|
| Guest    | Browse public pages and view information              |
| Patient  | Chat, appointments, health profile, and payments      |
| Agent    | Manage chats, patient records, and schedules          |
| Admin    | Full access: users, business settings, analytics      |

---

## 📜 Available Scripts

| Script            | Description                            |
|-------------------|----------------------------------------|
| `npm run dev`     | Start development server               |
| `npm run build`   | Build for production                   |
| `npm run start`   | Start production server                |
| `npm run lint`    | Run ESLint to check code quality       |

---

## 🛠️ Technology Stack

| Technology       | Description                                 |
|------------------|---------------------------------------------|
| **Next.js 15**     | Full-stack React framework                 |
| **Tailwind CSS**   | Utility-first styling framework            |
| **Radix UI**       | Accessible and customizable UI primitives  |
| **Prisma ORM**     | Type-safe database ORM for PostgreSQL      |
| **Socket.io**      | Real-time communication engine             |
| **Kinde Auth**     | Authentication and user management         |
| **PostgreSQL**     | Scalable relational database               |
| **React Hooks**    | Modern React state management              |

---

## 🌐 Solutions We Offer

Welcome to **PresTrack** — your trusted companion for pregnancy health and financial wellness.

- 💬 **Instant Support** – Chat with AI or human agents anytime.
- 🔐 **Secure Payments** – Manage transactions with confidence.
- 📆 **24/7 Access** – Access from any device, anytime.

---

## 📥 Ready to Get Started?

Join thousands of satisfied users and transform how your clinic or pregnancy journey is managed.

```bash
npm run dev
```

**Start Using PresTrack Today!**

---

## 🪪 License

This project is licensed under the MIT License.  
See the [LICENSE](./LICENSE) file for details.
---

## 🧩 ANC DAK Compliance + FHIR (MVP)

This project includes a DAK-aligned ANC flow and minimal FHIR export.

- **Codes/Value Sets**: LOINC for vitals/labs, standardized value sets in `src/lib/fhir/codes.ts`.
- **Server rules**: IPTp/TT spacing and GA checks, vitals ranges, and first-contact baseline screens enforced in `src/app/api/admin/patients/[id]/anc/contact/route.ts`.
- **Indicators**: `anc/indicators` exposes `lmp`, `edd`, last IPTp/TT dates, and screening flags for UI hints.
- **FHIR export**: Read-only endpoints emit Encounter, Observation, Immunization, and a Bundle.
- **Consent**: Per-channel consent (`ContactChannel.consent`) enforced for outbound WhatsApp.
- **Audit**: System `CommMessage` entries on escalation creation/updates; audit listing API.

Quick endpoints:
- `GET /api/fhir/patients/{id}/encounters`
- `GET /api/fhir/patients/{id}/observations`
- `GET /api/fhir/patients/{id}/immunizations`
- `GET /api/fhir/patients/{id}/bundle`
- `GET /api/admin/patients/{id}/audit`

Migration note:
- Run Prisma migrate to add `ContactChannel.consent` (see `docs/DAK-FHIR.md`).

Details and test checklist: see `docs/DAK-FHIR.md`.
