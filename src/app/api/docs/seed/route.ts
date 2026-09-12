import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can seed documentation' }, { status: 403, headers: corsHeaders() });
    }

    // Create categories
    const categories = [
      { name: 'Technical Documentation', slug: 'technical', description: 'System architecture, APIs, and technical specifications', icon: 'FiCode', color: 'blue', sortOrder: 1 },
      { name: 'Functional Documentation', slug: 'functional', description: 'Feature guides, user manuals, and functional specifications', icon: 'FiFileText', color: 'green', sortOrder: 2 },
      { name: 'Workflow Documentation', slug: 'workflows', description: 'Process flows, approval workflows, and business rules', icon: 'FiGitBranch', color: 'indigo', sortOrder: 3 },
      { name: 'Security Documentation', slug: 'security', description: 'Security policies, data protection, and compliance', icon: 'FiShield', color: 'red', sortOrder: 4 },
      { name: 'AI Documentation', slug: 'ai', description: 'AI features, model configuration, and intelligent automation', icon: 'FiZap', color: 'purple', sortOrder: 5 },
      { name: 'SOP Documents', slug: 'sop', description: 'Standard operating procedures and process guidelines', icon: 'FiClipboard', color: 'amber', sortOrder: 6 },
      { name: 'Training & Videos', slug: 'training', description: 'Training materials, video tutorials, and onboarding guides', icon: 'FiPlay', color: 'teal', sortOrder: 7 },
    ];

    const createdCategories: Record<string, string> = {};
    for (const cat of categories) {
      const existing = await db.docCategory.findUnique({ where: { slug: cat.slug } });
      if (existing) {
        createdCategories[cat.slug] = existing.id;
      } else {
        const created = await db.docCategory.create({ data: cat });
        createdCategories[cat.slug] = created.id;
      }
    }

    // Create articles
    const articles = [
      // Technical Documentation
      {
        categoryId: createdCategories['technical'],
        title: '3Boxes HRMS System Architecture',
        slug: 'system-architecture',
        summary: 'Comprehensive overview of the 3Boxes HRMS system architecture, including microservices design, database schema, and deployment strategy.',
        content: `# 3Boxes HRMS System Architecture

## Overview

3Boxes HRMS is built on a modern, cloud-native architecture designed for scalability, security, and multi-tenancy. The system follows a microservices-inspired design pattern with a Next.js monorepo structure that enables rapid feature development while maintaining clean separation of concerns.

## Architecture Principles

- **Multi-tenant by Design**: Every data model includes tenant isolation at the database level, ensuring complete data segregation between organizations.
- **API-First**: All functionality is exposed through RESTful APIs, enabling seamless integration with third-party systems.
- **Serverless-Ready**: Built for Vercel deployment with serverless functions, ensuring auto-scaling and cost efficiency.
- **Real-time Capable**: WebSocket support for live notifications, chat, and collaborative features.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 + React 19 | Server-side rendering and client interactivity |
| Styling | Tailwind CSS 4 | Utility-first styling with design tokens |
| State | Zustand + TanStack Query | Client and server state management |
| API | Next.js Route Handlers | RESTful API endpoints |
| Database | PostgreSQL (Neon) | Serverless PostgreSQL with connection pooling |
| ORM | Prisma 7.8 | Type-safe database access |
| Auth | JWT (jose) | Token-based authentication |
| AI | OpenAI / Custom Models | AI interview, chatbot, copilot |

## Database Design

The 3Boxes HRMS database follows a hierarchical multi-tenant model:

1. **Tenant** → Top-level organization
2. **Company Group** → Group of companies under a tenant
3. **Company** → Individual company
4. **Branch** → Physical locations
5. **Department** → Functional units
6. **Employee** → Individual employees

This hierarchy enables granular data access control and reporting at every organizational level.

## API Structure

All API endpoints follow the pattern \`/api/{module}/{resource}/{id}\` with:

- JWT authentication via Authorization header
- Role-based access control at the route level
- CORS support for cross-origin requests
- Standardized error responses

## Deployment Architecture

3Boxes HRMS is deployed on Vercel with:
- Edge functions for authentication middleware
- Serverless functions for API routes
- Neon PostgreSQL for serverless database
- CDN for static assets and images
- WebSocket support through mini-services

## Security Layers

1. **Network**: HTTPS everywhere, VPC isolation
2. **Application**: JWT authentication, RBAC, CSRF protection
3. **Data**: Encryption at rest, tenant isolation, audit logging
4. **API**: Rate limiting, input validation, SQL injection prevention via Prisma

This architecture ensures 3Boxes HRMS can handle organizations ranging from small businesses to large enterprises with thousands of employees.`,
        docType: 'technical',
        moduleKey: 'platform',
        tags: 'architecture,system,infrastructure,deployment',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['technical'],
        title: 'Employee Module — Technical Guide',
        slug: 'employee-module-technical',
        summary: 'Deep dive into the Employee module database schema, API endpoints, and integration patterns for developers.',
        content: `# Employee Module — Technical Guide

## Overview

The Employee module is the core data entity in 3Boxes HRMS. Almost every other module references employees, making it the central hub of the system. This guide covers the technical implementation details for developers building on or integrating with the Employee module.

## Database Schema

The Employee model includes comprehensive fields organized into logical groups:

### Personal Information
- **firstName, lastName**: Required string fields
- **email**: Unique identifier used for user linking
- **phone, avatar, gender, maritalStatus**: Optional demographic fields
- **dateOfBirth, nationality, bloodGroup**: Additional personal data

### Organizational Structure
- **departmentId**: Foreign key to Department (required)
- **designationId**: Foreign key to Designation (required)
- **branchId**: Foreign key to Branch (optional)
- **companyId**: Denormalized for faster queries

### Employment Details
- **dateOfJoining**: Required employment start date
- **status**: Enum (active, on_leave, terminated, resigned)
- **employeeId**: Auto-generated unique identifier

### Financial Information
- **salary**: Current salary amount
- **salaryCurrency**: Default USD
- **bankName, bankAccountNo, bankIfscCode**: Banking details
- **panNumber, aadhaarNumber, taxId**: Tax identification

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/employees | List all employees (filtered by role) |
| GET | /api/employees/:id | Get single employee with relations |
| POST | /api/employees | Create new employee |
| PUT | /api/employees/:id | Update employee |
| DELETE | /api/employees/:id | Soft-delete employee |

## User-Employee Linking

Employees can be linked to User accounts via the \`userId\` field. This creates a one-to-one relationship enabling:
- Authentication and authorization
- Personalized dashboard views
- Activity tracking and audit logs

## Common Integration Patterns

1. **Payroll Integration**: Employee.salary and bank details feed into payroll calculations
2. **Leave Management**: Leave balances are tracked per employee
3. **Attendance**: Daily attendance records reference employees
4. **Performance**: Reviews and goals are employee-centric
5. **Asset Management**: Asset assignments track which employee holds what

## Best Practices

- Always use Prisma's include for eager loading related data
- Use transactions when updating employee records that affect multiple tables
- Validate employeeId uniqueness before creation
- Respect tenant isolation when querying across companies`,
        docType: 'technical',
        moduleKey: 'employees',
        tags: 'employee,database,schema,api,integration',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['technical'],
        title: 'API Authentication & Authorization',
        slug: 'api-auth-technical',
        summary: 'Technical reference for JWT-based authentication, token management, and role-based access control in 3Boxes HRMS APIs.',
        content: `# API Authentication & Authorization

## Authentication Flow

3Boxes HRMS uses JWT (JSON Web Tokens) for stateless authentication. The flow works as follows:

1. **Login**: User submits email/password to \`/api/auth/login\`
2. **Token Generation**: Server validates credentials and returns a JWT
3. **Token Usage**: Client includes token in Authorization header for all API requests
4. **Token Verification**: Server middleware verifies token on every request
5. **Token Expiry**: Tokens expire after 24 hours; client must re-authenticate

## JWT Token Structure

The JWT payload contains:
\`\`\`json
{
  "userId": "clxxx...",
  "email": "user@example.com",
  "role": "hr_admin",
  "tenantId": "clxxx...",
  "iat": 1234567890,
  "exp": 1234654290
}
\`\`\`

## Token Storage

- **Client-side**: Stored in localStorage as \`tb_token\`
- **Alternative**: Can be sent via cookies for SSR support
- **Headers**: Sent as \`Authorization: Bearer <token>\`

## Role-Based Access Control (RBAC)

3Boxes HRMS implements five role levels:

| Role | Level | Access Scope |
|------|-------|-------------|
| super_admin | 5 | Full platform access, all tenants |
| tenant_admin | 4 | Full tenant access, all companies |
| hr_admin | 3 | HR module access, company-scoped |
| manager | 2 | Team-level access, reports |
| employee | 1 | Self-service, limited views |

## Implementation Pattern

Every API route follows this pattern:

\`\`\`typescript
const token = getTokenFromHeaders(request);
if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
const payload = await verifyToken(token);
if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });
const user = await db.user.findUnique({ where: { id: payload.userId } });
\`\`\`

## Special Access Rules

Some resources use additional access control via the DocAccessRule model, which allows:
- Role-based restrictions (e.g., document only visible to hr_admin and above)
- User-specific grants (e.g., a specific employee given access to a document)
- Access type differentiation (read, edit, manage)

## Security Considerations

- JWT_SECRET must be at least 32 characters
- Tokens are signed with HS256 algorithm
- Password hashing uses bcrypt with 12 salt rounds
- Failed login attempts are logged in LoginActivity
- All sensitive operations create AuditLog entries`,
        docType: 'technical',
        moduleKey: 'auth',
        tags: 'authentication,jwt,authorization,rbac,security',
        status: 'published',
        sortOrder: 3,
      },

      // Functional Documentation
      {
        categoryId: createdCategories['functional'],
        title: 'Recruitment Module — User Guide',
        slug: 'recruitment-user-guide',
        summary: 'Complete guide to using the Recruitment module for job postings, applicant tracking, and offer management.',
        content: `# Recruitment Module — User Guide

## Overview

The Recruitment module in 3Boxes HRMS provides a comprehensive suite of tools for managing the entire hiring lifecycle — from job requisition to offer acceptance. This guide walks you through each feature and best practices.

## Key Features

### 1. Job Requisitions
Create and manage manpower requisitions that flow through an approval workflow before becoming job postings. Requisitions capture:
- Position details and department
- Required qualifications and experience
- Salary range and budget
- Urgency and justification

### 2. Job Postings
Convert approved requisitions into public job postings with:
- Custom job descriptions using rich text
- Location and employment type settings
- Application deadline management
- Vacancy tracking

### 3. Applicant Tracking
Manage candidates through a structured pipeline:
- **Applied** → Initial application received
- **Screening** → Resume review and shortlisting
- **Interview** → Scheduled and completed interviews
- **Offered** → Offer letter extended
- **Hired** → Candidate accepted and onboarded
- **Rejected** → Candidate not selected

### 4. AI-Powered Interviews
Leverage 3Boxes AI to conduct initial screening interviews:
- Configurable interview questions per role
- Automated scoring and feedback
- Video interview support
- Integration with applicant pipeline

### 5. Offer Management
Generate and track offer letters:
- Template-based offer generation
- Digital signature workflow
- Offer acceptance tracking
- Auto-create employee record on acceptance

## Best Practices

1. **Standardize Job Templates**: Create job description templates for common roles to ensure consistency
2. **Use Scoring Criteria**: Define evaluation criteria before starting interviews
3. **Leverage AI Screening**: Use AI interviews for high-volume positions to save time
4. **Track Source Effectiveness**: Monitor which recruitment sources produce the best candidates
5. **Timely Communication**: Keep candidates informed at every stage to maintain a positive employer brand

## Role Access

| Feature | HR Admin | Manager | Employee |
|---------|----------|---------|----------|
| Create Requisitions | ✓ | ✓ | ✗ |
| Manage Job Postings | ✓ | ✗ | ✗ |
| Review Applications | ✓ | ✓ (team) | ✗ |
| Conduct Interviews | ✓ | ✓ | ✗ |
| Extend Offers | ✓ | ✗ | ✗ |
| View Job Portal | ✓ | ✓ | ✓ |

## Common Workflows

### Standard Hiring Flow
1. Manager raises requisition → HR Admin approves
2. HR creates job posting from requisition
3. Applications received and screened
4. Interviews scheduled (AI + human)
5. Best candidate selected → Offer extended
6. Offer accepted → Auto-create employee → Start onboarding`,
        docType: 'functional',
        moduleKey: 'recruitment',
        tags: 'recruitment,hiring,jobs,applicants,offers',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['functional'],
        title: 'Payroll Processing Guide',
        slug: 'payroll-processing-guide',
        summary: 'Step-by-step guide to processing payroll, managing salary structures, and generating payslips in 3Boxes HRMS.',
        content: `# Payroll Processing Guide

## Overview

The Payroll module automates salary computation, tax deductions, and payslip generation. This guide covers the complete payroll processing workflow from setup to payout.

## Prerequisites

Before processing payroll, ensure:
- Employee salary details are up to date
- Salary structures are configured
- Attendance and leave data is synced
- Tax and deduction rates are current

## Salary Structure Setup

Salary structures define how an employee's CTC is broken down:

### Common Components
- **Basic Salary**: 40-50% of CTC (foundational component)
- **HRA**: House Rent Allowance (40-50% of Basic)
- **DA**: Dearness Allowance (variable)
- **Conveyance**: Transport allowance
- **Medical**: Medical allowance
- **Other Allowances**: Special pay, etc.

### Deductions
- **PF**: Provident Fund (12% of Basic)
- **ESI**: Employee State Insurance (0.75% of Gross)
- **Tax**: Income tax (TDS)
- **Professional Tax**: State-specific
- **Other Deductions**: Loans, advances, etc.

## Processing Payroll

### Step 1: Review Data
Navigate to Payroll → Process Payroll and select the month/year. The system will show:
- Total employees to process
- Employees with data issues
- Previous month comparison

### Step 2: Calculate
Click "Calculate" to run the payroll engine. The system:
- Fetches attendance data for the month
- Applies leave deductions
- Calculates overtime payments
- Computes tax liabilities
- Generates net pay for each employee

### Step 3: Review & Adjust
Review the calculated payroll:
- Check for anomalies (negative pay, unusually high amounts)
- Make manual adjustments if needed
- Add one-time deductions or bonuses
- Verify total payout against budget

### Step 4: Approve
Submit for approval (if workflow is enabled):
- HR Admin reviews and approves
- Finance team gives final approval
- Approval triggers bank file generation

### Step 5: Disburse
Process the payout:
- Generate bank transfer files
- Mark payroll as "Paid"
- Auto-send payslips to employees
- Update employee records

## Payslip Generation

Payslips are auto-generated in PDF format containing:
- Company branding and logo
- Employee details
- Earnings breakdown
- Deductions breakdown
- Net pay amount
- Bank account details (masked)
- Year-to-date summary

## Tax Management

3Boxes HRMS supports:
- **TDS Calculation**: Automated based on tax regime
- **Tax Declarations**: Employee investment declarations
- **Form 16 Generation**: Annual tax statement
- **Tax Reports**: Monthly and annual tax summaries

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Negative net pay | Excess deductions | Review deduction limits |
| Missing attendance | Unsynced data | Run attendance sync first |
| Wrong tax amount | Outdated tax slabs | Update tax configuration |
| Bank file errors | Invalid account numbers | Validate bank details |`,
        docType: 'functional',
        moduleKey: 'payroll',
        tags: 'payroll,salary,payslip,tax,deductions',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['functional'],
        title: 'Leave Management — Complete Guide',
        slug: 'leave-management-guide',
        summary: 'Everything you need to know about configuring leave types, managing leave requests, and tracking leave balances.',
        content: `# Leave Management — Complete Guide

## Overview

The Leave Management module handles all aspects of employee time-off, from configuring leave types to tracking balances and processing requests through approval workflows.

## Leave Type Configuration

### Creating Leave Types
Each leave type has configurable parameters:

- **Name & Code**: E.g., "Casual Leave" / "CL"
- **Default Days**: Annual entitlement (e.g., 12 days)
- **Paid/Unpaid**: Whether salary is deducted
- **Carry Forward**: Allow unused leave to roll over
- **Max Carry Forward**: Cap on carried-over days
- **Status**: Active/Inactive

### Common Leave Types
| Type | Code | Default Days | Paid | Carry Forward |
|------|------|-------------|------|---------------|
| Casual Leave | CL | 12 | Yes | No |
| Sick Leave | SL | 10 | Yes | No |
| Earned Leave | EL | 15 | Yes | Yes (5 max) |
| Maternity Leave | ML | 180 | Yes | No |
| Paternity Leave | PL | 15 | Yes | No |
| Loss of Pay | LOP | 0 | No | N/A |

## Leave Balance Tracking

Leave balances are tracked per employee, per leave type, per year:
- **Total**: Opening balance + annual accrual
- **Used**: Approved leave days consumed
- **Remaining**: Total - Used
- **Carry Forward**: From previous year

## Request Workflow

1. **Employee submits** leave request with:
   - Leave type
   - Start and end dates
   - Reason (optional)
   - Half-day option

2. **Manager reviews** and can:
   - Approve: Leave is granted, balance deducted
   - Reject: With comments, employee notified
   - Request info: Ask for more details

3. **HR Admin** can override any decision

## Calendar Integration

The leave calendar shows:
- Company holidays (imported automatically)
- Team members on leave (for planning)
- Overlap detection (prevents team shortages)
- Color coding by leave type

## Reports

- **Leave Balance Report**: Current balances for all employees
- **Leave Trend Report**: Usage patterns over time
- **Absence Report**: Frequency and duration analysis
- **Department-wise Report**: Team absence patterns

## Best Practices

1. **Configure at Start**: Set up all leave types before employee onboarding
2. **Regular Balance Reviews**: Run monthly reports to ensure accuracy
3. **Holiday Calendar First**: Import holidays before leave processing
4. **Encourage Advance Requests**: Reduce last-minute approvals
5. **Monitor Patterns**: Watch for unusual leave patterns that may indicate issues`,
        docType: 'functional',
        moduleKey: 'leave',
        tags: 'leave,time-off,balance,approval,holidays',
        status: 'published',
        sortOrder: 3,
      },

      // Workflow Documentation
      {
        categoryId: createdCategories['workflows'],
        title: 'Recruitment Workflow Guide',
        slug: 'recruitment-workflow',
        summary: 'Detailed workflow documentation for the recruitment process from requisition to onboarding.',
        content: `# Recruitment Workflow Guide

## Overview

This document outlines the standard recruitment workflow in 3Boxes HRMS, defining each stage, decision point, and role responsibility.

## Workflow Stages

### Stage 1: Requisition
\`\`\`
Manager → Creates Requisition → HR Admin Reviews → Approve/Reject
\`\`\`

**Trigger**: Department head identifies staffing need
**Actions**:
- Fill requisition form with position details
- Specify urgency, budget, and justification
- Submit for HR approval

**Approval Rules**:
- Standard positions: HR Admin approval only
- Senior positions: HR Admin + Tenant Admin
- C-Suite: Super Admin approval required

### Stage 2: Job Posting
\`\`\`
HR Admin → Creates Job Posting → Publishes to Portal → Applications Flow In
\`\`\`

**Actions**:
- Convert approved requisition to job posting
- Set application deadline
- Configure screening criteria
- Publish to job portal

### Stage 3: Screening
\`\`\`
Applications → Auto-screen (AI) → Shortlist → HR Review
\`\`\`

**Automated Screening**:
- Resume parsing and keyword matching
- Experience and qualification validation
- AI-generated candidate scores

**Manual Review**:
- HR reviews shortlisted candidates
- Assigns ratings and notes
- Advances or rejects candidates

### Stage 4: Interview
\`\`\`
HR → Schedules Interview → Interviewer Conducts → Feedback Submitted → Decision
\`\`\`

**Interview Types**:
1. AI Interview (automated screening)
2. Technical Interview
3. HR Interview
4. Managerial Interview
5. Final Interview

**Feedback Requirements**:
- Score (1-10)
- Written feedback
- Recommendation (Proceed/Reject/Hold)

### Stage 5: Offer
\`\`\`
HR → Generates Offer → Candidate Reviews → Accept/Reject/Negotiate
\`\`\`

### Stage 6: Onboarding
\`\`\`
Offer Accepted → Auto-create Employee → Assign Onboarding Tasks → Complete Setup
\`\`\`

## SLA Targets

| Stage | Target Duration | Escalation |
|-------|----------------|------------|
| Requisition Approval | 2 business days | Auto-escalate to next level |
| Job Posting | 1 business day after approval | Notify HR lead |
| Screening | 3 business days | Flag in dashboard |
| Interview Scheduling | 5 business days | Alert HR manager |
| Offer Release | 2 business days after final interview | Escalate to HR head |
| Onboarding Start | On agreed date | Automated checklist |`,
        docType: 'workflow',
        moduleKey: 'recruitment',
        tags: 'recruitment,workflow,approval,hiring,process',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['workflows'],
        title: 'Leave Approval Workflow',
        slug: 'leave-approval-workflow',
        summary: 'Workflow configuration and rules for leave request approval in 3Boxes HRMS.',
        content: `# Leave Approval Workflow

## Overview

The leave approval workflow ensures proper oversight of employee time-off while maintaining efficiency. This document describes the default workflow and customization options.

## Default Workflow

\`\`\`
Employee Submits → Manager Approves/Rejects → HR Notified → Balance Updated
\`\`\`

## Approval Rules

### By Leave Type
| Leave Type | Approval Level | Auto-Approve |
|------------|---------------|-------------|
| Casual Leave | Manager | If balance ≥ requested days |
| Sick Leave | Manager | If ≤ 2 days + medical proof |
| Earned Leave | Manager → HR | Never |
| Maternity Leave | HR Admin | Never |
| Loss of Pay | Manager → HR | Never |

### By Duration
| Duration | Approval Level |
|----------|---------------|
| 1-2 days | Direct Manager |
| 3-5 days | Manager + Skip Manager |
| >5 days | Manager + HR Admin |

## Escalation Rules

- Manager does not act within 24 hours: Auto-escalate to skip manager
- Skip manager does not act within 24 hours: Auto-escalate to HR
- HR does not act within 48 hours: Auto-approve (configurable)

## Conflict Detection

The system automatically checks for:
1. **Team Coverage**: Minimum staffing requirements
2. **Holiday Overlap**: Leave on company holidays
3. **Concurrent Leave**: Multiple team members on same dates
4. **Probation Period**: Leave during probation (restricted)

## Notifications

| Event | Recipient | Channel |
|-------|-----------|---------|
| Leave submitted | Manager | In-app + Email |
| Leave approved | Employee | In-app + Email |
| Leave rejected | Employee | In-app + Email |
| Leave cancelled | Manager | In-app |
| Escalation triggered | Next approver | In-app + Email |
| Balance low (<3 days) | Employee | In-app |

## Customization

HR Admins can configure:
- Custom approval chains per department
- Department-specific leave policies
- Blackout periods (no-leave periods)
- Minimum advance notice requirements
- Document requirements (medical certificates, etc.)`,
        docType: 'workflow',
        moduleKey: 'leave',
        tags: 'leave,workflow,approval,escalation,rules',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['workflows'],
        title: 'Expense Claim Workflow',
        slug: 'expense-claim-workflow',
        summary: 'Complete workflow for submitting, approving, and reimbursing employee expense claims.',
        content: `# Expense Claim Workflow

## Overview

The Expense Claim workflow manages employee reimbursement requests from submission to payout, with proper approval controls and policy enforcement.

## Workflow Stages

### 1. Submission
Employee submits expense claim with:
- Expense category (travel, food, accommodation, etc.)
- Amount and currency
- Date of expense
- Description/purpose
- Receipt attachment (photo or PDF)

### 2. Manager Review
Direct manager reviews the claim:
- Verifies business purpose
- Checks policy compliance
- Validates receipt
- Approves or rejects with comments

### 3. Finance Review
For claims above policy thresholds:
- Finance team validates against budget
- Checks receipt authenticity
- Verifies expense category
- Approves, rejects, or requests more info

### 4. Payment Processing
Approved claims enter the payment queue:
- Added to next payroll cycle (default)
- Or processed as separate reimbursement
- Payment confirmation recorded
- Employee notified

## Policy Thresholds

| Category | Auto-Approve Limit | Manager Limit | Finance Required |
|----------|-------------------|---------------|-----------------|
| Travel | $100 | $500 | >$500 |
| Food | $50 | $200 | >$200 |
| Accommodation | $200 | $800 | >$800 |
| Transport | $30 | $100 | >$100 |
| Medical | $100 | $500 | >$500 |
| Other | $50 | $200 | >$200 |

## Receipt Requirements

- **Under $25**: Receipt optional (description required)
- **$25 - $100**: Receipt recommended
- **Over $100**: Receipt mandatory
- **All travel**: Boarding pass + hotel bill required

## Common Rejection Reasons

1. Missing or invalid receipt
2. Expense not business-related
3. Amount exceeds policy limit
4. Duplicate claim detected
5. Submitted after deadline (30-day window)

## Reports

- **Pending Claims**: Awaiting approval
- **Processing Time**: Average approval duration
- **Category Breakdown**: Expenses by type
- **Policy Violations**: Claims that needed exception approval`,
        docType: 'workflow',
        moduleKey: 'expenses',
        tags: 'expenses,reimbursement,approval,workflow,finance',
        status: 'published',
        sortOrder: 3,
      },

      // Security Documentation
      {
        categoryId: createdCategories['security'],
        title: 'Security & Data Protection Overview',
        slug: 'security-data-protection',
        summary: 'Comprehensive security documentation covering data protection measures, access controls, and compliance standards.',
        content: `# Security & Data Protection Overview

## Security Philosophy

3Boxes HRMS follows a defense-in-depth approach with multiple layers of security to protect sensitive HR data. Every design decision prioritizes data confidentiality, integrity, and availability.

## Data Protection Measures

### Encryption
- **At Rest**: All database data encrypted using AES-256
- **In Transit**: TLS 1.3 for all API communications
- **Sensitive Fields**: PII data (SSN, bank accounts) has additional field-level encryption
- **Backups**: Encrypted before storage, with separate key management

### Access Control
- **Authentication**: JWT tokens with 24-hour expiry
- **Authorization**: Role-Based Access Control (RBAC) with 5 tiers
- **Tenant Isolation**: Database-level tenant separation ensuring zero cross-tenant data leakage
- **API Keys**: Required for all external integrations with rate limiting

### Data Minimization
- Only collect data necessary for HR operations
- Automatic data archival for separated employees
- Configurable data retention policies
- Right to erasure compliance support

## Compliance Standards

### GDPR Compliance
- Data processing consent management
- Data portability (export all employee data)
- Right to be forgotten implementation
- Data breach notification (72-hour window)
- Data Protection Impact Assessment tools

### SOC 2 Type II
- Regular security audits
- Access logging and monitoring
- Incident response procedures
- Change management controls

### ISO 27001 Alignment
- Information Security Management System
- Risk assessment framework
- Security awareness training
- Business continuity planning

## Incident Response

### Severity Levels
| Level | Description | Response Time |
|-------|-------------|--------------|
| P1 - Critical | Data breach, system compromise | 15 minutes |
| P2 - High | Security vulnerability exploited | 1 hour |
| P3 - Medium | Suspicious activity detected | 4 hours |
| P4 - Low | Policy violation, minor issue | 24 hours |

### Response Process
1. **Detect**: Automated monitoring and alerting
2. **Assess**: Severity classification and impact analysis
3. **Contain**: Isolate affected systems
4. **Eradicate**: Remove threat and patch vulnerabilities
5. **Recover**: Restore systems and data
6. **Review**: Post-incident analysis and improvements

## Audit Logging

Every significant action is logged:
- User authentication events
- Data access and modifications
- Configuration changes
- Administrative actions
- Failed access attempts

Logs are immutable, time-stamped, and retained for 7 years.

## Security Best Practices for Users

1. Use strong, unique passwords (minimum 12 characters)
2. Enable two-factor authentication when available
3. Never share login credentials
4. Report suspicious activity immediately
5. Lock screen when stepping away
6. Use secure networks for accessing the system
7. Review your access logs regularly`,
        docType: 'security',
        moduleKey: 'security',
        tags: 'security,data-protection,compliance,GDPR,encryption',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['security'],
        title: 'Role-Based Access Control Reference',
        slug: 'rbac-reference',
        summary: 'Complete reference for the role-based access control system, including permission matrices and role hierarchies.',
        content: `# Role-Based Access Control Reference

## Role Hierarchy

3Boxes HRMS implements a hierarchical RBAC system where higher roles inherit permissions from lower ones:

\`\`\`
super_admin → tenant_admin → hr_admin → manager → employee
\`\`\`

## Role Definitions

### Super Admin
- **Scope**: Platform-wide
- **Responsibilities**: Tenant management, system configuration, AI settings
- **Access**: All modules, all tenants, all data
- **Restrictions**: None (highest privilege)

### Tenant Admin
- **Scope**: Single tenant
- **Responsibilities**: Company management, subscription, user provisioning
- **Access**: All modules within tenant
- **Restrictions**: Cannot access other tenants or platform settings

### HR Admin
- **Scope**: Company/branch level
- **Responsibilities**: Employee management, payroll, recruitment, policies
- **Access**: HR modules, employee data, reports
- **Restrictions**: No platform settings, limited tenant settings

### Manager
- **Scope**: Department/team level
- **Responsibilities**: Team management, leave approvals, performance reviews
- **Access**: Team data, limited employee views, reports
- **Restrictions**: No payroll, limited recruitment, no settings

### Employee
- **Scope**: Self only
- **Responsibilities**: Self-service, leave requests, profile updates
- **Access**: Own data, company announcements, helpdesk
- **Restrictions**: No access to others' data, no admin functions

## Module Permission Matrix

| Module | Super Admin | Tenant Admin | HR Admin | Manager | Employee |
|--------|------------|-------------|----------|---------|----------|
| Dashboard | Full | Full | Full | Team | Self |
| Employees | Full | Full | Full | View | Profile |
| Recruitment | Full | Full | Full | Team | Portal |
| Payroll | Full | Full | Full | ✗ | Payslip |
| Leave | Full | Full | Manage | Approve | Request |
| Attendance | Full | Full | Manage | Team | Self |
| Performance | Full | Full | Full | Team | Self |
| Training | Full | Full | Full | Enroll | Enroll |
| Reports | Full | Full | Full | Team | ✗ |
| Settings | Full | Partial | Limited | ✗ | Profile |
| AI Features | Full | Full | Use | Limited | Chatbot |

## Custom Access Rules

Beyond the standard RBAC, 3Boxes HRMS supports:
- **Document-level access**: Restrict specific documents to certain roles
- **Field-level access**: Hide sensitive fields from specific roles
- **Temporary access**: Grant time-limited elevated permissions
- **Delegated access**: Allow managers to act on behalf of others

## Audit Trail

All access decisions are logged:
- Who accessed what
- When they accessed it
- What action they performed
- Whether access was granted or denied
- The role used for the access decision`,
        docType: 'security',
        moduleKey: 'auth',
        tags: 'rbac,roles,permissions,access-control,security',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['security'],
        title: 'Data Backup & Recovery Procedures',
        slug: 'data-backup-recovery',
        summary: 'Procedures for data backup, disaster recovery, and business continuity in 3Boxes HRMS.',
        content: `# Data Backup & Recovery Procedures

## Backup Strategy

3Boxes HRMS implements a comprehensive backup strategy to ensure data durability and recovery capability.

### Automated Backups

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full Database | Daily | 30 days | Encrypted S3 |
| Incremental | Every 6 hours | 7 days | Encrypted S3 |
| WAL Archives | Continuous | 7 days | Encrypted S3 |
| Configuration | On change | 90 days | Version control |

### Backup Verification
- Automated restore testing: Weekly
- Data integrity checks: Daily
- Point-in-time recovery testing: Monthly

## Recovery Procedures

### Scenario 1: Accidental Data Deletion
1. Identify the scope of deletion (table, records, time)
2. Notify super admin and affected tenant admins
3. Create a point-in-time snapshot before recovery
4. Restore from the most recent backup before deletion
5. Verify data integrity
6. Resume normal operations
**Target RTO**: 4 hours

### Scenario 2: Database Corruption
1. Detect corruption via automated monitoring
2. Alert on-call engineering team
3. Switch to read-only mode to prevent further damage
4. Create forensic snapshot of corrupted state
5. Restore from last known good backup
6. Replay WAL archives to minimize data loss
7. Verify application functionality
8. Resume normal operations
**Target RTO**: 8 hours

### Scenario 3: Regional Outage
1. Automated health check detects outage
2. DNS failover to secondary region
3. Promote secondary database to primary
4. Verify application functionality
5. Communicate status to all users
6. Monitor primary region for recovery
7. Plan failback when primary is healthy
**Target RTO**: 30 minutes

## Business Continuity

### High Availability
- Multi-AZ database deployment
- Auto-scaling API servers
- CDN for static assets
- Health monitoring and auto-restart

### Disaster Recovery
- Cross-region replication
- Documented runbooks for all scenarios
- Quarterly disaster recovery drills
- Communication templates for stakeholders

## Compliance & Retention

- Backup logs retained for 7 years
- All backups encrypted with separate keys
- Access to backup systems restricted to super_admin
- Regular compliance audits of backup procedures`,
        docType: 'security',
        moduleKey: 'platform',
        tags: 'backup,recovery,disaster-recovery,business-continuity',
        status: 'published',
        sortOrder: 3,
      },

      // AI Documentation
      {
        categoryId: createdCategories['ai'],
        title: 'AI Interview — Setup & Configuration',
        slug: 'ai-interview-setup',
        summary: 'Guide to setting up and configuring AI-powered interviews for automated candidate screening.',
        content: `# AI Interview — Setup & Configuration

## Overview

The AI Interview feature in 3Boxes HRMS leverages advanced language models to conduct automated screening interviews. This guide covers setup, configuration, and best practices for getting the most out of AI interviews.

## Prerequisites

- Super Admin or HR Admin access
- At least one job posting created
- AI models configured in the AI Admin Console

## Setup Steps

### 1. Configure AI Models
Navigate to AI Admin Console and configure:
- **Primary Model**: Used for interview conversations (recommended: GPT-4 or equivalent)
- **Evaluation Model**: Used for scoring and feedback
- **Temperature**: 0.7 for natural conversations
- **Max Tokens**: 2048 for responses

### 2. Create Interview Templates
Each template defines:
- **Role/Position**: What role the interview is for
- **Duration**: 15, 30, or 45 minutes
- **Question Categories**: Technical, behavioral, situational
- **Evaluation Criteria**: Scoring rubric
- **Passing Score**: Minimum score to proceed

### 3. Configure Question Bank
Build a question bank organized by:
- **Skill**: Required competencies
- **Difficulty**: Easy, Medium, Hard
- **Type**: Multiple choice, open-ended, coding
- **Time**: Expected answer duration

### 4. Set Up Scoring
Define the scoring model:
- **Technical Accuracy** (0-10): Correctness of technical answers
- **Communication** (0-10): Clarity and articulation
- **Problem Solving** (0-10): Approach to challenges
- **Cultural Fit** (0-10): Alignment with values
- **Overall Score**: Weighted average

## Interview Flow

\`\`\`
Candidate Opens Link → Intro & Instructions → AI Asks Questions → 
Candidate Responds → AI Evaluates → Follow-up Questions → 
Summary & Score → Results Available to HR
\`\`\`

## Best Practices

1. **Start with Structured Questions**: Use a mix of predefined and adaptive questions
2. **Set Realistic Time Limits**: 30 minutes is optimal for most screening interviews
3. **Review AI Feedback**: Always have a human review AI-generated scores before making decisions
4. **Avoid Bias**: Regularly audit AI interview outcomes for demographic bias
5. **Candidate Experience**: Ensure the interface is user-friendly and provides clear instructions
6. **Technical Backup**: Always have a human interviewer available as backup

## Monitoring & Analytics

Track these metrics in the AI Admin Console:
- Interview completion rate
- Average score distribution
- Time per interview
- Candidate feedback ratings
- Correlation with hiring outcomes

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| AI not responding | Model API down | Check API status, switch to backup model |
| Low-quality questions | Poor template config | Refine question bank and evaluation criteria |
| Biased scoring | Training data bias | Audit and recalibrate scoring model |
| Candidate stuck | UI bug | Clear browser cache, try different browser |
| Score not saving | Network timeout | Check API logs, retry interview finalization |`,
        docType: 'ai',
        moduleKey: 'ai-interview',
        tags: 'ai,interview,screening,configuration,hiring',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['ai'],
        title: 'AI Assistant & Chatbot Configuration',
        slug: 'ai-assistant-chatbot',
        summary: 'Configure the AI-powered HR assistant and chatbot for employee self-service and automated HR support.',
        content: `# AI Assistant & Chatbot Configuration

## Overview

The 3Boxes AI Assistant provides 24/7 HR support to employees through an intelligent chatbot interface. It can answer policy questions, guide employees through processes, and escalate complex issues to human agents.

## Features

### Employee Self-Service
- Policy queries ("What is our leave policy?")
- Payroll questions ("When is the next payday?")
- Process guidance ("How do I submit an expense claim?")
- Status checks ("What's my leave balance?")

### HR Admin Capabilities
- Automated FAQ responses
- Ticket creation for complex queries
- Knowledge base integration
- Multi-language support

## Configuration

### 1. Knowledge Base Setup
Feed the AI with your organization's:
- Company policies and handbook
- HR procedures and guidelines
- FAQ documents
- Department-specific rules

### 2. Intent Mapping
Define what the chatbot can handle:
| Intent | Example Query | Response Type |
|--------|--------------|---------------|
| leave_balance | "How many leaves do I have?" | Dynamic data lookup |
| policy_query | "What's the dress code?" | Knowledge base search |
| payroll_date | "When do we get paid?" | System data |
| expense_help | "How to claim expenses?" | Step-by-step guide |
| it_support | "I can't log in" | Create ticket |

### 3. Escalation Rules
Configure when to involve humans:
- **Immediate Escalation**: Grievances, harassment complaints
- **After 2 failed attempts**: Complex policy questions
- **On keyword trigger**: "speak to human", "real person"
- **Sentiment detection**: Frustrated or upset employee

### 4. Response Templates
Customize response formats:
- Greeting and closing messages
- Error and fallback responses
- Escalation notifications
- Follow-up questions

## Chat Log Analytics

Monitor chatbot performance:
- **Resolution Rate**: % of queries resolved without human intervention
- **Average Response Time**: Speed of AI responses
- **Escalation Rate**: % of chats escalated to humans
- **User Satisfaction**: Post-chat feedback scores
- **Common Topics**: Most frequently asked questions

## Privacy & Compliance

- Chat logs are stored securely and encrypted
- Employees can request chat history deletion
- Sensitive data (salary, SSN) is masked in logs
- Admin access to chat logs requires HR Admin role
- Chat data is not used for model training without consent

## Best Practices

1. **Regular Knowledge Updates**: Keep the knowledge base current
2. **Monitor Escalations**: High escalation rates indicate gaps
3. **Test with Real Queries**: Use actual employee questions for testing
4. **Set Expectations**: Clearly indicate when users are chatting with AI
5. **Provide Feedback Mechanism**: Allow employees to rate AI responses
6. **Review Chat Logs Weekly**: Identify training opportunities`,
        docType: 'ai',
        moduleKey: 'ai-assistant',
        tags: 'ai,chatbot,assistant,self-service,configuration',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['ai'],
        title: 'AI Model Configuration Guide',
        slug: 'ai-model-configuration',
        summary: 'Technical guide for configuring and managing AI models in the 3Boxes HRMS AI Admin Console.',
        content: `# AI Model Configuration Guide

## Overview

The AI Admin Console provides centralized management of all AI models used across 3Boxes HRMS features. This guide covers model selection, configuration, and monitoring.

## Available Model Types

| Model Type | Use Case | Recommended Model |
|-----------|----------|------------------|
| Chat Completion | AI Assistant, Chatbot | GPT-4 / Claude 3 |
| Interview | Candidate screening | GPT-4 with custom prompts |
| Resume Parsing | Application screening | Fine-tuned extraction model |
| Sentiment Analysis | Feedback processing | DistilBERT |
| Summarization | Report generation | GPT-3.5 Turbo |

## Configuration Parameters

### General Settings
- **Model Provider**: OpenAI, Anthropic, or custom endpoint
- **API Key**: Encrypted and stored securely
- **Rate Limit**: Requests per minute (default: 60)
- **Timeout**: Maximum wait time (default: 30 seconds)

### Model Parameters
- **Temperature**: Controls randomness (0.0 = deterministic, 1.0 = creative)
  - Interviews: 0.7
  - Policy queries: 0.3
  - Creative tasks: 0.9
- **Max Tokens**: Maximum response length
- **Top P**: Nucleus sampling threshold
- **Frequency Penalty**: Reduce repetition
- **Presence Penalty**: Encourage topic diversity

### Prompt Templates
Each feature uses system prompts that define:
- **Role**: "You are an HR assistant for 3Boxes HRMS..."
- **Context**: Company policies, current data
- **Constraints**: What the AI should NOT do
- **Format**: Expected response structure

## Monitoring Dashboard

Track key metrics:
- **API Calls**: Total requests per day/week/month
- **Token Usage**: Input and output tokens consumed
- **Cost**: Estimated cost per feature
- **Latency**: Average response time
- **Error Rate**: Failed requests percentage
- **Quality Score**: Based on user feedback

## Cost Management

### Optimization Strategies
1. **Caching**: Cache common queries to reduce API calls
2. **Model Selection**: Use lighter models for simple tasks
3. **Token Limits**: Set reasonable max_tokens per use case
4. **Batching**: Group similar requests when possible
5. **Rate Limiting**: Prevent abuse and control costs

### Budget Alerts
Configure alerts when spending reaches:
- 50% of monthly budget → Warning email
- 80% of monthly budget → Reduce rate limits
- 100% of monthly budget → Disable non-essential features

## Security

- API keys are encrypted at rest
- Model outputs are filtered for PII
- No employee data is sent to external APIs without consent
- All AI interactions are logged for audit purposes
- Model access is restricted to authorized features only

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| High latency | Model overload | Switch to lighter model or add retry logic |
| Incoherent responses | Temperature too high | Lower temperature setting |
| Cost spike | Unexpected usage | Review usage logs, adjust rate limits |
| API errors | Invalid key or quota | Verify API key and billing status |
| Biased outputs | Training data bias | Review and adjust system prompts |`,
        docType: 'ai',
        moduleKey: 'ai-admin',
        tags: 'ai,models,configuration,LLM,monitoring',
        status: 'published',
        sortOrder: 3,
      },

      // SOP Documents
      {
        categoryId: createdCategories['sop'],
        title: 'Employee Onboarding SOP',
        slug: 'employee-onboarding-sop',
        summary: 'Standard operating procedure for onboarding new employees, covering IT setup, HR documentation, and first-week activities.',
        content: `# Employee Onboarding SOP

## Purpose

This SOP defines the standard process for onboarding new employees into the organization, ensuring a consistent, professional, and welcoming experience while maintaining compliance with all HR and IT requirements.

## Scope

This procedure applies to all new hires, including full-time employees, part-time employees, and contractors. It covers the period from offer acceptance through the first 90 days.

## Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| HR Admin | Coordinate onboarding, ensure documentation |
| IT Team | Setup accounts, equipment, and access |
| Hiring Manager | Welcome, assign buddy, set expectations |
| New Employee | Complete required documentation and training |
| Finance | Setup payroll and benefits |

## Pre-boarding (Before Day 1)

### Day -5 to Day -1
1. **HR Tasks**:
   - Send welcome email with first-day instructions
   - Prepare employee ID and access badge
   - Create employee record in 3Boxes HRMS
   - Assign onboarding task checklist

2. **IT Tasks**:
   - Create email account and system credentials
   - Configure laptop/desktop with required software
   - Set up VPN and remote access
   - Grant role-appropriate system permissions

3. **Manager Tasks**:
   - Assign onboarding buddy from the team
   - Prepare desk/workspace
   - Schedule first-week meetings
   - Prepare 30-60-90 day plan

## Day 1: Welcome & Setup

### Morning (9:00 - 12:00)
- [ ] Welcome meeting with HR (30 min)
- [ ] Complete all required documentation:
  - NDA and confidentiality agreement
  - Tax forms and banking details
  - Emergency contact information
  - Policy acknowledgment
- [ ] IT orientation: email, intranet, tools (30 min)
- [ ] Office tour and introductions (30 min)

### Afternoon (14:00 - 17:00)
- [ ] Team welcome lunch
- [ ] Meeting with direct manager (1 hour):
  - Role expectations and goals
  - Team structure and communication norms
  - First week schedule review
- [ ] Setup 3Boxes HRMS profile and self-service

## Week 1: Orientation

### Day 2
- [ ] Company culture and values presentation
- [ ] Department overview meeting
- [ ] Begin role-specific training

### Day 3
- [ ] Compliance and safety training
- [ ] Policy review (leave, expenses, code of conduct)
- [ ] Benefits enrollment

### Day 4-5
- [ ] Role-specific tool training
- [ ] Shadow team members
- [ ] Begin assigned onboarding tasks in 3Boxes HRMS

## 30-Day Checkpoint

- Manager 1-on-1 to discuss:
  - Adjustment and integration
  - Training progress
  - Early feedback
  - Any concerns or challenges
- HR check-in for any documentation issues

## 60-Day Checkpoint

- Performance expectations review
- Training completion assessment
- Peer feedback collection
- Goals refinement

## 90-Day Review

- Formal probation review meeting
- Performance against 30-60-90 day plan
- Conversion to permanent status (if applicable)
- Long-term goal setting

## Documentation Checklist

All items must be completed in 3Boxes HRMS:
- [ ] Employment contract signed
- [ ] NDA signed
- [ ] Tax documents submitted
- [ ] Bank details verified
- [ ] Emergency contacts added
- [ ] Policy acknowledgments completed
- [ ] Benefits enrollment confirmed
- [ ] IT equipment receipt signed
- [ ] Training modules completed

## Exception Handling

- **Remote employees**: Adjust for virtual onboarding; ship equipment in advance
- **International hires**: Add visa/work permit verification steps
- **Contractors**: Streamlined onboarding with limited system access
- **Transfers**: Modified process focusing on new role/department`,
        docType: 'sop',
        moduleKey: 'onboarding',
        tags: 'onboarding,SOP,new-hire,checklist,process',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['sop'],
        title: 'Employee Offboarding SOP',
        slug: 'employee-offboarding-sop',
        summary: 'Standard operating procedure for managing employee exits, including clearance, data handover, and account deactivation.',
        content: `# Employee Offboarding SOP

## Purpose

This SOP ensures a smooth, secure, and compliant employee exit process, protecting organizational data and maintaining positive relationships with departing employees.

## Scope

Covers all types of separation: resignation, termination, retirement, and contract end.

## Process Timeline

### Upon Resignation Notice
1. **Immediate Actions** (Day 0):
   - Acknowledge resignation in writing
   - Create separation record in 3Boxes HRMS
   - Notify HR Admin, IT, and Finance
   - Assign clearance checklist

2. **Knowledge Transfer** (Week 1-2):
   - Document current projects and status
   - Identify critical tasks and deadlines
   - Train replacement or team members
   - Transfer key contacts and relationships

3. **HR Processing** (Throughout notice period):
   - Calculate leave encashment
   - Process final payroll adjustments
   - Prepare experience/recommendation letter
   - Schedule exit interview

### Final Week
1. **Clearance Checklist**:
   - [ ] Return all company assets (laptop, badge, keys)
   - [ ] Complete knowledge transfer documentation
   - [ ] Hand over pending work items
   - [ ] Return company credit cards
   - [ ] Clear outstanding expense claims
   - [ ] Return confidential documents

2. **IT Deactivation** (Last working day):
   - [ ] Disable email account (after forwarding setup)
   - [ ] Revoke VPN and system access
   - [ ] Archive mailbox and files
   - [ ] Remove from distribution lists
   - [ ] Disable building access

3. **Finance Processing**:
   - [ ] Process final salary
   - [ ] Calculate FNF settlement
   - [ ] Process leave encashment
   - [ ] Settle outstanding dues
   - [ ] Issue FNF statement

### Last Working Day
- Exit interview with HR
- Return all assets and collect receipt
- Collect experience letter (if applicable)
- Personal belongings checkout
- Formal farewell (optional, team discretion)

## Exit Interview

### Questions to Cover
1. Reason for leaving
2. Experience with the team and management
3. Suggestions for improvement
4. Would they recommend the company?
5. Any unresolved issues?

### Key Metrics to Track
- Turnover rate by department
- Common reasons for leaving
- Average tenure before departure
- Exit interview satisfaction score

## FNF Settlement Timeline

| Item | Deadline |
|------|----------|
| Final salary | Last working day |
| Leave encashment | Within 7 days |
| FNF statement | Within 15 days |
| Full settlement | Within 30 days |

## Data Retention

- Employee records: 7 years after separation
- Payroll records: 7 years
- Attendance records: 3 years
- Email archives: 1 year
- Access logs: 2 years`,
        docType: 'sop',
        moduleKey: 'separation',
        tags: 'offboarding,SOP,separation,clearance,exit',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['sop'],
        title: 'Payroll Processing SOP',
        slug: 'payroll-processing-sop',
        summary: 'Step-by-step SOP for monthly payroll processing including data validation, calculation, approval, and disbursement.',
        content: `# Payroll Processing SOP

## Purpose

This SOP defines the standard monthly payroll processing procedure to ensure accurate, timely, and compliant salary disbursement for all employees.

## Processing Schedule

| Activity | Date | Owner |
|----------|------|-------|
| Attendance freeze | 25th of month | HR Admin |
| Leave data sync | 25th of month | HR Admin |
| Payroll calculation | 26th of month | HR Admin |
| Review & adjustments | 27th of month | HR Admin |
| Approval submission | 28th of month | HR Admin |
| Finance approval | 29th of month | Finance |
| Bank file generation | 30th of month | Finance |
| Salary disbursement | Last working day | Finance |
| Payslip distribution | Last working day | System |

## Step-by-Step Process

### Step 1: Data Preparation (25th)
1. Freeze attendance for the month
2. Verify all leave requests are processed
3. Sync overtime data
4. Import any new joiners
5. Mark separated employees

### Step 2: Payroll Calculation (26th)
1. Navigate to Payroll → Process Payroll
2. Select month and year
3. Click "Calculate All"
4. System automatically:
   - Computes basic, HRA, and allowances
   - Calculates PF, ESI, and TDS
   - Applies leave deductions
   - Adds overtime payments
   - Processes Arrears (if any)

### Step 3: Review (27th)
1. Check summary report:
   - Total payout vs. budget
   - Number of employees processed
   - Exception list (errors, warnings)
2. Review individual exceptions:
   - Negative net pay
   - Unusually high amounts
   - Missing attendance data
3. Make manual adjustments if needed:
   - One-time bonuses
   - Deduction corrections
   - Arrear payments

### Step 4: Approval (28th)
1. Submit payroll for approval
2. HR Admin reviews and approves
3. System sends notification to Finance

### Step 5: Finance Approval & Disbursement (29th-30th)
1. Finance reviews the payroll
2. Verifies bank details
3. Generates bank transfer file
4. Approves disbursement
5. Marks payroll as "Paid" in system

### Step 6: Post-Processing
1. System auto-generates payslips
2. Email notifications sent to employees
3. Payroll reports archived
4. Tax registers updated

## Exception Handling

### New Joiner (Joined after 1st)
- Calculate pro-rata salary based on joining date
- Pro-rate allowances accordingly
- Full month PF/ESI deduction

### Separated Employee
- Calculate up to last working day
- Include leave encashment
- Process FNF separately if applicable
- Pro-rate all components

### Salary Revision (Mid-month)
- Calculate old salary up to revision date
- Calculate new salary from revision date
- Show arrears as separate line item
- Update future months automatically

## Compliance Checklist

- [ ] PF returns filed on time
- [ ] ESI returns submitted
- [ ] TDS deposited by 7th of next month
- [ ] Professional tax paid
- [ ] All statutory registers updated
- [ ] Audit trail preserved

## Reports

After each payroll run, generate:
1. **Payroll Register**: Complete employee-wise breakdown
2. **Bank Advice**: For fund transfer
3. **PF Statement**: Employer and employee contributions
4. **ESI Statement**: Monthly contribution details
5. **TDS Statement**: Tax deducted at source
6. **Reconciliation Report**: Payroll vs. previous month`,
        docType: 'sop',
        moduleKey: 'payroll',
        tags: 'payroll,SOP,processing,monthly,compliance',
        status: 'published',
        sortOrder: 3,
      },

      // Training & Videos
      {
        categoryId: createdCategories['training'],
        title: 'Getting Started — Manager Training',
        slug: 'getting-started-manager-training',
        summary: 'Training module for new managers covering team management, approvals, performance reviews, and reporting.',
        content: `# Getting Started — Manager Training

## Welcome

Congratulations on your new management role! This training module will help you get up to speed with the 3Boxes HRMS tools available to you as a manager.

## Module 1: Dashboard Overview

As a manager, your dashboard shows:
- **Team Overview**: Headcount, attendance summary, leave status
- **Pending Approvals**: Leave requests, expense claims, timesheets
- **Performance Snapshot**: Goal progress, review cycles
- **Quick Actions**: Approve/reject, create requisitions, schedule meetings

### Key Actions
1. **Check Pending Items**: Review dashboard daily for pending approvals
2. **Team Calendar**: View who's in, out, or on leave
3. **Reports**: Access team-level reports for data-driven decisions

## Module 2: Leave Management

### Your Responsibilities
- Review and respond to leave requests within 24 hours
- Ensure team coverage before approving leaves
- Monitor leave patterns for team wellbeing

### How to Approve/Reject Leave
1. Navigate to Leave Management from sidebar
2. Click on pending requests
3. Review leave details, dates, and balance
4. Check team calendar for conflicts
5. Click Approve or Reject with comments

### Tips
- Set up auto-forwarding when you're on leave
- Communicate leave approval decisions promptly
- Use the team calendar to plan coverage

## Module 3: Performance Management

### Setting Goals
1. Navigate to Performance → Goals
2. Create SMART goals for each team member
3. Assign weights and deadlines
4. Review progress monthly

### Conducting Reviews
1. Navigate to Performance → Reviews
2. Select the review cycle
3. Complete the review form:
   - Rate each competency
   - Provide specific examples
   - Set development areas
4. Submit and schedule feedback meeting

### Best Practices
- Give regular feedback, not just during reviews
- Use the 360-degree feedback tool
- Document performance issues early
- Celebrate achievements publicly

## Module 4: Team Reports

### Available Reports
| Report | Description | Frequency |
|--------|-------------|-----------|
| Attendance Summary | Team attendance trends | Weekly |
| Leave Report | Leave usage by member | Monthly |
| Performance Summary | Goal completion rates | Quarterly |
| Training Report | Training completion status | Monthly |

### How to Access
1. Navigate to Reports from sidebar
2. Select the report type
3. Apply filters (date range, team member)
4. Export to PDF or Excel

## Module 5: Communication

### Team Announcements
- Post announcements visible to your team
- Pin important messages
- Track read receipts

### Helpdesk Integration
- Create tickets for IT/HR issues on behalf of team
- Track resolution status
- Escalate when needed

## Assessment

Complete the following to finish your manager training:
1. ✅ Approve/reject 3 sample leave requests
2. ✅ Create a goal for a team member
3. ✅ Generate a team attendance report
4. ✅ Submit a helpdesk ticket

## Support

- **Help**: Click the AI Assistant chatbot for instant answers
- **Documentation**: Visit the Documentation Hub for detailed guides
- **HR Support**: Contact your HR Admin for policy questions
- **IT Support**: Submit a ticket through the Helpdesk module`,
        docType: 'training',
        moduleKey: 'training',
        tags: 'training,manager,onboarding,guide,getting-started',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['training'],
        title: 'HR Admin Training — Complete Course',
        slug: 'hr-admin-training-course',
        summary: 'Comprehensive training course for HR administrators covering all HRMS modules, configuration, and daily operations.',
        content: `# HR Admin Training — Complete Course

## Course Overview

This training course equips HR administrators with the knowledge and skills to effectively manage 3Boxes HRMS. By the end of this course, you'll be proficient in all core HR modules.

## Module 1: Employee Management

### Creating Employees
1. Navigate to Employees → Add Employee
2. Fill in personal details (name, email, phone)
3. Assign organizational structure:
   - Company → Branch → Department → Designation
4. Set joining date and status
5. Configure salary and bank details
6. Link to user account (for login access)
7. Review and save

### Managing Employee Records
- Update personal information
- Transfer between departments
- Promote and change designation
- Manage document uploads
- Track employee lifecycle

## Module 2: Recruitment

### Job Postings
1. Create from approved requisition
2. Set position details and requirements
3. Configure application settings
4. Publish to job portal
5. Monitor applications

### Application Management
- Screen and rate applications
- Schedule interviews
- Record interview feedback
- Process offer letters
- Auto-onboard accepted candidates

## Module 3: Attendance & Leave

### Attendance Configuration
- Set up shifts and schedules
- Configure grace periods
- Set up holidays calendar
- Manage overtime rules

### Leave Management
- Configure leave types and policies
- Process leave requests
- Handle escalations
- Generate leave reports

## Module 4: Payroll

### Setup
1. Configure salary structures
2. Set up tax slabs
3. Define PF/ESI rates
4. Create allowance templates

### Processing
- Follow the Payroll Processing SOP
- Validate data before calculation
- Review and adjust
- Submit for approval
- Disburse and distribute payslips

## Module 5: Performance Management

### Review Cycles
1. Create review cycle
2. Assign reviewers
3. Configure rating scales
4. Set deadlines
5. Monitor completion

### Goal Management
- Create organizational goals
- Cascade to departments and individuals
- Track progress
- Conduct review meetings

## Module 6: Reports & Analytics

### Key Reports
- Headcount report
- Attrition analysis
- Salary band analysis
- Leave utilization
- Training completion
- Diversity metrics

### Custom Reports
- Use the report builder
- Apply filters and groupings
- Schedule automated reports
- Export in multiple formats

## Module 7: System Administration

### User Management
- Create user accounts
- Assign roles and permissions
- Manage access levels
- Monitor login activity

### Configuration
- Company and branch settings
- Department structure
- Policy documents
- Notification templates
- Workflow configurations

## Assessment Checklist

Complete all items to earn your HR Admin certification:
1. ✅ Create an employee record end-to-end
2. ✅ Process a leave request approval
3. ✅ Run payroll for a test month
4. ✅ Create and publish a job posting
5. ✅ Generate a custom report
6. ✅ Configure a leave type
7. ✅ Submit a helpdesk ticket
8. ✅ Set up a performance review cycle

## Continuing Education

- Monthly webinars on new features
- Quarterly best practices workshops
- Annual HRMS certification renewal
- Community forum for peer learning`,
        docType: 'training',
        moduleKey: 'training',
        tags: 'training,hr-admin,course,comprehensive,certification',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['training'],
        title: 'Employee Self-Service Training',
        slug: 'employee-self-service-training',
        summary: 'Training guide for employees on using 3Boxes HRMS self-service features including profile, leave, attendance, and more.',
        content: `# Employee Self-Service Training

## Welcome to 3Boxes HRMS

3Boxes HRMS gives you easy access to manage your employment information, request time off, view payslips, and more — all from a single, intuitive interface.

## Getting Started

### Logging In
1. Visit your company's 3Boxes HRMS URL
2. Enter your email and password
3. You'll see your personalized dashboard

### Your Dashboard
The dashboard shows:
- **Quick Stats**: Leave balance, attendance today
- **Announcements**: Latest company news
- **Pending Items**: Tasks that need your attention
- **Upcoming**: Holidays, birthdays, events

## Profile Management

### Viewing Your Profile
Navigate to your profile to see:
- Personal information
- Employment details
- Salary information (summary)
- Documents

### Updating Information
You can update:
- Contact number and address
- Emergency contacts
- Bank details (with approval)
- Profile photo

## Leave Management

### Applying for Leave
1. Click "Leave Management" in sidebar
2. Click "Apply Leave"
3. Select leave type
4. Choose start and end dates
5. Add a reason (optional)
6. Toggle half-day if applicable
7. Submit

### Checking Leave Balance
Your leave dashboard shows:
- Total days available per type
- Days used this year
- Days remaining
- Pending requests

### Cancelling Leave
You can cancel approved leave requests:
1. Go to "My Leave Requests"
2. Find the request
3. Click "Cancel"
4. Your manager will be notified

## Attendance

### Marking Attendance
If your company uses 3Boxes HRMS for attendance:
1. Click "Attendance" in sidebar
2. Click "Check In" when you start work
3. Click "Check Out" when you leave
4. Your work hours are auto-calculated

### Regularization
If you forgot to check in/out:
1. Go to Attendance → Regularization
2. Select the date
3. Enter the correct time
4. Submit for manager approval

## Payslips

### Viewing Payslips
1. Navigate to Payroll section
2. Click on any month to view payslip
3. Download as PDF for your records

### Understanding Your Payslip
- **Earnings**: Basic, HRA, allowances
- **Deductions**: PF, ESI, TDS, professional tax
- **Net Pay**: What you receive in your bank account

## Expense Claims

### Submitting an Expense
1. Navigate to Expenses
2. Click "New Claim"
3. Select category (travel, food, etc.)
4. Enter amount and date
5. Upload receipt
6. Add description
7. Submit

### Tracking Claims
- View status (Pending/Approved/Rejected/Paid)
- Add comments to rejected claims
- Track payment status

## Training

### Browsing Courses
1. Navigate to Training
2. Browse available courses
3. Filter by category or mode (online/offline)
4. Enroll in relevant courses

### Completing Training
- Access course materials
- Complete assessments
- Track your progress
- Download certificates

## Helpdesk

### Raising a Ticket
1. Navigate to Helpdesk
2. Click "New Ticket"
3. Select category (HR, IT, Payroll)
4. Describe your issue
5. Submit

### AI Assistant
For quick answers, use the AI chatbot:
- Click the chat icon (bottom right)
- Type your question
- Get instant answers 24/7
- Escalate to a human if needed

## Tips & Shortcuts

- Use the search bar to find anything quickly
- Check the notification bell for updates
- Mobile-responsive: access from any device
- Bookmark frequently used pages
- Use keyboard shortcuts (coming soon!)`,
        docType: 'training',
        moduleKey: 'training',
        tags: 'training,employee,self-service,guide,quickstart',
        status: 'published',
        sortOrder: 3,
      },
    ];

    let createdCount = 0;
    for (const article of articles) {
      const existing = await db.docArticle.findUnique({ where: { slug: article.slug } });
      if (!existing) {
        await db.docArticle.create({ data: article });
        createdCount++;
      }
    }

    // Create access rules for some restricted articles
    const restrictedArticles = [
      { slug: 'employee-module-technical', roles: ['tenant_admin', 'super_admin'] },
      { slug: 'rbac-reference', roles: ['tenant_admin', 'super_admin'] },
      { slug: 'data-backup-recovery', roles: ['super_admin'] },
      { slug: 'ai-interview-setup', roles: ['tenant_admin', 'super_admin'] },
      { slug: 'ai-assistant-chatbot', roles: ['tenant_admin', 'super_admin'] },
      { slug: 'getting-started-manager-training', roles: ['manager', 'tenant_admin', 'super_admin'] },
    ];

    let rulesCreated = 0;
    for (const restricted of restrictedArticles) {
      const article = await db.docArticle.findUnique({ where: { slug: restricted.slug } });
      if (article) {
        for (const role of restricted.roles) {
          const existing = await db.docAccessRule.findFirst({
            where: { articleId: article.id, role },
          });
          if (!existing) {
            await db.docAccessRule.create({
              data: {
                articleId: article.id,
                role,
                accessType: 'read',
                grantedBy: user.id,
              },
            });
            rulesCreated++;
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Documentation seeded successfully',
      categories: Object.keys(createdCategories).length,
      articlesCreated: createdCount,
      accessRulesCreated: rulesCreated,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error seeding documentation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
