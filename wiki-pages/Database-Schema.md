# 🗄️ Database Schema

Complete documentation of the NEXUS HRMS database schema, including all models, relationships, and the Prisma schema reference.

---

## Entity Relationship Overview

```
┌──────────┐     ┌───────────┐     ┌──────────┐
│  Company  │────▶│   User    │◀────│  Shift   │
└────┬─────┘     └─────┬─────┘     └──────────┘
     │                 │
     │           ┌─────┴─────┐
     │           │           │
     ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Branch   │ │ Employee │ │ Notification │
└──────────┘ └────┬─────┘ └──────────────┘
                  │
     ┌────────────┼────────────────┐
     │            │                │
     ▼            ▼                ▼
┌──────────┐ ┌──────────┐  ┌──────────────┐
│Department│ │Attendance│  │    Leave     │
└──────────┘ └──────────┘  └──────────────┘
     │
     ├──▶ ┌──────────┐
     │    │   Job    │
     │    └────┬─────┘
     │         │
     │         ▼
     │    ┌──────────┐     ┌──────────────┐
     │    │Candidate │────▶│  Interview   │
     │    └──────────┘     └──────────────┘
     │
     ├──▶ ┌──────────┐
     │    │ Payroll  │
     │    └──────────┘
     │
     ├──▶ ┌──────────────┐
     │    │    Asset     │
     │    └──────────────┘
     │
     ├──▶ ┌──────────────────┐
     │    │ TravelRequest   │
     │    └──────────────────┘
     │
     ├──▶ ┌──────────┐
     │    │ Expense  │
     │    └──────────┘
     │
     ├──▶ ┌──────────┐
     │    │ Ticket   │
     │    └──────────┘
     │
     └──▶ ┌────────────────┐
          │OnboardingTask │
          └────────────────┘

┌──────────┐     ┌────────────────────┐
│  Client  │     │WorkflowDefinition  │
└──────────┘     └────────┬───────────┘
                          │
┌──────────┐              ▼
│  Vendor  │     ┌────────────────────┐
└──────────┘     │ WorkflowInstance   │
                 └────────────────────┘

┌──────────┐     ┌──────────┐
│  Survey  │     │ AuditLog │
└──────────┘     └──────────┘
```

---

## Models

### User

The User model handles authentication and authorization.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `email` | String (unique) | User email address |
| `name` | String | Display name |
| `password` | String (hashed) | Bcrypt hashed password |
| `role` | UserRole | User role (enum) |
| `companyId` | String | FK → Company |
| `avatar` | String? | Profile picture URL |
| `isActive` | Boolean | Account status |
| `lastLogin` | DateTime? | Last login timestamp |
| `createdAt` | DateTime | Record creation time |
| `updatedAt` | DateTime | Last update time |

**UserRole Enum:**
```
super_admin | admin | hr_manager | hr_executive | manager | team_lead |
senior_employee | employee | intern | candidate | client | vendor | auditor | helpdesk
```

---

### Company

The Company model enables multi-tenancy.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `name` | String | Company name |
| `logo` | String? | Logo URL |
| `industry` | String? | Industry type |
| `size` | String? | Company size range |
| `website` | String? | Company website |
| `address` | String? | Physical address |
| `city` | String? | City |
| `country` | String? | Country |
| `phone` | String? | Contact phone |
| `email` | String? | Contact email |
| `taxId` | String? | Tax identification |
| `settings` | Json? | Company-level settings |
| `isActive` | Boolean | Active status |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Employee

The core Employee model with comprehensive HR information.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String (unique) | Employee ID (EMP001) |
| `userId` | String? | FK → User |
| `companyId` | String | FK → Company |
| `firstName` | String | First name |
| `lastName` | String | Last name |
| `email` | String | Work email |
| `phone` | String? | Phone number |
| `departmentId` | String? | FK → Department |
| `designation` | String? | Job title |
| `branchId` | String? | FK → Branch |
| `reportingTo` | String? | FK → Employee (manager) |
| `status` | EmployeeStatus | active/resigned/terminated/on_leave |
| `joinDate` | DateTime | Date of joining |
| `exitDate` | DateTime? | Date of exit |
| `salary` | Float? | Base salary |
| `address` | Json? | Address object |
| `emergencyContact` | Json? | Emergency contact info |
| `bankDetails` | Json? | Bank account details |
| `avatar` | String? | Profile picture |
| `dateOfBirth` | DateTime? | Date of birth |
| `gender` | String? | Gender |
| `bloodGroup` | String? | Blood group |
| `maritalStatus` | String? | Marital status |
| `nationality` | String? | Nationality |
| `documents` | Json? | Document references |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

**EmployeeStatus Enum:** `active | resigned | terminated | on_leave | probation`

---

### Department

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `name` | String | Department name |
| `description` | String? | Department description |
| `companyId` | String | FK → Company |
| `headId` | String? | FK → Employee (dept head) |
| `budget` | Float? | Annual budget |
| `parentDepartmentId` | String? | FK → Department (hierarchy) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Branch

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `name` | String | Branch name |
| `companyId` | String | FK → Company |
| `address` | String? | Street address |
| `city` | String? | City |
| `state` | String? | State/Province |
| `country` | String? | Country |
| `timezone` | String? | IANA timezone |
| `phone` | String? | Branch phone |
| `isActive` | Boolean | Active status |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Job

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `title` | String | Job title |
| `companyId` | String | FK → Company |
| `departmentId` | String? | FK → Department |
| `description` | String? | Job description |
| `requirements` | Json? | List of requirements |
| `location` | String? | Job location |
| `type` | JobType | full-time/part-time/contract/internship |
| `experience` | String? | Experience requirement |
| `salaryMin` | Float? | Minimum salary |
| `salaryMax` | Float? | Maximum salary |
| `status` | JobStatus | open/closed/draft |
| `postedDate` | DateTime? | When posted |
| `closingDate` | DateTime? | Application deadline |
| `createdBy` | String? | FK → User |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

**JobType Enum:** `full_time | part_time | contract | internship | remote`

**JobStatus Enum:** `open | closed | draft | on_hold`

---

### Candidate

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `name` | String | Full name |
| `email` | String | Email address |
| `phone` | String? | Phone number |
| `jobId` | String | FK → Job |
| `resume` | String? | Resume file URL |
| `coverLetter` | String? | Cover letter text |
| `stage` | CandidateStage | Current stage |
| `rating` | Float? | Rating (1-5) |
| `source` | String? | Application source |
| `notes` | String? | Internal notes |
| `appliedDate` | DateTime | Application date |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

**CandidateStage Enum:** `applied | screening | interview | offer | hired | rejected | withdrawn`

---

### Interview

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `candidateId` | String | FK → Candidate |
| `jobId` | String | FK → Job |
| `interviewerId` | String? | FK → Employee |
| `scheduledAt` | DateTime | Interview date/time |
| `duration` | Int? | Duration in minutes |
| `type` | InterviewType | technical/behavioral/hr/final |
| `status` | InterviewStatus | scheduled/completed/cancelled/no_show |
| `location` | String? | Physical location |
| `meetingLink` | String? | Video call link |
| `feedback` | String? | Interviewer feedback |
| `rating` | Float? | Interview rating |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Attendance

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String | FK → Employee |
| `date` | DateTime | Attendance date |
| `checkIn` | DateTime? | Check-in time |
| `checkOut` | DateTime? | Check-out time |
| `status` | AttendanceStatus | present/absent/late/half_day/holiday/weekend |
| `hoursWorked` | Float? | Total hours |
| `overtime` | Float? | Overtime hours |
| `note` | String? | Note/reason |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Leave

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String | FK → Employee |
| `type` | LeaveType | casual/sick/annual/maternity/paternity/compensatory/unpaid |
| `startDate` | DateTime | Leave start date |
| `endDate` | DateTime | Leave end date |
| `days` | Float | Number of days |
| `status` | LeaveStatus | pending/approved/rejected/cancelled |
| `reason` | String? | Reason for leave |
| `documents` | Json? | Supporting documents |
| `approvedById` | String? | FK → Employee (approver) |
| `approvalDate` | DateTime? | When approved |
| `rejectionReason` | String? | Reason for rejection |
| `appliedDate` | DateTime | When applied |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Payroll

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String | FK → Employee |
| `companyId` | String | FK → Company |
| `month` | String | Payroll month (YYYY-MM) |
| `basicSalary` | Float | Basic salary component |
| `hra` | Float | House Rent Allowance |
| `da` | Float | Dearness Allowance |
| `specialAllowance` | Float | Special allowance |
| `otherAllowances` | Float | Other allowances |
| `grossSalary` | Float | Total before deductions |
| `pf` | Float | Provident Fund |
| `esi` | Float | Employee State Insurance |
| `tax` | Float | Income Tax (TDS) |
| `professionalTax` | Float | Professional tax |
| `otherDeductions` | Float | Other deductions |
| `totalDeductions` | Float | Total deductions |
| `netSalary` | Float | Take-home salary |
| `status` | PayrollStatus | pending/processed/paid/failed |
| `paidDate` | DateTime? | Payment date |
| `paymentMethod` | String? | bank_transfer/cheque/cash |
| `transactionRef` | String? | Transaction reference |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Asset

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `assetId` | String (unique) | Asset ID (AST001) |
| `companyId` | String | FK → Company |
| `name` | String | Asset name |
| `category` | AssetCategory | laptop/monitor/phone/furniture/vehicle/software/other |
| `serialNumber` | String? | Serial number |
| `assignedToId` | String? | FK → Employee |
| `assignedDate` | DateTime? | Assignment date |
| `status` | AssetStatus | allocated/available/under_repair/retired/lost |
| `purchaseDate` | DateTime? | Purchase date |
| `purchaseCost` | Float? | Purchase cost |
| `currentValue` | Float? | Current value |
| `vendor` | String? | Vendor name |
| `warrantyExpiry` | DateTime? | Warranty expiry date |
| `notes` | String? | Additional notes |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### TravelRequest

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String | FK → Employee |
| `purpose` | String | Travel purpose |
| `destination` | String | Travel destination |
| `departureDate` | DateTime | Departure date |
| `returnDate` | DateTime | Return date |
| `estimatedCost` | Float | Estimated cost |
| `status` | TravelStatus | pending/approved/rejected/completed/cancelled |
| `approvedById` | String? | FK → Employee |
| `itinerary` | Json? | Travel itinerary |
| `documents` | Json? | Travel documents |
| `notes` | String? | Additional notes |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Expense

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `employeeId` | String | FK → Employee |
| `title` | String | Expense title |
| `category` | ExpenseCategory | travel/food/accommodation/transport/communication/other |
| `amount` | Float | Claim amount |
| `date` | DateTime | Expense date |
| `status` | ExpenseStatus | pending/approved/rejected/reimbursed |
| `receipts` | Json? | Receipt file URLs |
| `approvedById` | String? | FK → Employee |
| `notes` | String? | Additional notes |
| `travelRequestId` | String? | FK → TravelRequest |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Ticket

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `ticketId` | String (unique) | Ticket ID (TKT001) |
| `companyId` | String | FK → Company |
| `title` | String | Ticket title |
| `description` | String | Detailed description |
| `category` | TicketCategory | it/hr/facilities/payroll/admin/other |
| `priority` | TicketPriority | low/medium/high/critical |
| `status` | TicketStatus | open/in_progress/resolved/closed/reopened |
| `createdById` | String | FK → Employee |
| `assignedToId` | String? | FK → Employee |
| `comments` | Json? | Ticket comments/updates |
| `attachments` | Json? | File attachments |
| `resolvedAt` | DateTime? | Resolution timestamp |
| `satisfactionRating` | Int? | User rating (1-5) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Client

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `name` | String | Client company name |
| `industry` | String? | Industry type |
| `contactPerson` | String? | Primary contact |
| `email` | String? | Contact email |
| `phone` | String? | Contact phone |
| `address` | String? | Address |
| `contractValue` | Float? | Total contract value |
| `status` | ClientStatus | active/inactive/prospective |
| `startDate` | DateTime? | Contract start |
| `endDate` | DateTime? | Contract end |
| `notes` | String? | Additional notes |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Vendor

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `name` | String | Vendor company name |
| `category` | String? | Vendor category |
| `contactPerson` | String? | Primary contact |
| `email` | String? | Contact email |
| `phone` | String? | Contact phone |
| `address` | String? | Address |
| `contractValue` | Float? | Contract value |
| `status` | VendorStatus | active/inactive/blacklisted |
| `rating` | Float? | Vendor rating (1-5) |
| `contractStart` | DateTime? | Contract start |
| `contractEnd` | DateTime? | Contract end |
| `notes` | String? | Additional notes |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### WorkflowDefinition

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `name` | String | Workflow name |
| `description` | String? | Workflow description |
| `type` | WorkflowType | approval/request/notification/custom |
| `steps` | Json | Workflow step definitions |
| `status` | WorkflowStatus | active/inactive/draft |
| `createdById` | String | FK → User |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### WorkflowInstance

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `workflowDefinitionId` | String | FK → WorkflowDefinition |
| `initiatedById` | String | FK → User |
| `entityType` | String | Related entity type |
| `entityId` | String | Related entity ID |
| `currentStep` | Int | Current step number |
| `status` | InstanceStatus | pending/in_progress/completed/rejected/cancelled |
| `stepHistory` | Json | Step completion history |
| `completedAt` | DateTime? | Completion timestamp |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### Survey

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `title` | String | Survey title |
| `description` | String? | Survey description |
| `questions` | Json | Survey questions |
| `status` | SurveyStatus | draft/active/closed |
| `targetAudience` | Json? | Who should take the survey |
| `responses` | Json? | Submitted responses |
| `createdById` | String | FK → User |
| `startDate` | DateTime? | Survey start date |
| `endDate` | DateTime? | Survey end date |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### AuditLog

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `userId` | String? | FK → User |
| `action` | String | CREATE/UPDATE/DELETE/LOGIN/LOGOUT |
| `entity` | String | Entity type (Employee, Leave, etc.) |
| `entityId` | String? | Entity ID |
| `changes` | Json? | Before/after values |
| `ipAddress` | String? | Client IP address |
| `userAgent` | String? | Client user agent |
| `timestamp` | DateTime | Action timestamp |

---

### Notification

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `userId` | String | FK → User (recipient) |
| `title` | String | Notification title |
| `message` | String | Notification body |
| `type` | NotificationType | leave/approval/system/ticket/payroll/reminder |
| `read` | Boolean | Read status |
| `link` | String? | Deep link to related page |
| `metadata` | Json? | Additional data |
| `createdAt` | DateTime | Creation timestamp |

---

### Shift

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `name` | String | Shift name |
| `startTime` | String | Start time (HH:mm) |
| `endTime` | String | End time (HH:mm) |
| `breakDuration` | Int? | Break in minutes |
| `days` | Json | Working days array |
| `employees` | Json? | Assigned employee IDs |
| `isActive` | Boolean | Active status |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

### OnboardingTask

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `companyId` | String | FK → Company |
| `employeeId` | String | FK → Employee (new hire) |
| `title` | String | Task title |
| `description` | String? | Task description |
| `category` | OnboardingCategory | it/hr/facilities/finance/other |
| `assignee` | String? | Assignee (department or person) |
| `dueDate` | DateTime? | Due date |
| `status` | OnboardingStatus | pending/in_progress/completed/skipped |
| `completedAt` | DateTime? | Completion timestamp |
| `notes` | String? | Additional notes |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Update timestamp |

---

## Key Relationships

### Core Relationships

| From | To | Type | Description |
|------|----|------|-------------|
| Company | User | 1:N | A company has many users |
| Company | Employee | 1:N | A company has many employees |
| Company | Department | 1:N | A company has many departments |
| Company | Branch | 1:N | A company has many branches |
| Department | Employee | 1:N | A department has many employees |
| Branch | Employee | 1:N | A branch has many employees |
| Employee | Employee | N:1 | Employee reports to manager |

### HR Process Relationships

| From | To | Type | Description |
|------|----|------|-------------|
| Department | Job | 1:N | A department has many jobs |
| Job | Candidate | 1:N | A job has many candidates |
| Candidate | Interview | 1:N | A candidate has many interviews |
| Employee | Attendance | 1:N | Employee has attendance records |
| Employee | Leave | 1:N | Employee has leave requests |
| Employee | Payroll | 1:N | Employee has payroll records |
| Employee | Asset | N:M | Employee has/uses assets |
| Employee | TravelRequest | 1:N | Employee has travel requests |
| Employee | Expense | 1:N | Employee has expense claims |
| Employee | Ticket | 1:N | Employee creates tickets |
| Employee | OnboardingTask | 1:N | Employee has onboarding tasks |

### Workflow Relationships

| From | To | Type | Description |
|------|----|------|-------------|
| WorkflowDefinition | WorkflowInstance | 1:N | A definition has many instances |
| User | WorkflowInstance | 1:N | User initiates workflow instances |

---

## Prisma Schema Reference

The Prisma schema is located at `prisma/schema.prisma`. Key configuration:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_URL")
}

// All models use UUID primary keys
// All models include createdAt and updatedAt timestamps
// Soft deletes are implemented via status fields
// JSON fields are used for flexible data (documents, settings, etc.)
```

### Naming Conventions

- **Models**: PascalCase (e.g., `Employee`, `TravelRequest`)
- **Fields**: camelCase (e.g., `firstName`, `departmentId`)
- **Enums**: PascalCase values (e.g., `active`, `on_leave`)
- **Foreign Keys**: Model name + `Id` suffix (e.g., `employeeId`, `companyId`)

### Common Patterns

**Soft Deletes:**
```prisma
model Employee {
  status EmployeeStatus @default(active)
  // Records are never hard-deleted; status changes to 'resigned' or 'terminated'
}
```

**JSON Fields for Flexibility:**
```prisma
model Employee {
  address           Json? // { street, city, state, zip, country }
  emergencyContact  Json? // { name, relationship, phone }
  bankDetails       Json? // { bankName, accountNumber, ifscCode }
  documents         Json? // [{ type, url, uploadedAt }]
}
```

**Multi-Tenancy:**
```prisma
model Employee {
  companyId String  // Every record belongs to a company
  company   Company @relation(fields: [companyId], references: [id])
}
```

---

*See also: [API Reference](API-Reference), [System Architecture](System-Architecture), [Getting Started](Getting-Started)*
