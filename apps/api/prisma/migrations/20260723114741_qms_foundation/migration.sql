-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'OBSOLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('USES', 'GENERATES', 'REFERENCES', 'REPLACES', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "ownerId" TEXT,
    "objectives" TEXT,
    "scope" TEXT,
    "risks" JSONB,
    "opportunities" JSONB,
    "kpis" JSONB,
    "status" "ProcessStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controlled_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "processId" TEXT,
    "categoryId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "version" TEXT NOT NULL DEFAULT '0.1',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "keywords" TEXT[],
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "searchVector" tsvector,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controlled_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "comment" TEXT,
    "uploadedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_relations" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "targetDocumentId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processes_departmentId_idx" ON "processes"("departmentId");

-- CreateIndex
CREATE INDEX "processes_status_idx" ON "processes"("status");

-- CreateIndex
CREATE INDEX "processes_deletedAt_idx" ON "processes"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "processes_departmentId_code_key" ON "processes"("departmentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_code_key" ON "document_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "controlled_documents_code_key" ON "controlled_documents"("code");

-- CreateIndex
CREATE INDEX "controlled_documents_departmentId_idx" ON "controlled_documents"("departmentId");

-- CreateIndex
CREATE INDEX "controlled_documents_processId_idx" ON "controlled_documents"("processId");

-- CreateIndex
CREATE INDEX "controlled_documents_categoryId_idx" ON "controlled_documents"("categoryId");

-- CreateIndex
CREATE INDEX "controlled_documents_status_idx" ON "controlled_documents"("status");

-- CreateIndex
CREATE INDEX "controlled_documents_ownerId_idx" ON "controlled_documents"("ownerId");

-- CreateIndex
CREATE INDEX "controlled_documents_deletedAt_idx" ON "controlled_documents"("deletedAt");

-- CreateIndex
CREATE INDEX "controlled_documents_expirationDate_idx" ON "controlled_documents"("expirationDate");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

-- CreateIndex
CREATE INDEX "document_versions_uploadedById_idx" ON "document_versions"("uploadedById");

-- CreateIndex
CREATE INDEX "document_relations_sourceDocumentId_idx" ON "document_relations"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "document_relations_targetDocumentId_idx" ON "document_relations"("targetDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_relations_sourceDocumentId_targetDocumentId_type_key" ON "document_relations"("sourceDocumentId", "targetDocumentId", "type");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "controlled_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
