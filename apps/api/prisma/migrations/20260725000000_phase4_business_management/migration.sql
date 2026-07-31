
-- CreateTable
CREATE TABLE "business_object_types" (
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

    CONSTRAINT "business_object_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_objects" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "processId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT,
    "unit" TEXT,
    "target" DOUBLE PRECISION,
    "warningThreshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "trend" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "responsibleUserId" TEXT,
    "departmentId" TEXT,
    "processId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_risks" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "riskScore" INTEGER NOT NULL DEFAULT 9,
    "ownerId" TEXT,
    "mitigation" TEXT,
    "reviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_assignments" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_timeline" (
    "id" TEXT NOT NULL,
    "processId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_relationships" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_object_types_code_key" ON "business_object_types"("code");

-- CreateIndex
CREATE INDEX "business_objects_typeId_idx" ON "business_objects"("typeId");

-- CreateIndex
CREATE INDEX "business_objects_processId_idx" ON "business_objects"("processId");

-- CreateIndex
CREATE INDEX "business_objects_departmentId_idx" ON "business_objects"("departmentId");

-- CreateIndex
CREATE INDEX "business_objects_status_idx" ON "business_objects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "business_objects_departmentId_code_key" ON "business_objects"("departmentId", "code");

-- CreateIndex
CREATE INDEX "kpis_processId_idx" ON "kpis"("processId");

-- CreateIndex
CREATE INDEX "kpis_departmentId_idx" ON "kpis"("departmentId");

-- CreateIndex
CREATE INDEX "kpis_status_idx" ON "kpis"("status");

-- CreateIndex
CREATE INDEX "process_risks_processId_idx" ON "process_risks"("processId");

-- CreateIndex
CREATE INDEX "process_risks_status_idx" ON "process_risks"("status");

-- CreateIndex
CREATE INDEX "process_assignments_processId_idx" ON "process_assignments"("processId");

-- CreateIndex
CREATE INDEX "process_assignments_userId_idx" ON "process_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "process_assignments_processId_userId_role_key" ON "process_assignments"("processId", "userId", "role");

-- CreateIndex
CREATE INDEX "activity_timeline_processId_createdAt_idx" ON "activity_timeline"("processId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_timeline_entityType_entityId_idx" ON "activity_timeline"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "business_relationships_sourceType_sourceId_idx" ON "business_relationships"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "business_relationships_targetType_targetId_idx" ON "business_relationships"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "business_relationships_sourceType_sourceId_targetType_targe_key" ON "business_relationships"("sourceType", "sourceId", "targetType", "targetId", "type");

-- AddForeignKey
ALTER TABLE "business_objects" ADD CONSTRAINT "business_objects_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "business_object_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_objects" ADD CONSTRAINT "business_objects_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_objects" ADD CONSTRAINT "business_objects_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_objects" ADD CONSTRAINT "business_objects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_objects" ADD CONSTRAINT "business_objects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_risks" ADD CONSTRAINT "process_risks_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_risks" ADD CONSTRAINT "process_risks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignments" ADD CONSTRAINT "process_assignments_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_assignments" ADD CONSTRAINT "process_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_timeline" ADD CONSTRAINT "activity_timeline_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_timeline" ADD CONSTRAINT "activity_timeline_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

