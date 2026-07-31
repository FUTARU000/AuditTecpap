-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('YES_NO', 'YES_NO_NA', 'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('OBSERVATION', 'OFI', 'MINOR_NC', 'MAJOR_NC');


-- CreateTable
CREATE TABLE "audit_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT,
    "processId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "audit_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_template_questions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "helpText" TEXT,
    "defaultAnswer" JSONB,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "findingRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "audit_template_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "processId" TEXT,
    "auditorId" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "reviewComment" TEXT,
    "score" DOUBLE PRECISION,
    "compliance" DOUBLE PRECISION,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_answers" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "questionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "responsibleUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "processId" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_evidence" (
    "id" TEXT NOT NULL,
    "auditId" TEXT,
    "questionId" TEXT,
    "findingId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "comment" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_templates_status_idx" ON "audit_templates"("status");

-- CreateIndex
CREATE INDEX "audit_templates_departmentId_idx" ON "audit_templates"("departmentId");

-- CreateIndex
CREATE INDEX "audit_templates_processId_idx" ON "audit_templates"("processId");

-- CreateIndex
CREATE INDEX "audit_template_sections_templateId_idx" ON "audit_template_sections"("templateId");

-- CreateIndex
CREATE INDEX "audit_template_questions_sectionId_idx" ON "audit_template_questions"("sectionId");

-- CreateIndex
CREATE INDEX "audits_templateId_idx" ON "audits"("templateId");

-- CreateIndex
CREATE INDEX "audits_departmentId_idx" ON "audits"("departmentId");

-- CreateIndex
CREATE INDEX "audits_processId_idx" ON "audits"("processId");

-- CreateIndex
CREATE INDEX "audits_status_idx" ON "audits"("status");

-- CreateIndex
CREATE INDEX "audits_auditorId_idx" ON "audits"("auditorId");

-- CreateIndex
CREATE INDEX "audit_answers_auditId_idx" ON "audit_answers"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_answers_auditId_questionId_key" ON "audit_answers"("auditId", "questionId");

-- CreateIndex
CREATE INDEX "findings_auditId_idx" ON "findings"("auditId");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_status_idx" ON "findings"("status");

-- CreateIndex
CREATE INDEX "audit_evidence_auditId_idx" ON "audit_evidence"("auditId");

-- CreateIndex
CREATE INDEX "audit_evidence_findingId_idx" ON "audit_evidence"("findingId");

-- AddForeignKey
ALTER TABLE "audit_templates" ADD CONSTRAINT "audit_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_templates" ADD CONSTRAINT "audit_templates_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_templates" ADD CONSTRAINT "audit_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_templates" ADD CONSTRAINT "audit_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_template_sections" ADD CONSTRAINT "audit_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "audit_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_template_questions" ADD CONSTRAINT "audit_template_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "audit_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "audit_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_answers" ADD CONSTRAINT "audit_answers_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_answers" ADD CONSTRAINT "audit_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "audit_template_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

