-- CreateEnum
CREATE TYPE "IndicatorFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "IndicatorDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_BASED');

-- CreateTable
CREATE TABLE "indicators" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "direction" "IndicatorDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "target" DOUBLE PRECISION,
    "warningThreshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "frequency" "IndicatorFrequency" NOT NULL DEFAULT 'MONTHLY',
    "responsibleUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_values" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indicators_code_key" ON "indicators"("code");

-- CreateIndex
CREATE INDEX "indicators_departmentId_idx" ON "indicators"("departmentId");

-- CreateIndex
CREATE INDEX "indicators_active_idx" ON "indicators"("active");

-- CreateIndex
CREATE INDEX "indicators_category_idx" ON "indicators"("category");

-- CreateIndex
CREATE INDEX "indicator_values_indicatorId_measuredAt_idx" ON "indicator_values"("indicatorId", "measuredAt");

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_values" ADD CONSTRAINT "indicator_values_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_values" ADD CONSTRAINT "indicator_values_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

