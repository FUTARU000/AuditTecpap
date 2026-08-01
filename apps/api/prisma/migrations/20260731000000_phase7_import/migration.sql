-- Phase 7 — Legacy QMS Import & Enterprise Knowledge Digitalization

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('LOCAL', 'GOOGLE_DRIVE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'SCANNING', 'PARSING', 'CLASSIFYING', 'WAITING_REVIEW', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportItemType" AS ENUM ('CONTROLLED_DOCUMENT', 'AUDIT_TEMPLATE', 'BUSINESS_OBJECT');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING', 'PARSED', 'CLASSIFIED', 'DUPLICATE', 'AWAITING_REVIEW', 'APPROVED', 'REJECTED', 'IMPORTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'MERGE', 'REPLACE_VERSION');


-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL DEFAULT 'UPLOAD',
    "sourceLocation" TEXT,
    "name" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedById" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "stats" JSONB,
    "errors" JSONB,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "relativePath" TEXT,
    "fileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "parentFolder" TEXT,
    "format" TEXT NOT NULL,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "parsedMetadata" JSONB,
    "contentText" TEXT,
    "pageCount" INTEGER,
    "tableCount" INTEGER,
    "imageCount" INTEGER,
    "ocrNeeded" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "warnings" JSONB,
    "error" TEXT,
    "detectedType" TEXT,
    "targetEntityType" "ImportItemType",
    "classification" JSONB,
    "duplicateOfId" TEXT,
    "duplicateStrategy" TEXT,
    "reviewDecision" "ReviewDecision",
    "reviewNote" TEXT,
    "reviewById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "fileKey" TEXT,
    "importedEntityId" TEXT,
    "importedEntityType" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_startedById_idx" ON "import_jobs"("startedById");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_items_jobId_idx" ON "import_items"("jobId");

-- CreateIndex
CREATE INDEX "import_items_status_idx" ON "import_items"("status");

-- CreateIndex
CREATE INDEX "import_items_checksum_idx" ON "import_items"("checksum");

-- CreateIndex
CREATE INDEX "import_items_importedEntityId_idx" ON "import_items"("importedEntityId");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_reviewById_fkey" FOREIGN KEY ("reviewById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
