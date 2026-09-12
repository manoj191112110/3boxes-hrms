CREATE TABLE "AttendanceWorkflowConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "requestType" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Attendance Workflow',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "levels" TEXT NOT NULL DEFAULT '[]',
    "rules" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceWorkflowConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "employeeId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "subtype" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "payload" JSONB,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "configSnapshot" TEXT,
    "monthlyKey" TEXT,
    "systemActions" TEXT,
    "qrToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRequestApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "slaAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "scanLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRequestApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceWorkflowConfig_companyId_requestType_idx" ON "AttendanceWorkflowConfig"("companyId", "requestType");

CREATE UNIQUE INDEX "AttendanceRequest_qrToken_key" ON "AttendanceRequest"("qrToken");

CREATE INDEX "AttendanceRequest_companyId_requestType_status_idx" ON "AttendanceRequest"("companyId", "requestType", "status");

CREATE INDEX "AttendanceRequest_employeeId_idx" ON "AttendanceRequest"("employeeId");

CREATE INDEX "AttendanceRequest_status_currentLevel_idx" ON "AttendanceRequest"("status", "currentLevel");

CREATE INDEX "AttendanceRequestApproval_requestId_idx" ON "AttendanceRequestApproval"("requestId");

CREATE INDEX "AttendanceRequestApproval_actorUserId_status_idx" ON "AttendanceRequestApproval"("actorUserId", "status");

CREATE UNIQUE INDEX "AttendanceRequestApproval_requestId_level_key" ON "AttendanceRequestApproval"("requestId", "level");

ALTER TABLE "AttendanceWorkflowConfig" ADD CONSTRAINT "AttendanceWorkflowConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceRequestApproval" ADD CONSTRAINT "AttendanceRequestApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;