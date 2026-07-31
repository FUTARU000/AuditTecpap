-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('DRAFT', 'ROOT_CAUSE_ANALYSIS', 'ACTION_PLAN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'PENDING_EFFECTIVENESS', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CapaPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CapaActionType" AS ENUM ('CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EffectivenessResult" AS ENUM ('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE');


-- AlterTable
ALTER TABLE "findings" ADD COLUMN     "capaDecision" TEXT,
ADD COLUMN     "capaDecisionById" TEXT,
ADD COLUMN     "capaDecisionDate" TIMESTAMP(3),
ADD COLUMN     "capaDecisionReason" TEXT;

-- CreateTable
CREATE TABLE "capas" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "findingId" TEXT,
    "departmentId" TEXT NOT NULL,
    "processId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "priority" "CapaPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CapaStatus" NOT NULL DEFAULT 'DRAFT',
    "targetDate" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "effectivenessDueDate" TIMESTAMP(3),
    "effectivenessReviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureComment" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_root_cause_analyses" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "problemStatement" TEXT,
    "immediateCause" TEXT,
    "rootCause" TEXT,
    "contributingFactors" TEXT,
    "analysisNotes" TEXT,
    "useFiveWhys" BOOLEAN NOT NULL DEFAULT false,
    "useEightD" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capa_root_cause_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_why_steps" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capa_why_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_eight_ds" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "d1Team" TEXT,
    "d2ProblemDescription" TEXT,
    "d3InterimActions" TEXT,
    "d4RootCause" TEXT,
    "d5PermanentActions" TEXT,
    "d6Implementation" TEXT,
    "d7Prevention" TEXT,
    "d8Closure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capa_eight_ds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_actions" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actionType" "CapaActionType" NOT NULL DEFAULT 'CORRECTIVE',
    "ownerId" TEXT,
    "priority" "CapaPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CapaActionStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capa_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_action_evidence" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "comment" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_action_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_verifications" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capa_effectiveness_reviews" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "result" "EffectivenessResult" NOT NULL,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_effectiveness_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capas_referenceNumber_key" ON "capas"("referenceNumber");

-- CreateIndex
CREATE INDEX "capas_departmentId_idx" ON "capas"("departmentId");

-- CreateIndex
CREATE INDEX "capas_status_idx" ON "capas"("status");

-- CreateIndex
CREATE INDEX "capas_findingId_idx" ON "capas"("findingId");

-- CreateIndex
CREATE INDEX "capas_ownerId_idx" ON "capas"("ownerId");

-- CreateIndex
CREATE INDEX "capas_processId_idx" ON "capas"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "capa_root_cause_analyses_capaId_key" ON "capa_root_cause_analyses"("capaId");

-- CreateIndex
CREATE INDEX "capa_why_steps_analysisId_idx" ON "capa_why_steps"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "capa_eight_ds_analysisId_key" ON "capa_eight_ds"("analysisId");

-- CreateIndex
CREATE INDEX "capa_actions_capaId_idx" ON "capa_actions"("capaId");

-- CreateIndex
CREATE INDEX "capa_actions_ownerId_idx" ON "capa_actions"("ownerId");

-- CreateIndex
CREATE INDEX "capa_action_evidence_actionId_idx" ON "capa_action_evidence"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "capa_verifications_capaId_key" ON "capa_verifications"("capaId");

-- CreateIndex
CREATE UNIQUE INDEX "capa_effectiveness_reviews_capaId_key" ON "capa_effectiveness_reviews"("capaId");

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capas" ADD CONSTRAINT "capas_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_root_cause_analyses" ADD CONSTRAINT "capa_root_cause_analyses_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_why_steps" ADD CONSTRAINT "capa_why_steps_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "capa_root_cause_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_eight_ds" ADD CONSTRAINT "capa_eight_ds_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "capa_root_cause_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_action_evidence" ADD CONSTRAINT "capa_action_evidence_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "capa_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_action_evidence" ADD CONSTRAINT "capa_action_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_verifications" ADD CONSTRAINT "capa_verifications_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_verifications" ADD CONSTRAINT "capa_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "capa_effectiveness_reviews_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_effectiveness_reviews" ADD CONSTRAINT "capa_effectiveness_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

