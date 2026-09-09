#!/usr/bin/env python3
"""Generate NEXUS HRMS Security Features Documentation PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'security_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-Security-Documentation.pdf')

doc = TocDocTemplate(BODY_PATH, pagesize=A4, leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM)
story = []

# ── TOC ──
story.append(Paragraph('<b>Table of Contents</b>', s['H1']))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='DejaVuSansBold', fontSize=13, leftIndent=20, leading=22),
    ParagraphStyle('TOC2', fontName='DejaVuSans', fontSize=11, leftIndent=40, leading=18),
]
story.append(toc)
story.append(PageBreak())

# ── 1. Security Architecture Overview ──
story.append(heading('1. Security Architecture Overview', 'H1', s, 0))
story.append(body('The NEXUS HRMS platform implements a multi-layered security architecture designed to protect sensitive human resources data across the entire application stack. The security model encompasses authentication, authorization, data protection, API security, infrastructure hardening, and continuous monitoring.', s))
story.append(Spacer(1, 6))

story.append(heading('1.1 Security Stack', 'H2', s, 1))
story.append(body('The NEXUS security stack operates across five distinct layers, each providing complementary protections:', s))
sec_layers = [
    '<b>Presentation Layer:</b> Next.js client with role-based UI filtering and secure token storage in localStorage with Bearer + cookie token retrieval mechanism.',
    '<b>Application Layer:</b> Next.js API routes with JWT-based authentication middleware, input validation, and CORS enforcement.',
    '<b>Authentication Layer:</b> JWT tokens signed with HS256 algorithm using the jose library, with bcryptjs password hashing at 12 salt rounds and 24-hour token expiry.',
    '<b>Data Layer:</b> Prisma ORM with multi-tenant isolation via tenantId foreign keys, parameterized queries preventing SQL injection, and Neon serverless PostgreSQL with encrypted connections.',
    '<b>Infrastructure Layer:</b> Vercel deployment with automatic TLS, Neon PostgreSQL with encryption at rest and in transit, and environment variable management through Vercel secrets.'
]
for layer in sec_layers:
    story.append(bullet(layer, s))
story.append(Spacer(1, 6))

story.append(heading('1.2 Core Security Parameters', 'H2', s, 1))
sec_params = make_table(
    ['Parameter', 'Implementation', 'Value/Detail'],
    [
        ['Authentication Method', 'JWT (JSON Web Tokens)', 'HS256 algorithm via jose library'],
        ['Password Hashing', 'bcryptjs', '12 salt rounds (cost factor 12)'],
        ['Token Expiry', 'JWT expiration', '24 hours (86400 seconds)'],
        ['Token Storage', 'Client-side', 'localStorage with Bearer + cookie retrieval'],
        ['Database Isolation', 'Multi-tenant', 'tenantId foreign key on all tenant-scoped models'],
        ['SQL Injection Prevention', 'Prisma ORM', 'Parameterized queries, no raw SQL'],
        ['Connection Encryption', 'Neon PostgreSQL', 'TLS/SSL encrypted connections'],
        ['Deployment Security', 'Vercel', 'Automatic HTTPS, edge network'],
        ['CORS Policy', 'Next.js middleware', 'Configured origin validation'],
        ['Secret Management', 'Vercel Environment Variables', 'Encrypted at rest, never exposed to client'],
    ],
    s, [130, 130, 210]
)
story.append(sec_params)
story.append(Spacer(1, 12))

# ── 2. Authentication System ──
story.append(heading('2. Authentication System', 'H1', s, 0))
story.append(body('The NEXUS authentication system implements JWT-based stateless authentication with secure password handling and comprehensive session management. The system uses the jose library for JWT operations and bcryptjs for password hashing.', s))
story.append(Spacer(1, 6))

story.append(heading('2.1 Login Flow', 'H2', s, 1))
story.append(body('The authentication flow follows a standard credential-based login process with JWT token issuance:', s))
login_steps = [
    '<b>Step 1 — Credential Submission:</b> User submits email and password through the login form. The client sends a POST request to <font face="DejaVuMono">/api/auth/login</font>.',
    '<b>Step 2 — User Lookup:</b> The API route queries the database using Prisma to find the user by email. The query includes the user record with associated role and tenant information.',
    '<b>Step 3 — Password Verification:</b> The submitted password is compared against the stored bcrypt hash using <font face="DejaVuMono">bcryptjs.compare()</font>. The bcrypt algorithm with 12 salt rounds ensures computationally expensive brute-force resistance.',
    '<b>Step 4 — Token Creation:</b> Upon successful verification, a JWT token is created using <font face="DejaVuMono">jose.SignJWT()</font>. The payload includes userId, email, role, and tenantId claims. The token is signed with HS256 using the JWT_SECRET from environment variables.',
    '<b>Step 5 — Token Delivery:</b> The JWT token is returned in the response body. The client stores the token in localStorage for subsequent API calls.',
    '<b>Step 6 — Login Activity Logging:</b> The system creates a LoginActivity record capturing the login timestamp, IP address (if available), and user agent for audit purposes.'
]
for step in login_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('2.2 Token Creation Details', 'H2', s, 1))
story.append(body('JWT tokens in NEXUS are created with the following structure and security parameters:', s))
token_details = make_table(
    ['Property', 'Value', 'Notes'],
    [
        ['Algorithm', 'HS256', 'HMAC with SHA-256, symmetric key'],
        ['Signing Library', 'jose (SignJWT)', 'Standards-compliant JWT library'],
        ['Expiration', '24 hours', 'Configurable via environment variable'],
        ['Payload Claims', 'userId, email, role, tenantId', 'Minimal necessary claims'],
        ['Secret Key', 'JWT_SECRET env variable', 'Must be 256-bit minimum for HS256'],
        ['Token Format', 'JWS Compact Serialization', 'Standard three-part JWT format'],
    ],
    s, [120, 160, 190]
)
story.append(token_details)
story.append(Spacer(1, 8))

story.append(heading('2.3 Token Verification', 'H2', s, 1))
story.append(body('Every protected API route verifies the JWT token using the jose library\'s <font face="DejaVuMono">jwtVerify()</font> function. The verification process extracts the token from the Authorization header (Bearer token) and validates the signature, expiration, and claims.', s))
story.append(Spacer(1, 4))
verify_steps = [
    'Extract the Authorization header from the incoming request.',
    'Parse the Bearer token from the header value.',
    'Call jose.jwtVerify() with the token and JWT_SECRET.',
    'Validate that the token has not expired and the signature is valid.',
    'Extract userId, role, and tenantId from the verified payload.',
    'Attach the decoded user context to the request for downstream processing.',
    'If verification fails, return 401 Unauthorized response.'
]
for step in verify_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('2.4 Logout Process', 'H2', s, 1))
story.append(body('The logout process clears the JWT token from client-side storage. Since NEXUS uses stateless JWT authentication, server-side token invalidation is not natively supported. The logout flow:', s))
logout_steps = [
    'Client calls the logout endpoint or clears local token.',
    'Token is removed from localStorage.',
    'Application state is reset to unauthenticated.',
    'User is redirected to the login page.',
    'LoginActivity record is optionally updated with logout timestamp.'
]
for step in logout_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('2.5 Password Hashing', 'H2', s, 1))
story.append(body('Password security is implemented using bcryptjs with the following parameters:', s))
pwd_details = make_table(
    ['Parameter', 'Value', 'Security Rationale'],
    [
        ['Algorithm', 'bcrypt', 'Adaptive hashing, resistant to GPU/ASIC attacks'],
        ['Salt Rounds', '12', 'Cost factor of 2^12 = 4096 iterations'],
        ['Hash Length', '60 characters', 'Standard bcrypt output format'],
        ['Password Validation', 'bcryptjs.compare()', 'Constant-time comparison prevents timing attacks'],
        ['Password Storage', 'Hash only', 'Original password never stored or logged'],
    ],
    s, [120, 150, 200]
)
story.append(pwd_details)
story.append(Spacer(1, 12))

# ── 3. Authorization & RBAC ──
story.append(heading('3. Authorization & RBAC', 'H1', s, 0))
story.append(body('NEXUS implements a Role-Based Access Control (RBAC) system with dual role models: database-level roles for authentication and application-level roles for fine-grained authorization. This section details the role hierarchy, permission mapping, and access control mechanisms.', s))
story.append(Spacer(1, 6))

story.append(heading('3.1 Database Roles (5 Roles)', 'H2', s, 1))
story.append(body('The database User model defines 5 core roles that determine the user\'s position in the organizational hierarchy:', s))
db_roles = make_table(
    ['Role', 'Scope', 'Key Capabilities'],
    [
        ['SUPER_ADMIN', 'Platform-wide', 'Full system access, tenant management, all operations'],
        ['ADMIN', 'Organization-wide', 'Organization management, user administration, all modules'],
        ['HR', 'Organization-wide', 'HR module access, employee management, payroll, recruitment'],
        ['MANAGER', 'Department-level', 'Team management, approvals, performance reviews'],
        ['EMPLOYEE', 'Individual-level', 'Self-service, leave requests, profile updates'],
    ],
    s, [100, 120, 250]
)
story.append(db_roles)
story.append(Spacer(1, 8))

story.append(heading('3.2 Application Roles (14 Roles)', 'H2', s, 1))
story.append(body('The application sidebar and route protection use an expanded set of 14 roles for more granular access control:', s))
app_roles = make_table(
    ['App Role', 'DB Role Mapping', 'Sidebar Access'],
    [
        ['super_admin', 'SUPER_ADMIN', 'All modules + Tenant Management + AI Admin'],
        ['admin', 'ADMIN', 'All modules within tenant organization'],
        ['hr', 'HR', 'Employee, Recruitment, Onboarding, Leave, Payroll, Performance'],
        ['manager', 'MANAGER', 'Team view, Approvals, Performance, Attendance, Leave'],
        ['employee', 'EMPLOYEE', 'Self-service, Leave, Attendance, Helpdesk, Training'],
        ['recruiter', 'HR', 'Recruitment, AI Interview, Offers, Candidate Management'],
        ['interviewer', 'HR / MANAGER', 'AI Interview, Candidate Assessment'],
        ['payroll_admin', 'HR', 'Payroll, Tax, Reports, Salary Structure'],
        ['trainer', 'HR / MANAGER', 'Training, Course Management, Assessments'],
        ['finance', 'HR / ADMIN', 'Payroll, Expenses, FNF, Loans, Travel'],
        ['it_admin', 'ADMIN', 'Asset Management, IT Provisioning, Helpdesk'],
        ['helpdesk_agent', 'EMPLOYEE / HR', 'Helpdesk, AI Assistant, Ticket Management'],
        ['compliance_officer', 'HR / ADMIN', 'Compliance, Audit Logs, Reports'],
        ['viewer', 'EMPLOYEE', 'Read-only access to permitted modules'],
    ],
    s, [120, 120, 230]
)
story.append(app_roles)
story.append(Spacer(1, 8))

story.append(heading('3.3 Sidebar Role Filtering', 'H2', s, 1))
story.append(body('The NEXUS sidebar navigation implements role-based filtering to ensure users only see menu items relevant to their assigned role. The filtering mechanism works as follows:', s))
sidebar_steps = [
    'Upon login, the user\'s role is extracted from the JWT token payload.',
    'The sidebar configuration maps each menu item to an array of permitted roles.',
    'The rendering engine filters menu items based on the current user\'s role.',
    'Only authorized menu items are displayed in the sidebar navigation.',
    'Direct URL access to unauthorized routes is handled by client-side route guards.',
    'API-level protection ensures that even if UI is bypassed, data access is controlled.'
]
for step in sidebar_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('3.4 API Route Protection', 'H2', s, 1))
story.append(body('API route protection in NEXUS is implemented through authentication middleware that verifies the JWT token on protected routes. The protection operates at multiple levels:', s))
api_prot = [
    '<b>Token Verification:</b> All protected API routes extract and verify the JWT token from the Authorization header using jose.jwtVerify().',
    '<b>Role-Based Access:</b> Certain API routes check the user\'s role from the token payload to determine if the requested operation is permitted.',
    '<b>Tenant Isolation:</b> API routes that query tenant-scoped data include tenantId filtering from the token payload to ensure data isolation.',
    '<b>Ownership Validation:</b> Employee-level operations validate that the authenticated user is accessing only their own data (e.g., own leave requests, own profile).',
    '<b>Important Note:</b> The current middleware implementation includes a pass-through for unauthenticated routes, which means some routes may not enforce authentication consistently. See Section 7 for details.'
]
for item in api_prot:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 4. Data Security ──
story.append(heading('4. Data Security', 'H1', s, 0))
story.append(body('Data security in NEXUS HRMS is critical given the sensitivity of HR data including personal information, salary details, performance records, and medical information. The platform implements multiple layers of data protection.', s))
story.append(Spacer(1, 6))

story.append(heading('4.1 Multi-Tenant Data Isolation', 'H2', s, 1))
story.append(body('NEXUS implements multi-tenant data isolation at the database level using tenantId foreign keys on all tenant-scoped models. This approach ensures that each organization\'s data is logically separated within the shared database infrastructure.', s))
isolation_details = [
    '<b>tenantId Foreign Key:</b> Every tenant-scoped model (Employee, Leave, Payroll, etc.) includes a tenantId field that references the Tenant model. All queries include tenantId filtering to ensure data isolation.',
    '<b>Shared Database, Logical Isolation:</b> Unlike separate database per tenant, NEXUS uses a single database with logical isolation through tenantId. This reduces infrastructure overhead while maintaining data separation.',
    '<b>Query-Level Enforcement:</b> Prisma queries must explicitly include tenantId in where clauses. The system relies on API route implementations to consistently include tenantId filtering.',
    '<b>Cross-Tenant Access Prevention:</b> The JWT token includes the tenantId claim, and API routes use this to filter queries. This prevents a user from one tenant accessing another tenant\'s data through the API.',
    '<b>Super Admin Scope:</b> The SUPER_ADMIN role has access to all tenant data for platform management. This is an intentional design decision for administrative operations.'
]
for detail in isolation_details:
    story.append(bullet(detail, s))
story.append(Spacer(1, 8))

story.append(heading('4.2 Database Security', 'H2', s, 1))
story.append(body('The NEXUS database layer leverages Neon serverless PostgreSQL with built-in security features:', s))
db_sec = make_table(
    ['Security Feature', 'Implementation', 'Protection Level'],
    [
        ['Connection Encryption', 'Neon SSL/TLS for all connections', 'Data in transit encryption'],
        ['SQL Injection Prevention', 'Prisma ORM parameterized queries', 'No raw SQL execution'],
        ['Access Control', 'Database credentials via env vars', 'Credential isolation'],
        ['Connection Pooling', 'Neon serverless connection pooling', 'Connection limit protection'],
        ['Database Hosting', 'Neon cloud (AWS infrastructure)', 'Physical security by provider'],
        ['Backup & Recovery', 'Neon point-in-time recovery', 'Data durability'],
        ['Schema Migration', 'Prisma migrate with versioning', 'Controlled schema changes'],
    ],
    s, [130, 190, 150]
)
story.append(db_sec)
story.append(Spacer(1, 8))

story.append(heading('4.3 Prisma ORM Security Benefits', 'H2', s, 1))
story.append(body('The use of Prisma ORM provides several security advantages for data access:', s))
prisma_benefits = [
    '<b>SQL Injection Prevention:</b> Prisma generates parameterized queries automatically, eliminating the risk of SQL injection attacks through user input.',
    '<b>Type Safety:</b> Prisma\'s generated client provides TypeScript type safety, reducing runtime errors and potential data access vulnerabilities.',
    '<b>Query Validation:</b> Prisma validates query structure before execution, preventing malformed queries from reaching the database.',
    '<b>Schema Enforcement:</b> The Prisma schema defines data types, relations, and constraints, ensuring data integrity at the application level.',
    '<b>Migration Safety:</b> Prisma Migrate provides controlled schema changes with rollback capability, reducing the risk of data corruption during updates.'
]
for benefit in prisma_benefits:
    story.append(bullet(benefit, s))
story.append(Spacer(1, 12))

# ── 5. API Security ──
story.append(heading('5. API Security', 'H1', s, 0))
story.append(body('API security encompasses the protection of all HTTP endpoints exposed by the NEXUS platform. This section covers authentication mechanisms, CORS configuration, rate limiting considerations, and input validation practices.', s))
story.append(Spacer(1, 6))

story.append(heading('5.1 Bearer Token Authentication', 'H2', s, 1))
story.append(body('All protected API endpoints require a valid JWT Bearer token in the Authorization header. The authentication flow for API requests:', s))
bearer_steps = [
    'Client retrieves the JWT token from localStorage.',
    'Token is included in the Authorization header as "Bearer &lt;token&gt;".',
    'API middleware extracts the token and verifies it using jose.jwtVerify().',
    'If verification succeeds, the request proceeds with the decoded user context.',
    'If verification fails, the API returns a 401 Unauthorized response.',
    'Expired tokens require the user to re-authenticate through the login flow.'
]
for step in bearer_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('5.2 CORS Configuration', 'H2', s, 1))
story.append(body('Cross-Origin Resource Sharing (CORS) is configured through Next.js middleware to control which domains can access the API endpoints:', s))
cors_details = [
    '<b>Allowed Origins:</b> Only the deployed application domain is permitted for API access in production.',
    '<b>HTTP Methods:</b> GET, POST, PUT, PATCH, DELETE are allowed as needed for API operations.',
    '<b>Headers:</b> Authorization, Content-Type, and custom headers are permitted for cross-origin requests.',
    '<b>Credentials:</b> Cookie-based credentials are supported for specific authentication flows.',
    '<b>Preflight Handling:</b> OPTIONS requests are handled automatically by the Next.js middleware for CORS preflight checks.'
]
for detail in cors_details:
    story.append(bullet(detail, s))
story.append(Spacer(1, 8))

story.append(heading('5.3 Rate Limiting Considerations', 'H2', s, 1))
story.append(body('Rate limiting is an important consideration for protecting the API from abuse, brute-force attacks, and denial-of-service attempts:', s))
rate_items = [
    '<b>Current Status:</b> Application-level rate limiting is not currently implemented in the base NEXUS deployment. Reliance is placed on Vercel\'s platform-level rate limiting.',
    '<b>Authentication Endpoints:</b> The login endpoint (<font face="DejaVuMono">/api/auth/login</font>) is particularly vulnerable to brute-force attacks and should be rate-limited.',
    '<b>AI Endpoints:</b> AI-powered endpoints (<font face="DejaVuMono">/api/ai-interview</font>, <font face="DejaVuMono">/api/ai-chat</font>) should have rate limiting to control API costs.',
    '<b>Recommended Approach:</b> Implement rate limiting using Vercel KV with Upstash for distributed rate limiting across edge functions.',
    '<b>Rate Limit Thresholds:</b> Suggested limits: Login - 5 attempts per minute; API - 100 requests per minute; AI endpoints - 20 requests per minute per user.'
]
for item in rate_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('5.4 Input Validation', 'H2', s, 1))
story.append(body('Input validation is performed at both the client and server levels to prevent injection attacks and data corruption:', s))
validation_items = [
    '<b>Client-Side Validation:</b> Form validation using React Hook Form with Zod schema validation provides immediate feedback and prevents obviously invalid data submission.',
    '<b>Server-Side Validation:</b> API routes should validate all input data before processing. Current implementation varies across routes; consistent validation is recommended.',
    '<b>Data Sanitization:</b> All user inputs should be sanitized before database storage to prevent XSS (Cross-Site Scripting) and injection attacks.',
    '<b>File Upload Validation:</b> Document and image uploads should validate file type, size, and content before processing.',
    '<b>Type Checking:</b> TypeScript provides compile-time type checking, reducing runtime type-related vulnerabilities.'
]
for item in validation_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 6. Infrastructure Security ──
story.append(heading('6. Infrastructure Security', 'H1', s, 0))
story.append(body('Infrastructure security encompasses the hosting platform, database infrastructure, and deployment pipeline that underpin the NEXUS HRMS platform.', s))
story.append(Spacer(1, 6))

story.append(heading('6.1 Vercel Deployment Security', 'H2', s, 1))
vercel_sec = make_table(
    ['Feature', 'Implementation', 'Security Benefit'],
    [
        ['HTTPS/TLS', 'Automatic SSL certificates', 'Encrypted data in transit'],
        ['DDoS Protection', 'Vercel edge network', 'Distributed attack mitigation'],
        ['Deployment Isolation', 'Serverless function isolation', 'Process-level separation'],
        ['Access Control', 'Vercel team authentication', 'Authorized deployments only'],
        ['Audit Logging', 'Deployment activity logs', 'Change tracking'],
        ['Edge Network', 'Global CDN distribution', 'Performance + availability'],
        ['Preview Deployments', 'Branch-based previews', 'Safe testing environment'],
    ],
    s, [130, 180, 160]
)
story.append(vercel_sec)
story.append(Spacer(1, 8))

story.append(heading('6.2 Neon PostgreSQL Security', 'H2', s, 1))
neon_sec = [
    '<b>Encryption at Rest:</b> Neon encrypts all data at rest using AES-256 encryption on the underlying storage infrastructure.',
    '<b>Encryption in Transit:</b> All connections to Neon PostgreSQL use SSL/TLS encryption, ensuring data security during transmission.',
    '<b>Network Isolation:</b> Neon databases are hosted in isolated VPC environments within AWS infrastructure.',
    '<b>Access Control:</b> Database access is controlled through connection strings with credentials stored as Vercel environment variables.',
    '<b>Point-in-Time Recovery:</b> Neon provides point-in-time recovery capabilities for data restoration in case of accidental deletion or corruption.',
    '<b>Branching:</b> Neon\'s database branching feature allows creating isolated database copies for testing without affecting production data.',
    '<b>Auto-Suspend:</b> Neon serverless computes auto-suspend after inactivity, reducing the attack surface during idle periods.'
]
for item in neon_sec:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('6.3 Environment Variable Management', 'H2', s, 1))
story.append(body('Environment variables in NEXUS are managed through Vercel\'s encrypted environment variable system:', s))
env_items = [
    '<b>JWT_SECRET:</b> The secret key used for signing and verifying JWT tokens. Must be a strong, random string of at least 32 characters.',
    '<b>DATABASE_URL:</b> The Neon PostgreSQL connection string. Contains host, credentials, and SSL parameters.',
    '<b>NEXT_PUBLIC_* Variables:</b> Variables prefixed with NEXT_PUBLIC_ are exposed to the client bundle. Only non-sensitive configuration should use this prefix.',
    '<b>Encryption:</b> All environment variables are encrypted at rest in Vercel\'s infrastructure.',
    '<b>Environment Scoping:</b> Variables can be scoped to Production, Preview, or Development environments.',
    '<b>Access Control:</b> Only authorized team members with Vercel project access can view or modify environment variables.',
    '<b>Warning:</b> The current codebase includes a fallback JWT secret (<font face="DejaVuMono">your-secret-key</font>) which is a critical security vulnerability. See Section 7.'
]
for item in env_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 7. Audit & Compliance ──
story.append(heading('7. Audit & Compliance', 'H1', s, 0))
story.append(body('The NEXUS platform includes audit logging and compliance tracking capabilities to maintain accountability, support incident investigation, and meet regulatory requirements.', s))
story.append(Spacer(1, 6))

story.append(heading('7.1 AuditLog Model', 'H2', s, 1))
story.append(body('The AuditLog model captures a comprehensive record of significant actions across the platform:', s))
audit_fields = make_table(
    ['Field', 'Type', 'Purpose'],
    [
        ['id', 'Int (Auto)', 'Unique audit log entry identifier'],
        ['action', 'String', 'Description of the action performed'],
        ['entity', 'String', 'Target entity type (e.g., Employee, Leave)'],
        ['entityId', 'String', 'Identifier of the affected record'],
        ['userId', 'String', 'ID of the user who performed the action'],
        ['tenantId', 'String', 'Tenant context for multi-tenant isolation'],
        ['details', 'String (Optional)', 'Additional context or change details'],
        ['ipAddress', 'String (Optional)', 'IP address of the client'],
        ['timestamp', 'DateTime', 'When the action occurred (auto-set)'],
    ],
    s, [100, 120, 250]
)
story.append(audit_fields)
story.append(Spacer(1, 8))

story.append(heading('7.2 LoginActivity Tracking', 'H2', s, 1))
story.append(body('The LoginActivity model specifically tracks user authentication events for security monitoring:', s))
login_tracking = [
    '<b>Login Events:</b> Every successful login is recorded with timestamp, user ID, and session details.',
    '<b>Failed Login Attempts:</b> Failed authentication attempts should be logged to detect brute-force attacks (implementation recommended).',
    '<b>Session Duration:</b> Login and logout timestamps enable calculation of session duration for compliance reporting.',
    '<b>Geographic Analysis:</b> IP address tracking (when available) enables geographic analysis of login patterns for anomaly detection.',
    '<b>Multi-Device Detection:</b> Concurrent session tracking can identify unusual access patterns indicating potential account compromise.'
]
for item in login_tracking:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('7.3 Notification System for Security Events', 'H2', s, 1))
story.append(body('The NEXUS notification system provides real-time alerts for security-relevant events:', s))
notif_items = [
    '<b>Login Notifications:</b> Users receive notifications for login events on their account.',
    '<b>Role Change Alerts:</b> Changes to user roles trigger notifications to both the affected user and administrators.',
    '<b>Data Access Alerts:</b> Sensitive data access (salary information, personal records) can be configured to generate audit notifications.',
    '<b>Bulk Operation Warnings:</b> Bulk data export or modification operations trigger admin notifications.',
    '<b>System Alerts:</b> Platform-level security events (failed login spikes, unusual API patterns) alert the Super Admin.'
]
for item in notif_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 8. Vulnerability Assessment ──
story.append(heading('8. Vulnerability Assessment', 'H1', s, 0))
story.append(body('This section documents known security gaps and vulnerabilities identified in the current NEXUS HRMS implementation. These items require attention for production deployment and are prioritized by severity.', s))
story.append(Spacer(1, 6))

story.append(heading('8.1 Critical Vulnerabilities', 'H2', s, 1))
vulns_critical = make_table(
    ['Vulnerability', 'Severity', 'Description', 'Impact'],
    [
        ['JWT Fallback Secret', 'Critical', 'Code includes fallback secret "your-secret-key" when JWT_SECRET env var is not set', 'Attackers can forge valid JWT tokens with known secret'],
        ['No Server-Side Route Protection', 'Critical', 'Pages are accessible via direct URL without server-side auth check', 'Unauthorized data access bypassing client-side guards'],
        ['Middleware Pass-Through', 'Critical', 'Middleware allows unauthenticated requests through to protected routes', 'API endpoints accessible without valid tokens'],
    ],
    s, [120, 60, 180, 110]
)
story.append(vulns_critical)
story.append(Spacer(1, 8))

story.append(heading('8.2 High Severity Issues', 'H2', s, 1))
vulns_high = make_table(
    ['Vulnerability', 'Severity', 'Description', 'Impact'],
    [
        ['Role Mismatch', 'High', '5 DB roles vs 14 app roles create authorization inconsistencies', 'Users may access unauthorized features'],
        ['No Rate Limiting', 'High', 'API endpoints lack application-level rate limiting', 'Brute-force and DoS attack vulnerability'],
        ['Token in localStorage', 'High', 'JWT stored in localStorage is vulnerable to XSS', 'Token theft through XSS attacks'],
        ['No Refresh Tokens', 'High', 'Single 24h token with no refresh mechanism', 'Forced re-authentication or extended vulnerability window'],
        ['No CSRF Protection', 'High', 'No CSRF tokens for state-changing operations', 'Cross-site request forgery attacks'],
    ],
    s, [120, 60, 180, 110]
)
story.append(vulns_high)
story.append(Spacer(1, 8))

story.append(heading('8.3 Medium Severity Issues', 'H2', s, 1))
vulns_medium = make_table(
    ['Vulnerability', 'Severity', 'Description', 'Impact'],
    [
        ['Inconsistent Input Validation', 'Medium', 'Input validation varies across API routes', 'Potential injection attacks on weak routes'],
        ['No Password Policy', 'Medium', 'No minimum password complexity requirements', 'Weak passwords susceptible to cracking'],
        ['No Account Lockout', 'Medium', 'No lockout after failed login attempts', 'Unlimited brute-force attempts possible'],
        ['Error Information Leakage', 'Medium', 'Some API errors expose internal details', 'Information disclosure to attackers'],
        ['No Security Headers', 'Medium', 'Missing CSP, X-Frame-Options, etc.', 'Clickjacking and XSS vulnerability'],
        ['Incomplete Audit Logging', 'Medium', 'Not all critical operations are logged', 'Gaps in forensic investigation capability'],
    ],
    s, [140, 60, 170, 100]
)
story.append(vulns_medium)
story.append(Spacer(1, 12))

# ── 9. Security Recommendations ──
story.append(heading('9. Security Recommendations', 'H1', s, 0))
story.append(body('Based on the vulnerability assessment and security architecture review, the following recommendations are provided in priority order for strengthening the NEXUS HRMS security posture.', s))
story.append(Spacer(1, 6))

story.append(heading('9.1 Critical Priority Recommendations', 'H2', s, 1))
crit_recs = [
    '<b>R1 — Remove JWT Fallback Secret:</b> Remove the fallback "your-secret-key" from the JWT signing code. The application should fail to start if JWT_SECRET is not configured, not silently use an insecure default.',
    '<b>R2 — Implement Server-Side Route Protection:</b> Add server-side authentication checks to all page routes using Next.js middleware or getServerSideProps. Never rely solely on client-side route guards.',
    '<b>R3 — Fix Middleware Pass-Through:</b> Update the middleware to block unauthenticated requests to protected routes. Remove or restrict the pass-through logic that allows requests without valid tokens.',
    '<b>R4 — Implement Rate Limiting:</b> Add rate limiting to all API endpoints, especially authentication endpoints. Use Vercel KV with Upstash for distributed rate limiting.',
    '<b>R5 — Move Token Storage to HttpOnly Cookies:</b> Replace localStorage token storage with HttpOnly, Secure, SameSite cookies to protect against XSS-based token theft.'
]
for rec in crit_recs:
    story.append(bullet(rec, s))
story.append(Spacer(1, 8))

story.append(heading('9.2 High Priority Recommendations', 'H2', s, 1))
high_recs = [
    '<b>R6 — Implement Refresh Token Rotation:</b> Add short-lived access tokens (15-30 minutes) with longer-lived refresh tokens that rotate on each use. This limits the damage window of token compromise.',
    '<b>R7 — Unify Role Model:</b> Reconcile the 5 DB roles and 14 app roles into a consistent authorization model. Implement a role-permission mapping table that both DB and UI reference.',
    '<b>R8 — Add CSRF Protection:</b> Implement CSRF tokens for all state-changing operations (POST, PUT, DELETE). Use the double-submit cookie pattern or synchronizer token pattern.',
    '<b>R9 — Implement Password Policy:</b> Enforce minimum password complexity (8+ characters, mixed case, numbers, special characters). Add password strength meter on the registration form.',
    '<b>R10 — Add Account Lockout:</b> Implement progressive lockout after failed login attempts (e.g., lock after 5 failures, unlock after 15 minutes or admin action).'
]
for rec in high_recs:
    story.append(bullet(rec, s))
story.append(Spacer(1, 8))

story.append(heading('9.3 Medium Priority Recommendations', 'H2', s, 1))
med_recs = [
    '<b>R11 — Standardize Input Validation:</b> Create a shared validation middleware using Zod schemas for all API routes. Ensure consistent validation across all endpoints.',
    '<b>R12 — Add Security Headers:</b> Implement Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers using Next.js configuration.',
    '<b>R13 — Implement Comprehensive Audit Logging:</b> Ensure all CRUD operations on sensitive models (Employee, Payroll, User) are logged with full change details including before/after values.',
    '<b>R14 — Add File Upload Security:</b> Validate file type (magic bytes, not just extension), enforce size limits, scan for malware, and store uploads outside the web root.',
    '<b>R15 — Implement Data Encryption at Application Level:</b> Encrypt particularly sensitive fields (SSN, bank account numbers) at the application level in addition to database-level encryption.',
    '<b>R16 — Add Session Management:</b> Implement server-side session tracking with the ability to invalidate specific sessions, force logout, and detect concurrent sessions.',
    '<b>R17 — Implement API Versioning:</b> Add API versioning to enable controlled security updates without breaking existing integrations.',
    '<b>R18 — Add Dependency Scanning:</b> Integrate automated dependency vulnerability scanning (npm audit, Snyk) into the CI/CD pipeline.'
]
for rec in med_recs:
    story.append(bullet(rec, s))
story.append(Spacer(1, 8))

story.append(heading('9.4 Standard Priority Recommendations', 'H2', s, 1))
std_recs = [
    '<b>R19 — Implement Content Security Policy:</b> Define a strict CSP that prevents inline script execution and limits resource loading to trusted sources.',
    '<b>R20 — Add Subresource Integrity:</b> Add SRI hashes to all externally loaded scripts and stylesheets to prevent tampering.',
    '<b>R21 — Implement Logging Infrastructure:</b> Set up centralized logging with structured log formats, retention policies, and alerting on security events.',
    '<b>R22 — Add Penetration Testing:</b> Conduct regular penetration testing by qualified security professionals, at minimum before major releases.',
    '<b>R23 — Implement Security Training:</b> Provide regular security awareness training to all development team members on OWASP Top 10 and secure coding practices.',
    '<b>R24 — Add Incident Response Plan:</b> Develop and document an incident response plan with defined roles, communication channels, and escalation procedures.',
    '<b>R25 — Implement Data Masking:</b> Mask sensitive data in non-production environments (e.g., replace real SSNs with generated values in staging/development databases).',
    '<b>R26 — Add Two-Factor Authentication:</b> Implement optional 2FA/MFA for all user accounts, mandatory for admin roles.',
    '<b>R27 — Implement IP Whitelisting:</b> Add optional IP whitelisting for admin access to restrict management functions to approved networks.',
    '<b>R28 — Add Database Query Monitoring:</b> Implement database query monitoring to detect unusual query patterns that may indicate data exfiltration attempts.'
]
for rec in std_recs:
    story.append(bullet(rec, s))
story.append(Spacer(1, 12))

# ── 10. Data Privacy & GDPR ──
story.append(heading('10. Data Privacy & GDPR Considerations', 'H1', s, 0))
story.append(body('As an HRMS platform processing personal data of employees across potentially multiple jurisdictions, NEXUS must address data privacy regulations including GDPR (EU), CCPA (California), and other applicable privacy laws.', s))
story.append(Spacer(1, 6))

story.append(heading('10.1 GDPR Compliance Considerations', 'H2', s, 1))
gdpr_items = [
    '<b>Lawful Basis for Processing:</b> HR data processing typically relies on "legitimate interest" (employment relationship) and "legal obligation" (tax, labor law compliance). The platform should document the lawful basis for each data processing activity.',
    '<b>Data Minimization:</b> Collect only the minimum personal data necessary for each HR function. Review all data fields to ensure each serves a documented purpose.',
    '<b>Right to Access (Article 15):</b> Employees should be able to access all personal data held about them. The Employee self-service portal partially addresses this requirement.',
    '<b>Right to Rectification (Article 16):</b> Employees can update certain personal details through self-service. A formal process for rectification requests should be documented.',
    '<b>Right to Erasure (Article 17):</b> Implement a data deletion workflow that handles erasure requests while maintaining legally required retention of employment records.',
    '<b>Data Portability (Article 20):</b> Provide the ability to export employee personal data in a machine-readable format (JSON, CSV).',
    '<b>Consent Management:</b> Track consent for optional data processing activities (e.g., background verification, photo usage) with timestamp and version of the consent form.',
    '<b>Data Processing Records (Article 30):</b> Maintain records of all data processing activities, including purposes, categories of data, recipients, and retention periods.'
]
for item in gdpr_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('10.2 Data Retention & Deletion Policy', 'H2', s, 1))
retention_tbl = make_table(
    ['Data Category', 'Retention Period', 'Legal Basis', 'Deletion Method'],
    [
        ['Active Employee Records', 'Duration of employment + 7 years', 'Legal obligation (tax/labor)', 'Automated archival after period'],
        ['Payroll Records', '7 years after tax year', 'Legal obligation (tax)', 'Scheduled deletion with audit'],
        ['Recruitment Data (Hired)', 'Duration of employment + 7 years', 'Employment contract', 'Part of employee record deletion'],
        ['Recruitment Data (Not Hired)', '6 months after decision', 'Consent / Legitimate interest', 'Automated deletion after period'],
        ['Attendance Records', '3 years', 'Legal obligation (labor)', 'Automated archival and deletion'],
        ['Performance Records', 'Duration of employment + 3 years', 'Legitimate interest', 'Archival with restricted access'],
        ['Audit Logs', '5 years', 'Legal obligation (compliance)', 'Automated deletion after period'],
        ['Login Activity', '1 year', 'Security / Legitimate interest', 'Automated deletion after period'],
    ],
    s, [130, 130, 120, 110]
)
story.append(retention_tbl)
story.append(Spacer(1, 8))

story.append(heading('10.3 Privacy by Design Principles', 'H2', s, 1))
pbpd_items = [
    '<b>Proactive not Reactive:</b> Implement privacy measures before data is collected, not after a breach. This includes encryption, access controls, and minimization by default.',
    '<b>Privacy as Default Setting:</b> Default configurations should maximize privacy. For example, employee profile fields should have minimum visibility by default.',
    '<b>Privacy Embedded into Design:</b> Privacy considerations should be part of the development process for every new feature, not an afterthought.',
    '<b>Full Functionality — Positive-Sum:</b> Design features that achieve both functionality and privacy without unnecessary trade-offs.',
    '<b>End-to-End Security — Lifecycle Protection:</b> Protect data from collection through processing to deletion with appropriate security measures at each stage.',
    '<b>Visibility and Transparency:</b> Make data processing practices visible to data subjects through clear privacy notices and accessible data dashboards.',
    '<b>Respect for User Privacy:</b> Prioritize the data subject\'s interests in all design decisions, providing granular controls and meaningful choices.'
]
for item in pbpd_items:
    story.append(bullet(item, s))

# ── Build ──
doc.multiBuild(story)

cover_pdf = generate_cover('Security Features<br/>Documentation', 'Comprehensive Security Architecture &amp; Compliance Reference', 'security_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS Security Documentation')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
