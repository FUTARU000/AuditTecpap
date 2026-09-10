-- DropIndex
DROP INDEX "capa_verifications_capaId_key";

-- CreateIndex
CREATE INDEX "capa_verifications_capaId_verifiedAt_idx" ON "capa_verifications"("capaId", "verifiedAt");
