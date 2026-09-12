-- CreateTable
CREATE TABLE "capa_action_verifications" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capa_action_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capa_action_verifications_actionId_verifiedAt_idx" ON "capa_action_verifications"("actionId", "verifiedAt");

-- AddForeignKey
ALTER TABLE "capa_action_verifications" ADD CONSTRAINT "capa_action_verifications_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "capa_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capa_action_verifications" ADD CONSTRAINT "capa_action_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
