# PreSTrack Frontend

A modern maternal care platform enabling real-time patient-doctor communication, AI-assisted support, medical record management, and data-driven insights — built with Next.js.

---

## 📖 Overview

PreSTrack is a comprehensive maternal health management system designed to support **patients**, **doctors**, and **administrators**. It enables:

* Real-time chat between doctors and patients
* Secure access to patient medical records
* AI assistant integration for 24/7 health support
* Role-based dashboards
* Automated daily health tips via WhatsApp

This frontend is part of a multi-repo project that connects to a dedicated socket server and backend service.

---

## 🔑 Key Features

* 🧑‍⚕️ **Doctor Dashboard** – Manage patients, view and update medical records, and toggle between AI or human interaction.
* 🤖 **AI Assistant Toggle** – Patients can interact with AI anytime; doctors can switch between AI and live support.
* 🩺 **Patient Portal** – Engage with doctors or AI, receive tips, and view health information securely.
* 💬 **Real-time Chat** – Powered by Socket.io, enabling instant doctor-patient conversations.
* 🧠 **Medical Records** – Doctors can view/add pregnancy status, blood type, medications, allergies, etc.
* 📊 **Admin Analytics** – Track room activities, chat logs, and CSV data imports for insights.
* 🔐 **Secure Role-Based Access** – Supports Admin, Agent (Doctor), and Patient views via Kinde Auth.
* 🌙 **Theme Toggle** – Switch between dark/light modes.

---

## 🌐 Live Preview

🔗 [https://prestrack.genistud.io/](https://prestrack.genistud.io/)

---

## ✅ Prerequisites

* [Node.js](https://nodejs.org/) 18.x or later
* [npm](https://www.npmjs.com/) 9.x or later

---

## 🚀 Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/Dennis2340/prestrack-enhance-frontend.git
cd prestrack-enhance-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and add:

```env
# Kinde Auth
KINDE_CLIENT_ID=your-client-id
KINDE_CLIENT_SECRET=your-secret
KINDE_ISSUER_URL=https://your-org.kinde.com
KINDE_SITE_URL=http://localhost:3000
KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3000
KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3000/dashboard

# Socket.io
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Genistudio WhatsApp / AI
NEXT_PUBLIC_CHATBOT_ID=your-chatbot-id
NEXT_PUBLIC_BUSINESS_ID=your-business-id
NEXT_PUBLIC_BUSINESS_NAME=PreSTrack
```

### 4. Start the Development Server

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```bash
prisma/             # Prisma schema (if used)
src/
├── app/            # Pages and routing (Next.js App Router)
├── components/     # Shared UI components
├── db/             # Prisma or DB config
├── lib/            # Utilities and helpers
├── models/         # Application models (e.g., rooms, users)
config/             # App-wide config files
```

---

## 🧪 Roles & Permissions

| Role    | Description                                        |
| ------- | -------------------------------------------------- |
| Admin   | Manage agents, support rooms, and analytics        |
| Agent   | Chat with patients, manage records, toggle AI      |
| Patient | Interact with doctors or AI, receive WhatsApp tips |

---

## 🛠️ Technology Stack

| Tech              | Description                       |
| ----------------- | --------------------------------- |
| Next.js 15        | Full-stack React framework        |
| Tailwind CSS      | Utility-first styling             |
| Shadcn + Radix UI | Accessible, modular UI components |
| Socket.io         | Real-time messaging               |
| Kinde Auth        | Authentication & role management  |
| Genistudio        | WhatsApp integration + AI chatbot |

---

## 🩺 Use Case Summary

* 💬 **24/7 Support** – AI chatbot + doctor communication
* 🩺 **Medical Data** – View/update patient records
* 📤 **CSV Upload** – For analytics insights (admin only)
* 📱 **WhatsApp Tips** – Daily health guidance via Genistudio

---

## 📜 Available Scripts

| Script          | Description             |
| --------------- | ----------------------- |
| `npm run dev`   | Run dev server          |
| `npm run build` | Build production app    |
| `npm run start` | Start production server |
| `npm run lint`  | Run ESLint              |

---

## 🪪 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
