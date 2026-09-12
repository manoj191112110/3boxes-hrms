#!/usr/bin/env python3
"""
3Boxes HRMS — Updated Architecture Technical Document
Generates a comprehensive PDF documenting the multi-tenant database architecture,
RBAC system, probation workflow, and Golden Rules.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image as RLImage
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

# Use NotoSerifSC for both body and headings (NotoSansSC has variable font issues)
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSC-Bold')

# ── Color Palette ──
C_PRIMARY = HexColor('#0F766E')    # Teal-700
C_ACCENT = HexColor('#0891B2')     # Cyan-600
C_DARK = HexColor('#1E293B')       # Slate-800
C_MUTED = HexColor('#64748B')      # Slate-500
C_BG_LIGHT = HexColor('#F1F5F9')   # Slate-100
C_BG_AMBER = HexColor('#FEF3C7')   # Amber-100
C_BG_EMERALD = HexColor('#D1FAE5') # Emerald-100
C_BG_BLUE = HexColor('#DBEAFE')    # Blue-100
C_BG_RED = HexColor('#FEE2E2')     # Red-100
C_BORDER = HexColor('#E2E8F0')     # Slate-200
C_WHITE = white

# ── Styles ──
styles = getSampleStyleSheet()

style_title = ParagraphStyle('CustomTitle', parent=styles['Title'],
    fontName='NotoSansSC-Bold', fontSize=24, textColor=C_PRIMARY,
    alignment=TA_CENTER, spaceAfter=6*mm, leading=30)

style_subtitle = ParagraphStyle('CustomSubtitle', parent=styles['Normal'],
    fontName='NotoSansSC', fontSize=12, textColor=C_MUTED,
    alignment=TA_CENTER, spaceAfter=12*mm, leading=16)

style_h1 = ParagraphStyle('H1', parent=styles['Heading1'],
    fontName='NotoSansSC-Bold', fontSize=16, textColor=C_PRIMARY,
    spaceBefore=10*mm, spaceAfter=4*mm, leading=22)

style_h2 = ParagraphStyle('H2', parent=styles['Heading2'],
    fontName='NotoSansSC-Bold', fontSize=13, textColor=C_DARK,
    spaceBefore=6*mm, spaceAfter=3*mm, leading=18)

style_h3 = ParagraphStyle('H3', parent=styles['Heading3'],
    fontName='NotoSansSC-Bold', fontSize=11, textColor=C_ACCENT,
    spaceBefore=4*mm, spaceAfter=2*mm, leading=15)

style_body = ParagraphStyle('Body', parent=styles['Normal'],
    fontName='NotoSansSC', fontSize=10, textColor=C_DARK,
    alignment=TA_JUSTIFY, spaceAfter=3*mm, leading=15)

style_bullet = ParagraphStyle('Bullet', parent=style_body,
    leftIndent=8*mm, bulletIndent=4*mm, spaceAfter=1.5*mm)

style_code = ParagraphStyle('Code', parent=styles['Code'],
    fontName='Courier', fontSize=9, textColor=C_DARK,
    backColor=C_BG_LIGHT, borderPadding=4, leftIndent=4*mm, rightIndent=4*mm,
    spaceAfter=3*mm, leading=13)

style_note = ParagraphStyle('Note', parent=style_body,
    fontName='NotoSansSC', fontSize=9, textColor=C_MUTED,
    leftIndent=4*mm, spaceAfter=2*mm)

# ── Helper Functions ──
def make_table(data, col_widths=None, header_bg=C_PRIMARY, header_fg=C_WHITE):
    """Create a styled table."""
    available = 170*mm
    if not col_widths:
        col_widths = [available / len(data[0])] * len(data[0])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), header_fg),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSansSC-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'NotoSansSC'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [C_WHITE, C_BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

def info_box(text, bg_color=C_BG_EMERALD, text_color=C_DARK):
    """Create a colored info box."""
    p = Paragraph(text, ParagraphStyle('InfoBox', parent=style_body,
        fontSize=9, textColor=text_color, alignment=TA_LEFT, leading=14))
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg_color),
        ('BOX', (0, 0), (-1, -1), 1, C_BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t

# ── Document Content ──
story = []

# ── Cover Page ──
story.append(Spacer(1, 40*mm))
story.append(Paragraph('3Boxes HRMS', style_title))
story.append(Paragraph('Updated Architecture Technical Document', style_subtitle))
story.append(Spacer(1, 20*mm))

cover_info = [
    ['Document', 'Architecture & Technical Specification'],
    ['Version', '2.0'],
    ['Date', 'September 2026'],
    ['Status', 'Production — Golden Rule Enforced'],
    ['Scope', 'Multi-Tenant DB Isolation, RBAC, Probation Workflow'],
]
cover_table = Table(cover_info, colWidths=[40*mm, 110*mm])
cover_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (0, -1), 'NotoSansSC-Bold'),
    ('FONTNAME', (1, 0), (1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 10),
    ('TEXTCOLOR', (0, 0), (0, -1), C_PRIMARY),
    ('TEXTCOLOR', (1, 0), (1, -1), C_DARK),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LINEBELOW', (0, 0), (-1, -2), 0.5, C_BORDER),
]))
story.append(cover_table)
story.append(PageBreak())

# ── Table of Contents ──
story.append(Paragraph('Table of Contents', style_h1))
story.append(Spacer(1, 4*mm))
toc_data = [
    ['Section', 'Title', 'Page'],
    ['1', 'Golden Rules & Database Separation', '3'],
    ['2', 'Multi-Tenant Database Architecture', '4'],
    ['3', 'Database Routing Mechanism', '5'],
    ['4', 'Role-Based Access Control (RBAC)', '6'],
    ['5', 'Employee Status & Type', '7'],
    ['6', 'Probation Workflow', '8'],
    ['7', 'API Route Security & Schema Sync', '9'],
    ['8', 'Official Email Validation', '10'],
    ['9', 'Super Admin Capabilities', '10'],
    ['10', 'Confirmation & Compliance Checklist', '11'],
]
story.append(make_table(toc_data, col_widths=[20*mm, 120*mm, 30*mm]))
story.append(PageBreak())

# ── Section 1: Golden Rules ──
story.append(Paragraph('1. Golden Rules & Database Separation', style_h1))

story.append(Paragraph(
    'The 3Boxes HRMS platform operates on a strict multi-tenant architecture where '
    'each tenant (organization) has its own dedicated database. This ensures complete '
    'data isolation, security, and scalability. The following Golden Rules are '
    'permanently enforced and cannot be overridden:', style_body))

story.append(Spacer(1, 3*mm))
story.append(info_box(
    '<b>GOLDEN RULE:</b> The Super Admin (platform) database and Tenant databases '
    'MUST be separate. The platform DB stores ONLY tenant registrations, user accounts '
    '(super_admin), and analytics. Tenant data (employees, companies, payroll, etc.) '
    'is NEVER stored in or read from the platform DB.',
    bg_color=C_BG_AMBER
))
story.append(Spacer(1, 3*mm))

story.append(Paragraph('1.1 Database Separation Rules', style_h2))

rules_data = [
    ['Rule', 'Description', 'Status'],
    ['Rule 1', 'Each link has a SEPARATE database', 'ENFORCED'],
    ['Rule 2', 'Platform DB stores ONLY: Tenant, TenantDatabase, User (super_admin), TrialRegistration, SubscriptionPlan', 'ENFORCED'],
    ['Rule 3', 'Tenant DBs store: Company, Department, Employee, Payroll, Attendance, Leave, etc.', 'ENFORCED'],
    ['Rule 4', 'NO tenant data is read from or written to the platform DB', 'ENFORCED'],
    ['Rule 5', 'Super admin fetches tenant data via getDbForTenant(slug) when viewing a specific tenant', 'ENFORCED'],
    ['Rule 6', 'Official email only for login (no personal emails like gmail/yahoo)', 'ENFORCED'],
    ['Rule 7', 'No dummy/sample data on the LIVE site (3boxeshrms.com)', 'ENFORCED'],
]
story.append(make_table(rules_data, col_widths=[20*mm, 120*mm, 30*mm]))
story.append(PageBreak())

# ── Section 2: Database Architecture ──
story.append(Paragraph('2. Multi-Tenant Database Architecture', style_h1))

story.append(Paragraph(
    'The platform uses Neon PostgreSQL with dedicated databases for each tenant. '
    'The connection routing is handled by the tenant-db.ts module, which resolves '
    'the correct database based on the request hostname, JWT token, or tenant slug.', style_body))

story.append(Paragraph('2.1 Database Map', style_h2))

db_map = [
    ['Link', 'Database', 'Purpose'],
    ['3boxeshrms.com', 'neondb (Platform DB)', 'Super Admin: Tenant registrations, user accounts, analytics'],
    ['marqaitechgroup.3boxeshrms.com', 'tenant_marqaitechgroup', 'MarqAI tenant: Companies, employees, payroll, etc.'],
    ['nexus-hrms-mu.vercel.app', 'tenant_demo', 'Demo link: Sample data for showcase'],
    ['[tenant].3boxeshrms.com', 'tenant_[slug]', 'Future tenants: Each gets own dedicated DB'],
]
story.append(make_table(db_map, col_widths=[55*mm, 45*mm, 70*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('2.2 Platform DB Contents (neondb)', style_h2))

platform_tables = [
    ['Table', 'Purpose'],
    ['Tenant', 'Tenant registrations: name, slug, domain, plan, status'],
    ['TenantDatabase', 'Maps each tenant to its dedicated DB connection string'],
    ['User', 'Platform-level users (super_admin only)'],
    ['TrialRegistration', 'Trial signup requests'],
    ['SubscriptionPlan', 'Pricing plans and features'],
]
story.append(make_table(platform_tables, col_widths=[40*mm, 130*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('2.3 Tenant DB Contents (tenant_[slug])', style_h2))

tenant_tables = [
    ['Table', 'Purpose'],
    ['User', 'Tenant users (tenant_admin, HR admin, employees)'],
    ['CompanyGroup', 'Company groups within the tenant'],
    ['Company', 'Companies (e.g., MARQ AI TECH, 3 BOXES LUXURY)'],
    ['Branch', 'Company branches/locations'],
    ['Department', 'Departments within companies'],
    ['Designation', 'Job titles and levels'],
    ['Employee', 'Employee records with all fields'],
    ['PerformanceReview', 'Probation reviews and performance data'],
    ['LeaveType, LeaveBalance, LeaveRequest', 'Leave management'],
    ['Attendance, Shift, Holiday', 'Attendance tracking'],
    ['Payroll, PayrollRun, PayrollInput', 'Payroll processing'],
    ['Notification, AuditLog, LoginActivity', 'System logs'],
]
story.append(make_table(tenant_tables, col_widths=[55*mm, 115*mm]))
story.append(PageBreak())

# ── Section 3: Database Routing ──
story.append(Paragraph('3. Database Routing Mechanism', style_h1))

story.append(Paragraph(
    'The getDb(request) function in src/lib/tenant-db.ts is the PRIMARY function '
    'all API routes use to determine which database to connect to. It resolves '
    'the tenant context through a priority chain:', style_body))

story.append(Paragraph('3.1 Resolution Priority', style_h2))

routing_data = [
    ['Priority', 'Source', 'Example'],
    ['1', 'x-tenant-slug header (set by middleware from subdomain)', 'marqaitechgroup'],
    ['2', 'Demo domain detection from host header', 'nexus-hrms-mu.vercel.app'],
    ['3', 'JWT token tenantId (decoded, then slug looked up)', 'From JWT payload'],
    ['4', '?tenantId= query param (super admin company switcher)', '?tenantId=abc123'],
    ['Fallback', 'Platform DB (for super_admin with no tenant context)', 'neondb'],
]
story.append(make_table(routing_data, col_widths=[20*mm, 80*mm, 70*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('3.2 getDbForTenant(slug) Function', style_h2))

story.append(Paragraph(
    'Once the tenant slug is resolved, getDbForTenant(slug) looks up the '
    'TenantDatabase record in the platform DB to find the connection string '
    'for the tenant\'s dedicated database. It creates a PrismaClient connected '
    'to that database and caches it for subsequent requests.', style_body))

story.append(Paragraph(
    'If no TenantDatabase record exists, it falls back to the platform DB '
    '(shared mode with tenantId filtering). This fallback is used ONLY during '
    'tenant onboarding before the dedicated DB is provisioned.', style_body))

story.append(Spacer(1, 3*mm))
story.append(info_box(
    '<b>Type 1 (CORRECT):</b> Super admin uses getPlatformDb() to look up which '
    'tenant a company belongs to (Company -> Group -> Tenant -> getDbForTenant), '
    'then fetches actual data from the tenant\'s dedicated DB.<br/><br/>'
    '<b>Type 2 (REMOVED):</b> Falling back to platform DB for employee/company '
    'data queries. This was removed in the latest update to enforce the Golden Rule.',
    bg_color=C_BG_EMERALD
))
story.append(PageBreak())

# ── Section 4: RBAC ──
story.append(Paragraph('4. Role-Based Access Control (RBAC)', style_h1))

story.append(Paragraph(
    'The RBAC system defines 5 standard roles with hierarchical access levels. '
    'Each role has a data scope that determines how much data they can see across '
    'all modules. Legacy roles (company_hr_admin, hr_admin, etc.) are mapped to '
    'these standard roles via the LEGACY_ROLE_MAP.', style_body))

story.append(Paragraph('4.1 Standard Roles', style_h2))

roles_data = [
    ['Role', 'Level', 'Data Scope', 'Description'],
    ['super_admin', '0', 'all', 'Platform-level full access across all tenants'],
    ['tenant_admin', '1', 'all', 'Tenant-level full access within their tenant'],
    ['admin', '2', 'all', 'Company-level admin (HR, Finance, IT combined)'],
    ['manager', '3', 'team', 'People manager: own + direct reports'],
    ['employee', '4', 'self', 'Self-service: own records only'],
]
story.append(make_table(roles_data, col_widths=[30*mm, 15*mm, 20*mm, 105*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('4.2 Legacy Role Mapping', style_h2))

story.append(Paragraph(
    'Existing users created with legacy role names are automatically mapped '
    'to the new 5-role system:', style_body))

legacy_data = [
    ['Legacy Role', 'Mapped To', 'Data Scope'],
    ['company_hr_admin', 'admin', 'all'],
    ['hr_admin', 'admin', 'all'],
    ['finance_admin', 'admin', 'all'],
    ['it_admin', 'admin', 'all'],
    ['manager', 'manager', 'team'],
    ['employee', 'employee', 'self'],
    ['recruiter', 'admin', 'all'],
    ['candidate', 'employee', 'self'],
]
story.append(make_table(legacy_data, col_widths=[50*mm, 40*mm, 40*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('4.3 Module Access', style_h2))

story.append(Paragraph(
    'Each module in the sidebar is tagged with roles that can access it. '
    'Employees see only self-service options (My Profile, Apply Leave, Apply '
    'Regularization, My Payslips). Managers see self-service + team management. '
    'Admins see everything. The filtering is done in Sidebar.tsx, layout.tsx, '
    'ModuleStrip.tsx, and modules/page.tsx using both moduleKey and per-item '
    'roles arrays.', style_body))
story.append(PageBreak())

# ── Section 5: Employee Status & Type ──
story.append(Paragraph('5. Employee Status & Type', style_h1))

story.append(Paragraph('5.1 Employee Status', style_h2))

story.append(Paragraph(
    'The Employee Status field determines the current employment status and '
    'drives the probation workflow:', style_body))

status_data = [
    ['Status', 'Description', 'Probation Workflow'],
    ['Confirmed', 'Employee has completed probation', 'No auto-creation'],
    ['Probation', 'Employee is in probation period', 'Auto-creates probation review'],
    ['Contract', 'Contract employee', 'No auto-creation'],
    ['Internship', 'Intern', 'No auto-creation'],
    ['Consultant', 'External consultant', 'No auto-creation'],
]
story.append(make_table(status_data, col_widths=[30*mm, 60*mm, 80*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('5.2 Employee Type', style_h2))

story.append(Paragraph(
    'The Employee Type field determines the employment contract type and will '
    'be connected to policy configuration fields across all modules:', style_body))

type_data = [
    ['Type', 'Description'],
    ['Full Time', 'Full-time permanent employee'],
    ['Part Time', 'Part-time employee'],
    ['Contract', 'Fixed-term contract employee'],
    ['Temporary', 'Temporary/seasonal worker'],
    ['Consultant', 'External consultant'],
]
story.append(make_table(type_data, col_widths=[30*mm, 140*mm]))

story.append(Spacer(1, 4*mm))
story.append(info_box(
    '<b>Probation Auto-Creation:</b> When an employee is created or edited with '
    'status "Probation", the system automatically creates a PerformanceReview '
    '(reviewCycle="Probation") with:<br/>'
    '- probationStartDate = Date of Joining<br/>'
    '- probationEndDate = Editable (default: joining + 6 months)<br/>'
    '- status = "pending" (goes to HR/Admin for review)<br/>'
    '- workflowStage = "hr_review"',
    bg_color=C_BG_BLUE
))
story.append(PageBreak())

# ── Section 6: Probation Workflow ──
story.append(Paragraph('6. Probation Workflow', style_h1))

story.append(Paragraph(
    'The probation workflow is a 2-level approval process: HR review followed '
    'by MD/Admin final confirmation. When an employee\'s status is set to '
    '"Probation", a review record is automatically created and routed through '
    'this workflow.', style_body))

story.append(Paragraph('6.1 Workflow Stages', style_h2))

workflow_data = [
    ['Stage', 'Who', 'Action', 'Result'],
    ['hr_review', 'HR/Admin (admin, company_hr_admin, hr_admin, manager)', 'Submit decision: Confirm / Extend / Reject', 'Moves to md_review; MD/Admin notified'],
    ['md_review', 'MD/Admin (super_admin, tenant_admin only)', 'Final decision: Confirm / Extend / Reject', 'Employee status updated; HR notified'],
    ['completed', 'System', 'Workflow complete', 'Employee status = "confirmed" if approved'],
]
story.append(make_table(workflow_data, col_widths=[25*mm, 50*mm, 45*mm, 50*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('6.2 Alert System (Cron Endpoint)', style_h2))

story.append(Paragraph(
    'A daily cron job endpoint (/api/cron/probation-alerts) checks all pending '
    'probation reviews and sends in-app notifications to HR/Admin at:', style_body))

alert_data = [
    ['Timing', 'Alert Type', 'Notification'],
    ['10 days before end date', 'Initial alert', 'Probation Review Due in 10 Days'],
    ['3 days before end date', 'Urgent alert', 'URGENT: Probation Review Due in 3 Days'],
    ['1 day before end date', 'Critical alert', 'CRITICAL: Probation Review Due Tomorrow'],
    ['On end date', 'Overdue alert', 'OVERDUE: Probation Period Ended'],
]
story.append(make_table(alert_data, col_widths=[40*mm, 30*mm, 100*mm]))

story.append(Spacer(1, 3*mm))
story.append(info_box(
    '<b>Cron Setup:</b> Set up a daily cron job to hit:<br/>'
    'https://[domain]/api/cron/probation-alerts?secret=3boxes-hrms-cron-2026',
    bg_color=C_BG_AMBER
))
story.append(PageBreak())

# ── Section 7: API Security ──
story.append(Paragraph('7. API Route Security & Schema Sync', style_h1))

story.append(Paragraph(
    'All API routes that access the Employee table include inline schema-sync '
    'statements at the start of each handler. This ensures ALL columns from the '
    'Prisma schema exist in the actual database table before any query runs. '
    'This prevents P2022 "column does not exist" errors on tenant databases '
    'that haven\'t been fully migrated.', style_body))

story.append(Paragraph('7.1 Routes with Inline Schema-Sync', style_h2))

sync_routes = [
    ['Route', 'Method', 'Schema-Sync'],
    ['/api/employees', 'GET', '30+ ALTER TABLE statements'],
    ['/api/employees', 'POST', '30+ ALTER TABLE statements'],
    ['/api/employees/[id]', 'GET', '30+ ALTER TABLE statements'],
    ['/api/employees/[id]', 'PUT', '7 ALTER TABLE statements'],
    ['/api/employees/credentials', 'GET', '37 ALTER TABLE statements (Employee + User)'],
    ['/api/users/profile', 'GET', '30+ ALTER TABLE statements (both DBs)'],
    ['/api/employees/probation', 'GET', 'CREATE TABLE IF NOT EXISTS PerformanceReview'],
    ['/api/employees/probation', 'POST', 'CREATE TABLE IF NOT EXISTS PerformanceReview'],
]
story.append(make_table(sync_routes, col_widths=[50*mm, 20*mm, 100*mm]))

story.append(Spacer(1, 4*mm))
story.append(Paragraph('7.2 Build-Time Schema Sync', style_h2))

story.append(Paragraph(
    'In addition to inline schema-sync, the following scripts run at Vercel '
    'build time to ensure all columns exist before the app starts:', style_body))

build_sync = [
    ['Script', 'When', 'What'],
    ['scripts/_init-table-fixes.js', 'Build time (before next build)', 'ALTER TABLE ADD COLUMN for all Employee fields'],
    ['scripts/schema-sync.js', 'Build time (before next build)', 'Full schema sync including FK constraints'],
    ['/api/db-push (POST)', 'Request time (on first page load)', 'Runtime schema fix as fallback'],
]
story.append(make_table(build_sync, col_widths=[55*mm, 45*mm, 70*mm]))
story.append(PageBreak())

# ── Section 8: Email Validation ──
story.append(Paragraph('8. Official Email Validation', style_h1))

story.append(Paragraph(
    'Only official/company email addresses are allowed for login. Personal email '
    'addresses (gmail, yahoo, outlook, etc.) are blocked at the login gate. '
    'Candidates are exempt and can use personal emails via the candidate portal.', style_body))

story.append(Paragraph('8.1 Blocked Personal Email Domains', style_h2))

blocked = [
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
    'yahoo.com', 'yahoo.in', 'icloud.com', 'protonmail.com', 'rediffmail.com',
    'aol.com', 'zoho.com', 'mail.com', 'tempmail.com', '+ 15 more'
]

email_table_data = [['Blocked Domain']] + [[d] for d in blocked]
story.append(make_table(email_table_data, col_widths=[170*mm], header_bg=HexColor('#DC2626')))

story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    'The validation is applied in both /api/auth/login (login gate) and '
    '/api/employees POST (employee creation). The validateOfficialEmail() '
    'function in src/lib/validators.ts checks the email domain against the '
    'blocked list and returns a clear error message if a personal email is used.', style_body))

# ── Section 9: Super Admin ──
story.append(Paragraph('9. Super Admin Capabilities', style_h1))

story.append(Paragraph(
    'The Super Admin dashboard (3boxeshrms.com) provides platform-level management '
    'capabilities. Super admin can view all tenants, manage subscriptions, and '
    'perform administrative actions on individual tenants.', style_body))

sa_features = [
    ['Feature', 'Description'],
    ['Register Separate DBs', 'Registers TenantDatabase records for demo and tenant DBs'],
    ['Seed DB', 'Seeds the dedicated tenant database with companies, employees, etc.'],
    ['Clear Prob', 'Clears all probation review data for a tenant'],
    ['Reset Pwd', 'Resets ALL user passwords to MarqAI@2026 (tenant + platform DB)'],
    ['Purge Dups', 'Deletes duplicate employees and syncs passwords across DBs'],
    ['Backup', 'Creates a backup of the tenant database'],
    ['Reset Employees', 'Deletes all employees except admin user'],
    ['Tenant Status', 'Activate/Suspend/Pending approval for tenants'],
]
story.append(make_table(sa_features, col_widths=[40*mm, 130*mm]))
story.append(PageBreak())

# ── Section 10: Confirmation ──
story.append(Paragraph('10. Confirmation & Compliance Checklist', style_h1))

story.append(info_box(
    '<b>CONFIRMED:</b> The Super Admin database and Tenant databases are SEPARATE. '
    'Tenant data will NOT fall back to the platform/super admin DB for any data.',
    bg_color=C_BG_EMERALD
))

story.append(Spacer(1, 4*mm))

checklist = [
    ['#', 'Check', 'Status'],
    ['1', 'Platform DB (neondb) stores ONLY: Tenant, TenantDatabase, User (super_admin), TrialRegistration, SubscriptionPlan', 'CONFIRMED'],
    ['2', 'Tenant DBs store: Company, Department, Employee, Payroll, Attendance, Leave, etc.', 'CONFIRMED'],
    ['3', 'NO tenant data is read from or written to the platform DB', 'CONFIRMED'],
    ['4', 'Super admin fetches tenant data via getDbForTenant(slug) when viewing a specific tenant', 'CONFIRMED'],
    ['5', 'Platform DB fallbacks for employee data removed from /api/users/profile GET', 'CONFIRMED'],
    ['6', 'Platform DB fallbacks for employee data removed from /api/users/profile PATCH', 'CONFIRMED'],
    ['7', 'Type 1 (super admin tenant resolution via Company -> Group -> Tenant -> getDbForTenant) kept', 'CONFIRMED'],
    ['8', 'Official email only for login (no personal emails)', 'CONFIRMED'],
    ['9', 'Employee Status: Confirmed, Probation, Contract, Internship, Consultant', 'CONFIRMED'],
    ['10', 'Employee Type: Full Time, Part Time, Contract, Temporary, Consultant', 'CONFIRMED'],
    ['11', 'Probation auto-creates review with start=dateOfJoining, end=editable', 'CONFIRMED'],
    ['12', '2-level workflow: HR review -> MD/Admin final confirmation', 'CONFIRMED'],
    ['13', '10-day email/notification alerts via cron endpoint', 'CONFIRMED'],
    ['14', 'Inline schema-sync on all Employee API routes', 'CONFIRMED'],
    ['15', 'Red asterisks (*) on all mandatory form fields', 'CONFIRMED'],
]
story.append(make_table(checklist, col_widths=[10*mm, 130*mm, 30*mm]))

story.append(Spacer(1, 6*mm))
story.append(Paragraph(
    'This document confirms that the 3Boxes HRMS architecture enforces complete '
    'database separation between the Super Admin platform and individual tenants. '
    'The Golden Rules are permanently enforced through API-level guards, inline '
    'schema-sync, and the removal of all platform DB fallbacks for tenant data.', style_body))

# ── Build PDF ──
output_path = '/home/z/my-project/download/3Boxes_HRMS_Architecture_Document.pdf'
doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=20*mm,
    rightMargin=20*mm,
    topMargin=20*mm,
    bottomMargin=20*mm,
    title='3Boxes HRMS Architecture Document',
    author='3Boxes HRMS',
    subject='Multi-Tenant Database Architecture & Technical Specification',
    creator='3Boxes HRMS',
)

doc.build(story)
print(f'PDF generated: {output_path}')
print(f'Size: {os.path.getsize(output_path) / 1024:.1f} KB')
