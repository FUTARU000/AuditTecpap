-- Frequency enum: MONTHLY/QUARTERLY unchanged; DAILY/WEEKLY removed (unused —
-- verified no existing row references them); YEARLY renamed to ANNUAL via a
-- safe text-cast (no row currently uses YEARLY either).
BEGIN;
CREATE TYPE "IndicatorFrequency_new" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
ALTER TABLE "indicators" ALTER COLUMN "frequency" DROP DEFAULT;
ALTER TABLE "indicators" ALTER COLUMN "frequency" TYPE "IndicatorFrequency_new" USING ("frequency"::text::"IndicatorFrequency_new");
ALTER TYPE "IndicatorFrequency" RENAME TO "IndicatorFrequency_old";
ALTER TYPE "IndicatorFrequency_new" RENAME TO "IndicatorFrequency";
DROP TYPE "IndicatorFrequency_old";
ALTER TABLE "indicators" ALTER COLUMN "frequency" SET DEFAULT 'MONTHLY';
COMMIT;

-- New period columns — added nullable first, backfilled from existing data,
-- then tightened. Never destructive: every existing indicator_values row
-- keeps its id/value/measuredAt/comment/recordedBy exactly as-is.
ALTER TABLE "indicator_values" ADD COLUMN "year" INTEGER;
ALTER TABLE "indicator_values" ADD COLUMN "periodMonth" INTEGER;
ALTER TABLE "indicator_values" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill: year/periodMonth derived deterministically from each row's own
-- measuredAt and its indicator's frequency (periodMonth snapped to the
-- frequency's representative month — see IndicatorFrequency_valid_months
-- logic in indicators.service.ts, which this mirrors exactly).
UPDATE "indicator_values" iv
SET "year" = EXTRACT(YEAR FROM iv."measuredAt")::int,
    "periodMonth" = CASE i."frequency"
      WHEN 'MONTHLY' THEN EXTRACT(MONTH FROM iv."measuredAt")::int
      WHEN 'QUARTERLY' THEN (CEIL(EXTRACT(MONTH FROM iv."measuredAt")::numeric / 3) * 3)::int
      WHEN 'SEMIANNUAL' THEN (CEIL(EXTRACT(MONTH FROM iv."measuredAt")::numeric / 6) * 6)::int
      WHEN 'ANNUAL' THEN 12
      ELSE EXTRACT(MONTH FROM iv."measuredAt")::int
    END
FROM "indicators" i
WHERE i."id" = iv."indicatorId";

-- updatedAt backfill: no revision has happened yet for existing rows, so
-- "last updated" = "created".
UPDATE "indicator_values" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "indicator_values" ALTER COLUMN "year" SET NOT NULL;
ALTER TABLE "indicator_values" ALTER COLUMN "periodMonth" SET NOT NULL;
ALTER TABLE "indicator_values" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "indicator_values_indicatorId_year_periodMonth_idx" ON "indicator_values"("indicatorId", "year", "periodMonth");
