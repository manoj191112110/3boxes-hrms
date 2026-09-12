-- ADDITIVE-ONLY schema sync for neondb
-- generated from prisma migrate diff vs schema.prisma

ALTER TABLE "CalendarSync" DROP CONSTRAINT "CalendarSync_employeeId_fkey";
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_initiatorId_fkey";
ALTER TABLE "CallParticipant" DROP CONSTRAINT "CallParticipant_callId_fkey";
ALTER TABLE "CallParticipant" DROP CONSTRAINT "CallParticipant_userId_fkey";
ALTER TABLE "CandidateSentimentScore" DROP CONSTRAINT "CandidateSentimentScore_jobApplicationId_fkey";
ALTER TABLE "CandidateTalentPool" DROP CONSTRAINT "CandidateTalentPool_jobApplicationId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_parentMessageId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_roomId_fkey";
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";
ALTER TABLE "ChatRoomMember" DROP CONSTRAINT "ChatRoomMember_roomId_fkey";
ALTER TABLE "ChatSummary" DROP CONSTRAINT "ChatSummary_roomId_fkey";
ALTER TABLE "DLPScanLog" DROP CONSTRAINT "DLPScanLog_userId_fkey";
ALTER TABLE "DocumentIntelligenceResult" DROP CONSTRAINT "DocumentIntelligenceResult_employeeId_fkey";
ALTER TABLE "DottedLineManager" DROP CONSTRAINT "DottedLineManager_employeeId_fkey";
ALTER TABLE "DottedLineManager" DROP CONSTRAINT "DottedLineManager_managerId_fkey";
ALTER TABLE "EmailMessage" DROP CONSTRAINT "EmailMessage_companyId_fkey";
ALTER TABLE "EmployeeCustomFieldValue" DROP CONSTRAINT "EmployeeCustomFieldValue_employeeId_fkey";
ALTER TABLE "EmployeeCustomFieldValue" DROP CONSTRAINT "EmployeeCustomFieldValue_fieldId_fkey";
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_ownerEmployeeId_fkey";
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_parentId_fkey";
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_uploadedById_fkey";
ALTER TABLE "FileShareLink" DROP CONSTRAINT "FileShareLink_createdBy_fkey";
ALTER TABLE "FileShareLink" DROP CONSTRAINT "FileShareLink_fileId_fkey";
ALTER TABLE "FileVersion" DROP CONSTRAINT "FileVersion_fileId_fkey";
ALTER TABLE "FileVersion" DROP CONSTRAINT "FileVersion_uploadedById_fkey";
ALTER TABLE "GDPRAnonymizationRequest" DROP CONSTRAINT "GDPRAnonymizationRequest_employeeId_fkey";
ALTER TABLE "JobBoardPosting" DROP CONSTRAINT "JobBoardPosting_jobPostingId_fkey";
ALTER TABLE "Note" DROP CONSTRAINT "Note_createdById_fkey";
ALTER TABLE "OKR" DROP CONSTRAINT "OKR_ownerId_fkey";
ALTER TABLE "ResumeParse" DROP CONSTRAINT "ResumeParse_jobApplicationId_fkey";
ALTER TABLE "SocialProfile" DROP CONSTRAINT "SocialProfile_employeeId_fkey";
ALTER TABLE "Team" DROP CONSTRAINT "Team_leadId_fkey";
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_employeeId_fkey";
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";
ALTER TABLE "TodoTask" DROP CONSTRAINT "TodoTask_createdById_fkey";
ALTER TABLE "WatermarkAccessLog" DROP CONSTRAINT "WatermarkAccessLog_fileId_fkey";
ALTER TABLE "WatermarkAccessLog" DROP CONSTRAINT "WatermarkAccessLog_userId_fkey";
DROP INDEX "Geofence_isActive_idx";
DROP INDEX "Holiday_country_idx";
DROP INDEX "Holiday_date_idx";
DROP INDEX "Holiday_type_idx";
ALTER TABLE "Document" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN     "expiryAlertDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "expiryAlertSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fileNodeId" TEXT,
ADD COLUMN     "isRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxFileSizeMb" INTEGER,
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "requiredFormat" TEXT,
ADD COLUMN     "uploadedById" TEXT;
ALTER TABLE "LeaveType" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "employeeStatus" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "probationRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sandwichRuleEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Policy" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT;
ALTER TABLE "Shift" ADD COLUMN     "companyId" TEXT NOT NULL;
CREATE INDEX "Document_category_idx" ON "Document"("category");
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");
CREATE INDEX "LeaveType_companyId_idx" ON "LeaveType"("companyId");
CREATE INDEX "LeaveType_employmentType_idx" ON "LeaveType"("employmentType");
CREATE INDEX "Policy_companyId_idx" ON "Policy"("companyId");
CREATE INDEX "Shift_companyId_idx" ON "Shift"("companyId");
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeUpdateRequest" ADD CONSTRAINT "EmployeeUpdateRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeUpdateApprovalStep" ADD CONSTRAINT "EmployeeUpdateApprovalStep_updateRequestId_fkey" FOREIGN KEY ("updateRequestId") REFERENCES "EmployeeUpdateRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "EmployeeCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DottedLineManager" ADD CONSTRAINT "DottedLineManager_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DottedLineManager" ADD CONSTRAINT "DottedLineManager_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarSync" ADD CONSTRAINT "CalendarSync_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileShareLink" ADD CONSTRAINT "FileShareLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileShareLink" ADD CONSTRAINT "FileShareLink_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentIntelligenceResult" ADD CONSTRAINT "DocumentIntelligenceResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatSummary" ADD CONSTRAINT "ChatSummary_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DLPScanLog" ADD CONSTRAINT "DLPScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GDPRAnonymizationRequest" ADD CONSTRAINT "GDPRAnonymizationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatermarkAccessLog" ADD CONSTRAINT "WatermarkAccessLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatermarkAccessLog" ADD CONSTRAINT "WatermarkAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeParse" ADD CONSTRAINT "ResumeParse_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateSentimentScore" ADD CONSTRAINT "CandidateSentimentScore_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobBoardPosting" ADD CONSTRAINT "JobBoardPosting_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveAttachment" ADD CONSTRAINT "LeaveAttachment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletBucket" ADD CONSTRAINT "WalletBucket_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EWARequest" ADD CONSTRAINT "EWARequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoanMarketplaceListing" ADD CONSTRAINT "LoanMarketplaceListing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardPointsLedger" ADD CONSTRAINT "RewardPointsLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceFraudFlag" ADD CONSTRAINT "MarketplaceFraudFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialStressFlag" ADD CONSTRAINT "FinancialStressFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletBudgetAllocation" ADD CONSTRAINT "WalletBudgetAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCountryAccess" ADD CONSTRAINT "TenantCountryAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCurrencyAccess" ADD CONSTRAINT "TenantCurrencyAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantLanguageAccess" ADD CONSTRAINT "TenantLanguageAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantPayrollPolicy" ADD CONSTRAINT "TenantPayrollPolicy_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;