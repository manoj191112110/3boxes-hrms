-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "logo" TEXT,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "language" TEXT NOT NULL DEFAULT 'en',
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "dataRegion" TEXT,
    "subscriptionSeats" INTEGER NOT NULL DEFAULT 0,
    "subscriptionStorage" INTEGER NOT NULL DEFAULT 0,
    "maxCompaniesAllowed" INTEGER NOT NULL DEFAULT 0,
    "aiFeedbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "resumeScoreThreshold" INTEGER NOT NULL DEFAULT 0,
    "talentPoolCrossCompanyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoInterviewRetakeLimit" INTEGER NOT NULL DEFAULT 0,
    "videoRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDatabase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectionString" TEXT NOT NULL,
    "directUrl" TEXT,
    "databaseName" TEXT NOT NULL,
    "neonBranchId" TEXT,
    "neonProjectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggeredByName" TEXT NOT NULL,
    "backupType" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "totalTables" INTEGER NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "tableDetails" TEXT,
    "storageLocation" TEXT,
    "fileSizeBytes" INTEGER,
    "backupNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "source" TEXT NOT NULL DEFAULT 'platform_default',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeLimitMode" TEXT NOT NULL DEFAULT 'group_total',
    "maxEmployees" INTEGER,
    "maxCompanies" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyGroupId" TEXT NOT NULL,
    "registrationNo" TEXT,
    "taxId" TEXT,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "language" TEXT NOT NULL DEFAULT 'en',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "maxEmployees" INTEGER,
    "plannedEmployeeCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyId" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "headId" TEXT,
    "parentDepartmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "minSalary" DOUBLE PRECISION,
    "maxSalary" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "tenantId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLogin" TIMESTAMP(3),
    "lastLogout" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personalEmail" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "userId" TEXT,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "branchId" TEXT,
    "companyId" TEXT,
    "reportingManagerId" TEXT,
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "bloodGroup" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "credentialsStatus" TEXT DEFAULT 'not_invited',
    "credentialsInvitedAt" TIMESTAMP(3),
    "credentialsInvitedBy" TEXT,
    "employeeStatus" TEXT DEFAULT 'confirmed',
    "employeeType" TEXT DEFAULT 'full_time',
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "taxId" TEXT,
    "salary" DOUBLE PRECISION,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'INR',
    "leavePolicyId" TEXT,
    "attendancePolicyId" TEXT,
    "travelPolicyId" TEXT,
    "salaryStructureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION,
    "certificate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'intermediate',
    "yearsOfExp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'full-time',
    "experience" TEXT,
    "salary" TEXT,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "postedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingDate" TIMESTAMP(3),
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "candidateId" TEXT,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "resume" TEXT,
    "coverLetter" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "status" TEXT NOT NULL DEFAULT 'applied',
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" INTEGER,
    "notes" TEXT,
    "interviewDate" TIMESTAMP(3),
    "expectedSalary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'technical',
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "duration" INTEGER,
    "location" TEXT,
    "meetingUrl" TEXT,
    "interviewer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "feedback" TEXT,
    "score" INTEGER,
    "aiScore" INTEGER,
    "aiFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "assignedBy" TEXT,
    "notes" TEXT,
    "preboardingCandidateId" TEXT,
    "templateId" TEXT,
    "buddyEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "defaultDays" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForward" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "companyId" TEXT NOT NULL,
    "attachmentMandatory" BOOLEAN NOT NULL DEFAULT false,
    "attachmentMandatoryAfterDays" INTEGER NOT NULL DEFAULT 0,
    "collaborativeCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "encashmentBasis" TEXT NOT NULL DEFAULT 'basic',
    "maxEncashmentDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carryForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "halfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDaySlot" TEXT,
    "aiCollaborativeWarning" TEXT,
    "workflowStage" TEXT,
    "currentApproverId" TEXT,
    "workflowConfigSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveWorkflowConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveTypeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Leave Approval Workflow',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveWorkflowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalStep" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverUserId" TEXT,
    "actionByUserId" TEXT,
    "action" TEXT,
    "comments" TEXT,
    "actionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'present',
    "workHours" DOUBLE PRECISION,
    "overtime" DOUBLE PRECISION,
    "notes" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "da" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conveyance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medical" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pf" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paidDate" TIMESTAMP(3),
    "paySlip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewCycle" TEXT NOT NULL,
    "reviewPeriod" TEXT,
    "reviewerId" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goalsRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skillsRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "behaviorRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comments" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'performance',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "trainer" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'online',
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "maxParticipants" INTEGER,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'available',
    "condition" TEXT NOT NULL DEFAULT 'new',
    "location" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnDate" TIMESTAMP(3),
    "expectedReturn" TIMESTAMP(3),
    "condition" TEXT NOT NULL DEFAULT 'good',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "reportedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'flight',
    "estimatedCost" DOUBLE PRECISION,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "receipt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "projectTaskId" TEXT,
    "project" TEXT,
    "task" TEXT,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'peer',
    "rating" INTEGER,
    "comments" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromDesignation" TEXT NOT NULL,
    "toDesignation" TEXT NOT NULL,
    "fromDepartment" TEXT NOT NULL,
    "toDepartment" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "salaryChange" DOUBLE PRECISION,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "resolution" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Separation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "noticePeriod" INTEGER NOT NULL DEFAULT 30,
    "lastWorkingDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "exitInterview" TEXT,
    "settlementAmount" DOUBLE PRECISION,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Separation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "category" TEXT NOT NULL DEFAULT 'system',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'public',
    "country" TEXT,
    "description" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "optionalQuota" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER NOT NULL DEFAULT 60,
    "graceTime" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'active',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "receipt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeeLimit" INTEGER NOT NULL DEFAULT 50,
    "companyLimit" INTEGER NOT NULL DEFAULT 1,
    "branchLimit" INTEGER NOT NULL DEFAULT 5,
    "storageLimit" INTEGER NOT NULL DEFAULT 1000,
    "aiInterviewLimit" INTEGER NOT NULL DEFAULT 10,
    "aiChatbotLimit" INTEGER NOT NULL DEFAULT 100,
    "payrollEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recruitmentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "attendanceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "projectEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clientPortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vendorPortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mobileAppEnabled" BOOLEAN NOT NULL DEFAULT false,
    "apiAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whiteLabelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "supportLevel" TEXT NOT NULL DEFAULT 'email',
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'active',
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyId" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "billingCurrency" TEXT NOT NULL DEFAULT 'INR',
    "paymentTerms" TEXT NOT NULL DEFAULT 'net_30',
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "contractValue" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'vendor',
    "parentVendorId" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zipCode" TEXT,
    "specialization" TEXT,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "piiPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "departmentId" TEXT,
    "projectManagerId" TEXT,
    "deliveryManagerId" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'internal',
    "billingType" TEXT NOT NULL DEFAULT 'non_billable',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "budgetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "assignedToId" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "billingAmount" DOUBLE PRECISION,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "invoiceStatus" TEXT NOT NULL DEFAULT 'not_invoiced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAllocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT,
    "allocationPct" INTEGER NOT NULL DEFAULT 100,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingStatus" TEXT NOT NULL DEFAULT 'billable',
    "billingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "internalCostRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timesheetApprover" TEXT,
    "clientApprover" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" TEXT,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'hr',
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "categoryId" TEXT,
    "requesterType" TEXT NOT NULL DEFAULT 'employee',
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedAgentId" TEXT,
    "assignedAgentName" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "attachments" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT,
    "hiringManagerId" TEXT,
    "positionType" TEXT NOT NULL DEFAULT 'new',
    "replacementEmployeeId" TEXT,
    "numberOfOpenings" INTEGER NOT NULL DEFAULT 1,
    "employmentType" TEXT NOT NULL DEFAULT 'full-time',
    "skillsRequired" TEXT,
    "experienceRequired" TEXT,
    "qualification" TEXT,
    "salaryBudget" TEXT,
    "projectId" TEXT,
    "clientId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "expectedJoiningDate" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "jobPostingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "offeredSalary" DOUBLE PRECISION NOT NULL,
    "offeredCurrency" TEXT NOT NULL DEFAULT 'INR',
    "offeredCTC" DOUBLE PRECISION,
    "salaryBreakdown" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "probationPeriod" INTEGER NOT NULL DEFAULT 90,
    "reportingTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseNotes" TEXT,
    "templateId" TEXT,
    "generatedPdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "esignProvider" TEXT,
    "esignEnvelopeId" TEXT,
    "signedPdfUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'fixed',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentageOf" TEXT,
    "formula" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "maxLimit" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FNFCalculation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "separationId" TEXT,
    "pendingSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leaveEncashment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incentives" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reimbursements" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noticeRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assetRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanRecovery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherRecoveries" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FNFCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "companyId" TEXT,
    "description" TEXT,
    "steps" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowApproval" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "action" TEXT,
    "comments" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIChatLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'chatbot',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreboardingCandidate" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "jobTitle" TEXT,
    "departmentId" TEXT,
    "offeredSalary" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "offerDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joiningDate" TIMESTAMP(3),
    "notes" TEXT,
    "offerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offer_accepted',
    "documentsUploaded" TEXT,
    "backgroundCheckStatus" TEXT NOT NULL DEFAULT 'pending',
    "backgroundCheckNotes" TEXT,
    "hrVerified" BOOLEAN NOT NULL DEFAULT false,
    "accountProvisioned" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "requisitionId" TEXT,
    "itProvisioningStatus" TEXT NOT NULL DEFAULT 'pending',
    "itProvisioningNotes" TEXT,
    "buddyEmployeeId" TEXT,
    "welcomeSeriesInitiated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreboardingCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'resignation',
    "reason" TEXT,
    "noticePeriodEndDate" TIMESTAMP(3),
    "lastWorkingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "clearanceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OKR" (
    "id" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "ownerId" TEXT,
    "companyId" TEXT,
    "projectId" TEXT,
    "createdById" TEXT,
    "quarter" TEXT NOT NULL DEFAULT 'Q1 2026',
    "year" INTEGER NOT NULL DEFAULT 2026,
    "category" TEXT NOT NULL DEFAULT 'individual',
    "parentOkrId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OKR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "okrId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitInterview" (
    "id" TEXT NOT NULL,
    "separationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "interviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewer" TEXT,
    "reason" TEXT,
    "feedback" TEXT,
    "rating" INTEGER,
    "wouldRehire" BOOLEAN,
    "suggestions" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sentimentScore" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    "sentimentSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExitInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'pulse',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "anonymous" BOOLEAN NOT NULL DEFAULT true,
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "questions" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "sentiment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recognition" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'kudos',
    "title" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "description" TEXT,
    "biasChecks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIPromptLog" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "model" TEXT,
    "promptInput" TEXT,
    "promptOutput" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "biasFlag" BOOLEAN NOT NULL DEFAULT false,
    "biasReason" TEXT,
    "userId" TEXT,
    "configId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIPromptLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'FiBookOpen',
    "color" TEXT NOT NULL DEFAULT 'blue',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocArticle" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'functional',
    "moduleKey" TEXT,
    "tags" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'published',
    "authorId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocAccessRule" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "role" TEXT,
    "userId" TEXT,
    "accessType" TEXT NOT NULL DEFAULT 'read',
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL,
    "jobDescription" TEXT,
    "tenantId" TEXT NOT NULL,
    "interviewMode" TEXT NOT NULL DEFAULT 'text',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timeLimit" INTEGER NOT NULL DEFAULT 30,
    "cvProbeDuration" INTEGER NOT NULL DEFAULT 10,
    "enablePreScreening" BOOLEAN NOT NULL DEFAULT true,
    "enableProctoring" BOOLEAN NOT NULL DEFAULT true,
    "enableDynamicFollowUp" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "preScreenFilters" JSONB,
    "evaluationConfig" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSetQuestion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedPoints" TEXT,
    "followUpPrompts" TEXT,
    "duration" INTEGER,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSetQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "resumeUrl" TEXT,
    "resumeParsed" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "preScreenResult" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "transcriptUrl" TEXT,
    "fullTranscript" TEXT,
    "overallScore" INTEGER,
    "communicationScore" INTEGER,
    "grammarScore" INTEGER,
    "fluencyScore" INTEGER,
    "comprehensionScore" INTEGER,
    "vocabularyScore" INTEGER,
    "cognitiveScore" INTEGER,
    "skillMatchScore" INTEGER,
    "aiSummary" TEXT,
    "aiRecommendation" TEXT,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT,
    "order" INTEGER NOT NULL,
    "question" TEXT,
    "responseText" TEXT,
    "responseAudioUrl" TEXT,
    "responseVideoUrl" TEXT,
    "responseDuration" INTEGER,
    "aiScore" INTEGER,
    "aiFeedback" TEXT,
    "followUpFromId" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "isCvBased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctoringLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenshotUrl" TEXT,

    CONSTRAINT "ProctoringLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewInvitation" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "invitationToken" TEXT NOT NULL,
    "invitationUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "emailDeliveryStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CTCTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IND',
    "legalEntityId" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "ctcType" TEXT NOT NULL DEFAULT 'ANNUAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "basePayPct" DOUBLE PRECISION,
    "createdBy" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CTCTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CTCComponentMapping" (
    "id" TEXT NOT NULL,
    "ctcTemplateId" TEXT NOT NULL,
    "componentId" TEXT,
    "componentName" TEXT NOT NULL,
    "componentCategory" TEXT NOT NULL DEFAULT 'EARNING',
    "allocationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE_OF_CTC',
    "allocationValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseComponentId" TEXT,
    "formulaExpression" TEXT,
    "calculationSequence" INTEGER NOT NULL DEFAULT 1,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "taxExemptionLimit" DOUBLE PRECISION,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "prorationRule" TEXT,
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "roundingRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CTCComponentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollComponent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "componentCategory" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IND',
    "calculationType" TEXT NOT NULL,
    "defaultValue" DOUBLE PRECISION,
    "percentageBase" TEXT,
    "formulaId" TEXT,
    "slabTableId" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "taxTreatment" TEXT,
    "exemptionSection" TEXT,
    "maxExemptionAmt" DOUBLE PRECISION,
    "affectsGross" BOOLEAN NOT NULL DEFAULT true,
    "affectsNet" BOOLEAN NOT NULL DEFAULT true,
    "affectsCTC" BOOLEAN NOT NULL DEFAULT true,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "prorationApplicable" BOOLEAN NOT NULL DEFAULT true,
    "roundingRule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryComponent" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "authorityCode" TEXT,
    "partyType" TEXT NOT NULL,
    "calculationBasis" TEXT NOT NULL,
    "basisComponentId" TEXT,
    "ratePercentage" DOUBLE PRECISION,
    "wageCeiling" DOUBLE PRECISION,
    "maxContributionAmt" DOUBLE PRECISION,
    "minContributionAmt" DOUBLE PRECISION,
    "slabTableId" TEXT,
    "remittanceFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "remittanceDueDay" INTEGER,
    "filingFrequency" TEXT,
    "filingFormat" TEXT,
    "penaltyRatePct" DOUBLE PRECISION,
    "isChallanRequired" BOOLEAN NOT NULL DEFAULT false,
    "challanFormat" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSlabTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "filingStatus" TEXT,
    "regimeType" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSlabTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSlabRateLine" (
    "id" TEXT NOT NULL,
    "slabTableId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "incomeFrom" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTo" DOUBLE PRECISION,
    "ratePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedAmount" DOUBLE PRECISION,
    "surchargeRate" DOUBLE PRECISION,
    "cessRate" DOUBLE PRECISION,
    "componentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSlabRateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollInput" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "employeeId" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "inputValueNumeric" DOUBLE PRECISION,
    "unitType" TEXT,
    "inputDateFrom" TIMESTAMP(3),
    "inputDateTo" TIMESTAMP(3),
    "currencyCode" TEXT DEFAULT 'INR',
    "exchangeRate" DOUBLE PRECISION,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvalDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "referenceDocument" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyConfig" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "payrollCurrency" TEXT NOT NULL DEFAULT 'INR',
    "reportingCurrency" TEXT,
    "exchangeRateSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "rateType" TEXT NOT NULL DEFAULT 'SPOT',
    "autoFetchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fetchFrequency" TEXT,
    "roundingPrecision" INTEGER NOT NULL DEFAULT 2,
    "roundingRule" TEXT NOT NULL DEFAULT 'NEAREST',
    "gainLossAccount" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'SPOT',
    "source" TEXT NOT NULL DEFAULT 'Manual Entry',
    "inverseRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL DEFAULT 'STANDARD',
    "hierarchyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allocationMethod" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT true,
    "maxAllocations" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DimensionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDimensionAllocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "dimensionValueId" TEXT NOT NULL,
    "allocationPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "allocationAmount" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDimensionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "payrollPeriod" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'REGULAR',
    "runStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRateDate" TIMESTAMP(3),
    "taxProjectionMethod" TEXT NOT NULL DEFAULT 'CUMULATIVE',
    "includeStatutory" BOOLEAN NOT NULL DEFAULT true,
    "processingMode" TEXT NOT NULL DEFAULT 'FULL',
    "initiatedBy" TEXT,
    "companyId" TEXT,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNetPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerContrib" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollTransactionLine" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "componentId" TEXT,
    "componentCode" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "componentCategory" TEXT NOT NULL,
    "calculatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overrideAmount" DOUBLE PRECISION,
    "finalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DOUBLE PRECISION,
    "baseCurrencyAmount" DOUBLE PRECISION,
    "ytdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mtdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prorationFactor" DOUBLE PRECISION,
    "inputSourceId" TEXT,
    "formulaTrace" TEXT,
    "dimensionSplitJson" TEXT,
    "glAccountCode" TEXT,
    "costCenterCode" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversedTransactionId" TEXT,
    "taxTreatment" TEXT,
    "statutoryReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceObligation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "filingType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dueDateRule" TEXT NOT NULL,
    "graceDays" INTEGER,
    "penaltyType" TEXT,
    "penaltyValue" DOUBLE PRECISION,
    "responsibleRole" TEXT NOT NULL DEFAULT 'PAYROLL_ADMIN',
    "escalationRole" TEXT,
    "reminderDaysBefore" TEXT,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "filingFormat" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFiling" (
    "id" TEXT NOT NULL,
    "complianceId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "filingPeriod" TEXT NOT NULL,
    "filingStatus" TEXT NOT NULL DEFAULT 'GENERATED',
    "generatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedDate" TIMESTAMP(3),
    "acknowledgementRef" TEXT,
    "filingAmount" DOUBLE PRECISION,
    "penaltyAmount" DOUBLE PRECISION,
    "filePath" TEXT,
    "submittedBy" TEXT,
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "resubmissionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLAccountMapping" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "debitAccount" TEXT NOT NULL,
    "creditAccount" TEXT NOT NULL,
    "costCenterSource" TEXT NOT NULL DEFAULT 'EMPLOYEE_DEFAULT',
    "specificCostCenter" TEXT,
    "postingType" TEXT NOT NULL DEFAULT 'ACTUAL',
    "intercompanyAccount" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GLAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "processingCutOff" INTEGER NOT NULL DEFAULT 25,
    "paymentDay" INTEGER NOT NULL DEFAULT 1,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "allowDirectDeposit" BOOLEAN NOT NULL DEFAULT true,
    "allowCheque" BOOLEAN NOT NULL DEFAULT false,
    "allowCash" BOOLEAN NOT NULL DEFAULT false,
    "costingSegments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePaymentMethod" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'DIRECT_DEPOSIT',
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,
    "bankBranch" TEXT,
    "accountType" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "splitType" TEXT,
    "splitValue" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "loanType" TEXT NOT NULL,
    "loanAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tenureMonths" INTEGER NOT NULL,
    "emiAmount" DOUBLE PRECISION NOT NULL,
    "outstandingBalance" DOUBLE PRECISION NOT NULL,
    "disbursedAmount" DOUBLE PRECISION NOT NULL,
    "disbursedDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingEmis" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "recoverySchedule" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateType" TEXT NOT NULL DEFAULT 'FLAT',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "project" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollHold" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "holdType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "holdFromPeriod" TEXT NOT NULL,
    "holdToPeriod" TEXT,
    "heldComponents" TEXT,
    "releasedDate" TIMESTAMP(3),
    "releasedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankPaymentFile" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL DEFAULT 'NACH',
    "bankCode" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "fileContent" TEXT,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankPaymentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollValidation" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "companyId" TEXT,
    "validationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "missingPaymentMethods" TEXT,
    "missingSalaryBasis" TEXT,
    "heldEmployees" TEXT,
    "newJoiners" TEXT,
    "terminations" TEXT,
    "errors" TEXT,
    "warnings" TEXT,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "validEmployees" INTEGER NOT NULL DEFAULT 0,
    "invalidEmployees" INTEGER NOT NULL DEFAULT 0,
    "runBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeTaxDeclaration" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "regimeType" TEXT NOT NULL DEFAULT 'NEW',
    "section80C_PPF" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C_ELSS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C_LIC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C_HomeLoanPrincipal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C_Other" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80C_Total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80D_Self" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80D_Parents" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80D_Total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80CCD_NPS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section24b_HomeLoanInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra_ActualHRA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra_RentPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra_IsMetro" BOOLEAN NOT NULL DEFAULT false,
    "hra_ExemptionCalc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80E_EducationLoan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80G_Donations" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section80TTA_SavingsInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeTaxDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "invoiceType" TEXT NOT NULL DEFAULT 'timesheet',
    "billingType" TEXT NOT NULL DEFAULT 'time_and_material',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseCurrency" TEXT,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fxRateDate" TIMESTAMP(3),
    "fxSource" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalBase" DOUBLE PRECISION,
    "totalAmountBase" DOUBLE PRECISION,
    "fxGainLoss" DOUBLE PRECISION,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdBy" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'timesheet',
    "timesheetId" TEXT,
    "milestoneId" TEXT,
    "projectId" TEXT,
    "projectTaskId" TEXT,
    "employeeId" TEXT,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'hours',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateSourceCurrency" TEXT,
    "rateSourceAmount" DOUBLE PRECISION,
    "fxRate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountBase" DOUBLE PRECISION,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "taxRate" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLockRequest" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollApproval" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "approvalStage" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approverRole" TEXT NOT NULL,
    "approverUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "approvalNotes" TEXT,
    "sodConflictFlag" BOOLEAN NOT NULL DEFAULT false,
    "sodCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustmentLog" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "employeeId" TEXT NOT NULL,
    "transactionLineId" TEXT,
    "componentCode" TEXT NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "beforeValue" DOUBLE PRECISION,
    "afterValue" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "reasonText" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL DEFAULT 'MANUAL',
    "adjustedBy" TEXT NOT NULL,
    "adjustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdjustmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAnomaly" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "employeeId" TEXT,
    "companyId" TEXT,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "metricName" TEXT,
    "observedValue" DOUBLE PRECISION,
    "baselineValue" DOUBLE PRECISION,
    "deviationPct" DOUBLE PRECISION,
    "detectionMethod" TEXT NOT NULL DEFAULT 'STATISTICAL',
    "description" TEXT NOT NULL,
    "evidenceJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceChangeAlert" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "authorityName" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "announcedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impactLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "affectedComponents" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceChangeAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhostEmployeeFlag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "payrollPeriod" TEXT NOT NULL,
    "timesheetHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adLoginCount" INTEGER NOT NULL DEFAULT 0,
    "emailSentCount" INTEGER NOT NULL DEFAULT 0,
    "hasProjectAllocation" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveDate" TIMESTAMP(3),
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskFactors" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "companyId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhostEmployeeFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossBorderSecondment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "homeCompanyId" TEXT NOT NULL,
    "hostCompanyId" TEXT NOT NULL,
    "homeCountry" TEXT NOT NULL,
    "hostCountry" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "certificateRef" TEXT,
    "taxResidencyStatus" TEXT NOT NULL DEFAULT 'HOME',
    "ssCoverageCountry" TEXT NOT NULL DEFAULT 'HOME',
    "homePayPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "hostPayPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "homeCurrency" TEXT NOT NULL,
    "hostCurrency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossBorderSecondment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinimumWageConfig" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "regionCode" TEXT,
    "wageType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "minimumAmount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "applicability" TEXT NOT NULL DEFAULT 'ALL',
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinimumWageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataResidencyPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "allowedRegions" TEXT NOT NULL,
    "primaryRegion" TEXT NOT NULL,
    "replicationAllowed" BOOLEAN NOT NULL DEFAULT false,
    "piiFieldsMasked" BOOLEAN NOT NULL DEFAULT true,
    "crossBorderTransferApproved" BOOLEAN NOT NULL DEFAULT false,
    "legalBasis" TEXT,
    "policyDocumentUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataResidencyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCustomField" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "countryCode" TEXT,
    "companyId" TEXT,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSystemLocked" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleToManager" BOOLEAN NOT NULL DEFAULT false,
    "isVisibleToPeer" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCustomFieldValue" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "valueBoolean" BOOLEAN,
    "valueJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DottedLineManager" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "managerType" TEXT NOT NULL DEFAULT 'dotted',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DottedLineManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teamType" TEXT NOT NULL DEFAULT 'virtual',
    "companyId" TEXT,
    "leadId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT,
    "profileUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "rawData" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSOProvider" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "issuer" TEXT,
    "metadataUrl" TEXT,
    "redirectUri" TEXT,
    "scopes" TEXT,
    "jitProvisioningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jitDefaultRole" TEXT NOT NULL DEFAULT 'employee',
    "jitDefaultStatus" TEXT NOT NULL DEFAULT 'pending_onboarding',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SSOProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSync" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "calendarId" TEXT,
    "refreshToken" TEXT,
    "syncDirection" TEXT NOT NULL DEFAULT 'bidirectional',
    "syncLeaveApproved" BOOLEAN NOT NULL DEFAULT true,
    "syncHolidays" BOOLEAN NOT NULL DEFAULT true,
    "syncFocusTime" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "roomType" TEXT NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "teamId" TEXT,
    "createdBy" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "description" TEXT,
    "isE2EE" BOOLEAN NOT NULL DEFAULT false,
    "isAnnouncement" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER,
    "lastMessageAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "body" TEXT NOT NULL,
    "attachments" TEXT,
    "originalLanguage" TEXT,
    "translatedBody" TEXT,
    "translatedTo" TEXT,
    "detectedActions" TEXT,
    "dlpStatus" TEXT NOT NULL DEFAULT 'clean',
    "dlpReason" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "callType" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'native_webrtc',
    "initiatorId" TEXT NOT NULL,
    "roomId" TEXT,
    "meetingUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "consentForRecording" BOOLEAN NOT NULL DEFAULT false,
    "transcriptUrl" TEXT,
    "transcriptStatus" TEXT NOT NULL DEFAULT 'none',
    "summaryText" TEXT,
    "isE2EE" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallParticipant" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "connectionQuality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driveType" TEXT NOT NULL,
    "ownerEmployeeId" TEXT,
    "projectId" TEXT,
    "companyId" TEXT,
    "parentId" TEXT,
    "nodeType" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "externalProvider" TEXT,
    "externalId" TEXT,
    "externalSyncUrl" TEXT,
    "externalSyncedAt" TIMESTAMP(3),
    "dlpScanStatus" TEXT NOT NULL DEFAULT 'pending',
    "dlpFlags" TEXT,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isUnderLegalHold" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "changeLog" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileShareLink" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "shareUrl" TEXT NOT NULL,
    "shareType" TEXT NOT NULL DEFAULT 'link',
    "recipientEmail" TEXT,
    "recipientUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "downloadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIKnowledgeQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "intent" TEXT,
    "responseText" TEXT,
    "contextJson" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "wasHelpful" BOOLEAN,
    "feedbackText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIKnowledgeQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentIntelligenceResult" (
    "id" TEXT NOT NULL,
    "fileId" TEXT,
    "documentId" TEXT,
    "employeeId" TEXT,
    "documentType" TEXT,
    "extractedData" TEXT,
    "rawOcrText" TEXT,
    "linkedEntityId" TEXT,
    "linkedEntityType" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentIntelligenceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSummary" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "summaryType" TEXT NOT NULL DEFAULT 'daily',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summaryText" TEXT NOT NULL,
    "keyPoints" TEXT,
    "actionItems" TEXT,
    "mentionedUsers" TEXT,
    "generatedFor" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentAnalysis" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "positivityScore" DOUBLE PRECISION,
    "negativityScore" DOUBLE PRECISION,
    "toxicityScore" DOUBLE PRECISION,
    "burnoutRiskScore" DOUBLE PRECISION,
    "messageCount" INTEGER NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "topNegativeKeywords" TEXT,
    "topPositiveKeywords" TEXT,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,
    "alertReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalQuotaBytes" INTEGER NOT NULL DEFAULT 10737418240,
    "usedQuotaBytes" INTEGER NOT NULL DEFAULT 0,
    "personalQuotaBytes" INTEGER NOT NULL DEFAULT 1073741824,
    "projectQuotaBytes" INTEGER NOT NULL DEFAULT 5368709120,
    "companyQuotaBytes" INTEGER NOT NULL DEFAULT 2147483648,
    "quotaAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "lastRecalculatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetRoomId" TEXT,
    "targetFileId" TEXT,
    "caseReference" TEXT,
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "releasedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationFeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxCallDurationMin" INTEGER NOT NULL DEFAULT 60,
    "maxFileUploadMB" INTEGER NOT NULL DEFAULT 100,
    "maxChatAttachments" INTEGER NOT NULL DEFAULT 10,
    "configuredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "policyValue" TEXT NOT NULL,
    "appliesToRoomType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageAnalytics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "driveType" TEXT NOT NULL,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "topFiles" TEXT,
    "growthLast30Days" DOUBLE PRECISION,
    "cleanupCandidates" INTEGER,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DLPScanLog" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patterns" TEXT,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'allow',
    "reasonText" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DLPScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GDPRAnonymizationRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "anonymizedFields" TEXT,
    "retainedFields" TEXT,
    "retentionPeriodYears" INTEGER NOT NULL DEFAULT 7,
    "scheduledPurgeDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GDPRAnonymizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatermarkAccessLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userIp" TEXT,
    "userAgent" TEXT,
    "watermarkText" TEXT NOT NULL,
    "accessType" TEXT NOT NULL DEFAULT 'view',
    "snapshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatermarkAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "referrerEmployeeId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "candidateResume" TEXT,
    "notes" TEXT,
    "bonusAmount" DOUBLE PRECISION,
    "bonusCurrency" TEXT NOT NULL DEFAULT 'INR',
    "trackToken" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "hiredAt" TIMESTAMP(3),
    "bonusPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateConsent" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" TEXT NOT NULL DEFAULT 'careers_portal',

    CONSTRAINT "CandidateConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePiiPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "visibleToRoles" TEXT NOT NULL,
    "maskingStrategy" TEXT NOT NULL DEFAULT 'hidden',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CandidatePiiPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeParse" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "language" TEXT,
    "parsedData" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceFormat" TEXT NOT NULL DEFAULT 'unknown',
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeParse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePortalUser" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "currentOtpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "passwordSetAt" TIMESTAMP(3),
    "oauthProvider" TEXT,
    "oauthSubject" TEXT,
    "magicToken" TEXT,
    "magicExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateMessage" (
    "id" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "candidateEmail" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL DEFAULT 'candidate',
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSentimentScore" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "engagementScore" INTEGER NOT NULL DEFAULT 50,
    "dropoffRisk" INTEGER NOT NULL DEFAULT 50,
    "rationale" TEXT,
    "source" TEXT NOT NULL DEFAULT 'chat_screening',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSentimentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "interviewerId" TEXT,
    "interviewerName" TEXT NOT NULL,
    "timestampSec" INTEGER,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "body" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '*',
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "header" TEXT,
    "footer" TEXT,
    "clauses" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferDeclineSurvey" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "primaryReason" TEXT,
    "comments" TEXT,
    "openToFuture" BOOLEAN,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferDeclineSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTaskTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "appliesToRole" TEXT,
    "appliesToDepartment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobBoardPosting" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "externalJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalUrl" TEXT,
    "lastSyncPayload" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "postedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBoardPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundCheck" (
    "id" TEXT NOT NULL,
    "preboardingCandidateId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT 'manual',
    "package" TEXT NOT NULL DEFAULT 'standard',
    "consentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalCaseId" TEXT,
    "reportUrl" TEXT,
    "summary" TEXT,
    "initiatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelcomeSeriesEmail" (
    "id" TEXT NOT NULL,
    "preboardingCandidateId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WelcomeSeriesEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "polygon" JSONB NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 200,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRegularization" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "punchType" TEXT NOT NULL,
    "requestedTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "aiSuggestedTime" TIMESTAMP(3),
    "aiConfidence" DOUBLE PRECISION,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRegularization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyPermission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustedCheckOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HourlyPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gatepass" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "visitorName" TEXT,
    "visitorCompany" TEXT,
    "visitorPhone" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "actualOutTime" TIMESTAMP(3),
    "actualInTime" TIMESTAMP(3),
    "managerStatus" TEXT NOT NULL DEFAULT 'pending',
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "securityStatus" TEXT NOT NULL DEFAULT 'pending',
    "securityApprovedBy" TEXT,
    "securityApprovedAt" TIMESTAMP(3),
    "gateOpenedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gatepass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "projectId" TEXT,
    "payoutPreference" TEXT NOT NULL DEFAULT 'payout',
    "compOffCreditedId" TEXT,
    "compOffCreditedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompOffLeave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "earnedDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'overtime',
    "sourceOvertimeRequestId" TEXT,
    "expiryDate" TIMESTAMP(3),
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompOffLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhAttendanceSnapshot" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "punchType" TEXT NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "activityChats" INTEGER NOT NULL DEFAULT 0,
    "activityTimesheets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activityEmails" INTEGER NOT NULL DEFAULT 0,
    "aiBurnoutRisk" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WfhAttendanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfhRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "supportingDoc" TEXT,
    "expectedWorkingHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "availableForMeetings" BOOLEAN NOT NULL DEFAULT true,
    "remoteLocation" TEXT,
    "emergencyContact" TEXT,
    "alternateEmail" TEXT,
    "totalDays" DOUBLE PRECISION,
    "managerStatus" TEXT NOT NULL DEFAULT 'pending',
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "managerComments" TEXT,
    "requiresHrApproval" BOOLEAN NOT NULL DEFAULT false,
    "hrStatus" TEXT NOT NULL DEFAULT 'pending',
    "hrApprovedBy" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrComments" TEXT,
    "approverComments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfhRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationalRoster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pattern" JSONB NOT NULL,
    "rotationUnit" TEXT NOT NULL DEFAULT 'week',
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotationalRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRosterAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "currentOffset" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRosterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicyConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "roundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "roundMinutes" INTEGER NOT NULL DEFAULT 15,
    "roundDirection" TEXT NOT NULL DEFAULT 'nearest',
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "earlyGraceMinutes" INTEGER NOT NULL DEFAULT 10,
    "autoOvertimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overtimeThresholdMinutes" INTEGER NOT NULL DEFAULT 480,
    "autoApprovePermissionMinutes" INTEGER NOT NULL DEFAULT 0,
    "autoApproveMinAttendancePct" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "autoApproveLeaveSingleDay" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveLeaveTypes" TEXT NOT NULL DEFAULT '[]',
    "autoApproveOvertimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoApproveGatepassMinutes" INTEGER NOT NULL DEFAULT 0,
    "wfhActivityMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "wfhInactivityThresholdHours" INTEGER NOT NULL DEFAULT 4,
    "lateMarkAllowancePerMonth" INTEGER NOT NULL DEFAULT 4,
    "lateMarkHalfDayOnExceed" BOOLEAN NOT NULL DEFAULT true,
    "halfDayAfterMinutes" INTEGER NOT NULL DEFAULT 21,
    "lateMarkNotApplicableOnTour" BOOLEAN NOT NULL DEFAULT true,
    "shiftStartDefault" TEXT NOT NULL DEFAULT '09:00',
    "shiftEndDefault" TEXT NOT NULL DEFAULT '17:30',
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "gatePassMaxPerMonth" INTEGER NOT NULL DEFAULT 1,
    "gatePassHalfDayOnExceed" BOOLEAN NOT NULL DEFAULT true,
    "gatePassHalfDayNextDay" BOOLEAN NOT NULL DEFAULT true,
    "gatePassEarlyHours" INTEGER NOT NULL DEFAULT 1,
    "canteenEnabled" BOOLEAN NOT NULL DEFAULT true,
    "canteenFreeForGeneralShift" BOOLEAN NOT NULL DEFAULT true,
    "canteenFreeForNightShift" BOOLEAN NOT NULL DEFAULT true,
    "canteenOtfreeThresholdHours" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "policyId" TEXT,
    "companyId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'all',
    "branchId" TEXT,
    "departmentId" TEXT,
    "leaveTypeAllocations" TEXT NOT NULL DEFAULT '[]',
    "sandwichRuleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "proRataEnabled" BOOLEAN NOT NULL DEFAULT false,
    "probationRestriction" BOOLEAN NOT NULL DEFAULT true,
    "probationMonths" INTEGER NOT NULL DEFAULT 6,
    "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardGlobal" BOOLEAN NOT NULL DEFAULT true,
    "maxCarryForwardDays" INTEGER NOT NULL DEFAULT 5,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicyRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "policyId" TEXT,
    "companyId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'all',
    "branchId" TEXT,
    "departmentId" TEXT,
    "shiftStartDefault" TEXT NOT NULL DEFAULT '09:00',
    "shiftEndDefault" TEXT NOT NULL DEFAULT '17:30',
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "earlyGraceMinutes" INTEGER NOT NULL DEFAULT 10,
    "lateMarkAllowancePerMonth" INTEGER NOT NULL DEFAULT 4,
    "lateMarkHalfDayOnExceed" BOOLEAN NOT NULL DEFAULT true,
    "halfDayAfterMinutes" INTEGER NOT NULL DEFAULT 21,
    "lateMarkNotApplicableOnTour" BOOLEAN NOT NULL DEFAULT true,
    "autoOvertimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overtimeThresholdMinutes" INTEGER NOT NULL DEFAULT 480,
    "gatePassMaxPerMonth" INTEGER NOT NULL DEFAULT 1,
    "gatePassHalfDayOnExceed" BOOLEAN NOT NULL DEFAULT true,
    "gatePassHalfDayNextDay" BOOLEAN NOT NULL DEFAULT true,
    "gatePassEarlyHours" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveEncashmentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'basic',
    "ratePerDay" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "taxImplications" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveEncashmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveAttachment" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isMedical" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionalHolidayElection" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptionalHolidayElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRoutingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "projectId" TEXT,
    "alternateManagerId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BurnoutFlag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "recommendations" TEXT,
    "notifiedManager" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BurnoutFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "changedBy" TEXT NOT NULL,
    "changedByIp" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT,
    "firmwareVersion" TEXT,
    "branchId" TEXT,
    "geofenceId" TEXT,
    "apiTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "encryptionKeyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "templateHash" TEXT NOT NULL,
    "modality" TEXT NOT NULL DEFAULT 'fingerprint',
    "qualityScore" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricPunch" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT,
    "punchType" TEXT NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "spoofingRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buddyPunchRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReasons" JSONB,
    "attendanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricPunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAiThreshold" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "spoofingRiskThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "buddyPunchRiskThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "impossibleTravelKm" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "impossibleTravelMinutes" INTEGER NOT NULL DEFAULT 30,
    "offHoursStartMinutes" INTEGER NOT NULL DEFAULT 0,
    "offHoursEndMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceAiThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBranch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "country" TEXT,
    "billingCurrency" TEXT NOT NULL DEFAULT 'INR',
    "paymentTerms" TEXT NOT NULL DEFAULT 'net_30',
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOW" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "rawText" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "maxHeadcount" INTEGER,
    "billRatesJson" JSONB,
    "milestonesJson" JSONB,
    "totalValue" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SOW_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalUser" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "otpSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTimesheetApproval" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientTimesheetApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientChurnRisk" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "factorsJson" JSONB,
    "recommendations" TEXT,
    "notifiedManager" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientChurnRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMarginSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "revenueBase" DOUBLE PRECISION NOT NULL,
    "costEmployee" DOUBLE PRECISION NOT NULL,
    "costVendor" DOUBLE PRECISION NOT NULL,
    "grossMargin" DOUBLE PRECISION NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMarginSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDocument" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "reminderSent30" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent15" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent7" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPortalUser" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "otpSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "canSubmitCandidates" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorStaff" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "skillTags" TEXT,
    "billRate" DOUBLE PRECISION,
    "costRate" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "candidateApplicationId" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "offboardedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "piiMasked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT,
    "vendorId" TEXT,
    "role" TEXT NOT NULL,
    "skillTags" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "billRateMax" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startDate" TIMESTAMP(3),
    "durationDays" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "contractorRequestId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "expectedBy" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLineItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "total" DOUBLE PRECISION NOT NULL,
    "matchedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoice" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseCurrency" TEXT NOT NULL DEFAULT 'INR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "matchedJson" JSONB,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBucket" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerCoPayPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "taxExemptLimit" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "bucketId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reference" TEXT,
    "description" TEXT,
    "initiatedById" TEXT,
    "previousHash" TEXT,
    "chainHash" TEXT,
    "tamperFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerSku" TEXT,
    "publicPrice" DOUBLE PRECISION NOT NULL,
    "corporatePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "allowedBuckets" TEXT NOT NULL,
    "imageUrl" TEXT,
    "fulfillmentMode" TEXT NOT NULL DEFAULT 'digital',
    "quantityLimitPerQuarter" INTEGER NOT NULL DEFAULT 0,
    "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
    "minAge" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "walletBucketId" TEXT,
    "employerCoPayPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "employerPaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employeePaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "fulfillmentRef" TEXT,
    "blockedByFraud" BOOLEAN NOT NULL DEFAULT false,
    "fraudReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'placed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "apiKeyMasked" TEXT,
    "webhookSecret" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "superAdminApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "policyNumber" TEXT,
    "coverageAmount" DOUBLE PRECISION NOT NULL,
    "premiumAmount" DOUBLE PRECISION NOT NULL,
    "premiumCurrency" TEXT NOT NULL DEFAULT 'INR',
    "paymentMode" TEXT NOT NULL DEFAULT 'payroll_deduction',
    "deductionFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "dependentsJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "claimAmount" DOUBLE PRECISION NOT NULL,
    "billFileUrl" TEXT,
    "aiParsedJson" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EWARequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "earnedToDate" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "transferredAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "payrollRunId" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EWARequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanMarketplaceListing" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "offerAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "emiAmount" DOUBLE PRECISION NOT NULL,
    "processingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "deepLinkSentAt" TIMESTAMP(3),
    "applicationStatus" TEXT NOT NULL DEFAULT 'pre_approved',
    "garnishmentActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanMarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "senderId" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "productId" TEXT,
    "voucherCode" TEXT,
    "message" TEXT,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPointsLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceFraudFlag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orderId" TEXT,
    "reason" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "mfaTriggered" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceFraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStressFlag" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "factorsJson" JSONB,
    "recommendedAction" TEXT,
    "notifiedHR" BOOLEAN NOT NULL DEFAULT false,
    "anonymized" BOOLEAN NOT NULL DEFAULT true,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialStressFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBudgetAllocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "employeeId" TEXT,
    "bucketCategory" TEXT NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFeedback" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientPortalUserId" TEXT,
    "projectId" TEXT,
    "employeeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "communication" INTEGER,
    "quality" INTEGER,
    "timeliness" INTEGER,
    "comments" TEXT,
    "wouldReengage" BOOLEAN NOT NULL DEFAULT true,
    "feedbackId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filtersJson" JSONB,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "recipientsJson" JSONB NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'pdf',
    "companyId" TEXT,
    "createdById" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "vendorId" TEXT NOT NULL,
    "vendorStaffId" TEXT,
    "projectId" TEXT,
    "role" TEXT NOT NULL,
    "billRate" DOUBLE PRECISION NOT NULL,
    "costRate" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "scopeFlags" TEXT NOT NULL DEFAULT 'collaboration,projects,timesheets',
    "ndaSigned" BOOLEAN NOT NULL DEFAULT false,
    "ndaSignedAt" TIMESTAMP(3),
    "bgvStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "offboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizedCatalogCache" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "lifeStage" TEXT NOT NULL,
    "signalsJson" JSONB NOT NULL,
    "rankedProductIds" TEXT NOT NULL,
    "reason" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalizedCatalogCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyInsight" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT,
    "metricValue" DOUBLE PRECISION,
    "baselineValue" DOUBLE PRECISION,
    "dimensionsJson" JSONB,
    "recommendedAction" TEXT,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTrigger" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "cronExpr" TEXT,
    "triggerKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUtilizationSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "billableHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nonBillableHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilizationPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUtilizationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSavedJob" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "matchScore" INTEGER,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateSavedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateTalentPool" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobApplicationId" TEXT,
    "skillsSnapshot" TEXT,
    "notes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CandidateTalentPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePasswordReset" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requestedFromIp" TEXT,
    "requestedFromUa" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidatePasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateErasureRequest" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deletionLog" TEXT,
    "reason" TEXT,
    "requestedFromIp" TEXT,
    "requestedFromUa" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateErasureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateResumeOptimization" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "gapAnalysis" TEXT,
    "rewriteSuggestions" TEXT,
    "suggestedKeywords" TEXT,
    "formatFeedback" TEXT,
    "summaryOptions" TEXT,
    "selectedSummary" TEXT,
    "optimizedResume" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateResumeOptimization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAiFeedback" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "aiDraft" TEXT,
    "hrEditedVersion" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'draft',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateAiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateJobAlert" (
    "id" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateJobAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialRegistration" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyPhone" TEXT,
    "companyWebsite" TEXT,
    "industry" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "employeeCount" INTEGER NOT NULL DEFAULT 10,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "designation" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trialDays" INTEGER NOT NULL DEFAULT 15,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "tempPassword" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "selectedModules" TEXT,
    "companyLogo" TEXT,
    "employeeDataJson" TEXT,
    "planConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompanyMapping" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "departmentId" TEXT,
    "designationId" TEXT,
    "branchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "dateOfJoining" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompanyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "autoProvisionPayroll" BOOLEAN NOT NULL DEFAULT true,
    "autoProvisionCompliance" BOOLEAN NOT NULL DEFAULT true,
    "autoProvisionTaxSlabs" BOOLEAN NOT NULL DEFAULT true,
    "autoProvisionMinWage" BOOLEAN NOT NULL DEFAULT true,
    "activeCountryCount" INTEGER NOT NULL DEFAULT 0,
    "activeCurrencyCount" INTEGER NOT NULL DEFAULT 0,
    "activeLanguageCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedMonthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedAnnualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customisationTier" TEXT NOT NULL DEFAULT 'standard',
    "maxUsers" INTEGER NOT NULL DEFAULT 50,
    "maxCompanies" INTEGER NOT NULL DEFAULT 5,
    "maxEmployees" INTEGER NOT NULL DEFAULT 500,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCountryAccess" (
    "id" TEXT NOT NULL,
    "tenantConfigId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessGrantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payrollFrequencyDefault" TEXT NOT NULL DEFAULT 'MONTHLY',
    "payrollCurrencyDefault" TEXT NOT NULL,
    "taxRegimeDefault" TEXT,
    "workingHoursPerWeek" INTEGER NOT NULL DEFAULT 40,
    "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "overtimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "pfEnabled" BOOLEAN NOT NULL DEFAULT false,
    "esiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gratuityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "socialSecurityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pensionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "medicaidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "labourLawCode" TEXT,
    "terminationNoticePeriod" INTEGER NOT NULL DEFAULT 30,
    "probationPeriod" INTEGER NOT NULL DEFAULT 180,
    "annualLeaveEntitlement" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "dataResidencyRequired" BOOLEAN NOT NULL DEFAULT false,
    "dataResidencyRegion" TEXT,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCountryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCurrencyAccess" (
    "id" TEXT NOT NULL,
    "tenantConfigId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "exchangeRateSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "autoFetchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fetchFrequency" TEXT,
    "lastFetchedRate" DOUBLE PRECISION,
    "lastFetchedAt" TIMESTAMP(3),
    "roundingPrecision" INTEGER NOT NULL DEFAULT 2,
    "roundingRule" TEXT NOT NULL DEFAULT 'NEAREST',
    "gainLossAccount" TEXT,
    "monthlyCostPerCurrency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCurrencyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLanguageAccess" (
    "id" TEXT NOT NULL,
    "tenantConfigId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "languageName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uiTranslated" BOOLEAN NOT NULL DEFAULT false,
    "documentTemplates" BOOLEAN NOT NULL DEFAULT false,
    "emailTemplates" BOOLEAN NOT NULL DEFAULT false,
    "helpArticles" BOOLEAN NOT NULL DEFAULT false,
    "isRTL" BOOLEAN NOT NULL DEFAULT false,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLanguageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPayrollPolicy" (
    "id" TEXT NOT NULL,
    "tenantConfigId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT,
    "policyName" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "policyContent" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system_default',
    "status" TEXT NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0',
    "previousVersionId" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideHistory" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "confirmAccountNumber" TEXT,
    "ifscCode" TEXT,
    "micrCode" TEXT,
    "branchName" TEXT,
    "branchAddress" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'savings',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationDoc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratuityLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "month" INTEGER NOT NULL DEFAULT 1,
    "lastDrawnBasicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastDrawnDA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearsOfService" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedYears" INTEGER NOT NULL DEFAULT 0,
    "monthlyProvision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accumulatedProvision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratuityEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerContribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAfterWithdrawal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityDate" TIMESTAMP(3),
    "lastDrawnSalaryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'provisioned',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GratuityLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "currentJobTitle" TEXT,
    "currentCompany" TEXT,
    "currentLocation" TEXT,
    "totalExperience" DOUBLE PRECISION,
    "noticePeriod" INTEGER,
    "currentCTC" DOUBLE PRECISION,
    "expectedCTC" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "skills" TEXT,
    "highestQualification" TEXT,
    "university" TEXT,
    "graduationYear" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "sourceDetails" TEXT,
    "recruiterId" TEXT,
    "resumeUrl" TEXT,
    "coverLetterUrl" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subStatus" TEXT,
    "aiMatchScore" DOUBLE PRECISION,
    "aiSentimentScore" DOUBLE PRECISION,
    "aiRecommendedRole" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "communicationCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "category" TEXT,
    "pool" TEXT,
    "appliedAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "anonymized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "policyCode" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "documentUrl" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "previousVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "effectiveDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "authoredBy" TEXT,
    "ownedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgementDeadlineDays" INTEGER,
    "totalAcknowledged" INTEGER NOT NULL DEFAULT 0,
    "totalPending" INTEGER NOT NULL DEFAULT 0,
    "applicableTo" TEXT NOT NULL DEFAULT 'all_employees',
    "departmentIds" TEXT,
    "designationIds" TEXT,
    "locationIds" TEXT,
    "isRegulatory" BOOLEAN NOT NULL DEFAULT false,
    "regulationRef" TEXT,
    "penaltyForNonCompliance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'meeting',
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "color" TEXT,
    "createdBy" TEXT NOT NULL,
    "companyId" TEXT,
    "attendees" TEXT,
    "recurrence" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT NOT NULL,
    "ccAddresses" TEXT,
    "bccAddresses" TEXT,
    "folder" TEXT NOT NULL DEFAULT 'inbox',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT,
    "labels" TEXT,
    "senderId" TEXT,
    "threadId" TEXT,
    "repliedToId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "category" TEXT,
    "dueDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "companyId" TEXT,
    "completedAt" TIMESTAMP(3),
    "subtasks" TEXT,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "companyId" TEXT,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'general',
    "authorId" TEXT NOT NULL,
    "companyId" TEXT,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "attachments" TEXT,
    "hashtags" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT,
    "createdById" TEXT NOT NULL,
    "columns" TEXT NOT NULL DEFAULT 'Backlog,To Do,In Progress,Done',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanbanCard" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "column" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "category" TEXT,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "subtasks" TEXT,
    "tags" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanbanCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fileSharingLimitMB" INTEGER NOT NULL DEFAULT 25,
    "messageRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "calendarSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "calendarSyncProvider" TEXT NOT NULL DEFAULT 'google',
    "emailIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailProvider" TEXT NOT NULL DEFAULT 'smtp',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUsername" TEXT,
    "smtpPassword" TEXT,
    "smtpEncryption" TEXT NOT NULL DEFAULT 'tls',
    "smtpFromName" TEXT,
    "smtpFromAddress" TEXT,
    "smtpReplyTo" TEXT,
    "smtpVerifiedAt" TIMESTAMP(3),
    "smtpVerifyError" TEXT,
    "resendApiKey" TEXT,
    "resendFromAddress" TEXT,
    "autoDeleteMessages" BOOLEAN NOT NULL DEFAULT false,
    "maxCallDurationMin" INTEGER NOT NULL DEFAULT 60,
    "allowExternalSharing" BOOLEAN NOT NULL DEFAULT true,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDatabase_tenantId_key" ON "TenantDatabase"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDatabase_tenantId_idx" ON "TenantDatabase"("tenantId");

-- CreateIndex
CREATE INDEX "TenantDatabase_isActive_idx" ON "TenantDatabase"("isActive");

-- CreateIndex
CREATE INDEX "BackupRecord_tenantId_idx" ON "BackupRecord"("tenantId");

-- CreateIndex
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureFlag_tenantId_idx" ON "FeatureFlag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_tenantId_key_key" ON "FeatureFlag"("tenantId", "key");

-- CreateIndex
CREATE INDEX "CompanyGroup_tenantId_idx" ON "CompanyGroup"("tenantId");

-- CreateIndex
CREATE INDEX "Company_companyGroupId_idx" ON "Company"("companyGroupId");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Department_branchId_idx" ON "Department"("branchId");

-- CreateIndex
CREATE INDEX "Designation_departmentId_idx" ON "Designation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId");

-- CreateIndex
CREATE INDEX "Dependent_employeeId_idx" ON "Dependent"("employeeId");

-- CreateIndex
CREATE INDEX "Qualification_employeeId_idx" ON "Qualification"("employeeId");

-- CreateIndex
CREATE INDEX "Experience_employeeId_idx" ON "Experience"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSkill_employeeId_idx" ON "EmployeeSkill"("employeeId");

-- CreateIndex
CREATE INDEX "JobPosting_departmentId_idx" ON "JobPosting"("departmentId");

-- CreateIndex
CREATE INDEX "JobPosting_status_idx" ON "JobPosting"("status");

-- CreateIndex
CREATE INDEX "JobApplication_jobPostingId_idx" ON "JobApplication"("jobPostingId");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_idx" ON "JobApplication"("candidateId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE INDEX "Interview_jobApplicationId_idx" ON "Interview"("jobApplicationId");

-- CreateIndex
CREATE INDEX "OnboardingTask_employeeId_idx" ON "OnboardingTask"("employeeId");

-- CreateIndex
CREATE INDEX "OnboardingTask_preboardingCandidateId_idx" ON "OnboardingTask"("preboardingCandidateId");

-- CreateIndex
CREATE INDEX "OnboardingTask_category_idx" ON "OnboardingTask"("category");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE INDEX "LeaveType_companyId_idx" ON "LeaveType"("companyId");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveTypeId_year_key" ON "LeaveBalance"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_currentApproverId_idx" ON "LeaveRequest"("currentApproverId");

-- CreateIndex
CREATE INDEX "LeaveRequest_workflowStage_idx" ON "LeaveRequest"("workflowStage");

-- CreateIndex
CREATE INDEX "LeaveWorkflowConfig_tenantId_idx" ON "LeaveWorkflowConfig"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveWorkflowConfig_leaveTypeId_idx" ON "LeaveWorkflowConfig"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_leaveRequestId_idx" ON "LeaveApprovalStep"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_approverUserId_idx" ON "LeaveApprovalStep"("approverUserId");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Payroll_employeeId_idx" ON "Payroll"("employeeId");

-- CreateIndex
CREATE INDEX "Payroll_status_idx" ON "Payroll"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_employeeId_month_year_key" ON "Payroll"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");

-- CreateIndex
CREATE INDEX "Goal_employeeId_idx" ON "Goal"("employeeId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_employeeId_idx" ON "TrainingEnrollment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_trainingId_employeeId_key" ON "TrainingEnrollment"("trainingId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateIndex
CREATE INDEX "AssetAssignment_employeeId_idx" ON "AssetAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId");

-- CreateIndex
CREATE INDEX "Document_employeeId_idx" ON "Document"("employeeId");

-- CreateIndex
CREATE INDEX "IncidentReport_employeeId_idx" ON "IncidentReport"("employeeId");

-- CreateIndex
CREATE INDEX "IncidentReport_status_idx" ON "IncidentReport"("status");

-- CreateIndex
CREATE INDEX "TravelRequest_employeeId_idx" ON "TravelRequest"("employeeId");

-- CreateIndex
CREATE INDEX "TravelRequest_status_idx" ON "TravelRequest"("status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_employeeId_idx" ON "ExpenseClaim"("employeeId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");

-- CreateIndex
CREATE INDEX "Timesheet_projectId_idx" ON "Timesheet"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_projectTaskId_idx" ON "Timesheet"("projectTaskId");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE INDEX "Timesheet_invoiced_idx" ON "Timesheet"("invoiced");

-- CreateIndex
CREATE INDEX "Timesheet_locked_idx" ON "Timesheet"("locked");

-- CreateIndex
CREATE INDEX "Timesheet_invoiceId_idx" ON "Timesheet"("invoiceId");

-- CreateIndex
CREATE INDEX "Feedback_fromId_idx" ON "Feedback"("fromId");

-- CreateIndex
CREATE INDEX "Feedback_toId_idx" ON "Feedback"("toId");

-- CreateIndex
CREATE INDEX "Promotion_employeeId_idx" ON "Promotion"("employeeId");

-- CreateIndex
CREATE INDEX "Grievance_employeeId_idx" ON "Grievance"("employeeId");

-- CreateIndex
CREATE INDEX "Grievance_status_idx" ON "Grievance"("status");

-- CreateIndex
CREATE INDEX "Separation_employeeId_idx" ON "Separation"("employeeId");

-- CreateIndex
CREATE INDEX "Separation_status_idx" ON "Separation"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "LoginActivity_userId_idx" ON "LoginActivity"("userId");

-- CreateIndex
CREATE INDEX "Policy_companyId_idx" ON "Policy"("companyId");

-- CreateIndex
CREATE INDEX "Holiday_companyId_idx" ON "Holiday"("companyId");

-- CreateIndex
CREATE INDEX "Shift_companyId_idx" ON "Shift"("companyId");

-- CreateIndex
CREATE INDEX "Reimbursement_employeeId_idx" ON "Reimbursement"("employeeId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");

-- CreateIndex
CREATE INDEX "Vendor_type_idx" ON "Vendor"("type");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTask_status_idx" ON "ProjectTask"("status");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAllocation_projectId_idx" ON "ProjectAllocation"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAllocation_employeeId_idx" ON "ProjectAllocation"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_employeeId_idx" ON "ProjectMember"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectMember_role_idx" ON "ProjectMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_employeeId_key" ON "ProjectMember"("projectId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketId_key" ON "Ticket"("ticketId");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_requisitionId_key" ON "Requisition"("requisitionId");

-- CreateIndex
CREATE INDEX "Requisition_companyId_idx" ON "Requisition"("companyId");

-- CreateIndex
CREATE INDEX "Requisition_approvalStatus_idx" ON "Requisition"("approvalStatus");

-- CreateIndex
CREATE INDEX "Requisition_status_idx" ON "Requisition"("status");

-- CreateIndex
CREATE INDEX "Offer_candidateId_idx" ON "Offer"("candidateId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "SalaryStructure_companyId_idx" ON "SalaryStructure"("companyId");

-- CreateIndex
CREATE INDEX "SalaryComponent_salaryStructureId_idx" ON "SalaryComponent"("salaryStructureId");

-- CreateIndex
CREATE INDEX "FNFCalculation_employeeId_idx" ON "FNFCalculation"("employeeId");

-- CreateIndex
CREATE INDEX "FNFCalculation_status_idx" ON "FNFCalculation"("status");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_module_idx" ON "WorkflowDefinition"("module");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_companyId_idx" ON "WorkflowDefinition"("companyId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_entityType_idx" ON "WorkflowInstance"("entityType");

-- CreateIndex
CREATE INDEX "WorkflowInstance_entityId_idx" ON "WorkflowInstance"("entityId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");

-- CreateIndex
CREATE INDEX "WorkflowApproval_workflowInstanceId_idx" ON "WorkflowApproval"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "WorkflowApproval_approverId_idx" ON "WorkflowApproval"("approverId");

-- CreateIndex
CREATE INDEX "AIChatLog_sessionId_idx" ON "AIChatLog"("sessionId");

-- CreateIndex
CREATE INDEX "AIChatLog_userId_idx" ON "AIChatLog"("userId");

-- CreateIndex
CREATE INDEX "PreboardingCandidate_status_idx" ON "PreboardingCandidate"("status");

-- CreateIndex
CREATE INDEX "PreboardingCandidate_candidateEmail_idx" ON "PreboardingCandidate"("candidateEmail");

-- CreateIndex
CREATE INDEX "PreboardingCandidate_employeeId_idx" ON "PreboardingCandidate"("employeeId");

-- CreateIndex
CREATE INDEX "ExitRequest_employeeId_idx" ON "ExitRequest"("employeeId");

-- CreateIndex
CREATE INDEX "ExitRequest_companyId_idx" ON "ExitRequest"("companyId");

-- CreateIndex
CREATE INDEX "ExitRequest_status_idx" ON "ExitRequest"("status");

-- CreateIndex
CREATE INDEX "OKR_ownerId_idx" ON "OKR"("ownerId");

-- CreateIndex
CREATE INDEX "OKR_companyId_idx" ON "OKR"("companyId");

-- CreateIndex
CREATE INDEX "OKR_projectId_idx" ON "OKR"("projectId");

-- CreateIndex
CREATE INDEX "OKR_parentOkrId_idx" ON "OKR"("parentOkrId");

-- CreateIndex
CREATE INDEX "OKR_category_idx" ON "OKR"("category");

-- CreateIndex
CREATE INDEX "OKR_quarter_idx" ON "OKR"("quarter");

-- CreateIndex
CREATE INDEX "OKR_year_idx" ON "OKR"("year");

-- CreateIndex
CREATE INDEX "KeyResult_okrId_idx" ON "KeyResult"("okrId");

-- CreateIndex
CREATE INDEX "ExitInterview_separationId_idx" ON "ExitInterview"("separationId");

-- CreateIndex
CREATE INDEX "ExitInterview_employeeId_idx" ON "ExitInterview"("employeeId");

-- CreateIndex
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- CreateIndex
CREATE INDEX "Survey_type_idx" ON "Survey"("type");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_employeeId_idx" ON "SurveyResponse"("employeeId");

-- CreateIndex
CREATE INDEX "Recognition_toId_idx" ON "Recognition"("toId");

-- CreateIndex
CREATE INDEX "Recognition_category_idx" ON "Recognition"("category");

-- CreateIndex
CREATE INDEX "AIConfig_type_idx" ON "AIConfig"("type");

-- CreateIndex
CREATE INDEX "AIConfig_category_idx" ON "AIConfig"("category");

-- CreateIndex
CREATE INDEX "AIConfig_isActive_idx" ON "AIConfig"("isActive");

-- CreateIndex
CREATE INDEX "AIPromptLog_category_idx" ON "AIPromptLog"("category");

-- CreateIndex
CREATE INDEX "AIPromptLog_status_idx" ON "AIPromptLog"("status");

-- CreateIndex
CREATE INDEX "AIPromptLog_createdAt_idx" ON "AIPromptLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocCategory_slug_key" ON "DocCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocArticle_slug_key" ON "DocArticle"("slug");

-- CreateIndex
CREATE INDEX "DocArticle_categoryId_idx" ON "DocArticle"("categoryId");

-- CreateIndex
CREATE INDEX "DocArticle_docType_idx" ON "DocArticle"("docType");

-- CreateIndex
CREATE INDEX "DocArticle_moduleKey_idx" ON "DocArticle"("moduleKey");

-- CreateIndex
CREATE INDEX "DocArticle_status_idx" ON "DocArticle"("status");

-- CreateIndex
CREATE INDEX "DocAccessRule_articleId_idx" ON "DocAccessRule"("articleId");

-- CreateIndex
CREATE INDEX "DocAccessRule_role_idx" ON "DocAccessRule"("role");

-- CreateIndex
CREATE INDEX "DocAccessRule_userId_idx" ON "DocAccessRule"("userId");

-- CreateIndex
CREATE INDEX "InterviewSet_tenantId_idx" ON "InterviewSet"("tenantId");

-- CreateIndex
CREATE INDEX "InterviewSet_status_idx" ON "InterviewSet"("status");

-- CreateIndex
CREATE INDEX "InterviewSetQuestion_setId_idx" ON "InterviewSetQuestion"("setId");

-- CreateIndex
CREATE INDEX "InterviewSession_setId_idx" ON "InterviewSession"("setId");

-- CreateIndex
CREATE INDEX "InterviewSession_status_idx" ON "InterviewSession"("status");

-- CreateIndex
CREATE INDEX "InterviewSession_candidateEmail_idx" ON "InterviewSession"("candidateEmail");

-- CreateIndex
CREATE INDEX "InterviewResponse_sessionId_idx" ON "InterviewResponse"("sessionId");

-- CreateIndex
CREATE INDEX "InterviewResponse_followUpFromId_idx" ON "InterviewResponse"("followUpFromId");

-- CreateIndex
CREATE INDEX "ProctoringLog_sessionId_idx" ON "ProctoringLog"("sessionId");

-- CreateIndex
CREATE INDEX "ProctoringLog_severity_idx" ON "ProctoringLog"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewInvitation_invitationToken_key" ON "InterviewInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "InterviewInvitation_setId_idx" ON "InterviewInvitation"("setId");

-- CreateIndex
CREATE INDEX "InterviewInvitation_invitationToken_idx" ON "InterviewInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "InterviewInvitation_status_idx" ON "InterviewInvitation"("status");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE INDEX "Role_key_idx" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_tenantId_companyId_key" ON "Role"("key", "tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Module_key_key" ON "Module"("key");

-- CreateIndex
CREATE INDEX "Permission_moduleId_idx" ON "Permission"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_moduleId_action_key" ON "Permission"("moduleId", "action");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_companyId_idx" ON "UserRoleAssignment"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_companyId_key" ON "UserRoleAssignment"("userId", "roleId", "companyId");

-- CreateIndex
CREATE INDEX "CTCTemplate_countryCode_idx" ON "CTCTemplate"("countryCode");

-- CreateIndex
CREATE INDEX "CTCTemplate_status_idx" ON "CTCTemplate"("status");

-- CreateIndex
CREATE INDEX "CTCTemplate_companyId_idx" ON "CTCTemplate"("companyId");

-- CreateIndex
CREATE INDEX "CTCComponentMapping_ctcTemplateId_idx" ON "CTCComponentMapping"("ctcTemplateId");

-- CreateIndex
CREATE INDEX "CTCComponentMapping_calculationSequence_idx" ON "CTCComponentMapping"("calculationSequence");

-- CreateIndex
CREATE INDEX "PayrollComponent_countryCode_idx" ON "PayrollComponent"("countryCode");

-- CreateIndex
CREATE INDEX "PayrollComponent_componentCategory_idx" ON "PayrollComponent"("componentCategory");

-- CreateIndex
CREATE INDEX "PayrollComponent_componentType_idx" ON "PayrollComponent"("componentType");

-- CreateIndex
CREATE INDEX "PayrollComponent_companyId_idx" ON "PayrollComponent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponent_code_countryCode_key" ON "PayrollComponent"("code", "countryCode");

-- CreateIndex
CREATE INDEX "StatutoryComponent_componentId_idx" ON "StatutoryComponent"("componentId");

-- CreateIndex
CREATE INDEX "StatutoryComponent_countryCode_idx" ON "StatutoryComponent"("countryCode");

-- CreateIndex
CREATE INDEX "TaxSlabTable_countryCode_idx" ON "TaxSlabTable"("countryCode");

-- CreateIndex
CREATE INDEX "TaxSlabTable_taxYear_idx" ON "TaxSlabTable"("taxYear");

-- CreateIndex
CREATE INDEX "TaxSlabRateLine_slabTableId_idx" ON "TaxSlabRateLine"("slabTableId");

-- CreateIndex
CREATE INDEX "TaxSlabRateLine_sequence_idx" ON "TaxSlabRateLine"("sequence");

-- CreateIndex
CREATE INDEX "PayrollInput_employeeId_idx" ON "PayrollInput"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollInput_payrollRunId_idx" ON "PayrollInput"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollInput_inputType_idx" ON "PayrollInput"("inputType");

-- CreateIndex
CREATE INDEX "PayrollInput_approvalStatus_idx" ON "PayrollInput"("approvalStatus");

-- CreateIndex
CREATE INDEX "CurrencyConfig_legalEntityId_idx" ON "CurrencyConfig"("legalEntityId");

-- CreateIndex
CREATE INDEX "CurrencyConfig_companyId_idx" ON "CurrencyConfig"("companyId");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrency_toCurrency_rateDate_idx" ON "ExchangeRate"("fromCurrency", "toCurrency", "rateDate");

-- CreateIndex
CREATE INDEX "ExchangeRate_isActive_idx" ON "ExchangeRate"("isActive");

-- CreateIndex
CREATE INDEX "DimensionDefinition_code_idx" ON "DimensionDefinition"("code");

-- CreateIndex
CREATE INDEX "DimensionDefinition_companyId_idx" ON "DimensionDefinition"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeDimensionAllocation_employeeId_idx" ON "EmployeeDimensionAllocation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDimensionAllocation_dimensionId_idx" ON "EmployeeDimensionAllocation"("dimensionId");

-- CreateIndex
CREATE INDEX "PayrollRun_runStatus_idx" ON "PayrollRun"("runStatus");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- CreateIndex
CREATE INDEX "PayrollRun_payrollPeriod_idx" ON "PayrollRun"("payrollPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_legalEntityId_payrollPeriod_runType_key" ON "PayrollRun"("legalEntityId", "payrollPeriod", "runType");

-- CreateIndex
CREATE INDEX "PayrollTransactionLine_payrollRunId_idx" ON "PayrollTransactionLine"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollTransactionLine_employeeId_idx" ON "PayrollTransactionLine"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollTransactionLine_componentCode_idx" ON "PayrollTransactionLine"("componentCode");

-- CreateIndex
CREATE INDEX "PayrollTransactionLine_componentType_idx" ON "PayrollTransactionLine"("componentType");

-- CreateIndex
CREATE INDEX "ComplianceObligation_countryCode_idx" ON "ComplianceObligation"("countryCode");

-- CreateIndex
CREATE INDEX "ComplianceObligation_isActive_idx" ON "ComplianceObligation"("isActive");

-- CreateIndex
CREATE INDEX "ComplianceObligation_companyId_idx" ON "ComplianceObligation"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceFiling_complianceId_idx" ON "ComplianceFiling"("complianceId");

-- CreateIndex
CREATE INDEX "ComplianceFiling_filingStatus_idx" ON "ComplianceFiling"("filingStatus");

-- CreateIndex
CREATE INDEX "ComplianceFiling_filingPeriod_idx" ON "ComplianceFiling"("filingPeriod");

-- CreateIndex
CREATE INDEX "GLAccountMapping_legalEntityId_idx" ON "GLAccountMapping"("legalEntityId");

-- CreateIndex
CREATE INDEX "GLAccountMapping_componentId_idx" ON "GLAccountMapping"("componentId");

-- CreateIndex
CREATE INDEX "GLAccountMapping_companyId_idx" ON "GLAccountMapping"("companyId");

-- CreateIndex
CREATE INDEX "PayrollDefinition_companyId_idx" ON "PayrollDefinition"("companyId");

-- CreateIndex
CREATE INDEX "PayrollDefinition_status_idx" ON "PayrollDefinition"("status");

-- CreateIndex
CREATE INDEX "EmployeePaymentMethod_employeeId_idx" ON "EmployeePaymentMethod"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePaymentMethod_status_idx" ON "EmployeePaymentMethod"("status");

-- CreateIndex
CREATE INDEX "Loan_employeeId_idx" ON "Loan"("employeeId");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_loanType_idx" ON "Loan"("loanType");

-- CreateIndex
CREATE INDEX "OvertimeRecord_employeeId_idx" ON "OvertimeRecord"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRecord_status_idx" ON "OvertimeRecord"("status");

-- CreateIndex
CREATE INDEX "OvertimeRecord_date_idx" ON "OvertimeRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRecord_employeeId_date_key" ON "OvertimeRecord"("employeeId", "date");

-- CreateIndex
CREATE INDEX "PayrollHold_employeeId_idx" ON "PayrollHold"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollHold_status_idx" ON "PayrollHold"("status");

-- CreateIndex
CREATE INDEX "BankPaymentFile_payrollRunId_idx" ON "BankPaymentFile"("payrollRunId");

-- CreateIndex
CREATE INDEX "BankPaymentFile_status_idx" ON "BankPaymentFile"("status");

-- CreateIndex
CREATE INDEX "BankPaymentFile_companyId_idx" ON "BankPaymentFile"("companyId");

-- CreateIndex
CREATE INDEX "PayrollValidation_payrollRunId_idx" ON "PayrollValidation"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollValidation_companyId_idx" ON "PayrollValidation"("companyId");

-- CreateIndex
CREATE INDEX "IncomeTaxDeclaration_employeeId_idx" ON "IncomeTaxDeclaration"("employeeId");

-- CreateIndex
CREATE INDEX "IncomeTaxDeclaration_financialYear_idx" ON "IncomeTaxDeclaration"("financialYear");

-- CreateIndex
CREATE INDEX "IncomeTaxDeclaration_status_idx" ON "IncomeTaxDeclaration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_timesheetId_idx" ON "InvoiceLineItem"("timesheetId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_projectId_idx" ON "InvoiceLineItem"("projectId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_employeeId_idx" ON "InvoiceLineItem"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollLockRequest_payrollRunId_idx" ON "PayrollLockRequest"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollLockRequest_status_idx" ON "PayrollLockRequest"("status");

-- CreateIndex
CREATE INDEX "PayrollLockRequest_requestedBy_idx" ON "PayrollLockRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "PayrollApproval_payrollRunId_idx" ON "PayrollApproval"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollApproval_status_idx" ON "PayrollApproval"("status");

-- CreateIndex
CREATE INDEX "PayrollApproval_approverRole_idx" ON "PayrollApproval"("approverRole");

-- CreateIndex
CREATE INDEX "PayrollAdjustmentLog_payrollRunId_idx" ON "PayrollAdjustmentLog"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollAdjustmentLog_employeeId_idx" ON "PayrollAdjustmentLog"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollAdjustmentLog_componentCode_idx" ON "PayrollAdjustmentLog"("componentCode");

-- CreateIndex
CREATE INDEX "PayrollAdjustmentLog_adjustedBy_idx" ON "PayrollAdjustmentLog"("adjustedBy");

-- CreateIndex
CREATE INDEX "PayrollAdjustmentLog_adjustedAt_idx" ON "PayrollAdjustmentLog"("adjustedAt");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_payrollRunId_idx" ON "PayrollAnomaly"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_employeeId_idx" ON "PayrollAnomaly"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_anomalyType_idx" ON "PayrollAnomaly"("anomalyType");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_status_idx" ON "PayrollAnomaly"("status");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_severity_idx" ON "PayrollAnomaly"("severity");

-- CreateIndex
CREATE INDEX "PayrollAnomaly_companyId_idx" ON "PayrollAnomaly"("companyId");

-- CreateIndex
CREATE INDEX "ComplianceChangeAlert_countryCode_idx" ON "ComplianceChangeAlert"("countryCode");

-- CreateIndex
CREATE INDEX "ComplianceChangeAlert_effectiveDate_idx" ON "ComplianceChangeAlert"("effectiveDate");

-- CreateIndex
CREATE INDEX "ComplianceChangeAlert_status_idx" ON "ComplianceChangeAlert"("status");

-- CreateIndex
CREATE INDEX "ComplianceChangeAlert_impactLevel_idx" ON "ComplianceChangeAlert"("impactLevel");

-- CreateIndex
CREATE INDEX "GhostEmployeeFlag_employeeId_idx" ON "GhostEmployeeFlag"("employeeId");

-- CreateIndex
CREATE INDEX "GhostEmployeeFlag_payrollRunId_idx" ON "GhostEmployeeFlag"("payrollRunId");

-- CreateIndex
CREATE INDEX "GhostEmployeeFlag_status_idx" ON "GhostEmployeeFlag"("status");

-- CreateIndex
CREATE INDEX "GhostEmployeeFlag_riskScore_idx" ON "GhostEmployeeFlag"("riskScore");

-- CreateIndex
CREATE INDEX "GhostEmployeeFlag_companyId_idx" ON "GhostEmployeeFlag"("companyId");

-- CreateIndex
CREATE INDEX "CrossBorderSecondment_employeeId_idx" ON "CrossBorderSecondment"("employeeId");

-- CreateIndex
CREATE INDEX "CrossBorderSecondment_homeCompanyId_idx" ON "CrossBorderSecondment"("homeCompanyId");

-- CreateIndex
CREATE INDEX "CrossBorderSecondment_hostCompanyId_idx" ON "CrossBorderSecondment"("hostCompanyId");

-- CreateIndex
CREATE INDEX "CrossBorderSecondment_status_idx" ON "CrossBorderSecondment"("status");

-- CreateIndex
CREATE INDEX "MinimumWageConfig_countryCode_idx" ON "MinimumWageConfig"("countryCode");

-- CreateIndex
CREATE INDEX "MinimumWageConfig_regionCode_idx" ON "MinimumWageConfig"("regionCode");

-- CreateIndex
CREATE INDEX "MinimumWageConfig_effectiveFrom_idx" ON "MinimumWageConfig"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DataResidencyPolicy_companyId_key" ON "DataResidencyPolicy"("companyId");

-- CreateIndex
CREATE INDEX "DataResidencyPolicy_companyId_idx" ON "DataResidencyPolicy"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeCustomField_scope_countryCode_companyId_idx" ON "EmployeeCustomField"("scope", "countryCode", "companyId");

-- CreateIndex
CREATE INDEX "EmployeeCustomField_key_idx" ON "EmployeeCustomField"("key");

-- CreateIndex
CREATE INDEX "EmployeeCustomFieldValue_employeeId_idx" ON "EmployeeCustomFieldValue"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCustomFieldValue_fieldId_idx" ON "EmployeeCustomFieldValue"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCustomFieldValue_employeeId_fieldId_key" ON "EmployeeCustomFieldValue"("employeeId", "fieldId");

-- CreateIndex
CREATE INDEX "DottedLineManager_employeeId_idx" ON "DottedLineManager"("employeeId");

-- CreateIndex
CREATE INDEX "DottedLineManager_managerId_idx" ON "DottedLineManager"("managerId");

-- CreateIndex
CREATE INDEX "Team_companyId_idx" ON "Team"("companyId");

-- CreateIndex
CREATE INDEX "Team_teamType_idx" ON "Team"("teamType");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_employeeId_idx" ON "TeamMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_employeeId_key" ON "TeamMember"("teamId", "employeeId");

-- CreateIndex
CREATE INDEX "SocialProfile_employeeId_idx" ON "SocialProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialProfile_employeeId_provider_key" ON "SocialProfile"("employeeId", "provider");

-- CreateIndex
CREATE INDEX "SSOProvider_tenantId_idx" ON "SSOProvider"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarSync_employeeId_idx" ON "CalendarSync"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSync_employeeId_provider_key" ON "CalendarSync"("employeeId", "provider");

-- CreateIndex
CREATE INDEX "ChatRoom_roomType_idx" ON "ChatRoom"("roomType");

-- CreateIndex
CREATE INDEX "ChatRoom_companyId_idx" ON "ChatRoom"("companyId");

-- CreateIndex
CREATE INDEX "ChatRoom_projectId_idx" ON "ChatRoom"("projectId");

-- CreateIndex
CREATE INDEX "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");

-- CreateIndex
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_parentMessageId_idx" ON "ChatMessage"("parentMessageId");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "CallLog_initiatorId_idx" ON "CallLog"("initiatorId");

-- CreateIndex
CREATE INDEX "CallLog_roomId_idx" ON "CallLog"("roomId");

-- CreateIndex
CREATE INDEX "CallLog_startedAt_idx" ON "CallLog"("startedAt");

-- CreateIndex
CREATE INDEX "CallParticipant_callId_idx" ON "CallParticipant"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "CallParticipant_callId_userId_key" ON "CallParticipant"("callId", "userId");

-- CreateIndex
CREATE INDEX "FileNode_driveType_ownerEmployeeId_idx" ON "FileNode"("driveType", "ownerEmployeeId");

-- CreateIndex
CREATE INDEX "FileNode_driveType_projectId_idx" ON "FileNode"("driveType", "projectId");

-- CreateIndex
CREATE INDEX "FileNode_driveType_companyId_idx" ON "FileNode"("driveType", "companyId");

-- CreateIndex
CREATE INDEX "FileNode_parentId_idx" ON "FileNode"("parentId");

-- CreateIndex
CREATE INDEX "FileVersion_fileId_versionNumber_idx" ON "FileVersion"("fileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FileShareLink_shareUrl_key" ON "FileShareLink"("shareUrl");

-- CreateIndex
CREATE INDEX "FileShareLink_fileId_idx" ON "FileShareLink"("fileId");

-- CreateIndex
CREATE INDEX "FileShareLink_shareUrl_idx" ON "FileShareLink"("shareUrl");

-- CreateIndex
CREATE INDEX "AIKnowledgeQuery_userId_idx" ON "AIKnowledgeQuery"("userId");

-- CreateIndex
CREATE INDEX "AIKnowledgeQuery_intent_idx" ON "AIKnowledgeQuery"("intent");

-- CreateIndex
CREATE INDEX "DocumentIntelligenceResult_fileId_idx" ON "DocumentIntelligenceResult"("fileId");

-- CreateIndex
CREATE INDEX "DocumentIntelligenceResult_documentId_idx" ON "DocumentIntelligenceResult"("documentId");

-- CreateIndex
CREATE INDEX "DocumentIntelligenceResult_employeeId_idx" ON "DocumentIntelligenceResult"("employeeId");

-- CreateIndex
CREATE INDEX "ChatSummary_roomId_periodStart_idx" ON "ChatSummary"("roomId", "periodStart");

-- CreateIndex
CREATE INDEX "SentimentAnalysis_scope_scopeId_periodStart_idx" ON "SentimentAnalysis"("scope", "scopeId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "StorageQuota_tenantId_key" ON "StorageQuota"("tenantId");

-- CreateIndex
CREATE INDEX "StorageQuota_tenantId_idx" ON "StorageQuota"("tenantId");

-- CreateIndex
CREATE INDEX "LegalHold_tenantId_status_idx" ON "LegalHold"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LegalHold_targetUserId_idx" ON "LegalHold"("targetUserId");

-- CreateIndex
CREATE INDEX "CollaborationFeatureFlag_tenantId_idx" ON "CollaborationFeatureFlag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationFeatureFlag_tenantId_featureKey_key" ON "CollaborationFeatureFlag"("tenantId", "featureKey");

-- CreateIndex
CREATE INDEX "CommunicationPolicy_tenantId_idx" ON "CommunicationPolicy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPolicy_tenantId_policyKey_key" ON "CommunicationPolicy"("tenantId", "policyKey");

-- CreateIndex
CREATE INDEX "StorageAnalytics_tenantId_snapshotDate_idx" ON "StorageAnalytics"("tenantId", "snapshotDate");

-- CreateIndex
CREATE INDEX "StorageAnalytics_companyId_driveType_idx" ON "StorageAnalytics"("companyId", "driveType");

-- CreateIndex
CREATE INDEX "DLPScanLog_sourceType_sourceId_idx" ON "DLPScanLog"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "DLPScanLog_userId_idx" ON "DLPScanLog"("userId");

-- CreateIndex
CREATE INDEX "DLPScanLog_action_idx" ON "DLPScanLog"("action");

-- CreateIndex
CREATE INDEX "GDPRAnonymizationRequest_employeeId_idx" ON "GDPRAnonymizationRequest"("employeeId");

-- CreateIndex
CREATE INDEX "GDPRAnonymizationRequest_status_idx" ON "GDPRAnonymizationRequest"("status");

-- CreateIndex
CREATE INDEX "WatermarkAccessLog_fileId_createdAt_idx" ON "WatermarkAccessLog"("fileId", "createdAt");

-- CreateIndex
CREATE INDEX "WatermarkAccessLog_userId_idx" ON "WatermarkAccessLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_trackToken_key" ON "Referral"("trackToken");

-- CreateIndex
CREATE INDEX "Referral_jobPostingId_idx" ON "Referral"("jobPostingId");

-- CreateIndex
CREATE INDEX "Referral_referrerEmployeeId_idx" ON "Referral"("referrerEmployeeId");

-- CreateIndex
CREATE INDEX "Referral_trackToken_idx" ON "Referral"("trackToken");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "CandidateConsent_candidateEmail_tenantId_idx" ON "CandidateConsent"("candidateEmail", "tenantId");

-- CreateIndex
CREATE INDEX "CandidateConsent_purpose_idx" ON "CandidateConsent"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePiiPolicy_tenantId_field_key" ON "CandidatePiiPolicy"("tenantId", "field");

-- CreateIndex
CREATE INDEX "ResumeParse_jobApplicationId_idx" ON "ResumeParse"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePortalUser_magicToken_key" ON "CandidatePortalUser"("magicToken");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePortalUser_candidateEmail_key" ON "CandidatePortalUser"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateMessage_candidateEmail_idx" ON "CandidateMessage"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateMessage_parentMessageId_idx" ON "CandidateMessage"("parentMessageId");

-- CreateIndex
CREATE INDEX "CandidateMessage_senderUserId_idx" ON "CandidateMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "CandidateSentimentScore_jobApplicationId_idx" ON "CandidateSentimentScore"("jobApplicationId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewId_idx" ON "InterviewFeedback"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewerId_idx" ON "InterviewFeedback"("interviewerId");

-- CreateIndex
CREATE INDEX "OfferTemplate_tenantId_country_idx" ON "OfferTemplate"("tenantId", "country");

-- CreateIndex
CREATE INDEX "OfferTemplate_isActive_idx" ON "OfferTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OfferDeclineSurvey_offerId_key" ON "OfferDeclineSurvey"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferDeclineSurvey_token_key" ON "OfferDeclineSurvey"("token");

-- CreateIndex
CREATE INDEX "OfferDeclineSurvey_offerId_idx" ON "OfferDeclineSurvey"("offerId");

-- CreateIndex
CREATE INDEX "OnboardingTaskTemplate_tenantId_isActive_idx" ON "OnboardingTaskTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "JobBoardPosting_jobPostingId_idx" ON "JobBoardPosting"("jobPostingId");

-- CreateIndex
CREATE INDEX "JobBoardPosting_board_status_idx" ON "JobBoardPosting"("board", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobBoardPosting_jobPostingId_board_key" ON "JobBoardPosting"("jobPostingId", "board");

-- CreateIndex
CREATE INDEX "BackgroundCheck_preboardingCandidateId_idx" ON "BackgroundCheck"("preboardingCandidateId");

-- CreateIndex
CREATE INDEX "BackgroundCheck_status_idx" ON "BackgroundCheck"("status");

-- CreateIndex
CREATE INDEX "WelcomeSeriesEmail_preboardingCandidateId_idx" ON "WelcomeSeriesEmail"("preboardingCandidateId");

-- CreateIndex
CREATE INDEX "WelcomeSeriesEmail_status_idx" ON "WelcomeSeriesEmail"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeSeriesEmail_preboardingCandidateId_sequenceKey_key" ON "WelcomeSeriesEmail"("preboardingCandidateId", "sequenceKey");

-- CreateIndex
CREATE INDEX "Geofence_branchId_idx" ON "Geofence"("branchId");

-- CreateIndex
CREATE INDEX "AttendanceRegularization_employeeId_idx" ON "AttendanceRegularization"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceRegularization_status_idx" ON "AttendanceRegularization"("status");

-- CreateIndex
CREATE INDEX "HourlyPermission_employeeId_idx" ON "HourlyPermission"("employeeId");

-- CreateIndex
CREATE INDEX "HourlyPermission_status_idx" ON "HourlyPermission"("status");

-- CreateIndex
CREATE INDEX "HourlyPermission_date_idx" ON "HourlyPermission"("date");

-- CreateIndex
CREATE INDEX "Gatepass_employeeId_idx" ON "Gatepass"("employeeId");

-- CreateIndex
CREATE INDEX "Gatepass_status_idx" ON "Gatepass"("status");

-- CreateIndex
CREATE INDEX "Gatepass_requestedAt_idx" ON "Gatepass"("requestedAt");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- CreateIndex
CREATE INDEX "OvertimeRequest_date_idx" ON "OvertimeRequest"("date");

-- CreateIndex
CREATE INDEX "CompOffLeave_employeeId_idx" ON "CompOffLeave"("employeeId");

-- CreateIndex
CREATE INDEX "CompOffLeave_status_idx" ON "CompOffLeave"("status");

-- CreateIndex
CREATE INDEX "WfhAttendanceSnapshot_employeeId_idx" ON "WfhAttendanceSnapshot"("employeeId");

-- CreateIndex
CREATE INDEX "WfhAttendanceSnapshot_date_idx" ON "WfhAttendanceSnapshot"("date");

-- CreateIndex
CREATE INDEX "WfhRequest_employeeId_idx" ON "WfhRequest"("employeeId");

-- CreateIndex
CREATE INDEX "WfhRequest_status_idx" ON "WfhRequest"("status");

-- CreateIndex
CREATE INDEX "WfhRequest_startDate_idx" ON "WfhRequest"("startDate");

-- CreateIndex
CREATE INDEX "WfhRequest_requestType_idx" ON "WfhRequest"("requestType");

-- CreateIndex
CREATE INDEX "EmployeeRosterAssignment_employeeId_idx" ON "EmployeeRosterAssignment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRosterAssignment_employeeId_rosterId_key" ON "EmployeeRosterAssignment"("employeeId", "rosterId");

-- CreateIndex
CREATE INDEX "AttendancePolicyConfig_companyId_idx" ON "AttendancePolicyConfig"("companyId");

-- CreateIndex
CREATE INDEX "LeavePolicyRule_companyId_idx" ON "LeavePolicyRule"("companyId");

-- CreateIndex
CREATE INDEX "LeavePolicyRule_employmentType_idx" ON "LeavePolicyRule"("employmentType");

-- CreateIndex
CREATE INDEX "LeavePolicyRule_branchId_idx" ON "LeavePolicyRule"("branchId");

-- CreateIndex
CREATE INDEX "AttendancePolicyRule_companyId_idx" ON "AttendancePolicyRule"("companyId");

-- CreateIndex
CREATE INDEX "AttendancePolicyRule_employmentType_idx" ON "AttendancePolicyRule"("employmentType");

-- CreateIndex
CREATE INDEX "AttendancePolicyRule_branchId_idx" ON "AttendancePolicyRule"("branchId");

-- CreateIndex
CREATE INDEX "LeaveEncashmentRequest_employeeId_idx" ON "LeaveEncashmentRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveEncashmentRequest_status_idx" ON "LeaveEncashmentRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveAttachment_leaveRequestId_idx" ON "LeaveAttachment"("leaveRequestId");

-- CreateIndex
CREATE INDEX "OptionalHolidayElection_employeeId_idx" ON "OptionalHolidayElection"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionalHolidayElection_employeeId_holidayId_key" ON "OptionalHolidayElection"("employeeId", "holidayId");

-- CreateIndex
CREATE INDEX "ApprovalRoutingRule_requestType_idx" ON "ApprovalRoutingRule"("requestType");

-- CreateIndex
CREATE INDEX "ApprovalRoutingRule_projectId_idx" ON "ApprovalRoutingRule"("projectId");

-- CreateIndex
CREATE INDEX "BurnoutFlag_employeeId_idx" ON "BurnoutFlag"("employeeId");

-- CreateIndex
CREATE INDEX "BurnoutFlag_riskLevel_idx" ON "BurnoutFlag"("riskLevel");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_employeeId_idx" ON "AttendanceAuditLog"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_action_idx" ON "AttendanceAuditLog"("action");

-- CreateIndex
CREATE INDEX "AttendanceAuditLog_createdAt_idx" ON "AttendanceAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_serialNumber_key" ON "BiometricDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "BiometricDevice_branchId_idx" ON "BiometricDevice"("branchId");

-- CreateIndex
CREATE INDEX "BiometricDevice_isActive_idx" ON "BiometricDevice"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricEnrollment_templateHash_key" ON "BiometricEnrollment"("templateHash");

-- CreateIndex
CREATE INDEX "BiometricEnrollment_employeeId_idx" ON "BiometricEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX "BiometricEnrollment_deviceId_idx" ON "BiometricEnrollment"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricEnrollment_employeeId_deviceId_key" ON "BiometricEnrollment"("employeeId", "deviceId");

-- CreateIndex
CREATE INDEX "BiometricPunch_deviceId_idx" ON "BiometricPunch"("deviceId");

-- CreateIndex
CREATE INDEX "BiometricPunch_employeeId_idx" ON "BiometricPunch"("employeeId");

-- CreateIndex
CREATE INDEX "BiometricPunch_punchTime_idx" ON "BiometricPunch"("punchTime");

-- CreateIndex
CREATE INDEX "BiometricPunch_flagged_idx" ON "BiometricPunch"("flagged");

-- CreateIndex
CREATE INDEX "ClientBranch_clientId_idx" ON "ClientBranch"("clientId");

-- CreateIndex
CREATE INDEX "ClientBranch_companyId_idx" ON "ClientBranch"("companyId");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "SOW_clientId_idx" ON "SOW"("clientId");

-- CreateIndex
CREATE INDEX "SOW_status_idx" ON "SOW"("status");

-- CreateIndex
CREATE INDEX "ClientPortalUser_clientId_idx" ON "ClientPortalUser"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalUser_clientId_email_key" ON "ClientPortalUser"("clientId", "email");

-- CreateIndex
CREATE INDEX "ClientTimesheetApproval_clientId_idx" ON "ClientTimesheetApproval"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTimesheetApproval_timesheetId_key" ON "ClientTimesheetApproval"("timesheetId");

-- CreateIndex
CREATE INDEX "ClientChurnRisk_clientId_idx" ON "ClientChurnRisk"("clientId");

-- CreateIndex
CREATE INDEX "ClientChurnRisk_riskLevel_idx" ON "ClientChurnRisk"("riskLevel");

-- CreateIndex
CREATE INDEX "ClientMarginSnapshot_clientId_idx" ON "ClientMarginSnapshot"("clientId");

-- CreateIndex
CREATE INDEX "ClientMarginSnapshot_projectId_idx" ON "ClientMarginSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "VendorCategory_name_idx" ON "VendorCategory"("name");

-- CreateIndex
CREATE INDEX "VendorDocument_vendorId_idx" ON "VendorDocument"("vendorId");

-- CreateIndex
CREATE INDEX "VendorDocument_expiryDate_idx" ON "VendorDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "VendorPortalUser_vendorId_idx" ON "VendorPortalUser"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPortalUser_vendorId_email_key" ON "VendorPortalUser"("vendorId", "email");

-- CreateIndex
CREATE INDEX "VendorStaff_vendorId_idx" ON "VendorStaff"("vendorId");

-- CreateIndex
CREATE INDEX "VendorStaff_status_idx" ON "VendorStaff"("status");

-- CreateIndex
CREATE INDEX "ContractorRequest_projectId_idx" ON "ContractorRequest"("projectId");

-- CreateIndex
CREATE INDEX "ContractorRequest_vendorId_idx" ON "ContractorRequest"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_idx" ON "PurchaseOrder"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_poId_idx" ON "PurchaseOrderLineItem"("poId");

-- CreateIndex
CREATE INDEX "VendorInvoice_vendorId_idx" ON "VendorInvoice"("vendorId");

-- CreateIndex
CREATE INDEX "VendorInvoice_poId_idx" ON "VendorInvoice"("poId");

-- CreateIndex
CREATE INDEX "VendorInvoice_status_idx" ON "VendorInvoice"("status");

-- CreateIndex
CREATE INDEX "Wallet_employeeId_idx" ON "Wallet"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_employeeId_currency_key" ON "Wallet"("employeeId", "currency");

-- CreateIndex
CREATE INDEX "WalletBucket_walletId_idx" ON "WalletBucket"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBucket_walletId_category_key" ON "WalletBucket"("walletId", "category");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_bucketId_idx" ON "WalletTransaction"("bucketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_sku_key" ON "MarketplaceProduct"("sku");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_category_idx" ON "MarketplaceProduct"("category");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_providerName_idx" ON "MarketplaceProduct"("providerName");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_employeeId_idx" ON "MarketplaceOrder"("employeeId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_productId_idx" ON "MarketplaceOrder"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProvider_name_key" ON "MarketplaceProvider"("name");

-- CreateIndex
CREATE INDEX "InsurancePolicy_employeeId_idx" ON "InsurancePolicy"("employeeId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_policyId_idx" ON "InsuranceClaim"("policyId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_employeeId_idx" ON "InsuranceClaim"("employeeId");

-- CreateIndex
CREATE INDEX "EWARequest_employeeId_idx" ON "EWARequest"("employeeId");

-- CreateIndex
CREATE INDEX "EWARequest_status_idx" ON "EWARequest"("status");

-- CreateIndex
CREATE INDEX "LoanMarketplaceListing_employeeId_idx" ON "LoanMarketplaceListing"("employeeId");

-- CreateIndex
CREATE INDEX "LoanMarketplaceListing_bankName_idx" ON "LoanMarketplaceListing"("bankName");

-- CreateIndex
CREATE INDEX "Gift_recipientId_idx" ON "Gift"("recipientId");

-- CreateIndex
CREATE INDEX "Gift_triggerEvent_idx" ON "Gift"("triggerEvent");

-- CreateIndex
CREATE INDEX "RewardPointsLedger_employeeId_idx" ON "RewardPointsLedger"("employeeId");

-- CreateIndex
CREATE INDEX "MarketplaceFraudFlag_employeeId_idx" ON "MarketplaceFraudFlag"("employeeId");

-- CreateIndex
CREATE INDEX "FinancialStressFlag_employeeId_idx" ON "FinancialStressFlag"("employeeId");

-- CreateIndex
CREATE INDEX "WalletBudgetAllocation_companyId_idx" ON "WalletBudgetAllocation"("companyId");

-- CreateIndex
CREATE INDEX "ClientFeedback_clientId_idx" ON "ClientFeedback"("clientId");

-- CreateIndex
CREATE INDEX "ClientFeedback_employeeId_idx" ON "ClientFeedback"("employeeId");

-- CreateIndex
CREATE INDEX "ClientFeedback_projectId_idx" ON "ClientFeedback"("projectId");

-- CreateIndex
CREATE INDEX "ReportSchedule_companyId_idx" ON "ReportSchedule"("companyId");

-- CreateIndex
CREATE INDEX "ReportSchedule_frequency_idx" ON "ReportSchedule"("frequency");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_userId_key" ON "Contractor"("userId");

-- CreateIndex
CREATE INDEX "Contractor_vendorId_idx" ON "Contractor"("vendorId");

-- CreateIndex
CREATE INDEX "Contractor_projectId_idx" ON "Contractor"("projectId");

-- CreateIndex
CREATE INDEX "Contractor_status_idx" ON "Contractor"("status");

-- CreateIndex
CREATE INDEX "PersonalizedCatalogCache_employeeId_idx" ON "PersonalizedCatalogCache"("employeeId");

-- CreateIndex
CREATE INDEX "AnomalyInsight_module_idx" ON "AnomalyInsight"("module");

-- CreateIndex
CREATE INDEX "AnomalyInsight_severity_idx" ON "AnomalyInsight"("severity");

-- CreateIndex
CREATE INDEX "AnomalyInsight_generatedAt_idx" ON "AnomalyInsight"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTrigger_triggerKey_key" ON "WorkflowTrigger"("triggerKey");

-- CreateIndex
CREATE INDEX "WorkflowTrigger_workflowId_idx" ON "WorkflowTrigger"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowTrigger_triggerType_idx" ON "WorkflowTrigger"("triggerType");

-- CreateIndex
CREATE INDEX "ProjectUtilizationSnapshot_projectId_idx" ON "ProjectUtilizationSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUtilizationSnapshot_employeeId_idx" ON "ProjectUtilizationSnapshot"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectUtilizationSnapshot_weekStart_idx" ON "ProjectUtilizationSnapshot"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUtilizationSnapshot_projectId_employeeId_weekStart_key" ON "ProjectUtilizationSnapshot"("projectId", "employeeId", "weekStart");

-- CreateIndex
CREATE INDEX "CandidateSavedJob_candidateEmail_idx" ON "CandidateSavedJob"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateSavedJob_jobPostingId_idx" ON "CandidateSavedJob"("jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSavedJob_candidateEmail_jobPostingId_key" ON "CandidateSavedJob"("candidateEmail", "jobPostingId");

-- CreateIndex
CREATE INDEX "CandidateTalentPool_candidateEmail_idx" ON "CandidateTalentPool"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateTalentPool_companyId_idx" ON "CandidateTalentPool"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateTalentPool_candidateEmail_companyId_key" ON "CandidateTalentPool"("candidateEmail", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePasswordReset_tokenHash_key" ON "CandidatePasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "CandidatePasswordReset_candidateEmail_idx" ON "CandidatePasswordReset"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidatePasswordReset_expiresAt_idx" ON "CandidatePasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "CandidateErasureRequest_candidateEmail_idx" ON "CandidateErasureRequest"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateErasureRequest_status_idx" ON "CandidateErasureRequest"("status");

-- CreateIndex
CREATE INDEX "CandidateResumeOptimization_candidateEmail_idx" ON "CandidateResumeOptimization"("candidateEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateResumeOptimization_jobApplicationId_key" ON "CandidateResumeOptimization"("jobApplicationId");

-- CreateIndex
CREATE INDEX "CandidateAiFeedback_candidateEmail_idx" ON "CandidateAiFeedback"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateAiFeedback_reviewStatus_idx" ON "CandidateAiFeedback"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateAiFeedback_jobApplicationId_key" ON "CandidateAiFeedback"("jobApplicationId");

-- CreateIndex
CREATE INDEX "CandidateJobAlert_candidateEmail_idx" ON "CandidateJobAlert"("candidateEmail");

-- CreateIndex
CREATE INDEX "CandidateJobAlert_jobPostingId_idx" ON "CandidateJobAlert"("jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialRegistration_companyCode_key" ON "TrialRegistration"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "TrialRegistration_companyEmail_key" ON "TrialRegistration"("companyEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TrialRegistration_contactEmail_key" ON "TrialRegistration"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TrialRegistration_tenantId_key" ON "TrialRegistration"("tenantId");

-- CreateIndex
CREATE INDEX "TrialRegistration_status_idx" ON "TrialRegistration"("status");

-- CreateIndex
CREATE INDEX "TrialRegistration_companyEmail_idx" ON "TrialRegistration"("companyEmail");

-- CreateIndex
CREATE INDEX "TrialRegistration_contactEmail_idx" ON "TrialRegistration"("contactEmail");

-- CreateIndex
CREATE INDEX "TrialRegistration_tenantId_idx" ON "TrialRegistration"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeCompanyMapping_employeeId_idx" ON "EmployeeCompanyMapping"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCompanyMapping_companyId_idx" ON "EmployeeCompanyMapping"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCompanyMapping_employeeId_companyId_key" ON "EmployeeCompanyMapping"("employeeId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfiguration_tenantId_key" ON "TenantConfiguration"("tenantId");

-- CreateIndex
CREATE INDEX "TenantConfiguration_tenantId_idx" ON "TenantConfiguration"("tenantId");

-- CreateIndex
CREATE INDEX "TenantCountryAccess_tenantConfigId_idx" ON "TenantCountryAccess"("tenantConfigId");

-- CreateIndex
CREATE INDEX "TenantCountryAccess_countryCode_idx" ON "TenantCountryAccess"("countryCode");

-- CreateIndex
CREATE INDEX "TenantCountryAccess_isActive_idx" ON "TenantCountryAccess"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCountryAccess_tenantConfigId_countryCode_key" ON "TenantCountryAccess"("tenantConfigId", "countryCode");

-- CreateIndex
CREATE INDEX "TenantCurrencyAccess_tenantConfigId_idx" ON "TenantCurrencyAccess"("tenantConfigId");

-- CreateIndex
CREATE INDEX "TenantCurrencyAccess_currencyCode_idx" ON "TenantCurrencyAccess"("currencyCode");

-- CreateIndex
CREATE INDEX "TenantCurrencyAccess_isActive_idx" ON "TenantCurrencyAccess"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCurrencyAccess_tenantConfigId_currencyCode_key" ON "TenantCurrencyAccess"("tenantConfigId", "currencyCode");

-- CreateIndex
CREATE INDEX "TenantLanguageAccess_tenantConfigId_idx" ON "TenantLanguageAccess"("tenantConfigId");

-- CreateIndex
CREATE INDEX "TenantLanguageAccess_languageCode_idx" ON "TenantLanguageAccess"("languageCode");

-- CreateIndex
CREATE INDEX "TenantLanguageAccess_isActive_idx" ON "TenantLanguageAccess"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantLanguageAccess_tenantConfigId_languageCode_key" ON "TenantLanguageAccess"("tenantConfigId", "languageCode");

-- CreateIndex
CREATE INDEX "TenantPayrollPolicy_tenantConfigId_idx" ON "TenantPayrollPolicy"("tenantConfigId");

-- CreateIndex
CREATE INDEX "TenantPayrollPolicy_countryCode_idx" ON "TenantPayrollPolicy"("countryCode");

-- CreateIndex
CREATE INDEX "TenantPayrollPolicy_policyType_idx" ON "TenantPayrollPolicy"("policyType");

-- CreateIndex
CREATE INDEX "TenantPayrollPolicy_status_idx" ON "TenantPayrollPolicy"("status");

-- CreateIndex
CREATE INDEX "TenantPayrollPolicy_source_idx" ON "TenantPayrollPolicy"("source");

-- CreateIndex
CREATE INDEX "BankAccount_employeeId_idx" ON "BankAccount"("employeeId");

-- CreateIndex
CREATE INDEX "BankAccount_isPrimary_idx" ON "BankAccount"("isPrimary");

-- CreateIndex
CREATE INDEX "BankAccount_status_idx" ON "BankAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_employeeId_accountNumber_ifscCode_key" ON "BankAccount"("employeeId", "accountNumber", "ifscCode");

-- CreateIndex
CREATE INDEX "GratuityLedger_employeeId_idx" ON "GratuityLedger"("employeeId");

-- CreateIndex
CREATE INDEX "GratuityLedger_companyId_idx" ON "GratuityLedger"("companyId");

-- CreateIndex
CREATE INDEX "GratuityLedger_financialYear_idx" ON "GratuityLedger"("financialYear");

-- CreateIndex
CREATE INDEX "GratuityLedger_status_idx" ON "GratuityLedger"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GratuityLedger_employeeId_financialYear_month_key" ON "GratuityLedger"("employeeId", "financialYear", "month");

-- CreateIndex
CREATE INDEX "Setting_tenantId_idx" ON "Setting"("tenantId");

-- CreateIndex
CREATE INDEX "Setting_companyId_idx" ON "Setting"("companyId");

-- CreateIndex
CREATE INDEX "Setting_category_idx" ON "Setting"("category");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_tenantId_companyId_category_key_key" ON "Setting"("tenantId", "companyId", "category", "key");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_idx" ON "Candidate"("tenantId");

-- CreateIndex
CREATE INDEX "Candidate_companyId_idx" ON "Candidate"("companyId");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Candidate_source_idx" ON "Candidate"("source");

-- CreateIndex
CREATE INDEX "Candidate_aiMatchScore_idx" ON "Candidate"("aiMatchScore");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_tenantId_email_key" ON "Candidate"("tenantId", "email");

-- CreateIndex
CREATE INDEX "CompanyPolicy_companyId_idx" ON "CompanyPolicy"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPolicy_category_idx" ON "CompanyPolicy"("category");

-- CreateIndex
CREATE INDEX "CompanyPolicy_status_idx" ON "CompanyPolicy"("status");

-- CreateIndex
CREATE INDEX "CompanyPolicy_effectiveDate_idx" ON "CompanyPolicy"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPolicy_companyId_policyCode_key" ON "CompanyPolicy"("companyId", "policyCode");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdBy_idx" ON "CalendarEvent"("createdBy");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDateTime_idx" ON "CalendarEvent"("startDateTime");

-- CreateIndex
CREATE INDEX "CalendarEvent_companyId_idx" ON "CalendarEvent"("companyId");

-- CreateIndex
CREATE INDEX "EmailMessage_folder_idx" ON "EmailMessage"("folder");

-- CreateIndex
CREATE INDEX "EmailMessage_senderId_idx" ON "EmailMessage"("senderId");

-- CreateIndex
CREATE INDEX "EmailMessage_isRead_idx" ON "EmailMessage"("isRead");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_companyId_idx" ON "EmailMessage"("companyId");

-- CreateIndex
CREATE INDEX "TodoTask_assignedToId_idx" ON "TodoTask"("assignedToId");

-- CreateIndex
CREATE INDEX "TodoTask_createdById_idx" ON "TodoTask"("createdById");

-- CreateIndex
CREATE INDEX "TodoTask_status_idx" ON "TodoTask"("status");

-- CreateIndex
CREATE INDEX "TodoTask_companyId_idx" ON "TodoTask"("companyId");

-- CreateIndex
CREATE INDEX "Note_createdById_idx" ON "Note"("createdById");

-- CreateIndex
CREATE INDEX "Note_category_idx" ON "Note"("category");

-- CreateIndex
CREATE INDEX "Note_companyId_idx" ON "Note"("companyId");

-- CreateIndex
CREATE INDEX "SocialPost_authorId_idx" ON "SocialPost"("authorId");

-- CreateIndex
CREATE INDEX "SocialPost_postType_idx" ON "SocialPost"("postType");

-- CreateIndex
CREATE INDEX "SocialPost_companyId_idx" ON "SocialPost"("companyId");

-- CreateIndex
CREATE INDEX "SocialComment_postId_idx" ON "SocialComment"("postId");

-- CreateIndex
CREATE INDEX "SocialComment_authorId_idx" ON "SocialComment"("authorId");

-- CreateIndex
CREATE INDEX "SocialLike_postId_idx" ON "SocialLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialLike_postId_userId_key" ON "SocialLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "KanbanBoard_companyId_idx" ON "KanbanBoard"("companyId");

-- CreateIndex
CREATE INDEX "KanbanBoard_createdById_idx" ON "KanbanBoard"("createdById");

-- CreateIndex
CREATE INDEX "KanbanCard_boardId_idx" ON "KanbanCard"("boardId");

-- CreateIndex
CREATE INDEX "KanbanCard_column_idx" ON "KanbanCard"("column");

-- CreateIndex
CREATE INDEX "KanbanCard_assignedToId_idx" ON "KanbanCard"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationSettings_tenantId_key" ON "CollaborationSettings"("tenantId");

-- CreateIndex
CREATE INDEX "CollaborationSettings_tenantId_idx" ON "CollaborationSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantDatabase" ADD CONSTRAINT "TenantDatabase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyGroup" ADD CONSTRAINT "CompanyGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "CompanyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectTaskId_fkey" FOREIGN KEY ("projectTaskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Separation" ADD CONSTRAINT "Separation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginActivity" ADD CONSTRAINT "LoginActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_parentVendorId_fkey" FOREIGN KEY ("parentVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAllocation" ADD CONSTRAINT "ProjectAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FNFCalculation" ADD CONSTRAINT "FNFCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowApproval" ADD CONSTRAINT "WorkflowApproval_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRequest" ADD CONSTRAINT "ExitRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OKR" ADD CONSTRAINT "OKR_parentOkrId_fkey" FOREIGN KEY ("parentOkrId") REFERENCES "OKR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_okrId_fkey" FOREIGN KEY ("okrId") REFERENCES "OKR"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitInterview" ADD CONSTRAINT "ExitInterview_separationId_fkey" FOREIGN KEY ("separationId") REFERENCES "Separation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitInterview" ADD CONSTRAINT "ExitInterview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocArticle" ADD CONSTRAINT "DocArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocAccessRule" ADD CONSTRAINT "DocAccessRule_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "DocArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSetQuestion" ADD CONSTRAINT "InterviewSetQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_followUpFromId_fkey" FOREIGN KEY ("followUpFromId") REFERENCES "InterviewResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProctoringLog" ADD CONSTRAINT "ProctoringLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewInvitation" ADD CONSTRAINT "InterviewInvitation_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CTCComponentMapping" ADD CONSTRAINT "CTCComponentMapping_ctcTemplateId_fkey" FOREIGN KEY ("ctcTemplateId") REFERENCES "CTCTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryComponent" ADD CONSTRAINT "StatutoryComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxSlabRateLine" ADD CONSTRAINT "TaxSlabRateLine_slabTableId_fkey" FOREIGN KEY ("slabTableId") REFERENCES "TaxSlabTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxSlabRateLine" ADD CONSTRAINT "TaxSlabRateLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollInput" ADD CONSTRAINT "PayrollInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDimensionAllocation" ADD CONSTRAINT "EmployeeDimensionAllocation_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "DimensionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollTransactionLine" ADD CONSTRAINT "PayrollTransactionLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollTransactionLine" ADD CONSTRAINT "PayrollTransactionLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollTransactionLine" ADD CONSTRAINT "PayrollTransactionLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFiling" ADD CONSTRAINT "ComplianceFiling_complianceId_fkey" FOREIGN KEY ("complianceId") REFERENCES "ComplianceObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFiling" ADD CONSTRAINT "ComplianceFiling_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccountMapping" ADD CONSTRAINT "GLAccountMapping_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDefinition" ADD CONSTRAINT "PayrollDefinition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePaymentMethod" ADD CONSTRAINT "EmployeePaymentMethod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollHold" ADD CONSTRAINT "PayrollHold_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaymentFile" ADD CONSTRAINT "BankPaymentFile_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaymentFile" ADD CONSTRAINT "BankPaymentFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeTaxDeclaration" ADD CONSTRAINT "IncomeTaxDeclaration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLockRequest" ADD CONSTRAINT "PayrollLockRequest_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollApproval" ADD CONSTRAINT "PayrollApproval_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustmentLog" ADD CONSTRAINT "PayrollAdjustmentLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAnomaly" ADD CONSTRAINT "PayrollAnomaly_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAnomaly" ADD CONSTRAINT "PayrollAnomaly_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAnomaly" ADD CONSTRAINT "PayrollAnomaly_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhostEmployeeFlag" ADD CONSTRAINT "GhostEmployeeFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhostEmployeeFlag" ADD CONSTRAINT "GhostEmployeeFlag_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhostEmployeeFlag" ADD CONSTRAINT "GhostEmployeeFlag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossBorderSecondment" ADD CONSTRAINT "CrossBorderSecondment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinimumWageConfig" ADD CONSTRAINT "MinimumWageConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataResidencyPolicy" ADD CONSTRAINT "DataResidencyPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerEmployeeId_fkey" FOREIGN KEY ("referrerEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeParse" ADD CONSTRAINT "ResumeParse_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateMessage" ADD CONSTRAINT "CandidateMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "CandidateMessage"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSentimentScore" ADD CONSTRAINT "CandidateSentimentScore_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferDeclineSurvey" ADD CONSTRAINT "OfferDeclineSurvey_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBoardPosting" ADD CONSTRAINT "JobBoardPosting_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundCheck" ADD CONSTRAINT "BackgroundCheck_preboardingCandidateId_fkey" FOREIGN KEY ("preboardingCandidateId") REFERENCES "PreboardingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelcomeSeriesEmail" ADD CONSTRAINT "WelcomeSeriesEmail_preboardingCandidateId_fkey" FOREIGN KEY ("preboardingCandidateId") REFERENCES "PreboardingCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRegularization" ADD CONSTRAINT "AttendanceRegularization_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyPermission" ADD CONSTRAINT "HourlyPermission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gatepass" ADD CONSTRAINT "Gatepass_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompOffLeave" ADD CONSTRAINT "CompOffLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhAttendanceSnapshot" ADD CONSTRAINT "WfhAttendanceSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfhRequest" ADD CONSTRAINT "WfhRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRosterAssignment" ADD CONSTRAINT "EmployeeRosterAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRosterAssignment" ADD CONSTRAINT "EmployeeRosterAssignment_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "RotationalRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyConfig" ADD CONSTRAINT "AttendancePolicyConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyRule" ADD CONSTRAINT "AttendancePolicyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyRule" ADD CONSTRAINT "AttendancePolicyRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyRule" ADD CONSTRAINT "AttendancePolicyRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEncashmentRequest" ADD CONSTRAINT "LeaveEncashmentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEncashmentRequest" ADD CONSTRAINT "LeaveEncashmentRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAttachment" ADD CONSTRAINT "LeaveAttachment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionalHolidayElection" ADD CONSTRAINT "OptionalHolidayElection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionalHolidayElection" ADD CONSTRAINT "OptionalHolidayElection_holidayId_fkey" FOREIGN KEY ("holidayId") REFERENCES "Holiday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BurnoutFlag" ADD CONSTRAINT "BurnoutFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "Geofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEnrollment" ADD CONSTRAINT "BiometricEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEnrollment" ADD CONSTRAINT "BiometricEnrollment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricPunch" ADD CONSTRAINT "BiometricPunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranch" ADD CONSTRAINT "ClientBranch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranch" ADD CONSTRAINT "ClientBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOW" ADD CONSTRAINT "SOW_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOW" ADD CONSTRAINT "SOW_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalUser" ADD CONSTRAINT "ClientPortalUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTimesheetApproval" ADD CONSTRAINT "ClientTimesheetApproval_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTimesheetApproval" ADD CONSTRAINT "ClientTimesheetApproval_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientChurnRisk" ADD CONSTRAINT "ClientChurnRisk_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMarginSnapshot" ADD CONSTRAINT "ClientMarginSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMarginSnapshot" ADD CONSTRAINT "ClientMarginSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorDocument" ADD CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPortalUser" ADD CONSTRAINT "VendorPortalUser_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorStaff" ADD CONSTRAINT "VendorStaff_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorRequest" ADD CONSTRAINT "ContractorRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorRequest" ADD CONSTRAINT "ContractorRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLineItem" ADD CONSTRAINT "PurchaseOrderLineItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBucket" ADD CONSTRAINT "WalletBucket_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "WalletBucket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPointsLedger" ADD CONSTRAINT "RewardPointsLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceFraudFlag" ADD CONSTRAINT "MarketplaceFraudFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStressFlag" ADD CONSTRAINT "FinancialStressFlag_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBudgetAllocation" ADD CONSTRAINT "WalletBudgetAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBudgetAllocation" ADD CONSTRAINT "WalletBudgetAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFeedback" ADD CONSTRAINT "ClientFeedback_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedCatalogCache" ADD CONSTRAINT "PersonalizedCatalogCache_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUtilizationSnapshot" ADD CONSTRAINT "ProjectUtilizationSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUtilizationSnapshot" ADD CONSTRAINT "ProjectUtilizationSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSavedJob" ADD CONSTRAINT "CandidateSavedJob_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTalentPool" ADD CONSTRAINT "CandidateTalentPool_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateResumeOptimization" ADD CONSTRAINT "CandidateResumeOptimization_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAiFeedback" ADD CONSTRAINT "CandidateAiFeedback_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateJobAlert" ADD CONSTRAINT "CandidateJobAlert_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialRegistration" ADD CONSTRAINT "TrialRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompanyMapping" ADD CONSTRAINT "EmployeeCompanyMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantConfiguration" ADD CONSTRAINT "TenantConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCountryAccess" ADD CONSTRAINT "TenantCountryAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCurrencyAccess" ADD CONSTRAINT "TenantCurrencyAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLanguageAccess" ADD CONSTRAINT "TenantLanguageAccess_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayrollPolicy" ADD CONSTRAINT "TenantPayrollPolicy_tenantConfigId_fkey" FOREIGN KEY ("tenantConfigId") REFERENCES "TenantConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedger" ADD CONSTRAINT "GratuityLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratuityLedger" ADD CONSTRAINT "GratuityLedger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPolicy" ADD CONSTRAINT "CompanyPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoTask" ADD CONSTRAINT "TodoTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanBoard" ADD CONSTRAINT "KanbanBoard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "KanbanBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

