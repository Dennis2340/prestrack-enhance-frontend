-- CreateEnum
CREATE TYPE "AdministrativeGender" AS ENUM ('male', 'female', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "ANCInterventionType" AS ENUM ('iptp', 'iron_folate', 'calcium', 'deworming');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'provider');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('patient', 'visitor');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('whatsapp');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('open', 'closed', 'escalated');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('medication_reminder', 'reminder', 'visit', 'escalation');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'sent', 'done', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "AdherenceEvent" AS ENUM ('taken', 'missed', 'skipped', 'side_effect');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('current', 'superseded', 'entered_in_error');

-- CreateEnum
CREATE TYPE "MedicationRequestStatus" AS ENUM ('active', 'completed', 'stopped', 'entered_in_error');

-- CreateEnum
CREATE TYPE "MedicationRequestIntent" AS ENUM ('order', 'plan');

-- CreateTable
CREATE TABLE "Pregnancy" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lmp" TIMESTAMP(3),
    "edd" TIMESTAMP(3),
    "gravida" INTEGER,
    "para" INTEGER,
    "riskFlags" JSONB,

    CONSTRAINT "Pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANCEncounter" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "providerUserId" TEXT,

    CONSTRAINT "ANCEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANCObservation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encounterId" TEXT NOT NULL,
    "codeSystem" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "valueQuantity" JSONB,
    "valueCodeableConcept" JSONB,
    "note" TEXT,

    CONSTRAINT "ANCObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ANCIntervention" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pregnancyId" TEXT NOT NULL,
    "type" "ANCInterventionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "medicationCode" TEXT,
    "medicationSystem" TEXT,
    "doseText" TEXT,

    CONSTRAINT "ANCIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" TEXT NOT NULL,
    "vaccineCode" TEXT NOT NULL,
    "vaccineSystem" TEXT NOT NULL,
    "occurrenceDateTime" TIMESTAMP(3) NOT NULL,
    "lotNumber" TEXT,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneE164" TEXT,
    "notifyMedication" BOOLEAN NOT NULL DEFAULT true,
    "notifyEscalation" BOOLEAN NOT NULL DEFAULT true,
    "notificationCooldownMinutes" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sex" TEXT,
    "administrativeGender" "AdministrativeGender",
    "externalId" TEXT,
    "identifiers" JSONB,
    "address" JSONB,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerType" "SubjectType" NOT NULL,
    "patientId" TEXT,
    "visitorId" TEXT,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "preferred" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "patientId" TEXT,
    "visitorId" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'whatsapp',
    "status" "ConversationStatus" NOT NULL DEFAULT 'open',
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "Direction" NOT NULL,
    "via" "Channel" NOT NULL DEFAULT 'whatsapp',
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "meta" JSONB,
    "senderType" TEXT,
    "senderId" TEXT,

    CONSTRAINT "CommMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "strength" TEXT,
    "form" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "MedicationRequestStatus" NOT NULL DEFAULT 'active',
    "intent" "MedicationRequestIntent" NOT NULL DEFAULT 'order',
    "medicationCode" TEXT,
    "medicationSystem" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DosageSchedule" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "frequency" TEXT,
    "times" JSONB,
    "intervalHours" INTEGER,

    CONSTRAINT "DosageSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "subjectType" "SubjectType" NOT NULL,
    "patientId" TEXT,
    "visitorId" TEXT,
    "prescriptionId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adherence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "taskId" TEXT,
    "event" "AdherenceEvent" NOT NULL,
    "details" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "note" TEXT,
    "performerUserId" TEXT,

    CONSTRAINT "Adherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "meta" JSONB,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER,
    "hash" TEXT,
    "metadata" JSONB,
    "status" "DocumentStatus" NOT NULL DEFAULT 'current',
    "typeCode" TEXT,
    "typeSystem" TEXT,
    "categoryCode" TEXT,
    "categorySystem" TEXT,
    "authoredAt" TIMESTAMP(3),
    "context" JSONB,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FhirLink" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "patientId" TEXT,
    "visitorId" TEXT,

    CONSTRAINT "FhirLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pregnancy_patientId_isActive_idx" ON "Pregnancy"("patientId", "isActive");

-- CreateIndex
CREATE INDEX "ANCEncounter_pregnancyId_date_idx" ON "ANCEncounter"("pregnancyId", "date");

-- CreateIndex
CREATE INDEX "ANCObservation_encounterId_idx" ON "ANCObservation"("encounterId");

-- CreateIndex
CREATE INDEX "ANCIntervention_pregnancyId_type_date_idx" ON "ANCIntervention"("pregnancyId", "type", "date");

-- CreateIndex
CREATE INDEX "Immunization_patientId_occurrenceDateTime_idx" ON "Immunization"("patientId", "occurrenceDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_externalId_key" ON "Patient"("externalId");

-- CreateIndex
CREATE INDEX "ContactChannel_type_value_idx" ON "ContactChannel"("type", "value");

-- CreateIndex
CREATE INDEX "Conversation_subjectType_patientId_idx" ON "Conversation"("subjectType", "patientId");

-- CreateIndex
CREATE INDEX "Conversation_subjectType_visitorId_idx" ON "Conversation"("subjectType", "visitorId");

-- CreateIndex
CREATE INDEX "CommMessage_conversationId_createdAt_idx" ON "CommMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_type_status_scheduledTime_idx" ON "Task"("type", "status", "scheduledTime");

-- CreateIndex
CREATE INDEX "Document_patientId_createdAt_idx" ON "Document"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "FhirLink_resourceType_resourceId_idx" ON "FhirLink"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ANCEncounter" ADD CONSTRAINT "ANCEncounter_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ANCObservation" ADD CONSTRAINT "ANCObservation_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ANCEncounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ANCIntervention" ADD CONSTRAINT "ANCIntervention_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommMessage" ADD CONSTRAINT "CommMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DosageSchedule" ADD CONSTRAINT "DosageSchedule_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_performerUserId_fkey" FOREIGN KEY ("performerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FhirLink" ADD CONSTRAINT "FhirLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FhirLink" ADD CONSTRAINT "FhirLink_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
