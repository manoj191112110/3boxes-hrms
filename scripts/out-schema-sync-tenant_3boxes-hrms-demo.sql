-- ADDITIVE-ONLY schema sync for tenant_3boxes-hrms-demo
-- generated from prisma migrate diff vs schema.prisma

ALTER TABLE "EmployeeWorkflowConfig" ADD COLUMN     "workflowType" TEXT NOT NULL DEFAULT 'update_profile';
ALTER TABLE "Offer" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "candidateSignature" TEXT,
ADD COLUMN     "candidateSignedAt" TIMESTAMP(3);
ALTER TABLE "OnboardingTask" ADD COLUMN     "kra" TEXT,
ADD COLUMN     "lastRemindedAt" TIMESTAMP(3),
ADD COLUMN     "mentorEmployeeId" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trainingModule" TEXT;
CREATE TABLE "PolicyDocumentVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "fileMimeType" TEXT,
    "changeNote" TEXT,
    "archivedById" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PolicyAcknowledgment" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyVersion" TEXT,
    "method" TEXT NOT NULL DEFAULT 'self_service',
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedById" TEXT,
    "comments" TEXT,

    CONSTRAINT "PolicyAcknowledgment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PolicyDocumentVersion_policyId_idx" ON "PolicyDocumentVersion"("policyId");
CREATE INDEX "PolicyAcknowledgment_policyId_idx" ON "PolicyAcknowledgment"("policyId");
CREATE INDEX "PolicyAcknowledgment_employeeId_idx" ON "PolicyAcknowledgment"("employeeId");
CREATE UNIQUE INDEX "PolicyAcknowledgment_policyId_employeeId_key" ON "PolicyAcknowledgment"("policyId", "employeeId");
CREATE UNIQUE INDEX "Offer_accessToken_key" ON "Offer"("accessToken");
ALTER TABLE "PolicyDocumentVersion" ADD CONSTRAINT "PolicyDocumentVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyAcknowledgment" ADD CONSTRAINT "PolicyAcknowledgment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyAcknowledgment" ADD CONSTRAINT "PolicyAcknowledgment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;