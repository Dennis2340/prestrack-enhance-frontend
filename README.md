# Saful Pay Frontend

A modern dashboard for managing payments and customer interactions built with Next.js.

## Overview

Saful Pay Frontend is a comprehensive dashboard application designed to handle payment processing, customer support through chat functionality, and business management. It features authentication, real-time communication, and a responsive UI.

## Features

- **User Authentication**: Secure login and registration via Kinde Auth
- **Real-time Chat**: Live customer support using Socket.io
- **Role-based Access**: Different interfaces for guests, agents, and admins
- **Business Management**: Tools for managing business profiles and settings
- **Dark/Light Theme**: Theme switching with next-themes

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- PostgreSQL database

## Setup and Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd saful-pay-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/safulpay"
DIRECT_URL="postgresql://username:password@localhost:5432/safulpay"

# Kinde Auth
KINDE_CLIENT_ID="your-kinde-client-id"
KINDE_CLIENT_SECRET="your-kinde-client-secret"
KINDE_ISSUER_URL="https://your-subdomain.kinde.com"
KINDE_SITE_URL="http://localhost:3000"
KINDE_POST_LOGOUT_REDIRECT_URL="http://localhost:3000"
KINDE_POST_LOGIN_REDIRECT_URL="http://localhost:3000/dashboard"

# Socket.io
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

# Business Config
NEXT_PUBLIC_BUSINESS_ID="your-business-id"
NEXT_PUBLIC_BUSINESS_NAME="Your Business Name"
NEXT_PUBLIC_CHATBOT_ID="your-chatbot-id"
```

### 4. Set up the database

```bash
npx prisma db push
```

This will create the database schema based on the Prisma models.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

This is automatically run after npm install, but you can run it manually if needed.

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint to check for code issues

## Technology Stack

- **Framework**: Next.js 15
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **Database ORM**: Prisma
- **Authentication**: Kinde Auth
- **Real-time Communication**: Socket.io
- **Database**: PostgreSQL
- **State Management**: React Hooks

## Project Structure

- `prisma/` - Database schema and migrations
- `src/`
  - `app/` - Next.js app router pages and layouts
  - `components/` - Reusable UI components
  - `lib/` - Utility functions and shared logic
  - `models/` - Data models
  - `db/` - Database connection and queries
- `config/` - Application configuration

## License

[MIT](LICENSE)
