import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// GET: Check if docs hub is initialized; auto-initialize if not
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // Check if tables exist and have data
    let categoryCount = 0;
    let articleCount = 0;
    let needsMigration = false;

    try {
      categoryCount = await db.docCategory.count();
      articleCount = await db.docArticle.count();
    } catch (err) {
      // Tables don't exist - need migration
      needsMigration = true;
      const errorMsg = err instanceof Error ? err.message : '';
      console.log('Doc tables not found, will attempt migration:', errorMsg);
    }

    if (!needsMigration && categoryCount > 0) {
      return NextResponse.json({
        initialized: true,
        categories: categoryCount,
        articles: articleCount,
      }, { headers: corsHeaders() });
    }

    // Only super_admin can auto-initialize
    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({
        initialized: false,
        needsMigration,
        message: 'Documentation hub needs initialization. Please contact a Super Admin.',
      }, { headers: corsHeaders() });
    }

    // Step 1: Migrate tables if needed
    if (needsMigration) {
      try {
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DocCategory" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "description" TEXT,
            "icon" TEXT NOT NULL DEFAULT 'FiBookOpen',
            "color" TEXT NOT NULL DEFAULT 'blue',
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'active',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "DocCategory_slug_key" UNIQUE ("slug")
          );
        `);

        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DocArticle" (
            "id" TEXT NOT NULL,
            "categoryId" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "summary" TEXT,
            "content" TEXT NOT NULL DEFAULT '',
            "docType" TEXT NOT NULL DEFAULT 'functional',
            "moduleKey" TEXT,
            "tags" TEXT,
            "version" TEXT NOT NULL DEFAULT '1.0',
            "status" TEXT NOT NULL DEFAULT 'draft',
            "authorId" TEXT,
            "viewCount" INTEGER NOT NULL DEFAULT 0,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "DocArticle_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "DocArticle_slug_key" UNIQUE ("slug"),
            CONSTRAINT "DocArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);

        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocArticle_categoryId_idx" ON "DocArticle"("categoryId");
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocArticle_docType_idx" ON "DocArticle"("docType");
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocArticle_moduleKey_idx" ON "DocArticle"("moduleKey");
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocArticle_status_idx" ON "DocArticle"("status");
        `);

        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DocAccessRule" (
            "id" TEXT NOT NULL,
            "articleId" TEXT NOT NULL,
            "role" TEXT,
            "userId" TEXT,
            "accessType" TEXT NOT NULL DEFAULT 'read',
            "grantedBy" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "DocAccessRule_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "DocAccessRule_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "DocArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);

        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocAccessRule_articleId_idx" ON "DocAccessRule"("articleId");
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocAccessRule_role_idx" ON "DocAccessRule"("role");
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "DocAccessRule_userId_idx" ON "DocAccessRule"("userId");
        `);

        console.log('Doc tables created successfully');
      } catch (migrationErr) {
        console.error('Migration error:', migrationErr);
        // Tables might already exist from Prisma, continue to seed
      }
    }

    // Step 2: Check if we need to seed (might already have categories from a previous seed)
    const existingCount = await db.docCategory.count();
    if (existingCount > 0) {
      return NextResponse.json({
        initialized: true,
        categories: await db.docCategory.count(),
        articles: await db.docArticle.count(),
        migrated: needsMigration,
      }, { headers: corsHeaders() });
    }

    // Step 3: Seed data
    // Need to disconnect and reconnect to pick up new tables
    // Actually, since we're using Prisma client with the models defined in schema, it should work

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

    const articles = [
      // Technical Documentation
      {
        categoryId: createdCategories['technical'],
        title: '3Boxes HRMS System Architecture',
        slug: 'system-architecture',
        summary: 'Comprehensive overview of the 3Boxes HRMS system architecture, including microservices design, database schema, and deployment strategy.',
        content: `# 3Boxes HRMS System Architecture\n\n## Overview\n\n3Boxes HRMS is built on a modern, cloud-native architecture designed for scalability, security, and multi-tenancy. The system follows a microservices-inspired design pattern with a Next.js monorepo structure that enables rapid feature development while maintaining clean separation of concerns.\n\n## Architecture Principles\n\n- **Multi-tenant by Design**: Every data model includes tenant isolation at the database level, ensuring complete data segregation between organizations.\n- **API-First**: All functionality is exposed through RESTful APIs, enabling seamless integration with third-party systems.\n- **Serverless-Ready**: Built for Vercel deployment with serverless functions, ensuring auto-scaling and cost efficiency.\n- **Real-time Capable**: WebSocket support for live notifications, chat, and collaborative features.\n\n## Technology Stack\n\n| Layer | Technology | Purpose |\n|-------|-----------|----------|\n| Frontend | Next.js 16 + React 19 | Server-side rendering and client interactivity |\n| Styling | Tailwind CSS 4 | Utility-first styling with design tokens |\n| State | Zustand + TanStack Query | Client and server state management |\n| API | Next.js Route Handlers | RESTful API endpoints |\n| Database | PostgreSQL (Neon) | Serverless PostgreSQL with connection pooling |\n| ORM | Prisma 7.8 | Type-safe database access |\n| Auth | JWT (jose) | Token-based authentication |\n| AI | OpenAI / Custom Models | AI interview, chatbot, copilot |\n\n## Database Design\n\nThe 3Boxes HRMS database follows a hierarchical multi-tenant model:\n\n1. **Tenant** - Top-level organization\n2. **Company Group** - Group of companies under a tenant\n3. **Company** - Individual company\n4. **Branch** - Physical locations\n5. **Department** - Functional units\n6. **Employee** - Individual employees\n\nThis hierarchy enables granular data access control and reporting at every organizational level.\n\n## Deployment Architecture\n\n3Boxes HRMS is deployed on Vercel with:\n- Edge functions for authentication middleware\n- Serverless functions for API routes\n- Neon PostgreSQL for serverless database\n- CDN for static assets and images\n\n## Security Layers\n\n1. **Network**: HTTPS everywhere, VPC isolation\n2. **Application**: JWT authentication, RBAC, CSRF protection\n3. **Data**: Encryption at rest, tenant isolation, audit logging\n4. **API**: Rate limiting, input validation, SQL injection prevention via Prisma`,
        docType: 'technical',
        moduleKey: 'platform',
        tags: 'architecture,system,infrastructure,deployment',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['technical'],
        title: 'Employee Module - Technical Guide',
        slug: 'employee-module-technical',
        summary: 'Deep dive into the Employee module database schema, API endpoints, and integration patterns for developers.',
        content: `# Employee Module - Technical Guide\n\n## Overview\n\nThe Employee module is the core data entity in 3Boxes HRMS. Almost every other module references employees, making it the central hub of the system.\n\n## Database Schema\n\nThe Employee model includes comprehensive fields organized into logical groups:\n\n### Personal Information\n- firstName, lastName: Required string fields\n- email: Unique identifier used for user linking\n- phone, avatar, gender, maritalStatus: Optional demographic fields\n- dateOfBirth, nationality, bloodGroup: Additional personal data\n\n### Organizational Structure\n- departmentId: Foreign key to Department (required)\n- designationId: Foreign key to Designation (required)\n- branchId: Foreign key to Branch (optional)\n- companyId: Denormalized for faster queries\n\n### Employment Details\n- dateOfJoining: Required employment start date\n- status: Enum (active, on_leave, terminated, resigned)\n- employeeId: Auto-generated unique identifier\n\n### Financial Information\n- salary: Current salary amount\n- salaryCurrency: Default USD\n- bankName, bankAccountNo, bankIfscCode: Banking details\n- panNumber, aadhaarNumber, taxId: Tax identification\n\n## API Endpoints\n\n| Method | Endpoint | Description |\n|--------|----------|-------------|\n| GET | /api/employees | List all employees |\n| GET | /api/employees/:id | Get single employee with relations |\n| POST | /api/employees | Create new employee |\n| PUT | /api/employees/:id | Update employee |\n| DELETE | /api/employees/:id | Soft-delete employee |\n\n## Integration Patterns\n\n1. **Payroll Integration**: Employee.salary and bank details feed into payroll calculations\n2. **Leave Management**: Leave balances are tracked per employee\n3. **Attendance**: Daily attendance records reference employees\n4. **Performance**: Reviews and goals are employee-centric\n5. **Asset Management**: Asset assignments track which employee holds what`,
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
        summary: 'Technical reference for JWT-based authentication, token management, and role-based access control.',
        content: `# API Authentication & Authorization\n\n## Authentication Flow\n\n3Boxes HRMS uses JWT (JSON Web Tokens) for stateless authentication:\n\n1. **Login**: User submits email/password to /api/auth/login\n2. **Token Generation**: Server validates credentials and returns a JWT\n3. **Token Usage**: Client includes token in Authorization header for all API requests\n4. **Token Verification**: Server middleware verifies token on every request\n5. **Token Expiry**: Tokens expire after 24 hours; client must re-authenticate\n\n## Role-Based Access Control (RBAC)\n\n| Role | Level | Access Scope |\n|------|-------|-------------|\n| super_admin | 5 | Full platform access, all tenants |\n| tenant_admin | 4 | Full tenant access, all companies |\n| hr_admin | 3 | HR module access, company-scoped |\n| manager | 2 | Team-level access, reports |\n| employee | 1 | Self-service, limited views |\n\n## Implementation Pattern\n\nEvery API route follows this pattern:\n\n\`\`\`typescript\nconst token = getTokenFromHeaders(request);\nif (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });\nconst payload = await verifyToken(token);\nif (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });\nconst user = await db.user.findUnique({ where: { id: payload.userId } });\n\`\`\`\n\n## Security Considerations\n\n- JWT_SECRET must be at least 32 characters\n- Tokens are signed with HS256 algorithm\n- Password hashing uses bcrypt with 12 salt rounds\n- Failed login attempts are logged\n- All sensitive operations create AuditLog entries`,
        docType: 'technical',
        moduleKey: 'auth',
        tags: 'authentication,jwt,authorization,rbac,security',
        status: 'published',
        sortOrder: 3,
      },
      // Functional Documentation
      {
        categoryId: createdCategories['functional'],
        title: 'Recruitment Module - User Guide',
        slug: 'recruitment-user-guide',
        summary: 'Complete guide to using the Recruitment module for job postings, applicant tracking, and offer management.',
        content: `# Recruitment Module - User Guide\n\n## Overview\n\nThe Recruitment module provides a comprehensive suite of tools for managing the entire hiring lifecycle from job requisition to offer acceptance.\n\n## Key Features\n\n### 1. Job Requisitions\nCreate and manage manpower requisitions that flow through an approval workflow before becoming job postings.\n\n### 2. Job Postings\nConvert approved requisitions into public job postings with custom descriptions, location settings, and deadline management.\n\n### 3. Applicant Tracking\nManage candidates through a structured pipeline:\n- Applied - Initial application received\n- Screening - Resume review and shortlisting\n- Interview - Scheduled and completed interviews\n- Offered - Offer letter extended\n- Hired - Candidate accepted and onboarded\n- Rejected - Candidate not selected\n\n### 4. AI-Powered Interviews\nLeverage 3Boxes AI to conduct initial screening interviews with configurable questions and automated scoring.\n\n### 5. Offer Management\nGenerate and track offer letters with template-based generation and digital signature workflow.\n\n## Role Access\n\n| Feature | HR Admin | Manager | Employee |\n|---------|----------|---------|----------|\n| Create Requisitions | Yes | Yes | No |\n| Manage Job Postings | Yes | No | No |\n| Review Applications | Yes | Yes (team) | No |\n| Conduct Interviews | Yes | Yes | No |\n| Extend Offers | Yes | No | No |\n| View Job Portal | Yes | Yes | Yes |`,
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
        summary: 'Step-by-step guide to processing payroll, managing salary structures, and generating payslips.',
        content: `# Payroll Processing Guide\n\n## Overview\n\nThe Payroll module automates salary computation, tax deductions, and payslip generation.\n\n## Salary Structure Setup\n\n### Common Components\n- Basic Salary: 40-50% of CTC\n- HRA: House Rent Allowance (40-50% of Basic)\n- DA: Dearness Allowance (variable)\n- Conveyance: Transport allowance\n- Medical: Medical allowance\n\n### Deductions\n- PF: Provident Fund (12% of Basic)\n- ESI: Employee State Insurance (0.75% of Gross)\n- Tax: Income tax (TDS)\n- Professional Tax: State-specific\n\n## Processing Payroll\n\n### Step 1: Review Data\nSelect the month/year and review employee data for issues.\n\n### Step 2: Calculate\nRun the payroll engine to compute net pay for each employee.\n\n### Step 3: Review & Adjust\nCheck for anomalies, make manual adjustments, add one-time deductions or bonuses.\n\n### Step 4: Approve\nSubmit for approval workflow: HR Admin reviews, Finance approves.\n\n### Step 5: Disburse\nProcess payout, generate bank transfer files, auto-send payslips.\n\n## Common Issues\n\n| Issue | Cause | Solution |\n|-------|-------|----------|\n| Negative net pay | Excess deductions | Review deduction limits |\n| Missing attendance | Unsynced data | Run attendance sync first |\n| Wrong tax amount | Outdated tax slabs | Update tax configuration |`,
        docType: 'functional',
        moduleKey: 'payroll',
        tags: 'payroll,salary,payslip,tax,deductions',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['functional'],
        title: 'Leave Management - Complete Guide',
        slug: 'leave-management-guide',
        summary: 'Everything about configuring leave types, managing leave requests, and tracking leave balances.',
        content: `# Leave Management - Complete Guide\n\n## Overview\n\nThe Leave Management module handles all aspects of employee time-off, from configuring leave types to tracking balances and processing requests.\n\n## Leave Type Configuration\n\n### Common Leave Types\n| Type | Code | Default Days | Paid | Carry Forward |\n|------|------|-------------|------|---------------|\n| Casual Leave | CL | 12 | Yes | No |\n| Sick Leave | SL | 10 | Yes | No |\n| Earned Leave | EL | 15 | Yes | Yes (5 max) |\n| Maternity Leave | ML | 180 | Yes | No |\n| Loss of Pay | LOP | 0 | No | N/A |\n\n## Leave Balance Tracking\n\nLeave balances are tracked per employee, per leave type, per year:\n- Total: Opening balance + annual accrual\n- Used: Approved leave days consumed\n- Remaining: Total - Used\n\n## Request Workflow\n\n1. Employee submits leave request\n2. Manager reviews and approves/rejects\n3. HR Admin can override any decision\n4. Balance is updated automatically\n\n## Best Practices\n\n1. Configure all leave types before employee onboarding\n2. Run monthly reports to ensure accuracy\n3. Import holidays before leave processing\n4. Encourage advance requests to reduce last-minute approvals`,
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
        content: `# Recruitment Workflow Guide\n\n## Overview\n\nThis document outlines the standard recruitment workflow in 3Boxes HRMS, defining each stage, decision point, and role responsibility.\n\n## Workflow Stages\n\n### Stage 1: Requisition\nManager creates Requisition - HR Admin Reviews - Approve/Reject\n\nApproval Rules:\n- Standard positions: HR Admin approval only\n- Senior positions: HR Admin + Tenant Admin\n- C-Suite: Super Admin approval required\n\n### Stage 2: Job Posting\nHR Admin creates Job Posting - Publishes to Portal - Applications Flow In\n\n### Stage 3: Screening\nApplications - Auto-screen (AI) - Shortlist - HR Review\n\n### Stage 4: Interview\nHR schedules Interview - Interviewer Conducts - Feedback Submitted - Decision\n\nInterview Types: AI Interview, Technical, HR, Managerial, Final\n\n### Stage 5: Offer\nHR generates Offer - Candidate Reviews - Accept/Reject/Negotiate\n\n### Stage 6: Onboarding\nOffer Accepted - Auto-create Employee - Assign Onboarding Tasks - Complete Setup\n\n## SLA Targets\n\n| Stage | Target Duration | Escalation |\n|-------|----------------|------------|\n| Requisition Approval | 2 business days | Auto-escalate to next level |\n| Job Posting | 1 business day | Notify HR lead |\n| Screening | 3 business days | Flag in dashboard |\n| Interview Scheduling | 5 business days | Alert HR manager |\n| Offer Release | 2 business days | Escalate to HR head |`,
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
        summary: 'Workflow configuration and rules for leave request approval.',
        content: `# Leave Approval Workflow\n\n## Default Workflow\n\nEmployee Submits - Manager Approves/Rejects - HR Notified - Balance Updated\n\n## Approval Rules by Leave Type\n\n| Leave Type | Approval Level | Auto-Approve |\n|------------|---------------|-------------|\n| Casual Leave | Manager | If balance sufficient |\n| Sick Leave | Manager | If 2 days or less with proof |\n| Earned Leave | Manager then HR | Never |\n| Maternity Leave | HR Admin | Never |\n| Loss of Pay | Manager then HR | Never |\n\n## Escalation Rules\n\n- Manager does not act within 24 hours: Auto-escalate to skip manager\n- Skip manager does not act within 24 hours: Auto-escalate to HR\n- HR does not act within 48 hours: Auto-approve (configurable)\n\n## Notifications\n\n| Event | Recipient | Channel |\n|-------|-----------|--------|\n| Leave submitted | Manager | In-app + Email |\n| Leave approved | Employee | In-app + Email |\n| Leave rejected | Employee | In-app + Email |\n| Escalation triggered | Next approver | In-app + Email |`,
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
        content: `# Expense Claim Workflow\n\n## Workflow Stages\n\n### 1. Submission\nEmployee submits expense claim with category, amount, date, description, and receipt attachment.\n\n### 2. Manager Review\nDirect manager verifies business purpose, checks policy compliance, validates receipt.\n\n### 3. Finance Review\nFor claims above policy thresholds, finance validates against budget and checks receipt authenticity.\n\n### 4. Payment Processing\nApproved claims enter the payment queue, added to next payroll cycle or processed separately.\n\n## Policy Thresholds\n\n| Category | Auto-Approve Limit | Manager Limit | Finance Required |\n|----------|-------------------|---------------|-----------------|\n| Travel | $100 | $500 | Greater than $500 |\n| Food | $50 | $200 | Greater than $200 |\n| Accommodation | $200 | $800 | Greater than $800 |\n| Transport | $30 | $100 | Greater than $100 |\n\n## Common Rejection Reasons\n\n1. Missing or invalid receipt\n2. Expense not business-related\n3. Amount exceeds policy limit\n4. Duplicate claim detected\n5. Submitted after deadline (30-day window)`,
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
        summary: 'Comprehensive security documentation covering data protection, access controls, and compliance standards.',
        content: `# Security & Data Protection Overview\n\n## Security Philosophy\n\n3Boxes HRMS follows a defense-in-depth approach with multiple layers of security to protect sensitive HR data.\n\n## Data Protection Measures\n\n### Encryption\n- At Rest: All database data encrypted using AES-256\n- In Transit: TLS 1.3 for all API communications\n- Sensitive Fields: PII data has additional field-level encryption\n- Backups: Encrypted before storage, with separate key management\n\n### Access Control\n- Authentication: JWT tokens with 24-hour expiry\n- Authorization: Role-Based Access Control (RBAC) with 5 tiers\n- Tenant Isolation: Database-level tenant separation\n- API Keys: Required for all external integrations\n\n## Compliance Standards\n\n### GDPR Compliance\n- Data processing consent management\n- Data portability (export all employee data)\n- Right to be forgotten implementation\n- Data breach notification (72-hour window)\n\n### SOC 2 Type II\n- Regular security audits\n- Access logging and monitoring\n- Incident response procedures\n\n### ISO 27001 Alignment\n- Information Security Management System\n- Risk assessment framework\n- Business continuity planning\n\n## Incident Response\n\n| Level | Description | Response Time |\n|-------|-------------|--------------|\n| P1 - Critical | Data breach | 15 minutes |\n| P2 - High | Vulnerability exploited | 1 hour |\n| P3 - Medium | Suspicious activity | 4 hours |\n| P4 - Low | Policy violation | 24 hours |\n\n## Audit Logging\n\nEvery significant action is logged and retained for 7 years, including authentication events, data modifications, and configuration changes.`,
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
        summary: 'Complete reference for the RBAC system, including permission matrices and role hierarchies.',
        content: `# Role-Based Access Control Reference\n\n## Role Hierarchy\n\nsuper_admin - tenant_admin - hr_admin - manager - employee\n\n## Role Definitions\n\n### Super Admin\n- Scope: Platform-wide\n- Access: All modules, all tenants, all data\n\n### Tenant Admin\n- Scope: Single tenant\n- Access: All modules within tenant\n- Restrictions: Cannot access other tenants\n\n### HR Admin\n- Scope: Company/branch level\n- Access: HR modules, employee data, reports\n- Restrictions: No platform settings\n\n### Manager\n- Scope: Department/team level\n- Access: Team data, limited employee views\n- Restrictions: No payroll, limited recruitment\n\n### Employee\n- Scope: Self only\n- Access: Own data, announcements, helpdesk\n- Restrictions: No admin functions\n\n## Module Permission Matrix\n\n| Module | Super Admin | Tenant Admin | HR Admin | Manager | Employee |\n|--------|------------|-------------|----------|---------|----------|\n| Dashboard | Full | Full | Full | Team | Self |\n| Employees | Full | Full | Full | View | Profile |\n| Recruitment | Full | Full | Full | Team | Portal |\n| Payroll | Full | Full | Full | No | Payslip |\n| Leave | Full | Full | Manage | Approve | Request |\n| Attendance | Full | Full | Manage | Team | Self |\n| Performance | Full | Full | Full | Team | Self |`,
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
        summary: 'Procedures for data backup, disaster recovery, and business continuity.',
        content: `# Data Backup & Recovery Procedures\n\n## Backup Strategy\n\n| Type | Frequency | Retention | Storage |\n|------|-----------|-----------|--------|\n| Full Database | Daily | 30 days | Encrypted S3 |\n| Incremental | Every 6 hours | 7 days | Encrypted S3 |\n| WAL Archives | Continuous | 7 days | Encrypted S3 |\n| Configuration | On change | 90 days | Version control |\n\n## Recovery Procedures\n\n### Accidental Data Deletion\n1. Identify the scope of deletion\n2. Notify super admin and affected tenant admins\n3. Create a point-in-time snapshot\n4. Restore from the most recent backup\n5. Verify data integrity\nTarget RTO: 4 hours\n\n### Database Corruption\n1. Detect corruption via automated monitoring\n2. Switch to read-only mode\n3. Create forensic snapshot\n4. Restore from last known good backup\n5. Replay WAL archives\nTarget RTO: 8 hours\n\n### Regional Outage\n1. Automated health check detects outage\n2. DNS failover to secondary region\n3. Promote secondary database\n4. Verify application functionality\nTarget RTO: 30 minutes\n\n## Business Continuity\n- Multi-AZ database deployment\n- Auto-scaling API servers\n- CDN for static assets\n- Quarterly disaster recovery drills`,
        docType: 'security',
        moduleKey: 'platform',
        tags: 'backup,recovery,disaster-recovery,business-continuity',
        status: 'published',
        sortOrder: 3,
      },
      // AI Documentation
      {
        categoryId: createdCategories['ai'],
        title: 'AI Interview - Setup & Configuration',
        slug: 'ai-interview-setup',
        summary: 'Guide to setting up and configuring AI-powered interviews for automated candidate screening.',
        content: `# AI Interview - Setup & Configuration\n\n## Overview\n\nThe AI Interview feature leverages advanced language models to conduct automated screening interviews.\n\n## Prerequisites\n\n- Super Admin or HR Admin access\n- At least one job posting created\n- AI models configured in the AI Admin Console\n\n## Setup Steps\n\n### 1. Configure AI Models\nNavigate to AI Admin Console and configure:\n- Primary Model: Used for interview conversations (recommended: GPT-4)\n- Evaluation Model: Used for scoring and feedback\n- Temperature: 0.7 for natural conversations\n- Max Tokens: 2048 for responses\n\n### 2. Create Interview Templates\nEach template defines:\n- Role/Position the interview is for\n- Duration and question count\n- Scoring criteria and weights\n- Pass/fail thresholds\n\n### 3. Configure Question Banks\nOrganize questions by:\n- Technical skills assessment\n- Behavioral evaluation\n- Situational judgment\n- Culture fit indicators\n\n## Interview Types\n\n1. **Automated Screening**: AI conducts initial candidate screening\n2. **Technical Assessment**: Code and problem-solving evaluation\n3. **Behavioral Interview**: Soft skills and communication assessment\n4. **Comprehensive**: Multi-stage AI interview combining all types\n\n## Scoring & Evaluation\n\nEach interview is scored on multiple dimensions:\n- Technical competency (0-100)\n- Communication skills (0-100)\n- Problem-solving ability (0-100)\n- Culture fit (0-100)\n- Overall recommendation score\n\n## Best Practices\n\n1. Start with automated screening for high-volume positions\n2. Always include a human review step after AI screening\n3. Customize question banks per role\n4. Regularly review and update scoring criteria\n5. Monitor for bias in AI evaluations`,
        docType: 'ai',
        moduleKey: 'ai-interview',
        tags: 'ai,interview,screening,automation,configuration',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['ai'],
        title: 'AI Assistant - User Guide',
        slug: 'ai-assistant-guide',
        summary: 'Guide to using the AI Assistant for HR queries, document generation, and workflow automation.',
        content: `# AI Assistant - User Guide\n\n## Overview\n\nThe AI Assistant is an intelligent chatbot that helps employees and HR staff with common tasks, queries, and document generation.\n\n## Features\n\n### Natural Language Queries\nAsk questions in plain English:\n- "How many leave days do I have remaining?"\n- "Show me the attendance policy"\n- "What is the recruitment workflow?"\n\n### Document Generation\n- Generate offer letters from templates\n- Create policy documents\n- Draft email communications\n- Build report summaries\n\n### Workflow Automation\n- Trigger approval workflows\n- Schedule interviews\n- Send notifications\n- Create recurring tasks\n\n## Usage by Role\n\n| Feature | Super Admin | HR Admin | Manager | Employee |\n|---------|------------|----------|---------|----------|\n| Query HR policies | Yes | Yes | Yes | Yes |\n| Generate documents | Yes | Yes | No | No |\n| Trigger workflows | Yes | Yes | Limited | No |\n| Access analytics | Yes | Yes | Team | No |\n| Manage settings | Yes | No | No | No |\n\n## Tips for Better Results\n\n1. Be specific in your queries\n2. Include context (department, date range, etc.)\n3. Use natural language - no need for commands\n4. Ask follow-up questions to refine results\n5. Use "summarize" or "explain" for complex topics`,
        docType: 'ai',
        moduleKey: 'ai-assistant',
        tags: 'ai,assistant,chatbot,automation,queries',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['ai'],
        title: 'AI Admin Console Guide',
        slug: 'ai-admin-console-guide',
        summary: 'Administrative guide for configuring AI models, managing prompts, and monitoring AI feature usage.',
        content: `# AI Admin Console Guide\n\n## Overview\n\nThe AI Admin Console is the central configuration hub for all AI features in 3Boxes HRMS. Only Super Admins have access.\n\n## Model Configuration\n\n### Available Models\n- GPT-4: Best quality, higher cost\n- GPT-3.5-Turbo: Fast, cost-effective\n- Custom Models: Bring your own model endpoint\n\n### Configuration Parameters\n- Temperature: Controls response randomness (0.0-2.0)\n- Max Tokens: Maximum response length\n- Top P: Nucleus sampling threshold\n- Frequency Penalty: Reduces repetition\n- Presence Penalty: Encourages topic diversity\n\n## Prompt Management\n\n### System Prompts\nConfigure default system prompts for:\n- AI Interview screening\n- Chatbot personality and boundaries\n- Document generation templates\n- Code review assistance\n\n### Custom Prompts\nCreate role-specific prompts:\n- HR Admin: Focus on policy and compliance\n- Manager: Focus on team management\n- Employee: Focus on self-service\n\n## Usage Monitoring\n\n### Key Metrics\n- Total API calls per day/week/month\n- Average response time\n- Token consumption\n- Cost per feature\n- Error rates\n\n### Alerts\nConfigure alerts for:\n- Usage exceeding budget\n- High error rates\n- Unusual usage patterns\n- Model degradation\n\n## Cost Management\n\n- Set monthly budgets per feature\n- Enable usage caps per role\n- Monitor token consumption\n- Optimize prompts for efficiency\n- Use cheaper models for simple tasks`,
        docType: 'ai',
        moduleKey: 'ai-admin',
        tags: 'ai,admin,configuration,models,prompts,monitoring',
        status: 'published',
        sortOrder: 3,
      },
      // SOP Documents
      {
        categoryId: createdCategories['sop'],
        title: 'Employee Onboarding SOP',
        slug: 'employee-onboarding-sop',
        summary: 'Standard operating procedure for new employee onboarding, including checklist and timeline.',
        content: `# Employee Onboarding SOP\n\n## Purpose\n\nThis SOP defines the standard process for onboarding new employees to ensure a consistent and thorough integration experience.\n\n## Scope\n\nApplies to all new hires across all departments and branches.\n\n## Responsibilities\n\n- HR Admin: Coordinates onboarding process\n- IT Department: Sets up systems and access\n- Hiring Manager: Plans role-specific orientation\n- Employee: Completes required documentation\n\n## Process\n\n### Day 1: Administrative Setup\n1. Employee reports to HR with original documents\n2. Verify identity and employment eligibility\n3. Complete tax forms and benefit enrollment\n4. Issue employee ID and access card\n5. Provide employee handbook\n\n### Day 2-3: IT & Systems Setup\n1. Create email and system accounts\n2. Assign role-based access permissions\n3. Set up workstation/laptop\n4. Install required software\n5. Configure communication tools\n\n### Week 1: Orientation\n1. Company culture and values presentation\n2. Office tour and introductions\n3. Policy review session\n4. Safety and compliance training\n5. Team lunch/welcome event\n\n### Week 2-4: Role-Specific Training\n1. Department processes and tools\n2. Shadow experienced team members\n3. Assign initial tasks with mentoring\n4. Set 30/60/90 day goals\n5. Schedule check-ins with manager\n\n## Checklist\n\n- [ ] Offer letter signed and filed\n- [ ] Background verification completed\n- [ ] Tax documents submitted\n- [ ] Bank details collected\n- [ ] IT accounts created\n- [ ] Equipment issued\n- [ ] Orientation completed\n- [ ] 30-day check-in scheduled`,
        docType: 'sop',
        moduleKey: 'onboarding',
        tags: 'onboarding,SOP,checklist,new-hire,orientation',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['sop'],
        title: 'Payroll Processing SOP',
        slug: 'payroll-processing-sop',
        summary: 'Standard operating procedure for monthly payroll processing, from data collection to disbursement.',
        content: `# Payroll Processing SOP\n\n## Purpose\n\nThis SOP defines the standard process for monthly payroll processing to ensure accurate and timely salary disbursement.\n\n## Schedule\n\n| Activity | Deadline |\n|----------|----------|\n| Data collection cutoff | 25th of month |\n| Attendance finalization | 26th of month |\n| Payroll calculation | 27th of month |\n| HR review | 28th of month |\n| Finance approval | 29th of month |\n| Salary disbursement | Last working day |\n| Payslip distribution | 1st of next month |\n\n## Process Steps\n\n### Step 1: Data Collection (By 25th)\n1. Collect attendance data from biometric/system\n2. Gather leave application records\n3. Record overtime approvals\n4. Collect new joiner salary details\n5. Note separations and final settlements\n\n### Step 2: Data Validation (By 26th)\n1. Cross-verify attendance against leave records\n2. Validate new employee bank details\n3. Check for data anomalies\n4. Reconcile with previous month adjustments\n\n### Step 3: Payroll Calculation (By 27th)\n1. Run payroll calculation engine\n2. Apply statutory deductions (PF, ESI, TDS)\n3. Process reimbursements\n4. Calculate overtime payments\n5. Handle final settlements\n\n### Step 4: Review & Approval (By 29th)\n1. HR Admin reviews payroll summary\n2. Finance team approves\n3. Generate bank transfer file\n4. Authorize payment\n\n### Step 5: Disbursement\n1. Process bank transfers\n2. Mark payroll as paid\n3. Auto-send payslips via email\n4. Update employee records\n\n## Exception Handling\n\n- Late joiners: Pro-rate salary calculation\n- Mid-month exits: Calculate till last working day\n- Arrears: Process in next payroll cycle\n- Reversals: Follow refund procedure`,
        docType: 'sop',
        moduleKey: 'payroll',
        tags: 'payroll,SOP,processing,salary,disbursement',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['sop'],
        title: 'Leave Management SOP',
        slug: 'leave-management-sop',
        summary: 'Standard operating procedure for leave request processing, approval, and balance management.',
        content: `# Leave Management SOP\n\n## Purpose\n\nThis SOP defines the standard process for managing employee leave requests, approvals, and balance tracking.\n\n## Leave Request Process\n\n### Employee Actions\n1. Submit leave request through the portal\n2. Select leave type and dates\n3. Provide reason (optional for casual leave)\n4. Attach medical certificate for sick leave over 2 days\n5. Check team calendar before submitting\n\n### Manager Actions\n1. Review request within 24 hours\n2. Check team coverage requirements\n3. Approve or reject with comments\n4. Escalate to HR if unsure\n\n### HR Actions\n1. Process approved leaves\n2. Update leave balances\n3. Handle disputes and exceptions\n4. Generate monthly leave reports\n\n## Escalation Matrix\n\n| Scenario | Escalation |\n|----------|------------|\n| Manager not responding (24hrs) | Skip Manager |\n| Skip Manager not responding (24hrs) | HR Admin |\n| HR not responding (48hrs) | Auto-approve |\n| Dispute on leave rejection | HR Admin |\n\n## Balance Management\n\n- Leave balances updated in real-time\n- Monthly reconciliation on 1st of each month\n- Annual carry forward processed in January\n- Probation employees: Limited leave types only\n\n## Special Cases\n\n- Half-day leave: Select half-day option in request\n- Comp-off: Must be claimed within 30 days\n- Maternity/Paternity: Requires HR pre-approval\n- Sabbatical: Requires Director-level approval`,
        docType: 'sop',
        moduleKey: 'leave',
        tags: 'leave,SOP,approval,balance,management',
        status: 'published',
        sortOrder: 3,
      },
      // Training & Videos
      {
        categoryId: createdCategories['training'],
        title: 'New Employee Orientation Program',
        slug: 'new-employee-orientation',
        summary: 'Training program overview for new employee orientation, including modules and schedule.',
        content: `# New Employee Orientation Program\n\n## Overview\n\nThe New Employee Orientation Program is designed to integrate new hires into the organization smoothly and effectively. The program spans the first two weeks of employment.\n\n## Program Structure\n\n### Module 1: Company Overview (Day 1)\n- Company history and mission\n- Organizational structure\n- Products and services\n- Culture and values\n\n### Module 2: HR Policies & Benefits (Day 2)\n- Employment policies review\n- Benefits enrollment\n- Leave and attendance policies\n- Code of conduct\n\n### Module 3: IT Systems Training (Day 3)\n- Email and communication tools\n- 3Boxes HRMS portal navigation\n- Document management system\n- Security best practices\n\n### Module 4: Department Orientation (Day 4-5)\n- Department goals and KPIs\n- Team introductions\n- Workflow and processes\n- Tools and systems used\n\n### Module 5: Role-Specific Training (Week 2)\n- Job-specific tools and software\n- Process walkthroughs\n- Shadowing with experienced team members\n- First assignment with mentoring support\n\n## Assessment\n\n- Online quiz after each module (pass mark: 80%)\n- Practical demonstration for IT systems\n- Manager feedback at end of Week 2\n- 30-day follow-up evaluation\n\n## Resources\n\n- Employee Handbook (digital)\n- IT Setup Guide\n- Department Process Manual\n- Buddy/Mentor Assignment`,
        docType: 'training',
        moduleKey: 'onboarding',
        tags: 'training,orientation,new-hire,onboarding,program',
        status: 'published',
        sortOrder: 1,
      },
      {
        categoryId: createdCategories['training'],
        title: 'HR Admin Training Guide',
        slug: 'hr-admin-training',
        summary: 'Comprehensive training guide for HR Administrators covering all HRMS modules and workflows.',
        content: `# HR Admin Training Guide\n\n## Overview\n\nThis training guide covers all aspects of the HR Admin role in 3Boxes HRMS, from basic navigation to advanced workflow configuration.\n\n## Module 1: Navigating 3Boxes HRMS\n\n### Dashboard Overview\n- Understanding key metrics and widgets\n- Customizing your dashboard view\n- Quick actions and shortcuts\n\n### Employee Management\n- Adding new employees\n- Updating employee records\n- Managing organizational structure\n- Bulk operations\n\n## Module 2: Recruitment & Hiring\n\n### Creating Job Postings\n1. Navigate to Recruitment module\n2. Click New Job Posting\n3. Fill in details and requirements\n4. Set salary range and deadline\n5. Publish to job portal\n\n### Managing Applications\n- Review and screen candidates\n- Schedule interviews\n- Record feedback and scores\n- Extend offers\n\n## Module 3: Payroll & Compensation\n\n### Running Payroll\n1. Verify attendance data\n2. Process payroll for the month\n3. Review and approve\n4. Generate payslips\n5. Process bank transfers\n\n### Salary Structure Configuration\n- Create salary components\n- Define formulas and calculations\n- Assign structures to employees\n\n## Module 4: Leave & Attendance\n\n### Leave Management\n- Configure leave types\n- Process leave requests\n- Handle escalations\n- Generate reports\n\n### Attendance Tracking\n- Set up attendance policies\n- Manage shift schedules\n- Process regularizations\n- Handle exceptions\n\n## Certification\n\nComplete the HR Admin certification by:\n1. Finishing all 4 training modules\n2. Passing the assessment quiz (80% minimum)\n3. Completing 2 supervised payroll runs\n4. Getting manager sign-off`,
        docType: 'training',
        moduleKey: 'employees',
        tags: 'training,hr-admin,guide,certification,modules',
        status: 'published',
        sortOrder: 2,
      },
      {
        categoryId: createdCategories['training'],
        title: 'Manager Training Program',
        slug: 'manager-training',
        summary: 'Training program for managers covering team management, approvals, and performance reviews.',
        content: `# Manager Training Program\n\n## Overview\n\nThis training program equips managers with the skills to effectively use 3Boxes HRMS for team management, approvals, and performance oversight.\n\n## Module 1: Team Management\n\n### Viewing Your Team\n- Access team member profiles\n- View organizational chart\n- Check attendance and leave status\n- Monitor team workload\n\n### Team Communication\n- Send team announcements\n- Schedule one-on-ones\n- Share documents and resources\n- Use AI Assistant for team queries\n\n## Module 2: Approvals Workflow\n\n### Leave Approvals\n1. Review leave request details\n2. Check team calendar for coverage\n3. Approve or reject with comments\n4. Handle escalation notifications\n\n### Expense Approvals\n1. Review expense claim details\n2. Verify receipt attachment\n3. Check policy compliance\n4. Approve or request more information\n\n### Timesheet Approvals\n1. Review submitted timesheets\n2. Verify project hours\n3. Approve or flag discrepancies\n4. Submit for payroll processing\n\n## Module 3: Performance Management\n\n### Setting Goals\n- Create SMART goals for team members\n- Align with department objectives\n- Set milestones and checkpoints\n- Track progress monthly\n\n### Conducting Reviews\n- Prepare review using performance data\n- Schedule review meeting\n- Document feedback and ratings\n- Create development plans\n\n## Module 4: Recruitment Participation\n\n### Interviewing Candidates\n- Review candidate profiles\n- Schedule and conduct interviews\n- Submit structured feedback\n- Participate in hiring decisions\n\n## Assessment\n\n- Complete all 4 modules\n- Pass role-specific scenarios\n- Demonstrate approval workflows\n- Get HR Admin certification sign-off`,
        docType: 'training',
        moduleKey: 'employees',
        tags: 'training,manager,approvals,performance,reviews',
        status: 'published',
        sortOrder: 3,
      },
    ];

    let articlesCreated = 0;
    let accessRulesCreated = 0;

    for (const article of articles) {
      const existing = await db.docArticle.findUnique({ where: { slug: article.slug } });
      if (!existing) {
        await db.docArticle.create({ data: article });
        articlesCreated++;
      }
    }

    // Create some default access rules for restricted docs
    const restrictedArticles = ['security-data-protection', 'rbac-reference', 'data-backup-recovery'];
    for (const slug of restrictedArticles) {
      const article = await db.docArticle.findUnique({ where: { slug } });
      if (article) {
        for (const role of ['tenant_admin', 'super_admin']) {
          const existingRule = await db.docAccessRule.findFirst({
            where: { articleId: article.id, role },
          });
          if (!existingRule) {
            await db.docAccessRule.create({
              data: {
                articleId: article.id,
                role,
                accessType: 'read',
                grantedBy: user.id,
              },
            });
            accessRulesCreated++;
          }
        }
      }
    }

    const finalCategoryCount = await db.docCategory.count();
    const finalArticleCount = await db.docArticle.count();

    return NextResponse.json({
      initialized: true,
      migrated: needsMigration,
      categories: finalCategoryCount,
      articlesCreated,
      totalArticles: finalArticleCount,
      accessRulesCreated,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Error initializing docs hub:', error);
    return NextResponse.json(
      { error: 'Initialization failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST: Force re-initialize
export async function POST(request: Request) {
  const db = await getDb(request);
  return GET(request);
}
