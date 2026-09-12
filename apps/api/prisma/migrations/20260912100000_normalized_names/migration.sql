-- Duplicate-name prevention (Templates, Audits, CAPAs, Documents).
--
-- Adds a normalized (trimmed, whitespace-collapsed, lowercased) copy of each
-- entity's name/title column, used by the application layer to detect
-- duplicates. This is NOT a unique constraint: live data already contains
-- case/whitespace-variant duplicate names in audit_templates, audits and
-- controlled_documents (verified by direct inspection before writing this
-- migration) — adding a unique index here would fail to apply, and silently
-- renaming existing business data to resolve the collisions is explicitly
-- out of scope. Uniqueness is enforced at the service layer instead, the
-- same pattern already used for IndicatorValue period uniqueness.
--
-- Safe on non-empty tables: DEFAULT '' satisfies NOT NULL for existing rows
-- in the same statement that adds the column, so no separate backfill step
-- is required to apply this migration. The UPDATE statements below then fill
-- in the real normalized value for pre-existing rows.

-- AlterTable
ALTER TABLE "audit_templates" ADD COLUMN     "normalizedName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "normalizedTitle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "capas" ADD COLUMN     "normalizedTitle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "controlled_documents" ADD COLUMN     "normalizedTitle" TEXT NOT NULL DEFAULT '';

-- Backfill: trim + collapse internal whitespace + lowercase, mirroring
-- normalizeName() in @tecpap/config.
UPDATE "audit_templates" SET "normalizedName" = regexp_replace(lower(trim(both from "name")), '\s+', ' ', 'g');
UPDATE "audits" SET "normalizedTitle" = regexp_replace(lower(trim(both from "title")), '\s+', ' ', 'g');
UPDATE "capas" SET "normalizedTitle" = regexp_replace(lower(trim(both from "title")), '\s+', ' ', 'g');
UPDATE "controlled_documents" SET "normalizedTitle" = regexp_replace(lower(trim(both from "title")), '\s+', ' ', 'g');

-- CreateIndex
CREATE INDEX "audit_templates_normalizedName_idx" ON "audit_templates"("normalizedName");

-- CreateIndex
CREATE INDEX "audits_normalizedTitle_idx" ON "audits"("normalizedTitle");

-- CreateIndex
CREATE INDEX "capas_normalizedTitle_idx" ON "capas"("normalizedTitle");

-- CreateIndex
CREATE INDEX "controlled_documents_normalizedTitle_idx" ON "controlled_documents"("normalizedTitle");
