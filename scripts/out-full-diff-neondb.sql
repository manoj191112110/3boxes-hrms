-- DropForeignKey
ALTER TABLE "CalendarSync" DROP CONSTRAINT "CalendarSync_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_initiatorId_fkey";

-- DropForeignKey
ALTER TABLE "CallParticipant" DROP CONSTRAINT "CallParticipant_callId_fkey";

-- DropForeignKey
ALTER TABLE "CallParticipant" DROP CONSTRAINT "CallParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateSentimentScore" DROP CONSTRAINT "CandidateSentimentScore_jobApplicationId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateTalentPool" DROP CONSTRAINT "CandidateTalentPool_jobApplicationId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_parentMessageId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_roomId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_senderId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRoomMember" DROP CONSTRAINT "ChatRoomMember_roomId_fkey";

-- DropForeignKey
ALTER TABLE "ChatSummary" DROP CONSTRAINT "ChatSummary_roomId_fkey";

-- DropForeignKey
ALTER TABLE "DLPScanLog" DROP CONSTRAINT "DLPScanLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentIntelligenceResult" DROP CONSTRAINT "DocumentIntelligenceResult_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "DottedLineManager" DROP CONSTRAINT "DottedLineManager_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "DottedLineManager" DROP CONSTRAINT "DottedLineManager_managerId_fkey";

-- DropForeignKey
ALTER TABLE "EmailMessage" DROP CONSTRAINT "EmailMessage_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeCustomFieldValue" DROP CONSTRAINT "EmployeeCustomFieldValue_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeCustomFieldValue" DROP CONSTRAINT "EmployeeCustomFieldValue_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_ownerEmployeeId_fkey";

-- DropForeignKey
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_parentId_fkey";

-- DropForeignKey
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "FileShareLink" DROP CONSTRAINT "FileShareLink_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "FileShareLink" DROP CONSTRAINT "FileShareLink_fileId_fkey";

-- DropForeignKey
ALTER TABLE "FileVersion" DROP CONSTRAINT "FileVersion_fileId_fkey";

-- DropForeignKey
ALTER TABLE "FileVersion" DROP CONSTRAINT "FileVersion_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "GDPRAnonymizationRequest" DROP CONSTRAINT "GDPRAnonymizationRequest_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "JobBoardPosting" DROP CONSTRAINT "JobBoardPosting_jobPostingId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_createdById_fkey";

-- DropForeignKey
ALTER TABLE "OKR" DROP CONSTRAINT "OKR_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "ResumeParse" DROP CONSTRAINT "ResumeParse_jobApplicationId_fkey";

-- DropForeignKey
ALTER TABLE "SocialProfile" DROP CONSTRAINT "SocialProfile_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_leadId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TodoTask" DROP CONSTRAINT "TodoTask_createdById_fkey";

-- DropForeignKey
ALTER TABLE "WatermarkAccessLog" DROP CONSTRAINT "WatermarkAccessLog_fileId_fkey";

-- DropForeignKey
ALTER TABLE "WatermarkAccessLog" DROP CONSTRAINT "WatermarkAccessLog_userId_fkey";

-- DropIndex
DROP INDEX "Geofence_isActive_idx";

-- DropIndex
DROP INDEX "Holiday_country_idx";

-- DropIndex
DROP INDEX "Holiday_date_idx";

-- DropIndex
DROP INDEX "Holiday_type_idx";

-- AlterTable
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

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "employeeStatus" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "probationRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sandwichRuleEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "fileMimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "companyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "LeaveType_companyId_idx" ON "LeaveType"("companyId");

-- CreateIndex
CREATE INDEX "LeaveType_employmentType_idx" ON "LeaveType"("employmentType");

-- CreateIndex
CREATE INDEX "Policy_companyId_idx" ON "Policy"("companyId");

-- CreateIndex
CREATE INDEX "Shift_companyId_idx" ON "Shift"("companyId");

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeUpdateRequest" ADD CONSTRAINT "EmployeeUpdateRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeUpdateApprovalStep" ADD CONSTRAINT "EmployeeUpdateApprovalStep_updateRequestId_fkey" FOREIGN KEY ("updateRequestId") REFERENCES "EmployeeUpdateRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCustomFieldValue" ADD CONSTRAINT "EmployeeCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "EmployeeCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DottedLineManager" ADD CONSTRAINT "DottedLineManager_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DottedLineManager" ADD CONSTRAINT "DottedLineManager_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSync" ADD CONSTRAINT "CalendarSync_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallParticipant" ADD CONSTRAINT "CallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileNode" ADD CONSTRAINT "FileNode_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileShareLink" ADD CONSTRAINT "FileShareLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileShareLink" ADD CONSTRAINT "FileShareLink_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentIntelligenceResult" ADD CONSTRAINT "DocumentIntelligenceResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSummary" ADD CONSTRAINT "ChatSummary_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DLPScanLog" ADD CONSTRAINT "DLPScanLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GDPRAnonymizationRequest" ADD CONSTRAINT "GDPRAnonymizationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkAccessLog" ADD CONSTRAINT "WatermarkAccessLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkAccessLog" ADD CONSTRAINT "WatermarkAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeParse" ADD CONSTRAINT "ResumeParse_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSentimentScore" ADD CONSTRAINT "CandidateSentimentScore_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBoardPosting" ADD CONSTRAINT "JobBoardPosting_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAttachment" ADD CONSTRAINT "LeaveAttachment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBucket" ADD CONSTRAINT "WalletBucket_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EWARequest" ADD CONSTRAINT "EWARequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanMarketplaceListing" ADD CONSTRAINT "LoanMarketplaceListing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPointsLedger" ADD CONSTRAINT "RewardPointsLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceFraudFlag" ADD CONSTRAINT "MarketplaceFraudFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStressFlag" ADD CONSTRAINT "FinancialStressFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBudgetAllocation" ADD CONSTRAINT "WalletBudgetAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCountryAccess" ADD CONSTRAINT "TenantCountryAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCurrencyAccess" ADD CONSTRAINT "TenantCurrencyAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLanguageAccess" ADD CONSTRAINT "TenantLanguageAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayrollPolicy" ADD CONSTRAINT "TenantPayrollPolicy_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AIKnowledgeQuery_user_idx" RENAME TO "AIKnowledgeQuery_userId_idx";

-- RenameIndex
ALTER INDEX "CalendarSync_employee_idx" RENAME TO "CalendarSync_employeeId_idx";

-- RenameIndex
ALTER INDEX "CallLog_initiator_idx" RENAME TO "CallLog_initiatorId_idx";

-- RenameIndex
ALTER INDEX "CallLog_room_idx" RENAME TO "CallLog_roomId_idx";

-- RenameIndex
ALTER INDEX "CallLog_started_idx" RENAME TO "CallLog_startedAt_idx";

-- RenameIndex
ALTER INDEX "CallParticipant_call_idx" RENAME TO "CallParticipant_callId_idx";

-- RenameIndex
ALTER INDEX "ChatMessage_parent_idx" RENAME TO "ChatMessage_parentMessageId_idx";

-- RenameIndex
ALTER INDEX "ChatMessage_room_created_idx" RENAME TO "ChatMessage_roomId_createdAt_idx";

-- RenameIndex
ALTER INDEX "ChatMessage_sender_idx" RENAME TO "ChatMessage_senderId_idx";

-- RenameIndex
ALTER INDEX "ChatRoom_company_idx" RENAME TO "ChatRoom_companyId_idx";

-- RenameIndex
ALTER INDEX "ChatRoom_project_idx" RENAME TO "ChatRoom_projectId_idx";

-- RenameIndex
ALTER INDEX "ChatRoomMember_room_idx" RENAME TO "ChatRoomMember_roomId_idx";

-- RenameIndex
ALTER INDEX "ChatRoomMember_user_idx" RENAME TO "ChatRoomMember_userId_idx";

-- RenameIndex
ALTER INDEX "CollabFeatureFlag_tenant_idx" RENAME TO "CollaborationFeatureFlag_tenantId_idx";

-- RenameIndex
ALTER INDEX "CommunicationPolicy_tenant_idx" RENAME TO "CommunicationPolicy_tenantId_idx";

-- RenameIndex
ALTER INDEX "DLPScanLog_source_idx" RENAME TO "DLPScanLog_sourceType_sourceId_idx";

-- RenameIndex
ALTER INDEX "DLPScanLog_user_idx" RENAME TO "DLPScanLog_userId_idx";

-- RenameIndex
ALTER INDEX "DocIntelligence_doc_idx" RENAME TO "DocumentIntelligenceResult_documentId_idx";

-- RenameIndex
ALTER INDEX "DocIntelligence_employee_idx" RENAME TO "DocumentIntelligenceResult_employeeId_idx";

-- RenameIndex
ALTER INDEX "DocIntelligence_file_idx" RENAME TO "DocumentIntelligenceResult_fileId_idx";

-- RenameIndex
ALTER INDEX "DottedLineManager_employee_idx" RENAME TO "DottedLineManager_employeeId_idx";

-- RenameIndex
ALTER INDEX "DottedLineManager_manager_idx" RENAME TO "DottedLineManager_managerId_idx";

-- RenameIndex
ALTER INDEX "EmployeeCustomField_scope_country_company_idx" RENAME TO "EmployeeCustomField_scope_countryCode_companyId_idx";

-- RenameIndex
ALTER INDEX "EmployeeCustomFieldValue_employee_idx" RENAME TO "EmployeeCustomFieldValue_employeeId_idx";

-- RenameIndex
ALTER INDEX "EmployeeCustomFieldValue_field_idx" RENAME TO "EmployeeCustomFieldValue_fieldId_idx";

-- RenameIndex
ALTER INDEX "FileNode_drive_company_idx" RENAME TO "FileNode_driveType_companyId_idx";

-- RenameIndex
ALTER INDEX "FileNode_drive_owner_idx" RENAME TO "FileNode_driveType_ownerEmployeeId_idx";

-- RenameIndex
ALTER INDEX "FileNode_drive_project_idx" RENAME TO "FileNode_driveType_projectId_idx";

-- RenameIndex
ALTER INDEX "FileNode_parent_idx" RENAME TO "FileNode_parentId_idx";

-- RenameIndex
ALTER INDEX "FileShareLink_file_idx" RENAME TO "FileShareLink_fileId_idx";

-- RenameIndex
ALTER INDEX "FileShareLink_url_idx" RENAME TO "FileShareLink_shareUrl_idx";

-- RenameIndex
ALTER INDEX "FileVersion_file_version_idx" RENAME TO "FileVersion_fileId_versionNumber_idx";

-- RenameIndex
ALTER INDEX "GDPRAnon_employee_idx" RENAME TO "GDPRAnonymizationRequest_employeeId_idx";

-- RenameIndex
ALTER INDEX "GDPRAnon_status_idx" RENAME TO "GDPRAnonymizationRequest_status_idx";

-- RenameIndex
ALTER INDEX "LegalHold_target_user_idx" RENAME TO "LegalHold_targetUserId_idx";

-- RenameIndex
ALTER INDEX "LegalHold_tenant_status_idx" RENAME TO "LegalHold_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "SSOProvider_tenant_idx" RENAME TO "SSOProvider_tenantId_idx";

-- RenameIndex
ALTER INDEX "SocialProfile_employee_idx" RENAME TO "SocialProfile_employeeId_idx";

-- RenameIndex
ALTER INDEX "StorageAnalytics_company_drive_idx" RENAME TO "StorageAnalytics_companyId_driveType_idx";

-- RenameIndex
ALTER INDEX "StorageAnalytics_tenant_snapshot_idx" RENAME TO "StorageAnalytics_tenantId_snapshotDate_idx";

-- RenameIndex
ALTER INDEX "StorageQuota_tenant_idx" RENAME TO "StorageQuota_tenantId_idx";

-- RenameIndex
ALTER INDEX "Team_company_idx" RENAME TO "Team_companyId_idx";

-- RenameIndex
ALTER INDEX "TeamMember_employee_idx" RENAME TO "TeamMember_employeeId_idx";

-- RenameIndex
ALTER INDEX "TeamMember_team_idx" RENAME TO "TeamMember_teamId_idx";

-- RenameIndex
ALTER INDEX "Watermark_file_created_idx" RENAME TO "WatermarkAccessLog_fileId_createdAt_idx";

-- RenameIndex
ALTER INDEX "Watermark_user_idx" RENAME TO "WatermarkAccessLog_userId_idx";

