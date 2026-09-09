const { Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageNumber, PageBreak, BorderStyle, ShadingType, WidthType,
  TableOfContents, NumberFormat, SectionType } = require("docx");
const fs = require("fs");

// Palette: DM-1 Deep Cyan (Tech/AI)
const P = {
  primary: "162235", body: "1A2B40", secondary: "6878A0",
  accent: "37DCF2", surface: "F4F8FC",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" }
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : level === HeadingLevel.HEADING_2 ? 280 : 220, after: 120 },
    children: [new TextRun({ text, bold: true, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 28 : 26 })]
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
  });
}

function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    shading: { type: ShadingType.CLEAR, fill: "F0F4F8" },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 20, color: "2D3748", font: { ascii: "Courier New" } })]
  });
}

function bulletItem(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    indent: { left: 720, hanging: 360 },
    children: [new TextRun({ text: "\u2022 " + text, size: 24, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
  });
}

function makeTable(headers, rows) {
  const t = P.table;
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, size: 21, color: t.headerText, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] })],
    shading: { type: ShadingType.CLEAR, fill: t.headerBg },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  }));
  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 21, color: P.body, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] })],
      shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: t.surface } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
    }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: t.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: headerCells, tableHeader: true, cantSplit: true }), ...dataRows],
  });
}

// ===================== COVER PAGE (R1 - Deep Cyan) =====================
function buildCover() {
  const titleLines = ["NEXUS HRMS", "Security Documentation"];
  const children = [
    new Paragraph({ spacing: { before: 3600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { line: 920, lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[0], bold: true, size: 72, color: P.cover.titleColor, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })]
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { line: 660, lineRule: "atLeast", after: 200 },
      children: [new TextRun({ text: titleLines[1], bold: true, size: 44, color: P.accent, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })]
    }),
    new Paragraph({
      indent: { left: 1200, right: 1200 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 20 } },
      spacing: { before: 200 }, children: []
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { before: 300, line: 400 },
      children: [new TextRun({ text: "Comprehensive Security Architecture & Practices", size: 28, color: P.cover.subtitleColor, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { before: 100, line: 360 },
      children: [new TextRun({ text: "SaaS-Based AI-Powered Human Resource Management System", size: 22, color: P.cover.subtitleColor, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
    }),
    new Paragraph({ spacing: { before: 2000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { line: 360 },
      children: [new TextRun({ text: "Version 1.0  |  March 2026", size: 20, color: P.cover.metaColor, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { line: 360 },
      children: [new TextRun({ text: "NEXUS HRMS Security Team", size: 20, color: P.cover.metaColor, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })]
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      indent: { left: 1200 },
      spacing: { line: 360 },
      children: [new TextRun({ text: "CONFIDENTIAL", size: 20, bold: true, color: P.accent, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })]
    }),
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        verticalAlign: "top",
        shading: { type: ShadingType.CLEAR, fill: P.primary },
        children: children,
      })]
    })]
  });
}

// ===================== BODY CONTENT =====================
const content = [];

// ====== 1. Authentication Security ======
content.push(heading("1. Authentication Security"));
content.push(body("Authentication is the foundational security layer of NEXUS HRMS, serving as the gateway through which all users access the platform's sensitive HR data. The system implements a robust, multi-layered authentication architecture that combines industry-standard cryptographic practices with comprehensive activity tracking. Given the highly sensitive nature of HR data\u2014including personal identifiable information (PII), salary details, bank account numbers, and performance evaluations\u2014the authentication subsystem is designed to resist both brute-force attacks and credential-based threats while maintaining a seamless user experience."));
content.push(body("The authentication framework is built on JSON Web Tokens (JWT) using the jose library, which provides a standards-compliant implementation of the JWT specification (RFC 7519). Tokens are signed using the HMAC-SHA256 (HS256) algorithm with a server-side secret key, ensuring both integrity and authenticity of the token payload. Each token carries a standardized set of claims including the user ID, email, role, tenant ID, issued-at timestamp (iat), and expiration time (exp). The 24-hour expiry window balances security against user convenience, requiring re-authentication daily while avoiding excessive login friction."));
content.push(body("Password security is implemented using bcryptjs with 12 salt rounds, which provides adaptive hashing that is resistant to rainbow table attacks and GPU-accelerated brute-force attempts. The bcrypt algorithm incorporates a cost factor that determines the number of key expansion rounds; at 12 rounds, each password hash requires approximately 250 milliseconds of computation time, making large-scale brute-force attacks computationally infeasible. Passwords are never stored in plaintext, and the system never logs or exposes password values at any point in the authentication flow."));
content.push(body("Token extraction follows a dual-path strategy, checking both the Authorization header (Bearer token) and the cookie header. This design supports both API-first access patterns (where clients send tokens via the Authorization header) and browser-based sessions (where tokens are stored in HTTP-only cookies). The getTokenFromHeaders function in the auth module implements this dual extraction, providing flexibility without compromising security. Every API request undergoes session validation by verifying the JWT signature and checking the expiration claim, ensuring that expired or tampered tokens are rejected immediately."));

content.push(heading("1.1 JWT Implementation Details", HeadingLevel.HEADING_2));
content.push(body("The JWT implementation in NEXUS HRMS leverages the jose library, a modern JavaScript implementation of the JOSE (JSON Object Signing and Encryption) specification. Unlike the older jsonwebtoken library, jose is designed for modern JavaScript runtimes and provides native support for Edge and serverless environments. The token creation process uses the SignJWT class, which follows a fluent builder pattern for constructing signed tokens."));
content.push(codeBlock("// Token creation (src/lib/auth.ts)"));
content.push(codeBlock("const JWT_SECRET = new TextEncoder().encode("));
content.push(codeBlock("  process.env.JWT_SECRET || 'nexus-hrms-fallback-secret'"));
content.push(codeBlock(");"));
content.push(codeBlock("export async function createToken(payload: object): Promise<string> {"));
content.push(codeBlock("  return new SignJWT(payload as Record<string, unknown>)"));
content.push(codeBlock("    .setProtectedHeader({ alg: 'HS256' })"));
content.push(codeBlock("    .setIssuedAt()"));
content.push(codeBlock("    .setExpirationTime('24h')"));
content.push(codeBlock("    .sign(JWT_SECRET);"));
content.push(codeBlock("}"));
content.push(body("The token verification process uses the jwtVerify function, which validates both the signature and the expiration claim. If the token is expired, malformed, or signed with a different secret, the verification returns null, and the calling code treats this as an authentication failure. This fail-closed approach ensures that any uncertainty in token validity results in denial of access rather than potential unauthorized access."));

content.push(heading("1.2 Password Security & Complexity", HeadingLevel.HEADING_2));
content.push(body("Password hashing is performed using bcryptjs with 12 salt rounds, which generates a unique 128-bit salt for each password before hashing. This ensures that even if two users choose the same password, their stored hashes will be completely different. The bcrypt algorithm is specifically designed to be slow (by increasing the cost factor), making it resistant to offline brute-force attacks even if the database is compromised."));
content.push(makeTable(
  ["Security Parameter", "Value", "Rationale"],
  [
    ["Algorithm", "bcrypt", "Adaptive hashing resistant to GPU/ASIC attacks"],
    ["Salt Rounds", "12", "~250ms per hash; balances security and performance"],
    ["Min Password Length", "8 characters", "Minimum threshold for basic entropy"],
    ["Token Algorithm", "HS256", "HMAC with SHA-256; widely supported and secure"],
    ["Token Expiry", "24 hours", "Daily re-auth; limits exposure window"],
    ["Token Storage", "Authorization header + Cookie", "Dual-path extraction for API and browser clients"],
  ]
));

content.push(heading("1.3 Login Activity Tracking", HeadingLevel.HEADING_2));
content.push(body("The LoginActivity Prisma model provides comprehensive tracking of all authentication events across the platform. Every login, logout, and failed authentication attempt is recorded with metadata including the user ID, action type, IP address, user agent string, and inferred geographic location. This data serves multiple security purposes: it enables detection of brute-force attacks, identification of suspicious login patterns (such as logins from unusual geographic locations), and provides forensic evidence in the event of a security incident."));
content.push(body("The LoginActivity model tracks three distinct action types: 'login' for successful authentication, 'logout' for explicit session termination, and 'failed_login' for unsuccessful authentication attempts. The IP and userAgent fields enable security teams to correlate authentication events with specific devices and network locations. The location field stores inferred geographic data based on IP geolocation, enabling rapid identification of access from unexpected regions."));
content.push(makeTable(
  ["LoginActivity Field", "Type", "Purpose"],
  [
    ["id", "String (cuid)", "Unique identifier for each activity record"],
    ["userId", "String", "Foreign key reference to the User model"],
    ["action", "String", "Event type: login, logout, or failed_login"],
    ["ip", "String?", "Client IP address at time of event"],
    ["userAgent", "String?", "Browser/client user agent string"],
    ["location", "String?", "Inferred geographic location from IP"],
    ["createdAt", "DateTime", "Timestamp of the authentication event"],
  ]
));

content.push(heading("1.4 Account Protection Mechanisms", HeadingLevel.HEADING_2));
content.push(body("NEXUS HRMS implements several account protection mechanisms to guard against unauthorized access. While the current implementation provides foundational protections, the architecture is designed to support additional security enhancements including account lockout policies, multi-factor authentication (MFA), and password complexity enforcement. The account lockout mechanism is planned to automatically disable accounts after a configurable number of consecutive failed login attempts, with escalation thresholds that trigger longer lockout periods."));
content.push(body("Multi-factor authentication represents the next evolution of the platform's authentication security. The architecture supports MFA integration through the existing JWT-based session management, where a secondary verification step (such as TOTP, SMS OTP, or authenticator app) can be required before the JWT is issued. The token payload includes a 'mfaVerified' claim that indicates whether the user has completed the second-factor verification, enabling fine-grained access control where sensitive operations require MFA completion."));
content.push(makeTable(
  ["Risk", "Likelihood", "Impact", "Mitigation"],
  [
    ["Brute-force password attack", "Medium", "High", "bcrypt 12 rounds + planned lockout after 5 failed attempts"],
    ["Credential stuffing", "Medium", "High", "Unique password requirement + planned MFA enforcement"],
    ["Token theft (XSS)", "Low", "Critical", "HTTP-only cookies + short token expiry + planned token rotation"],
    ["Session hijacking", "Low", "High", "IP validation + HTTPS enforcement + planned refresh tokens"],
    ["Weak passwords", "Medium", "Medium", "Complexity requirements + planned password strength scoring"],
  ]
));

// ====== 2. Authorization & Access Control ======
content.push(heading("2. Authorization & Access Control"));
content.push(body("Authorization in NEXUS HRMS operates on the principle of least privilege, ensuring that users can only access data and functionality appropriate to their organizational role. The system implements a comprehensive Role-Based Access Control (RBAC) model that maps organizational hierarchies to system permissions, providing fine-grained control over feature access, data visibility, and operational capabilities. The RBAC model is central to the multi-tenant architecture, as it enforces data isolation between tenants while enabling flexible role assignments within each tenant."));
content.push(body("The authorization framework is implemented at multiple layers of the application stack. At the frontend, the sidebar navigation component filters available modules based on the user's role, presenting only the features that the user is authorized to access. At the API layer, every route handler validates the authenticated user's role against the required permission level for the requested operation. At the database layer, Prisma queries include tenant-scoped filtering (via tenantId) to ensure that data access is strictly limited to the user's organizational context."));
content.push(body("The multi-layered approach ensures defense in depth: even if one layer is bypassed (for example, through direct API invocation), the subsequent layers will still enforce the appropriate access restrictions. This architecture prevents both horizontal privilege escalation (accessing another tenant's data) and vertical privilege escalation (accessing features or data above the user's role level)."));

content.push(heading("2.1 Role Hierarchy & Permissions", HeadingLevel.HEADING_2));
content.push(body("NEXUS HRMS defines 5 primary roles and 9 extended roles that cover the full spectrum of organizational responsibilities. The primary roles represent the most common access patterns, while extended roles provide granular control for specialized organizational functions. Each role carries a specific set of permissions that determine which modules, features, and data sets the user can access."));
content.push(makeTable(
  ["Role", "Level", "Scope", "Key Permissions"],
  [
    ["super_admin", "Platform", "Global", "All tenants, subscriptions, system config, audit logs"],
    ["tenant_admin", "Organization", "Tenant", "Company management, user management, tenant settings"],
    ["hr_admin", "Department", "Department", "Employee CRUD, leave approval, payroll processing"],
    ["manager", "Team", "Team", "Team dashboards, leave approval, performance reviews"],
    ["employee", "Individual", "Self", "Self-service portal, leave requests, profile viewing"],
    ["company_hr_admin", "Company", "Company", "HR operations scoped to a single company"],
    ["hr_executive", "Department", "Department", "HR operations with limited admin access"],
    ["dept_head", "Department", "Department", "Department-level reports and approvals"],
    ["reporting_manager", "Team", "Team", "Direct report management and approvals"],
    ["finance", "Department", "Department", "Payroll and financial data access"],
    ["it_admin", "Department", "Department", "System configuration and user management"],
    ["recruiter", "Department", "Department", "Recruitment module full access"],
    ["vendor", "External", "Self", "Vendor portal access only"],
    ["sub_vendor", "External", "Self", "Sub-vendor portal access only"],
    ["client", "External", "Self", "Client portal access only"],
    ["auditor", "External", "Tenant", "Read-only access to audit and compliance data"],
    ["job_seeker", "External", "Self", "Job portal access and application submission"],
  ]
));

content.push(heading("2.2 Sidebar Navigation Filtering", HeadingLevel.HEADING_2));
content.push(body("The sidebar navigation component implements client-side role-based filtering that determines which modules are visible to the authenticated user. The ROLE_LABELS constant maps each role to its display name, while the module configuration defines the required role for each navigation item. When a user logs in, the sidebar component reads the user's role from the authentication state and renders only the navigation items that the user's role permits."));
content.push(body("This filtering is implemented as a declarative mapping between roles and module access, where each module defines a minimum required role and optional role-specific overrides. For example, the Super Admin module requires the 'super_admin' role exclusively, while the Dashboard module is accessible to all authenticated users. The Employee Management module is accessible to hr_admin, tenant_admin, and super_admin roles, but the employee self-service view is available to the 'employee' role."));
content.push(body("While client-side filtering provides an optimized user experience by hiding unauthorized features, it is important to note that it is not a security boundary on its own. The true security enforcement occurs at the API layer, where JWT validation and role verification are performed on every request. The sidebar filtering exists to improve usability and reduce confusion; it does not replace server-side authorization checks."));

content.push(heading("2.3 API Route Authorization", HeadingLevel.HEADING_2));
content.push(body("Every API route in NEXUS HRMS implements authorization checks as part of the standard request handling pattern. The authorization flow follows a consistent three-step process: first, extract and validate the JWT token; second, decode the token to obtain the user's role and tenant ID; third, verify that the user's role is permitted to perform the requested operation on the target resource. This pattern is enforced across all CRUD endpoints."));
content.push(codeBlock("// Standard API route authorization pattern"));
content.push(codeBlock("export async function GET(request: Request) {"));
content.push(codeBlock("  const token = getTokenFromHeaders(request);"));
content.push(codeBlock("  if (!token) return NextResponse.json("));
content.push(codeBlock("    { error: 'Unauthorized' }, { status: 401 });"));
content.push(codeBlock("  const decoded = await verifyToken(token);"));
content.push(codeBlock("  if (!decoded) return NextResponse.json("));
content.push(codeBlock("    { error: 'Invalid token' }, { status: 401 });"));
content.push(codeBlock("  // Role-based access check"));
content.push(codeBlock("  if (!['super_admin','tenant_admin','hr_admin']"));
content.push(codeBlock("    .includes(decoded.role)) {"));
content.push(codeBlock("    return NextResponse.json("));
content.push(codeBlock("      { error: 'Forbidden' }, { status: 403 });"));
content.push(codeBlock("  }"));
content.push(codeBlock("  // Tenant-scoped data access"));
content.push(codeBlock("  const data = await prisma.model.findMany({"));
content.push(codeBlock("    where: { tenantId: decoded.tenantId }"));
content.push(codeBlock("  });"));
content.push(codeBlock("}"));

content.push(heading("2.4 Multi-Tenant Data Isolation", HeadingLevel.HEADING_2));
content.push(body("Multi-tenant data isolation is one of the most critical security requirements in a SaaS HR platform. NEXUS HRMS implements tenant isolation at the query level by requiring a tenantId filter on all database queries. The tenantId is derived from the authenticated user's JWT payload, which is populated during login and cannot be modified by the client. This ensures that every data access operation is scoped to the user's tenant, preventing cross-tenant data leakage."));
content.push(body("The Prisma schema enforces the tenant hierarchy through foreign key relationships. The User model has a mandatory tenantId field with a foreign key reference to the Tenant model, and all tenant-scoped models inherit the tenant context through their association with the User or through explicit tenantId fields. API routes consistently apply the tenantId filter using Prisma's where clause, and the middleware ensures that the tenant context is available in every request."));
content.push(makeTable(
  ["Isolation Level", "Implementation", "Enforcement Point"],
  [
    ["Tenant isolation", "tenantId filter on all queries", "API route handlers"],
    ["Company isolation", "companyId filter within tenant scope", "API route handlers"],
    ["Department isolation", "departmentId filter for department-scoped roles", "API route handlers"],
    ["Employee self-access", "userId matching for employee role", "API route handlers"],
    ["Feature isolation", "Subscription plan feature flags", "SubscriptionPlan model + API checks"],
  ]
));

content.push(heading("2.5 Feature-Level Access Control", HeadingLevel.HEADING_2));
content.push(body("Beyond role-based permissions, NEXUS HRMS implements feature-level access control through the subscription plan system. The SubscriptionPlan model defines boolean flags for each feature module (payrollEnabled, recruitmentEnabled, attendanceEnabled, projectEnabled, etc.) that determine which features are available to a tenant based on their subscription tier. API routes check these feature flags before allowing access to specific modules, ensuring that tenants cannot access features beyond their subscription level."));
content.push(body("The feature access control operates at two levels: the frontend hides unavailable features from the navigation, and the API rejects requests to features that the tenant has not subscribed to. This dual enforcement prevents both accidental access (through direct URL navigation) and deliberate circumvention (through API invocation). The feature flags are stored in the SubscriptionPlan model and evaluated at runtime, enabling dynamic feature activation as tenants upgrade their subscriptions."));

// ====== 3. Data Security ======
content.push(heading("3. Data Security"));
content.push(body("Data security in NEXUS HRMS encompasses the protection of all data at rest, in transit, and during processing. The platform handles some of the most sensitive categories of personal and organizational data, including employee personally identifiable information (PII), salary and compensation details, bank account numbers, tax identification numbers, performance evaluations, and medical information. The data security architecture is designed to protect this information against unauthorized access, disclosure, modification, and destruction across all stages of the data lifecycle."));
content.push(body("The data security framework addresses three fundamental aspects: confidentiality (ensuring data is only accessible to authorized parties), integrity (ensuring data is not altered in unauthorized ways), and availability (ensuring data is accessible when needed). These principles are implemented through a combination of encryption, access controls, input validation, and monitoring, with each layer providing additional protection against potential threats."));
content.push(body("A critical aspect of data security in a multi-tenant SaaS platform is the absolute isolation of tenant data. NEXUS HRMS implements this isolation through a combination of database-level foreign key constraints, application-level query filtering, and subscription-enforced feature boundaries. The Prisma ORM provides an additional layer of protection through its type-safe query builder, which prevents SQL injection and ensures that all database operations follow predictable, parameterized patterns."));

content.push(heading("3.1 Multi-Tenant Data Isolation", HeadingLevel.HEADING_2));
content.push(body("As discussed in the Authorization section, multi-tenant data isolation is enforced at the query level through tenantId filtering. Every API route that retrieves tenant-scoped data applies a where clause that includes the tenantId derived from the authenticated user's JWT token. This pattern is consistent across all CRUD operations and is verified during code review. The Prisma schema enforces the tenant hierarchy through foreign key relationships, ensuring that data integrity is maintained at the database level."));
content.push(body("The isolation model follows a hierarchical scoping pattern where each level of the organizational hierarchy imposes additional data access constraints. Super admins can access all tenant data, tenant admins can access all data within their tenant, company HR admins can access data within their company, department heads can access data within their department, and regular employees can only access their own data. This hierarchical scoping prevents both horizontal (cross-tenant) and vertical (cross-level) data leakage."));

content.push(heading("3.2 PII Data Handling", HeadingLevel.HEADING_2));
content.push(body("Personally Identifiable Information (PII) requires special handling under privacy regulations such as GDPR, CCPA, and other regional data protection laws. NEXUS HRMS categorizes PII into sensitivity tiers and applies appropriate protection measures for each tier. The Employee model contains numerous PII fields that are classified and protected according to their sensitivity level."));
content.push(makeTable(
  ["PII Category", "Fields", "Sensitivity", "Protection Measures"],
  [
    ["Identity", "firstName, lastName, email, phone, avatar", "High", "Role-based access, API masking"],
    ["Demographics", "dateOfBirth, gender, maritalStatus, nationality", "High", "Limited role access, audit logging"],
    ["Financial", "salary, bankName, bankAccountNo, bankIfscCode, panNumber", "Critical", "Encrypted storage, restricted access"],
    ["Government ID", "aadhaarNumber, taxId, panNumber", "Critical", "Encrypted storage, audit on every access"],
    ["Emergency", "emergencyContactName, emergencyContactPhone", "Medium", "Role-based access within department"],
    ["Location", "address, city, state, zipCode, country", "Medium", "Role-based access, masking in lists"],
  ]
));

content.push(heading("3.3 Encryption at Rest & in Transit", HeadingLevel.HEADING_2));
content.push(body("Data encryption at rest is provided by the Neon PostgreSQL platform, which encrypts all stored data using AES-256 encryption. This includes the database files, write-ahead logs, and backup snapshots. The encryption keys are managed by Neon's key management service and are rotated automatically according to industry best practices. This platform-level encryption ensures that even if physical storage media is compromised, the data remains unreadable without the appropriate decryption keys."));
content.push(body("Data encryption in transit is enforced through TLS 1.2+ for all connections between clients and the Vercel-hosted application, as well as between the application and the Neon PostgreSQL database. Vercel automatically provisions and renews TLS certificates for all deployed applications, ensuring that all HTTP traffic is upgraded to HTTPS. The Neon serverless driver establishes encrypted connections to the PostgreSQL database using SSL/TLS, preventing eavesdropping and man-in-the-middle attacks on the database connection."));
content.push(makeTable(
  ["Encryption Layer", "Technology", "Scope", "Key Management"],
  [
    ["At rest", "AES-256 (Neon)", "Database files, WAL, backups", "Neon managed key rotation"],
    ["In transit (client-server)", "TLS 1.2+ (Vercel)", "All HTTP/HTTPS traffic", "Auto-provisioned by Vercel"],
    ["In transit (app-database)", "SSL/TLS (Neon)", "PostgreSQL connections", "Neon certificate management"],
    ["Password hashing", "bcrypt (12 rounds)", "User passwords only", "Per-password 128-bit salt"],
    ["JWT signing", "HS256 (jose)", "Authentication tokens", "Server-side JWT_SECRET"],
  ]
));

content.push(heading("3.4 Sensitive Field Masking", HeadingLevel.HEADING_2));
content.push(body("API responses implement sensitive field masking to prevent exposure of critical data in list views and non-essential API responses. Bank account numbers, tax identification numbers, and salary figures are masked or omitted from list endpoints, with full details only available through authenticated detail endpoints that require elevated role permissions. This approach minimizes the attack surface by ensuring that sensitive data is only transmitted when explicitly needed and authorized."));
content.push(body("The masking strategy follows the principle of data minimization: API responses include only the data fields required for the requesting context. For example, the employee list API returns names, departments, and designations but excludes salary, bank details, and government IDs. The employee detail API returns comprehensive data only when the requesting user has the appropriate role (hr_admin, tenant_admin, or super_admin). This tiered approach to data exposure reduces the impact of potential data interception or unauthorized API access."));

content.push(heading("3.5 Document Access Control", HeadingLevel.HEADING_2));
content.push(body("The Document model stores employee documents such as offer letters, ID proofs, contracts, certificates, and policies. Access to these documents is controlled through the same RBAC system that governs data access, with additional restrictions based on document type and sensitivity. Employees can only view their own documents, while HR administrators and managers with appropriate roles can access documents within their organizational scope."));
content.push(body("Document access is further controlled through the fileUrl field, which stores the path to the document file. The application validates document access permissions before generating or serving document URLs, preventing unauthorized file access through direct URL manipulation. The document status field (active, archived, expired) provides an additional layer of access control, ensuring that expired or archived documents are not accessible through standard API endpoints."));

// ====== 4. API Security ======
content.push(heading("4. API Security"));
content.push(body("API security in NEXUS HRMS encompasses the full spectrum of protections applied to the application's RESTful API endpoints. As the primary interface between the frontend application and the backend data layer, the API is a critical attack surface that requires comprehensive security measures. The API security architecture follows the principle of defense in depth, implementing multiple layers of protection that operate independently to prevent, detect, and respond to potential threats."));
content.push(body("The API security framework addresses several key threat categories: authentication bypass (through token theft or forgery), authorization violations (through role escalation or tenant boundary violation), injection attacks (through malicious input), and information disclosure (through error messages or response data leakage). Each threat category is mitigated through specific countermeasures that are implemented consistently across all API endpoints."));
content.push(body("The standardized API route pattern enforces security at every request by requiring JWT validation, role checking, and tenant scoping before any data operation is performed. This pattern eliminates the risk of accidentally exposing unprotected endpoints, as the security checks are always executed before the business logic. The consistent pattern also simplifies security auditing, as all routes follow the same verification sequence."));

content.push(heading("4.1 JWT Token Validation", HeadingLevel.HEADING_2));
content.push(body("Every API request undergoes JWT token validation as the first step in request processing. The getTokenFromHeaders function extracts the token from either the Authorization header (Bearer token) or the cookie header. The verifyToken function then validates the token signature using the server-side JWT_SECRET and checks the expiration claim. If either validation fails, the request is rejected with a 401 Unauthorized response."));
content.push(body("The token payload includes the user's ID, email, role, and tenantId, which are used for subsequent authorization and data scoping decisions. The token is created during the login process and includes an issued-at (iat) timestamp and an expiration time (exp) of 24 hours. The 24-hour window limits the exposure period if a token is compromised while providing a reasonable user experience that avoids excessive re-authentication prompts."));

content.push(heading("4.2 Input Validation & Sanitization", HeadingLevel.HEADING_2));
content.push(body("Input validation is a critical defense against injection attacks, data corruption, and application errors. NEXUS HRMS implements input validation at the API route level, where request body fields are validated against expected types, formats, and value ranges before being passed to the database layer. The Prisma ORM provides an additional layer of validation through its type-safe query builder, which ensures that all data passed to the database is properly typed and escaped."));
content.push(body("The validation strategy follows the allowlist approach: rather than attempting to filter out known malicious inputs (blocklist), the system defines what constitutes valid input and rejects everything else. This approach is more secure because it does not depend on maintaining a comprehensive list of attack patterns. Specific validations include type checking for numeric fields, format validation for email addresses and phone numbers, length constraints for string fields, and enumeration validation for status and type fields."));

content.push(heading("4.3 SQL Injection Prevention", HeadingLevel.HEADING_2));
content.push(body("SQL injection prevention is achieved primarily through the use of Prisma ORM, which generates parameterized queries for all database operations. Prisma's query builder constructs SQL statements using parameterized inputs, ensuring that user-supplied values are treated as data rather than executable SQL code. This approach eliminates the possibility of SQL injection through the application's standard CRUD operations."));
content.push(body("For any scenarios where raw SQL queries might be necessary (such as complex reporting queries or performance optimizations), the system requires the use of Prisma's parameterized raw query interface, which enforces the same parameterized query pattern. Direct string concatenation in SQL queries is strictly prohibited by coding standards and is flagged during code review. The Prisma schema's type system also provides compile-time protection against injection by ensuring that all fields are properly typed."));

content.push(heading("4.4 Rate Limiting & Abuse Prevention", HeadingLevel.HEADING_2));
content.push(body("Rate limiting is an essential defense against brute-force attacks, denial-of-service attempts, and API abuse. While the current deployment on Vercel's serverless platform provides built-in DDoS protection and request throttling at the infrastructure level, the application is designed to support application-level rate limiting for sensitive endpoints such as login, registration, and password reset. The planned implementation uses a sliding window algorithm with configurable thresholds per endpoint."));
content.push(makeTable(
  ["Endpoint Category", "Planned Rate Limit", "Enforcement Level"],
  [
    ["Login attempts", "5 per minute per IP", "Application + Infrastructure"],
    ["Registration", "3 per hour per IP", "Application level"],
    ["Password reset", "3 per hour per user", "Application level"],
    ["General API", "100 per minute per user", "Infrastructure level (Vercel)"],
    ["AI chat/completion", "20 per minute per user", "Application level"],
    ["File upload", "10 per minute per user", "Application level"],
  ]
));

content.push(heading("4.5 CORS & Error Handling", HeadingLevel.HEADING_2));
content.push(body("Cross-Origin Resource Sharing (CORS) is configured to restrict API access to trusted origins only. In the Vercel deployment, CORS headers are managed through the Next.js configuration and Vercel's edge middleware. The production configuration restricts API access to the application's own domain, preventing cross-origin requests from unauthorized websites that could facilitate CSRF or data theft attacks."));
content.push(body("Error handling follows a sanitization strategy that prevents information leakage through error messages. API errors return generic messages to the client (e.g., 'Internal server error') while logging detailed error information server-side for debugging. Database errors are caught with try/catch blocks and translated to generic error responses, preventing the exposure of table names, column names, or SQL query fragments. Validation errors return specific field-level messages to assist client-side error handling, but never include internal system details."));
content.push(makeTable(
  ["Security Concern", "Implementation", "Status"],
  [
    ["CORS restriction", "Next.js config + Vercel edge middleware", "Implemented"],
    ["Error message sanitization", "try/catch with generic error responses", "Implemented"],
    ["Request size limits", "Vercel default 4.5MB + Next.js body parser config", "Implemented"],
    ["Rate limiting", "Vercel infrastructure + planned app-level limits", "Partial"],
    ["Request logging", "Vercel analytics + planned structured logging", "Partial"],
  ]
));

// ====== 5. Infrastructure Security ======
content.push(heading("5. Infrastructure Security"));
content.push(body("Infrastructure security in NEXUS HRMS leverages the security capabilities of the platform's cloud service providers: Vercel for application hosting and Neon for database hosting. By using managed serverless platforms, NEXUS HRMS benefits from the providers' substantial investments in security infrastructure, including physical data center security, network security, DDoS protection, and automated patching. This approach allows the development team to focus on application-level security while relying on the platform providers for infrastructure-level protections."));
content.push(body("The serverless deployment model provides inherent security advantages over traditional server-based deployments. Each API request is handled by an isolated function execution with a fresh runtime environment, eliminating the risk of cross-request contamination through shared server state. The ephemeral nature of serverless functions also reduces the attack surface, as there are no persistent servers to compromise and no SSH access to protect."));
content.push(body("The infrastructure security architecture follows the shared responsibility model, where Vercel and Neon are responsible for the security of the cloud (physical infrastructure, network, hypervisor), and NEXUS HRMS is responsible for security in the cloud (application code, authentication, authorization, data classification, and secret management). This model ensures clear accountability and enables both parties to focus on their respective security domains."));

content.push(heading("5.1 Vercel Serverless Deployment", HeadingLevel.HEADING_2));
content.push(body("The Vercel platform provides multiple layers of infrastructure security. All traffic is served over HTTPS with automatically provisioned and renewed TLS certificates. Vercel's global CDN includes built-in DDoS protection that detects and mitigates volumetric attacks before they reach the application. The platform also implements rate limiting at the edge, protecting against brute-force and abuse scenarios at the infrastructure level."));
content.push(body("Serverless function execution on Vercel provides automatic scaling and isolation. Each function invocation runs in an isolated container with its own runtime environment, preventing cross-request data leakage. The platform manages the underlying operating system and runtime patching, ensuring that known vulnerabilities in the infrastructure are addressed promptly without requiring application-level intervention."));

content.push(heading("5.2 Neon Database Security", HeadingLevel.HEADING_2));
content.push(body("The Neon serverless PostgreSQL platform provides database-level security including encrypted connections (SSL/TLS), encrypted storage (AES-256), automatic backups with point-in-time recovery, and connection pooling through the Neon serverless driver. The connection pooling mechanism manages database connections efficiently in a serverless environment while maintaining security through encrypted channels."));
content.push(body("Neon's architecture separates compute and storage, with storage being continuously replicated across multiple availability zones for durability and availability. The platform's automated backup system creates daily backups with point-in-time recovery capability, enabling restoration to any point within the retention period. Database access is restricted through Vercel's integration, which provides secure, keyless connections between the application and the database."));

content.push(heading("5.3 Secret Management", HeadingLevel.HEADING_2));
content.push(body("Secret management in NEXUS HRMS follows the principle of least exposure: secrets are never committed to the source code repository, never logged, and never exposed in client-side code. The primary secret is the JWT_SECRET environment variable, which is used for signing and verifying JWT tokens. This secret is stored as a Vercel environment variable and is only accessible to the server-side application code."));
content.push(body("Vercel environment variables support multiple environments (production, preview, development) with independent values for each. This enables the use of different JWT secrets across environments, preventing cross-environment token forgery. The production JWT_SECRET is generated using a cryptographically secure random generator and is rotated periodically as part of the security maintenance schedule. Additional secrets such as database connection strings and API keys are managed through the same Vercel environment variable system."));
content.push(makeTable(
  ["Secret Type", "Storage", "Rotation Schedule", "Access Control"],
  [
    ["JWT_SECRET", "Vercel environment variable", "Quarterly", "Server-side only"],
    ["DATABASE_URL", "Vercel environment variable", "On compromise", "Server-side only"],
    ["Neon connection string", "Vercel integration", "Automatic", "Vercel-Neon link"],
    ["API keys (third-party)", "Vercel environment variable", "Per provider policy", "Server-side only"],
    ["Deployment tokens", "Vercel platform", "On compromise", "CI/CD pipeline only"],
  ]
));

content.push(heading("5.4 CI/CD Pipeline Security", HeadingLevel.HEADING_2));
content.push(body("The CI/CD pipeline security ensures that code changes are validated before reaching production. The deployment pipeline on Vercel includes automated builds that verify code compilation, lint checks, and TypeScript type checking. Pull requests trigger preview deployments that enable code review and testing in an isolated environment before merging to the production branch."));
content.push(body("Dependency vulnerability scanning is integrated into the development workflow through npm audit, which checks all dependencies against known vulnerability databases. The CI pipeline runs dependency audits on every pull request, blocking merges that introduce known vulnerabilities. Critical and high-severity vulnerabilities must be resolved before the code can be merged to the main branch. The package-lock.json file ensures deterministic dependency resolution, preventing supply chain attacks through version manipulation."));

// ====== 6. Audit & Compliance ======
content.push(heading("6. Audit & Compliance"));
content.push(body("Audit and compliance capabilities are essential for a SaaS HR platform that processes sensitive employee data subject to multiple regulatory frameworks. NEXUS HRMS implements comprehensive audit logging that captures all significant actions across the platform, providing a complete trail of who did what, when, and from where. This audit trail serves both operational purposes (troubleshooting, user support) and compliance purposes (regulatory audits, incident investigation)."));
content.push(body("The compliance framework addresses multiple regulatory requirements including GDPR (EU data protection), CCPA (California consumer privacy), and industry-specific regulations. While full regulatory certification is a journey, NEXUS HRMS is designed with compliance-ready architecture that enables organizations to configure the platform to meet their specific regulatory requirements. The platform's audit logging, data access controls, and privacy features provide the technical foundation for demonstrating compliance during audits."));
content.push(body("The audit system is built on three Prisma models that capture different categories of auditable events: AuditLog for general system actions, LoginActivity for authentication events, and AIChatLog for AI interaction tracking. Together, these models provide comprehensive coverage of all significant platform activities."));

content.push(heading("6.1 AuditLog Model", HeadingLevel.HEADING_2));
content.push(body("The AuditLog model is the primary audit trail mechanism, capturing all significant actions performed across the platform. Each audit log entry records the user who performed the action (userId), the action type (e.g., 'create', 'update', 'delete', 'approve'), the module where the action occurred (e.g., 'employees', 'payroll', 'recruitment'), optional details about the specific action, the client's IP address, and the user agent string. The model also supports anonymous actions by allowing null userId values for system-initiated events."));
content.push(makeTable(
  ["AuditLog Field", "Type", "Purpose"],
  [
    ["id", "String (cuid)", "Unique identifier"],
    ["userId", "String?", "User who performed the action (nullable for system actions)"],
    ["action", "String", "Action type: create, update, delete, approve, etc."],
    ["module", "String", "Module: employees, payroll, recruitment, etc."],
    ["details", "String?", "Additional context about the action"],
    ["ip", "String?", "Client IP address"],
    ["userAgent", "String?", "Browser/client user agent"],
    ["createdAt", "DateTime", "Timestamp of the action"],
  ]
));

content.push(heading("6.2 AI Interaction Logging", HeadingLevel.HEADING_2));
content.push(body("The AIChatLog model provides dedicated audit logging for all AI interactions across the platform, including the AI chatbot, AI interview scoring, and AI copilot features. This model captures the full context of each AI interaction, including the user ID, session ID, message role (user or assistant), message content, detected intent, confidence score, interaction source, and metadata stored as JSON. This comprehensive logging enables auditing of AI feature usage, monitoring for potential misuse, and analysis of AI behavior patterns."));
content.push(body("AI interaction logging is particularly important for compliance with emerging AI regulations such as the EU AI Act, which requires transparency and accountability in AI decision-making. The AIChatLog model provides the data foundation for demonstrating that AI features operate within their intended parameters and that human oversight is maintained. The confidence score and detected intent fields enable monitoring of AI accuracy and identifying situations where AI responses may require human review."));

content.push(heading("6.3 Data Retention Policies", HeadingLevel.HEADING_2));
content.push(body("Data retention policies define how long different categories of data are retained and when they are purged. NEXUS HRMS implements configurable retention policies that balance regulatory requirements (which often mandate minimum retention periods) with privacy principles (which favor data minimization). The retention framework classifies data into categories with specific retention periods and purge mechanisms."));
content.push(makeTable(
  ["Data Category", "Retention Period", "Purge Mechanism", "Regulatory Basis"],
  [
    ["Audit logs", "7 years", "Automated purge after retention period", "SOC 2, SOX"],
    ["Login activity", "2 years", "Automated purge", "GDPR accountability"],
    ["AI chat logs", "1 year", "Automated purge + manual review", "AI transparency"],
    ["Employee records (active)", "Duration of employment", "Archive on separation", "Labor law, tax regulations"],
    ["Employee records (separated)", "7 years after separation", "Automated purge", "Tax, pension regulations"],
    ["Payroll records", "7 years", "Automated purge", "Tax, audit regulations"],
    ["Job applications (not hired)", "1 year", "Automated purge", "GDPR data minimization"],
  ]
));

content.push(heading("6.4 GDPR Compliance", HeadingLevel.HEADING_2));
content.push(body("NEXUS HRMS is designed to support GDPR compliance for organizations operating within the European Economic Area. The platform implements several key GDPR requirements including data minimization (collecting only necessary data), purpose limitation (using data only for stated purposes), data subject rights (access, rectification, erasure, portability), and breach notification (72-hour reporting requirement)."));
content.push(body("The right to erasure ('right to be forgotten') is supported through the platform's data model, which allows for soft deletion of employee records while maintaining referential integrity. When an employee requests data deletion, the system can anonymize personal fields (replacing names with hashes, removing email addresses) while preserving the data structures needed for regulatory compliance (such as payroll records that must be retained for tax purposes). The AuditLog and LoginActivity models support GDPR accountability requirements by providing a complete record of data processing activities."));
content.push(makeTable(
  ["GDPR Requirement", "Implementation Status", "Details"],
  [
    ["Data minimization", "Implemented", "API responses return only required fields per context"],
    ["Purpose limitation", "Implemented", "Module-based access restricts data use to authorized purposes"],
    ["Right of access", "Implemented", "Employee self-service provides personal data access"],
    ["Right to rectification", "Implemented", "Profile update endpoints for employees and HR admins"],
    ["Right to erasure", "Partial", "Soft delete + planned full anonymization workflow"],
    ["Data portability", "Planned", "JSON/CSV export for personal data"],
    ["Breach notification", "Planned", "Automated detection + notification workflow"],
    ["DPIA", "Planned", "Privacy impact assessment for high-risk processing"],
  ]
));

content.push(heading("6.5 SOC 2 Readiness", HeadingLevel.HEADING_2));
content.push(body("NEXUS HRMS is architected to support SOC 2 Type II compliance, which requires demonstrating effective controls over security, availability, processing integrity, confidentiality, and privacy over an observation period. The platform's technical controls map directly to SOC 2 Trust Service Criteria, providing the foundation for organizations to pursue SOC 2 certification."));
content.push(makeTable(
  ["SOC 2 Criteria", "Control Category", "NEXUS HRMS Implementation"],
  [
    ["CC6.1", "Logical Access", "JWT authentication + RBAC authorization"],
    ["CC6.2", "Access Removal", "User status management + session invalidation"],
    ["CC6.3", "Access Authorization", "Role-based permissions + tenant isolation"],
    ["CC7.1", "Detection & Monitoring", "AuditLog + LoginActivity + real-time monitoring"],
    ["CC7.2", "Incident Response", "Planned incident response playbook"],
    ["CC8.1", "Change Management", "Git-based CI/CD + code review requirements"],
    ["CC9.1", "Risk Mitigation", "Dependency scanning + penetration testing schedule"],
  ]
));

// ====== 7. Frontend Security ======
content.push(heading("7. Frontend Security"));
content.push(body("Frontend security in NEXUS HRMS addresses the unique threats that arise from executing application code in the user's browser, where the runtime environment is outside the server's direct control. The frontend security architecture is designed to protect against cross-site scripting (XSS), cross-site request forgery (CSRF), and other client-side attack vectors while maintaining the rich, interactive user experience that the platform provides."));
content.push(body("The React framework provides built-in protections against several common web vulnerabilities, particularly XSS through automatic HTML escaping of all rendered content. This default-safe behavior ensures that user-supplied data cannot be interpreted as executable HTML or JavaScript, preventing the most common XSS attack patterns. Additional frontend security measures include secure token handling, content security policy enforcement, and careful management of sensitive data in React component state."));
content.push(body("The frontend security model assumes that the browser environment is fundamentally untrusted. Sensitive operations and data access decisions are always made on the server side (in API routes), and the frontend serves as a presentation layer that displays authorized data and sends authorized requests. This separation ensures that even if the frontend is compromised, the attacker cannot bypass server-side authorization checks or access data that the server has not explicitly provided."));

content.push(heading("7.1 XSS Prevention", HeadingLevel.HEADING_2));
content.push(body("Cross-site scripting (XSS) prevention is primarily achieved through React's built-in escaping mechanism, which automatically encodes all dynamic content before rendering it in the DOM. This prevents attackers from injecting malicious scripts through user-supplied data fields such as employee names, comments, or descriptions. React's JSX syntax enforces this escaping by default, requiring explicit use of dangerouslySetInnerHTML to render raw HTML, which is prohibited in the NEXUS HRMS codebase."));
content.push(body("Additional XSS protections include input sanitization at the API level (which strips or encodes potentially dangerous HTML before storing it in the database) and output encoding at the rendering level (which ensures that even if malicious content reaches the frontend, it is rendered as text rather than executable code). The Content Security Policy header provides a third layer of defense by restricting the sources from which scripts can be loaded and executed."));

content.push(heading("7.2 CSRF Protection", HeadingLevel.HEADING_2));
content.push(body("Cross-Site Request Forgery (CSRF) protection in NEXUS HRMS is inherently provided by the JWT-based authentication architecture. Unlike cookie-based session authentication, which is vulnerable to CSRF attacks because cookies are automatically sent with every request to the originating domain, JWT tokens stored in the Authorization header are not automatically sent by the browser. The frontend application explicitly includes the JWT token in the Authorization header of each API request, making CSRF attacks ineffective because the attacker's website cannot access the victim's JWT token."));
content.push(body("For the cookie-based token path (where tokens are stored in HTTP-only cookies for browser convenience), CSRF protection relies on the SameSite cookie attribute, which prevents the cookie from being sent in cross-origin requests. The combination of SameSite=Lax or SameSite=Strict and the requirement for an Authorization header on state-changing requests provides robust CSRF protection without the complexity of CSRF token synchronization."));

content.push(heading("7.3 Token Storage & Content Security", HeadingLevel.HEADING_2));
content.push(body("Token storage is a critical security decision that balances convenience against attack resistance. NEXUS HRMS supports dual token storage: the primary mechanism uses the Authorization header with tokens stored in the application's JavaScript context (via Zustand state management with localStorage persistence), and the secondary mechanism uses HTTP-only cookies. The Authorization header approach provides inherent CSRF protection, while the cookie approach provides better XSS resistance (since HTTP-only cookies cannot be accessed by JavaScript)."));
content.push(makeTable(
  ["Storage Method", "XSS Risk", "CSRF Risk", "Recommendation"],
  [
    ["localStorage", "High (JS accessible)", "Low (not auto-sent)", "Use with short token expiry"],
    ["sessionStorage", "High (JS accessible)", "Low (not auto-sent)", "Better: cleared on tab close"],
    ["HTTP-only cookie", "Low (JS inaccessible)", "Medium (auto-sent)", "Use with SameSite=Strict"],
    ["In-memory only", "None", "None", "Best security, lost on refresh"],
    ["Authorization header", "High (JS accessible)", "None", "Current implementation"],
  ]
));
content.push(body("The Content Security Policy (CSP) is planned as an additional frontend security layer that restricts the sources from which content can be loaded. A strict CSP would prevent inline script execution, restrict script sources to the application's own domain, and block unauthorized external resource loading. The planned CSP configuration uses nonce-based script allowlisting, which provides strong protection against XSS while allowing the application's legitimate inline scripts."));

// ====== 8. Database Security ======
content.push(heading("8. Database Security"));
content.push(body("Database security in NEXUS HRMS encompasses the protection of data at the storage layer, the integrity of data relationships, and the performance and reliability of database operations. As the persistent data store for all platform information, the database is a critical asset that requires comprehensive security measures. The database security architecture leverages the Prisma ORM, PostgreSQL features, and the Neon serverless platform to provide multi-layered protection."));
content.push(body("The Prisma ORM serves as the primary interface between the application and the database, providing type-safe query construction, automatic SQL injection prevention, and schema migration management. By using Prisma as the sole database access layer, NEXUS HRMS eliminates the risk of raw SQL injection and ensures that all database operations follow predictable, parameterized patterns. The Prisma schema also serves as documentation for the data model, making it easier to review and audit the database structure."));
content.push(body("The PostgreSQL database, hosted on the Neon serverless platform, provides enterprise-grade data protection features including row-level security, encrypted connections, automated backups, and point-in-time recovery. The Neon platform augments these features with serverless-specific capabilities such as connection pooling, auto-scaling, and branch-based development workflows that enable safe testing of schema changes."));

content.push(heading("8.1 Prisma ORM Security", HeadingLevel.HEADING_2));
content.push(body("Prisma ORM provides multiple security benefits beyond SQL injection prevention. The type-safe query builder ensures that all database operations are validated at compile time, preventing type mismatch errors that could lead to data corruption or unexpected behavior. The migration system ensures that schema changes are applied consistently across environments, with each migration generating SQL that is reviewed before application."));
content.push(body("The Prisma Client is generated from the schema definition, creating a TypeScript API that exactly matches the database structure. This eliminates the risk of typos in field names or table names that could cause runtime errors or security vulnerabilities. The generated client also includes runtime validation of query parameters, ensuring that only properly typed and formatted data reaches the database."));

content.push(heading("8.2 Data Integrity Constraints", HeadingLevel.HEADING_2));
content.push(body("Data integrity is enforced through foreign key constraints, unique constraints, and cascade delete rules defined in the Prisma schema. Foreign key constraints ensure that relationships between entities are always valid\u2014for example, an Employee must always reference a valid Department and Designation. Unique constraints prevent duplicate data, such as duplicate employee IDs or email addresses. Cascade delete rules ensure that when a parent entity is deleted, its dependent entities are also deleted, preventing orphaned records."));
content.push(makeTable(
  ["Constraint Type", "Example", "Purpose"],
  [
    ["Foreign Key", "Employee.departmentId \u2192 Department.id", "Ensure valid department reference"],
    ["Unique", "Employee.employeeId, User.email", "Prevent duplicate identifiers"],
    ["Cascade Delete", "CompanyGroup \u2192 Company (onDelete: Cascade)", "Remove dependents on parent deletion"],
    ["Set Null", "Employee.branchId \u2192 Branch (onDelete: SetNull)", "Nullify reference on parent deletion"],
    ["Composite Unique", "LeaveBalance (employeeId, leaveTypeId, year)", "Prevent duplicate balance records"],
    ["Index", "@@index([tenantId]) on all tenant-scoped models", "Optimize tenant-scoped queries"],
  ]
));

content.push(heading("8.3 Connection Pooling & Performance", HeadingLevel.HEADING_2));
content.push(body("Connection pooling is managed by the Neon serverless platform, which provides WebSocket-based connection pooling optimized for serverless environments. The Neon serverless driver (@neondatabase/serverless) manages connection lifecycle automatically, establishing connections on demand and releasing them when no longer needed. This approach is critical in a serverless architecture where each API route invocation may run in a different process, making traditional persistent connection pooling impractical."));
content.push(body("Database query performance is optimized through strategic index placement on frequently queried fields. The Prisma schema defines indexes on all foreign key fields (tenantId, companyId, departmentId, employeeId, status) to ensure efficient joins and filtering. Additional composite indexes support common query patterns such as filtering by status and date range. The index strategy is reviewed periodically based on query performance monitoring."));

content.push(heading("8.4 Backup & Recovery", HeadingLevel.HEADING_2));
content.push(body("Database backup and recovery is managed by the Neon platform, which provides automated daily backups with point-in-time recovery (PITR) capability. PITR enables restoration of the database to any point in time within the backup retention window, which is critical for recovering from data corruption events that may not be immediately detected. The Neon platform also supports branching, which allows creating database copies for testing or recovery purposes without affecting the production database."));
content.push(makeTable(
  ["Backup Feature", "Specification", "Purpose"],
  [
    ["Automated backups", "Daily full backup", "Disaster recovery baseline"],
    ["Point-in-time recovery", "Continuous WAL archiving", "Recovery to any point within retention window"],
    ["Backup retention", "7-30 days (plan dependent)", "Compliance and recovery window"],
    ["Database branching", "On-demand copy for testing", "Safe testing of migrations and queries"],
    ["Cross-region replication", "Neon platform feature", "Geographic disaster recovery"],
  ]
));

// ====== 9. Security Monitoring & Incident Response ======
content.push(heading("9. Security Monitoring & Incident Response"));
content.push(body("Security monitoring and incident response capabilities are essential for detecting, containing, and recovering from security events. NEXUS HRMS implements a multi-layered monitoring strategy that combines real-time audit log analysis, authentication anomaly detection, and infrastructure-level monitoring provided by the Vercel and Neon platforms. The incident response framework defines procedures for handling security events of varying severity, from routine failed login attempts to full-scale data breach scenarios."));
content.push(body("The monitoring architecture follows the detect-respond-recover pattern: continuous monitoring detects potential security events, the response procedures contain and mitigate the impact, and the recovery procedures restore normal operations and implement improvements to prevent recurrence. This cyclical approach ensures that the platform's security posture continuously improves based on lessons learned from both actual incidents and near-misses."));
content.push(body("Effective security monitoring requires a combination of automated detection systems and human oversight. Automated systems provide the speed and consistency needed to detect patterns across large volumes of data, while human analysts provide the context and judgment needed to distinguish genuine threats from false positives. The monitoring strategy is designed to minimize false positives (which can lead to alert fatigue) while ensuring that genuine threats are detected and escalated promptly."));

content.push(heading("9.1 Real-Time Audit Log Monitoring", HeadingLevel.HEADING_2));
content.push(body("The AuditLog and LoginActivity models provide the data foundation for real-time security monitoring. The planned monitoring system continuously analyzes incoming audit entries for patterns that indicate potential security events, such as unusual data access patterns, bulk data exports, privilege escalation attempts, or access to sensitive resources outside of normal business hours. Real-time alerts are triggered when detected patterns match predefined threat indicators."));
content.push(body("The monitoring system will implement threshold-based and behavioral anomaly detection. Threshold-based detection triggers alerts when metrics exceed predefined limits (e.g., more than 50 employee records accessed in 5 minutes). Behavioral anomaly detection uses statistical models to identify deviations from established baselines (e.g., a user accessing the payroll module for the first time at 3 AM). Both detection methods feed into a unified alert system that prioritizes events based on severity and potential impact."));

content.push(heading("9.2 Authentication Anomaly Detection", HeadingLevel.HEADING_2));
content.push(body("Authentication anomaly detection leverages the LoginActivity model to identify suspicious login patterns that may indicate credential compromise or unauthorized access attempts. The detection system monitors several key indicators including failed login frequency, geographic impossibility (logins from distant locations within short timeframes), unusual access times, and login from new devices or browsers. Each indicator contributes to a risk score that determines the response action."));
content.push(makeTable(
  ["Anomaly Type", "Detection Method", "Response Action"],
  [
    ["Brute-force attempt", ">5 failed logins in 10 min from same IP", "Temporary IP block + user notification"],
    ["Credential stuffing", "Multiple failed logins across accounts from same IP", "IP block + mandatory password reset"],
    ["Impossible travel", "Logins from distant IPs within 30 minutes", "Session invalidation + MFA challenge"],
    ["Off-hours access", "Login outside business hours + sensitive data access", "Alert security team + enhanced logging"],
    ["New device login", "Login from unrecognized user agent", "Email notification + optional MFA"],
    ["Multiple concurrent sessions", "Active sessions from different IPs", "Alert user + terminate oldest session"],
  ]
));

content.push(heading("9.3 Incident Response Procedures", HeadingLevel.HEADING_2));
content.push(body("The incident response framework defines structured procedures for handling security events, ensuring consistent and effective response regardless of the incident type or severity. The framework follows the NIST Cybersecurity Framework (CSF) lifecycle: Identify, Protect, Detect, Respond, and Recover. Each phase has defined activities, responsibilities, and deliverables that guide the response team through the incident lifecycle."));
content.push(makeTable(
  ["Severity", "Definition", "Response Time", "Examples"],
  [
    ["Critical (P1)", "Active data breach or system compromise", "< 1 hour", "Confirmed data exfiltration, ransomware"],
    ["High (P2)", "Potential breach or significant vulnerability", "< 4 hours", "Credential compromise, unauthorized admin access"],
    ["Medium (P3)", "Anomalous activity requiring investigation", "< 24 hours", "Unusual access patterns, failed login spikes"],
    ["Low (P4)", "Minor security event or policy violation", "< 72 hours", "Single failed login, minor policy deviation"],
  ]
));

content.push(heading("9.4 Breach Notification", HeadingLevel.HEADING_2));
content.push(body("Data breach notification procedures comply with applicable regulations including GDPR (72-hour notification to supervisory authority), CCPA (notification without unreasonable delay), and other regional requirements. The breach notification process includes identification and classification of the breach, containment and evidence preservation, impact assessment, regulatory notification, affected individual notification, and post-incident review. All breach notifications are logged in the audit system for accountability and regulatory compliance."));
content.push(body("The breach notification template includes the nature of the breach, categories and approximate number of affected individuals, likely consequences, and measures taken or proposed to address the breach. For GDPR compliance, the notification to the supervisory authority is made within 72 hours of becoming aware of the breach, unless the breach is unlikely to result in a risk to individuals' rights and freedoms. Individual notifications are made without undue delay when the breach is likely to result in a high risk to individuals."));

content.push(heading("9.5 Security Assessment Schedule", HeadingLevel.HEADING_2));
content.push(makeTable(
  ["Assessment Type", "Frequency", "Scope", "Responsible Party"],
  [
    ["Vulnerability scan", "Monthly", "Application + infrastructure", "Security team + automated tools"],
    ["Penetration test", "Quarterly", "Full application + API", "External security firm"],
    ["Code security review", "Per PR", "Code changes only", "Development team + security champion"],
    ["Dependency audit", "Weekly", "All npm dependencies", "Automated CI pipeline"],
    ["Access review", "Quarterly", "User roles and permissions", "IT admin + HR"],
    ["Incident response drill", "Semi-annually", "Full IR procedure", "Security team + stakeholders"],
    ["Compliance audit", "Annually", "Full platform", "External auditor"],
  ]
));

// ====== 10. Security Best Practices for Development ======
content.push(heading("10. Security Best Practices for Development"));
content.push(body("Security is a shared responsibility across the entire development team, not just the security team. This chapter outlines the security best practices that all developers contributing to NEXUS HRMS must follow throughout the software development lifecycle. These practices are designed to integrate security into the development process rather than treating it as an afterthought, following the 'shift left' philosophy that catches vulnerabilities early when they are least expensive to fix."));
content.push(body("The security best practices framework covers five key areas: code review requirements for security-sensitive changes, dependency audit processes, environment variable rotation, penetration testing guidelines, and security headers. Each area defines specific, actionable requirements that are enforced through a combination of tooling, process, and cultural norms. The goal is to create a development environment where secure coding is the default, and security vulnerabilities are the exception."));
content.push(body("Developers are expected to maintain security awareness through regular training, participation in security reviews, and adherence to the coding standards defined in this document. Security champions within each development team serve as local security experts who can provide guidance on security-relevant decisions and ensure that security considerations are addressed during design and implementation."));

content.push(heading("10.1 Code Review for Security", HeadingLevel.HEADING_2));
content.push(body("All code changes that touch security-sensitive areas require mandatory security review in addition to the standard code review. Security-sensitive areas include authentication and authorization logic, API route handlers, database queries, file upload handling, external API integrations, and any code that processes or stores PII. The security review checklist includes verification of input validation, authentication checks, authorization enforcement, error handling, and logging."));
content.push(bulletItem("All API routes must validate JWT tokens before processing requests"));
content.push(bulletItem("All data modification endpoints must enforce role-based authorization"));
content.push(bulletItem("All database queries must include tenant scoping (tenantId filter)"));
content.push(bulletItem("Error responses must never include internal system details or stack traces"));
content.push(bulletItem("User-supplied input must be validated against expected types, formats, and ranges"));
content.push(bulletItem("New dependencies must be reviewed for security vulnerabilities before approval"));

content.push(heading("10.2 Dependency Audit Process", HeadingLevel.HEADING_2));
content.push(body("Dependency management is a critical aspect of application security, as third-party packages can introduce vulnerabilities into the application. The npm audit command checks all dependencies against the Node.js Security Working Group's vulnerability database and reports known vulnerabilities with severity ratings. The CI pipeline runs npm audit on every pull request, blocking merges that introduce critical or high-severity vulnerabilities."));
content.push(body("Beyond automated auditing, the dependency management process includes regular manual review of dependency choices, evaluation of dependency health metrics (maintainer activity, issue response time, download trends), and removal of unused dependencies that expand the attack surface unnecessarily. Major dependency updates are tested in preview deployments before being merged to production. The package-lock.json file ensures deterministic dependency resolution, preventing supply chain attacks through version manipulation."));

content.push(heading("10.3 Environment Variable Rotation", HeadingLevel.HEADING_2));
content.push(body("Environment variable rotation is a security hygiene practice that limits the impact of potential secret exposure. The JWT_SECRET environment variable, which is used for signing and verifying authentication tokens, should be rotated on a quarterly basis or immediately upon suspected compromise. The rotation process involves generating a new secret, updating the Vercel environment variable, and redeploying the application. Existing tokens remain valid until their natural expiration (24 hours), after which users must re-authenticate with tokens signed using the new secret."));
content.push(makeTable(
  ["Variable", "Rotation Frequency", "Rotation Process", "Impact"],
  [
    ["JWT_SECRET", "Quarterly", "Generate new, update Vercel, redeploy", "Existing sessions expire within 24h"],
    ["DATABASE_URL", "On compromise only", "Neon dashboard rotate + Vercel update", "Brief connection interruption"],
    ["API keys", "Per provider policy", "Provider rotation + Vercel update", "Dependent features briefly unavailable"],
    ["Deployment tokens", "On compromise only", "Vercel dashboard regenerate", "CI/CD pipeline update required"],
  ]
));

content.push(heading("10.4 Penetration Testing Guidelines", HeadingLevel.HEADING_2));
content.push(body("Penetration testing provides an independent assessment of the platform's security posture by simulating real-world attack scenarios. NEXUS HRMS undergoes quarterly penetration testing conducted by an external security firm, with additional tests triggered by significant architecture changes or security incidents. The penetration testing scope covers the web application, API endpoints, authentication mechanisms, authorization boundaries, and data isolation controls."));
content.push(body("Penetration test results are classified using the OWASP Risk Rating Methodology and are reported to the development team with detailed findings, proof-of-concept exploits, and remediation recommendations. Critical and high-severity findings must be remediated within 30 days, medium-severity findings within 60 days, and low-severity findings within 90 days. All findings and remediation actions are tracked in the security issue tracker and verified through re-testing after remediation."));

content.push(heading("10.5 Security Headers Checklist", HeadingLevel.HEADING_2));
content.push(body("HTTP security headers provide browser-level protections against several common web vulnerabilities. The following security headers should be configured for all production responses. These headers instruct the browser to enforce security policies that prevent attacks such as clickjacking, MIME-type sniffing, and mixed content loading."));
content.push(makeTable(
  ["Header", "Recommended Value", "Purpose"],
  [
    ["Content-Security-Policy", "default-src 'self'; script-src 'self' 'nonce-{random}'", "Prevent XSS by restricting resource sources"],
    ["X-Content-Type-Options", "nosniff", "Prevent MIME-type sniffing attacks"],
    ["X-Frame-Options", "DENY", "Prevent clickjacking via iframe embedding"],
    ["X-XSS-Protection", "0", "Disable buggy browser XSS filter (rely on CSP)"],
    ["Referrer-Policy", "strict-origin-when-cross-origin", "Limit referrer information leakage"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=()", "Disable unnecessary browser APIs"],
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains", "Enforce HTTPS for all connections"],
  ]
));

content.push(body("These security headers provide defense in depth by enabling browser-level protections that complement the application's server-side security measures. The headers are configured through Next.js middleware or Vercel's headers configuration, ensuring they are applied consistently to all responses. The Content-Security-Policy header is the most critical, as it provides strong protection against XSS and data injection attacks. The recommended nonce-based CSP allows legitimate inline scripts while blocking injected scripts."));

// ===================== BUILD DOCUMENT =====================
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1417, bottom: 1417, left: 1701, right: 1417 };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
          size: 24,
          color: P.body,
        },
        paragraph: {
          spacing: { line: 312 },
        },
      },
      heading1: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 32,
          bold: true,
          color: P.primary,
        },
        paragraph: {
          spacing: { before: 360, after: 160, line: 312 },
        },
      },
      heading2: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 28,
          bold: true,
          color: P.primary,
        },
        paragraph: {
          spacing: { before: 240, after: 120, line: 312 },
        },
      },
      heading3: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 26,
          bold: true,
          color: P.primary,
        },
        paragraph: {
          spacing: { before: 200, after: 100, line: 312 },
        },
      },
    },
  },
  sections: [
    // Section 1: Cover page
    {
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: [buildCover()],
    },
    // Section 2: TOC page
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary, font: { ascii: "Times New Roman" } })],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({
            text: "Table of Contents",
            bold: true, size: 32,
            font: { eastAsia: "SimHei", ascii: "Times New Roman" },
            color: P.primary,
          })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888",
            font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" }
          })]
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body content
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: pgSize,
          margin: pgMargin,
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "NEXUS HRMS Security Documentation", size: 18, color: P.secondary, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "CONFIDENTIAL  |  ", size: 16, color: P.secondary, font: { ascii: "Times New Roman" } }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary, font: { ascii: "Times New Roman" } }),
              ],
            }),
          ],
        }),
      },
      children: content,
    },
  ],
});

// Generate the DOCX file
const OUTPUT = "/home/z/my-project/download/NEXUS-HRMS-Security-Documentation.docx";

(async () => {
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Document generated successfully:", OUTPUT);
})();
