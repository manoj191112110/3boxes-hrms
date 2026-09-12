#!/usr/bin/env python3
"""
NEXUS HRMS Technical Documentation PDF Generator
"""

import os, sys, hashlib, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

OUTPUT_DIR = "/home/z/my-project/download/nexus-docs"
BODY_PDF = os.path.join(OUTPUT_DIR, "body.pdf")
COVER_HTML = os.path.join(OUTPUT_DIR, "cover.html")
COVER_PDF = os.path.join(OUTPUT_DIR, "cover.pdf")
FINAL_PDF = os.path.join(OUTPUT_DIR, "NEXUS-HRMS-Technical-Documentation.pdf")
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"

# Palette (user-specified)
ACCENT = colors.HexColor('#b54925')
TEXT_PRIMARY = colors.HexColor('#242321')
TEXT_MUTED = colors.HexColor('#8a877e')
BG_SURFACE = colors.HexColor('#e5e3df')
BG_PAGE = colors.HexColor('#f3f3f1')
TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = BG_SURFACE

PAGE_W, PAGE_H = A4
LM = 1.0 * inch
RM = 1.0 * inch
TM = 0.85 * inch
BM = 0.85 * inch
AW = PAGE_W - LM - RM

# Fonts
pdfmetrics.registerFont(TTFont('LiberationSerif', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerifB', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerifI', '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuMono', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuMonoB', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMono', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoB', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CarlitoB', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
registerFontFamily('LiberationSerif', normal='LiberationSerif', bold='LiberationSerifB', italic='LiberationSerifI')
registerFontFamily('DejaVuMono', normal='DejaVuMono', bold='DejaVuMonoB')
registerFontFamily('Carlito', normal='Carlito', bold='CarlitoB')

BF = 'LiberationSerif'

# Styles
s_body = ParagraphStyle('NB', fontName=BF, fontSize=10.5, leading=17,
    alignment=TA_JUSTIFY, spaceBefore=0, spaceAfter=8, textColor=TEXT_PRIMARY)
s_h1 = ParagraphStyle('NH1', fontName=BF, fontSize=20, leading=28,
    spaceBefore=18, spaceAfter=10, textColor=ACCENT)
s_h2 = ParagraphStyle('NH2', fontName=BF, fontSize=15, leading=22,
    spaceBefore=14, spaceAfter=8, textColor=TEXT_PRIMARY)
s_h3 = ParagraphStyle('NH3', fontName=BF, fontSize=12.5, leading=18,
    spaceBefore=10, spaceAfter=6, textColor=TEXT_PRIMARY)
s_toctitle = ParagraphStyle('NTT', fontName=BF, fontSize=22, leading=30,
    spaceBefore=0, spaceAfter=16, alignment=TA_CENTER, textColor=ACCENT)
s_th = ParagraphStyle('NTH', fontName=BF, fontSize=10, leading=14,
    alignment=TA_CENTER, textColor=colors.white)
s_tc = ParagraphStyle('NTC', fontName=BF, fontSize=9.5, leading=13.5,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY)
s_tcc = ParagraphStyle('NTCC', parent=s_tc, alignment=TA_CENTER)
s_code = ParagraphStyle('NC', fontName='DejaVuMono', fontSize=8.5, leading=12,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, leftIndent=12,
    backColor=BG_SURFACE, borderPadding=(4,4,4,4), spaceBefore=4, spaceAfter=4)
s_cap = ParagraphStyle('NCap', fontName=BF, fontSize=9, leading=13,
    alignment=TA_CENTER, textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=12)
s_bullet = ParagraphStyle('NBl', fontName=BF, fontSize=10.5, leading=17,
    alignment=TA_LEFT, textColor=TEXT_PRIMARY, leftIndent=20, bulletIndent=8,
    spaceBefore=2, spaceAfter=2)

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            self.notify('TOCEntry', (
                getattr(flowable, 'bookmark_level', 0),
                getattr(flowable, 'bookmark_text', ''),
                self.page,
                getattr(flowable, 'bookmark_key', '')
            ))

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1(t): return add_heading('<b>%s</b>' % t, s_h1, 0)
def h2(t): return add_heading('<b>%s</b>' % t, s_h2, 1)
def h3(t): return add_heading('<b>%s</b>' % t, s_h3, 2)
def p(t): return Paragraph(t, s_body)
def cap(t): return Paragraph(t, s_cap)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=TEXT_MUTED,
        spaceAfter=8, spaceBefore=8)

def mktbl(headers, rows, cr=None):
    nc = len(headers)
    if cr is None:
        cr = [1.0/nc]*nc
    cw = [r*AW for r in cr]
    data = [[Paragraph('<b>%s</b>' % h, s_th) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), s_tc) if not isinstance(c, Paragraph) else c for c in row])
    tbl = Table(data, colWidths=cw, hAlign='CENTER', repeatRows=1)
    sc = [
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), TABLE_HEADER_TEXT),
        ('GRID', (0,0), (-1,-1), 0.5, TEXT_MUTED),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i%2==1 else TABLE_ROW_ODD
        sc.append(('BACKGROUND', (0,i), (-1,i), bg))
    tbl.setStyle(TableStyle(sc))
    return tbl

def mkkv(pairs, cr=None):
    if cr is None: cr = [0.30, 0.70]
    cw = [r*AW for r in cr]
    data = []
    for k,v in pairs:
        data.append([Paragraph('<b>%s</b>' % k, s_tc), Paragraph(v, s_tc)])
    tbl = Table(data, colWidths=cw, hAlign='CENTER')
    sc = [
        ('GRID', (0,0), (-1,-1), 0.5, TEXT_MUTED),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]
    for i in range(len(data)):
        bg = TABLE_ROW_EVEN if i%2==0 else TABLE_ROW_ODD
        sc.append(('BACKGROUND', (0,i), (-1,i), bg))
    tbl.setStyle(TableStyle(sc))
    return tbl

# ═══════ MODULE DATA ═══════
MODULES = [
    ("Platform", [
        ("Super Admin", "Platform-wide administration panel with tenant provisioning, subscription management, and system configuration. Provides oversight across all tenants with global analytics and audit capabilities.", "src/app/(dashboard)/super-admin/", "super-admin", "Tenant, User, Subscription, SubscriptionPlan"),
        ("AI Admin Console", "Centralized AI feature management interface for configuring z-ai-web-dev-sdk integrations, managing AI interview parameters, chat bot settings, and intelligent workflow triggers.", "src/app/(dashboard)/ai-admin/", "ai-chat, ai-interview", "User, AuditLog"),
        ("Tenant Admin", "Tenant-level administration for managing company groups, companies, branches, and departments within the tenant hierarchy. Includes tenant-specific settings and user management.", "src/app/(dashboard)/tenants/", "tenants", "Tenant, CompanyGroup, Company, Branch, Department, User"),
    ]),
    ("Core HR", [
        ("Dashboard", "Central HR dashboard presenting KPIs, pending actions, attendance summaries, leave balances, and recruitment pipeline status. Uses aggregated API data from multiple endpoints.", "src/app/(dashboard)/dashboard/", "dashboard, analytics", "Employee, Attendance, LeaveBalance, LeaveRequest, JobApplication"),
        ("Company Management", "Full CRUD management for company entities including company groups, branches, and organizational structure. Supports the multi-tenant hierarchy from Company Group down to Departments.", "src/app/(dashboard)/companies/", "companies", "CompanyGroup, Company, Branch, Department, Designation"),
        ("Employees", "Comprehensive employee lifecycle management covering personal details, employment information, qualifications, experience, skills, and dependents. Central module connecting to payroll, attendance, and performance.", "src/app/(dashboard)/employees/", "employees", "Employee, Dependent, Qualification, Experience, EmployeeSkill, User"),
    ]),
    ("Talent Acquisition", [
        ("Recruitment", "End-to-end recruitment pipeline from job posting to candidate selection. Manages job postings, application tracking, interview scheduling, and candidate evaluation workflows.", "src/app/(dashboard)/recruitment/", "recruitment, job-postings", "JobPosting, JobApplication, Interview"),
        ("Requisitions", "Staff requisition management allowing departments to request new hires with approval workflows. Tracks requisition status from draft through approval to recruitment initiation.", "src/app/(dashboard)/requisitions/", "requisitions", "Requisition, Department, Designation"),
        ("Offers", "Offer letter management with template-based generation, approval workflows, and tracking. Integrates with salary structures for compensation package configuration.", "src/app/(dashboard)/offers/", "offers", "JobApplication, SalaryStructure, Employee"),
        ("Job Portal", "Public-facing job portal for candidates to browse openings, submit applications, and track status. Supports branded career pages per tenant/company.", "src/app/(dashboard)/job-portal/", "job-postings", "JobPosting, JobApplication"),
        ("AI Interview", "AI-powered interview module using z-ai-web-dev-sdk for automated candidate screening, question generation, and preliminary evaluation. Supports configurable interview templates and scoring rubrics.", "src/app/(dashboard)/ai-interview/", "ai-interview", "Interview, JobApplication"),
    ]),
    ("Lifecycle", [
        ("Preboarding", "Pre-boarding task management for new hires before their start date. Includes document collection, IT setup requests, policy acknowledgments, and welcome kit preparation.", "src/app/(dashboard)/preboarding/", "onboarding", "OnboardingTask, Employee"),
        ("Onboarding", "Structured onboarding workflow with task tracking, buddy assignment, training schedules, and milestone completion. Ensures consistent new hire experience across the organization.", "src/app/(dashboard)/onboarding/", "onboarding", "OnboardingTask, Employee, Training"),
        ("Attendance", "Real-time attendance tracking with check-in/check-out, shift management, overtime calculation, and attendance regularization. Supports biometric and geolocation integration.", "src/app/(dashboard)/attendance/", "attendance", "Attendance, Shift, Employee"),
        ("Leave", "Comprehensive leave management with leave type configuration, balance tracking, request/approval workflows, and holiday calendar integration. Supports carry-forward and encashment rules.", "src/app/(dashboard)/leave/", "leave", "LeaveType, LeaveBalance, LeaveRequest, Holiday"),
        ("Separation", "Employee separation and offboarding management covering resignation, termination, and retirement workflows. Includes notice period tracking, asset recovery, and knowledge transfer tasks.", "src/app/(dashboard)/separation/", "separation", "Separation, Employee, AssetAssignment"),
        ("FNF", "Full and Final settlement calculation processing exit dues, pending salary, leave encashment, recoverable advances, and final payout computation with statutory compliance.", "src/app/(dashboard)/fnf/", "fnf", "FNFCalculation, Separation, Employee, LeaveBalance"),
    ]),
    ("Compensation", [
        ("Payroll", "End-to-end payroll processing engine supporting multiple pay frequencies, tax calculations, statutory deductions, and bank file generation. Handles salary computation, approval workflows, and payment disbursement.", "src/app/(dashboard)/payroll/", "payroll", "Payroll, SalaryStructure, Employee"),
        ("Salary Structures", "Configurable salary structure definitions with components for basic, allowances, deductions, and employer contributions. Supports multiple structure templates per company and designation level.", "src/app/(dashboard)/salary-structures/", "salary-structures", "SalaryStructure, Employee"),
    ]),
    ("Growth", [
        ("Performance", "Performance review management with configurable review cycles, rating scales, competency frameworks, and multi-rater feedback. Supports self-assessment, manager review, and calibration workflows.", "src/app/(dashboard)/performance/", "performance", "PerformanceReview, Goal, Feedback, Employee"),
        ("Training", "Training program management covering course creation, scheduling, enrollment tracking, and completion certification. Supports both internal and external training programs with budget tracking.", "src/app/(dashboard)/training/", "training", "Training, TrainingEnrollment, Employee"),
        ("Engagement", "Employee engagement module with pulse surveys, feedback collection, and sentiment analysis. Provides engagement scores and trend analysis to help HR improve workplace satisfaction.", "src/app/(dashboard)/engagement/", "analytics, reports", "Feedback, Employee"),
        ("Succession Planning", "Succession planning for key positions with talent pool identification, readiness assessment, and development plan tracking. Ensures business continuity for critical roles.", "src/app/(dashboard)/succession/", "employees, performance", "Employee, PerformanceReview, Goal"),
    ]),
    ("Operations", [
        ("Projects", "Project management with project creation, team assignment, milestone tracking, and progress monitoring. Integrates with timesheets and resource allocation for project-based costing.", "src/app/(dashboard)/projects/", "projects", "Project, ProjectTask, ProjectMilestone, ProjectAllocation"),
        ("Timesheets", "Time tracking module for logging work hours against projects and tasks. Supports daily, weekly, and monthly views with approval workflows and overtime calculation.", "src/app/(dashboard)/timesheets/", "timesheets", "Timesheet, ProjectTask, Employee"),
        ("Travel", "Travel request management covering itinerary planning, approval workflows, budget allocation, and travel policy compliance. Integrates with expense claims for reimbursement.", "src/app/(dashboard)/travel/", "travel", "TravelRequest, Employee"),
        ("Expenses", "Expense claim management with receipt upload, categorization, approval workflows, and reimbursement processing. Supports per-diem rates and expense policy enforcement.", "src/app/(dashboard)/expenses/", "expenses", "ExpenseClaim, Employee"),
        ("Assets", "Asset management for IT and non-IT assets including procurement tracking, assignment, maintenance scheduling, and depreciation calculation. Supports asset lifecycle from procurement to disposal.", "src/app/(dashboard)/assets/", "assets", "Asset, AssetAssignment, Employee"),
        ("Documents", "Document management with version control, access permissions, expiry tracking, and document templates. Supports employee document uploads, company policies, and compliance document storage.", "src/app/(dashboard)/documents/", "documents", "Document, Employee"),
    ]),
    ("External", [
        ("Clients", "Client management with contact details, project associations, billing information, and communication history. Supports client onboarding and relationship management.", "src/app/(dashboard)/clients/", "clients", "Client, Project"),
        ("Vendors", "Vendor management covering vendor registration, service catalog, contract tracking, and performance evaluation. Supports vendor onboarding and compliance documentation.", "src/app/(dashboard)/vendors/", "vendors", "Vendor, Asset"),
    ]),
    ("Support", [
        ("Helpdesk", "IT and HR helpdesk with ticket categorization, priority assignment, SLA tracking, and resolution workflows. Supports knowledge base integration for self-service.", "src/app/(dashboard)/helpdesk/", "tickets", "Ticket, TicketComment, TicketCategory"),
        ("Grievances", "Grievance management with confidential submission, investigation workflows, resolution tracking, and escalation mechanisms. Ensures fair and timely resolution of workplace concerns.", "src/app/(dashboard)/grievances/", "grievances", "Grievance, Employee"),
        ("AI Assistant", "AI-powered HR assistant using z-ai-web-dev-sdk for natural language queries about policies, leave balances, payroll details, and company information. Provides contextual, role-based responses.", "src/app/(dashboard)/ai-assistant/", "ai-chat", "Employee, AuditLog"),
    ]),
    ("Governance", [
        ("Workflows", "Visual workflow builder and engine for configuring approval chains, notification rules, and automation triggers. Supports multi-step approval with conditional branching and delegation.", "src/app/(dashboard)/workflows/", "workflows", "AuditLog, Notification"),
        ("Reports", "Comprehensive reporting engine with pre-built templates, custom report builder, scheduled report generation, and export capabilities. Supports PDF, Excel, and CSV output formats.", "src/app/(dashboard)/reports/", "reports, analytics", "Employee, Payroll, Attendance, LeaveRequest"),
        ("Settings", "System-wide configuration management covering organization settings, policy definitions, role permissions, email templates, and integration configurations. Central control panel for all module settings.", "src/app/(dashboard)/settings/", "tenants", "Tenant, Policy, User"),
        ("Notifications", "Notification management with in-app notifications, email alerts, and configurable notification preferences. Supports real-time push notifications and digest-based delivery.", "src/app/(dashboard)/notifications/", "notifications", "Notification, User"),
    ]),
]

SIDEBAR = [
    ("Platform", "Super Admin, AI Admin Console, Tenant Admin"),
    ("Core HR", "Dashboard, Company Management, Employees"),
    ("Talent Acquisition", "Recruitment, Requisitions, Offers, Job Portal, AI Interview"),
    ("Onboarding and Lifecycle", "Preboarding, Onboarding, Attendance, Leave, Separation, FNF"),
    ("Time and Attendance", "Attendance, Leave, Timesheets"),
    ("Compensation", "Payroll, Salary Structures"),
    ("Performance and Growth", "Performance, Training, Engagement, Succession Planning"),
    ("Operations", "Projects, Timesheets, Travel, Expenses, Assets, Documents"),
    ("External Relations", "Clients, Vendors"),
    ("Support and Intelligence", "Helpdesk, Grievances, AI Assistant"),
    ("Governance", "Workflows, Reports, Settings, Notifications"),
]

DB_MODELS = [
    ("Tenant", "Organization tenant with multi-tenant isolation key, subscription reference, and configuration settings"),
    ("CompanyGroup", "Logical grouping of companies within a tenant for consolidated reporting"),
    ("Company", "Individual company entity with branding, location, and regulatory details"),
    ("Branch", "Physical office location with address and regional settings"),
    ("Department", "Functional department within a branch with head designation"),
    ("Designation", "Job title definition with grade level and salary band reference"),
    ("User", "Authentication entity with email, password hash, role, and tenant association"),
    ("Employee", "Core employee record linking personal info, employment details, and user account"),
    ("Dependent", "Employee dependent information for insurance and emergency contact purposes"),
    ("Qualification", "Employee educational qualifications with institution and year details"),
    ("Experience", "Employee prior work experience with company, role, and duration"),
    ("EmployeeSkill", "Employee skill mapping with proficiency level and certification status"),
    ("JobPosting", "Published job opening with requirements, compensation range, and status"),
    ("JobApplication", "Candidate application against a job posting with status tracking"),
    ("Interview", "Interview scheduling with type, panel, feedback, and scoring"),
    ("OnboardingTask", "Checklist item for new hire onboarding with assignee and due date"),
    ("LeaveType", "Leave category definition with quota, carry-forward, and encashment rules"),
    ("LeaveBalance", "Employee leave balance per type with opening, used, and remaining counts"),
    ("LeaveRequest", "Leave application with dates, type, reason, and approval status"),
    ("Attendance", "Daily attendance record with check-in/out times and status"),
    ("Payroll", "Monthly payroll run with gross, deductions, net pay, and processing status"),
    ("SalaryStructure", "Compensation template with component breakdown for basic, allowances, deductions"),
    ("PerformanceReview", "Review cycle entry with ratings, comments, and review status"),
    ("Goal", "Individual or team goal with metrics, target, and progress tracking"),
    ("Feedback", "Multi-rater feedback with competency ratings and qualitative comments"),
    ("Training", "Training program definition with syllabus, schedule, and capacity"),
    ("TrainingEnrollment", "Employee enrollment in a training program with completion status"),
    ("Asset", "Company asset with category, value, depreciation, and lifecycle status"),
    ("AssetAssignment", "Asset-to-employee assignment with issue and return dates"),
    ("Document", "Document record with type, version, access level, and expiry tracking"),
    ("IncidentReport", "Workplace incident with severity, investigation status, and resolution"),
    ("TravelRequest", "Travel request with itinerary, purpose, budget, and approval chain"),
    ("ExpenseClaim", "Expense claim with line items, receipts, and reimbursement status"),
    ("Timesheet", "Daily time entry with project, task, hours, and approval status"),
    ("Promotion", "Employee promotion with old/new designation, effective date, and approval"),
    ("Grievance", "Confidential grievance with category, priority, and resolution tracking"),
    ("Separation", "Employee separation with type, notice period, and clearance checklist"),
    ("FNFCalculation", "Full and final settlement with dues, recoveries, and net payout"),
    ("Notification", "System notification with type, read status, and delivery channel"),
    ("AuditLog", "System audit trail with entity, action, old/new values, and timestamp"),
    ("LoginActivity", "User login tracking with IP, device, and session details"),
    ("Policy", "Company policy definition with category, content, and version"),
    ("Holiday", "Holiday calendar entry with date, type, and applicability"),
    ("Announcement", "Company announcement with priority, audience, and expiry"),
    ("Shift", "Work shift definition with timing, break rules, and applicable days"),
    ("Reimbursement", "Reimbursement claim with type, amount, and approval workflow"),
    ("SubscriptionPlan", "SaaS subscription plan with features, limits, and pricing"),
    ("Subscription", "Tenant subscription with plan, billing cycle, and status"),
    ("Client", "Client entity with contact, industry, and billing information"),
    ("Vendor", "Vendor entity with services, contract terms, and performance rating"),
    ("Project", "Project with timeline, budget, client association, and status"),
    ("ProjectTask", "Task within a project with assignee, estimate, and progress"),
    ("ProjectMilestone", "Project milestone with target date, deliverables, and completion"),
    ("ProjectAllocation", "Employee allocation to project with percentage and date range"),
    ("TicketCategory", "Helpdesk ticket category with SLA and escalation rules"),
    ("Ticket", "Support ticket with priority, assignee, and resolution tracking"),
    ("TicketComment", "Comment on a support ticket with attachments and internal flag"),
    ("Requisition", "Staff requisition with justification, approval chain, and fulfillment status"),
]


def generate_cover_html():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 794px 1123px; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:794px; height:1123px; background:#f3f3f1; font-family:'Times New Roman',Georgia,serif; }
  .cover { position:relative; width:794px; height:1123px; background:#f3f3f1; overflow:hidden; }
  .bg-layer { position:absolute; inset:0; overflow:hidden; z-index:1; }
  .grid-bg { width:100%; height:100%; background-image:
    repeating-linear-gradient(0deg, transparent, transparent 48px, rgba(181,73,37,0.03) 48px, rgba(181,73,37,0.03) 49px),
    repeating-linear-gradient(90deg, transparent, transparent 48px, rgba(181,73,37,0.03) 48px, rgba(181,73,37,0.03) 49px); }
  .structure-layer { position:absolute; inset:0; z-index:2; }
  .thick-line { position:absolute; left:95px; top:100px; width:5px; height:923px; background:#b54925; }
  .meta-line { position:absolute; left:145px; top:680px; width:320px; height:1px; background:rgba(181,73,37,0.4); }
  .content-layer { position:absolute; inset:0; z-index:3; }
  .kicker { position:absolute; left:145px; top:150px; font-size:13px; font-weight:400;
    letter-spacing:3px; color:rgba(36,35,33,0.6); text-transform:uppercase; }
  .hero-title { position:absolute; left:145px; top:230px; width:580px; font-size:48px;
    font-weight:bold; line-height:1.15; color:#242321; }
  .subtitle { position:absolute; left:145px; top:380px; width:580px; font-size:18px;
    font-weight:400; line-height:1.4; color:rgba(36,35,33,0.85); }
  .summary { position:absolute; left:145px; top:470px; width:500px; font-size:15px;
    font-weight:normal; line-height:1.7; color:rgba(36,35,33,0.7); }
  .meta { position:absolute; left:145px; top:710px; font-size:15px; font-weight:400;
    line-height:2.0; color:#242321; }
  .version-tag { position:absolute; right:70px; bottom:80px; font-size:11px;
    letter-spacing:2px; color:rgba(138,135,126,0.6); text-transform:uppercase; }
  @media screen { html { height:auto; display:flex; justify-content:center; } body { transform-origin:top center; scale:min(1, calc(100vh / 1123)); margin:0 auto; } }
</style>
</head>
<body>
<div class="cover">
  <div class="bg-layer"><div class="grid-bg"></div></div>
  <div class="structure-layer">
    <div class="thick-line"></div>
    <div class="meta-line"></div>
  </div>
  <div class="content-layer">
    <div class="kicker">TECHNICAL DOCUMENTATION</div>
    <div class="hero-title">NEXUS HRMS</div>
    <div class="subtitle">Complete Coding Standards &amp; Architecture Reference</div>
    <div class="summary">
      Comprehensive technical documentation for the NEXUS Human Resource Management System,
      a SaaS-based AI-powered platform featuring 35+ modules, multi-tenant architecture,
      and intelligent automation. This document covers architecture, coding standards,
      module specifications, database design, and deployment guidelines.
    </div>
    <div class="meta">
      SaaS-Based AI HRMS Platform<br/>
      35+ Modules | Multi-Tenant Architecture<br/>
      Next.js 16 | PostgreSQL | Prisma ORM<br/>
      March 2026
    </div>
    <div class="version-tag">Version 1.0</div>
  </div>
</div>
</body>
</html>"""
    with open(COVER_HTML, 'w', encoding='utf-8') as f:
        f.write(html_content)


def build_body():
    doc = TocDocTemplate(BODY_PDF, pagesize=A4,
        leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM,
        title="NEXUS HRMS Technical Documentation",
        author="Z.ai", creator="Z.ai",
        subject="Technical Documentation for NEXUS HRMS Platform")

    story = []

    # TOC
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle('TOC1', fontName=BF, fontSize=13, leading=22,
            leftIndent=20, spaceBefore=6, spaceAfter=3, textColor=ACCENT),
        ParagraphStyle('TOC2', fontName=BF, fontSize=11, leading=18,
            leftIndent=40, spaceBefore=3, spaceAfter=2, textColor=TEXT_PRIMARY),
        ParagraphStyle('TOC3', fontName=BF, fontSize=10, leading=16,
            leftIndent=60, spaceBefore=2, spaceAfter=1, textColor=TEXT_MUTED),
    ]
    story.append(Paragraph('<b>Table of Contents</b>', s_toctitle))
    story.append(toc)
    story.append(PageBreak())

    # ═══════ SECTION 1: ARCHITECTURE OVERVIEW ═══════
    story.append(h1('1. Architecture Overview'))
    story.append(Spacer(1, 6))

    story.append(h2('1.1 System Architecture'))
    story.append(p(
        "The NEXUS HRMS platform implements a modern, cloud-native architecture built on a "
        "decoupled frontend-backend model. The frontend, rendered by Next.js 16 with React 19, "
        "operates as a server-side rendered application deployed on the Vercel edge network. The "
        "backend leverages Next.js API routes that communicate with a Neon serverless PostgreSQL "
        "database through Prisma ORM v7 with the @prisma/adapter-neon adapter for connection "
        "pooling and optimized query execution. The architecture follows a multi-tenant SaaS model "
        "where data isolation is enforced at the application layer through tenant ID propagation on "
        "every database query, ensuring complete data segregation between organizations."
    ))
    story.append(p(
        "The AI capabilities are powered by the z-ai-web-dev-sdk, which provides seamless "
        "integration for intelligent features such as AI-driven interviews, conversational HR "
        "assistants, automated resume screening, and predictive analytics. All AI operations are "
        "routed through dedicated API endpoints that manage request queuing, rate limiting, and "
        "response caching to maintain system responsiveness under load."
    ))
    story.append(Spacer(1, 8))

    story.append(mkkv([
        ("Frontend Framework", "Next.js 16 with React 19, Server Components, and App Router"),
        ("UI Library", "shadcn/ui components built on Radix UI primitives with Tailwind CSS 4"),
        ("State Management", "Zustand for client-side state with 3 primary stores (auth, UI, notifications)"),
        ("Backend Runtime", "Next.js API Routes (Edge + Node.js runtimes) on Vercel"),
        ("Database", "PostgreSQL via Neon Serverless with WebSocket connection support"),
        ("ORM", "Prisma ORM v7 with @prisma/adapter-neon for optimized Neon integration"),
        ("Authentication", "Custom JWT (jose + bcryptjs) with HS256, 24-hour expiry"),
        ("AI Integration", "z-ai-web-dev-sdk for AI interviews, chat, resume screening, and analytics"),
        ("Deployment", "Vercel with automatic preview deployments and production CDN"),
        ("CSS Framework", "Tailwind CSS 4 with custom design tokens (nexus-card, nexus-badge, etc.)"),
    ], cr=[0.25, 0.75]))
    story.append(cap('Table 1.1: NEXUS HRMS Technology Stack'))
    story.append(Spacer(1, 10))

    story.append(h2('1.2 Deployment Architecture'))
    story.append(p(
        "The platform is deployed on the Vercel infrastructure, which provides global edge "
        "distribution, automatic SSL, and serverless function execution. The Neon PostgreSQL "
        "database operates as a serverless instance with auto-scaling capabilities, branching "
        "for development environments, and point-in-time recovery. The connection between the "
        "application and database uses Prisma connection pooling with the @prisma/adapter-neon "
        "adapter, which supports WebSocket connections for real-time data synchronization and "
        "HTTP connections for standard CRUD operations."
    ))
    story.append(p(
        "The deployment pipeline follows a Git-based workflow where pushes to the main branch "
        "trigger production deployments, while pull requests generate preview deployments with "
        "unique URLs. Environment variables are managed through the Vercel encrypted environment "
        "variable system with a fallback chain of POSTGRES_PRISMA_URL, POSTGRES_URL, and "
        "DATABASE_URL for database connectivity, ensuring resilience across different configuration "
        "scenarios."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('1.3 Multi-Tenant Data Architecture'))
    story.append(p(
        "The multi-tenant architecture implements a hierarchical organizational model: Super "
        "Admin manages the entire platform, Tenant represents an organization subscribing to "
        "the service, Company Groups aggregate multiple companies, Companies contain Branches, "
        "Branches house Departments, and Departments employ Employees. This seven-level hierarchy "
        "enables fine-grained data isolation and access control while maintaining referential "
        "integrity across the organizational structure."
    ))
    story.append(p(
        "Data isolation is enforced at the application layer through a consistent tenant ID filter "
        "applied to all database queries via Prisma middleware. Each API route validates the "
        "requesting user tenant context before executing any database operation, preventing "
        "cross-tenant data access. The schema design ensures that every top-level entity includes "
        "a tenantId foreign key, and all child entities inherit the tenant context through their "
        "parent relationships. This approach provides logical data isolation without the overhead "
        "of separate database instances per tenant."
    ))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 2: PROJECT STRUCTURE ═══════
    story.append(h1('2. Project Structure'))
    story.append(Spacer(1, 6))

    story.append(h2('2.1 Directory Layout'))
    story.append(p(
        "The project follows Next.js 16 App Router conventions with a well-organized directory "
        "structure that separates concerns across pages, API routes, components, libraries, and "
        "configuration files. The src directory serves as the root for all application code, with "
        "the app directory containing route definitions using the file-system based routing "
        "approach. The components directory is organized into feature-specific subdirectories and "
        "a shared UI component library, while the lib directory houses utility functions, "
        "configuration, and type definitions."
    ))
    story.append(Spacer(1, 6))

    story.append(mkkv([
        ("src/app/(dashboard)/", "33 page routes organized by module with nested layouts and loading states"),
        ("src/app/api/", "75+ API route files across 25+ domain directories following RESTful conventions"),
        ("src/components/hrms/", "32 feature-specific HRMS components for module UI rendering"),
        ("src/components/ui/", "48 shadcn/ui base components with Radix UI primitives"),
        ("src/lib/", "10 library files for utilities, validators, and configuration"),
        ("src/stores/", "3 Zustand stores for authentication, UI state, and notification management"),
        ("prisma/", "Prisma schema with 40 models, migration files, and seed scripts"),
        ("public/", "Static assets including images, icons, and document templates"),
    ], cr=[0.35, 0.65]))
    story.append(cap('Table 2.1: Project Directory Structure'))
    story.append(Spacer(1, 8))

    story.append(h2('2.2 Key Configuration Files'))
    story.append(mkkv([
        ("next.config.js", "Next.js configuration with image domains, environment variables, and middleware settings"),
        ("tailwind.config.ts", "Tailwind CSS 4 configuration with custom design tokens and theme extensions"),
        ("prisma/schema.prisma", "Database schema definition with 40 models, relations, indexes, and enums"),
        ("tsconfig.json", "TypeScript configuration with path aliases and strict type checking enabled"),
        ("package.json", "Dependencies including Next.js 16, React 19, Prisma v7, Zustand, and z-ai-web-dev-sdk"),
        (".env.local", "Environment variables for database URLs, JWT secrets, and API keys"),
    ], cr=[0.30, 0.70]))
    story.append(Spacer(1, 8))

    story.append(h2('2.3 Environment Variables'))
    story.append(p(
        "Environment variables follow a strict fallback chain pattern for database connectivity "
        "and configuration. The primary connection string POSTGRES_PRISMA_URL is used by Prisma "
        "with the Neon adapter, falling back to POSTGRES_URL for direct connections, and finally "
        "DATABASE_URL as the universal fallback. This chain ensures the application can connect "
        "across local development, preview deployments, and production environments without code "
        "changes."
    ))
    story.append(Spacer(1, 6))
    story.append(mkkv([
        ("POSTGRES_PRISMA_URL", "Primary Neon connection string with Prisma adapter optimization"),
        ("POSTGRES_URL", "Fallback direct Neon connection string for non-Prisma operations"),
        ("DATABASE_URL", "Universal fallback connection string for local development"),
        ("JWT_SECRET", "Secret key for HS256 JWT token signing (minimum 32 characters)"),
        ("NEXT_PUBLIC_APP_URL", "Public application URL for CORS and callback configuration"),
        ("Z_AI_API_KEY", "API key for z-ai-web-dev-sdk AI feature integration"),
    ], cr=[0.35, 0.65]))
    story.append(cap('Table 2.3: Environment Variable Configuration'))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 3: CODING STANDARDS ═══════
    story.append(h1('3. Coding Standards'))
    story.append(Spacer(1, 6))

    story.append(h2('3.1 TypeScript and React Conventions'))
    story.append(p(
        "The codebase enforces strict TypeScript configuration with no implicit any, strict "
        "null checks, and explicit return types on exported functions. All React components are "
        "authored as functional components with TypeScript interfaces defining props. Server "
        "Components are the default for all page routes and data-fetching components, while Client "
        "Components are used only when interactivity (useState, useEffect, event handlers) is "
        'required, explicitly marked with the "use client" directive.'
    ))
    story.append(p(
        "Component props interfaces are defined inline for simple components and exported as "
        "named types for reusable components. All API responses are typed with dedicated response "
        "interfaces, and Zod schemas are used for runtime validation of form inputs and API "
        "payloads. The naming convention follows PascalCase for components and types, camelCase "
        "for functions and variables, and SCREAMING_SNAKE_CASE for constants."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('3.2 Component Architecture Patterns'))
    story.append(p(
        "Components follow a strict hierarchy pattern: Page components at the route level compose "
        "Module components, which compose Feature components, which compose UI primitives from "
        "shadcn/ui. Each module follows a consistent structure with a landing page displaying "
        "icon tiles for sub-features, a context-aware sidebar with sub-menus, and embedded inline "
        "forms for data entry. The pattern explicitly prohibits modal dialogs and popup windows; "
        "all data entry and editing occurs through inline forms that expand within the content area."
    ))
    story.append(p(
        "The view/read-only pattern uses a viewingId state variable combined with a FiEye (eye "
        "icon) button to toggle between list and detail views. When a user clicks the view button, "
        "the component sets viewingId to the selected record ID, triggering a conditional render "
        "that displays the detail panel inline without navigation. This pattern provides a seamless, "
        "single-page experience that eliminates context switching and preserves scroll position."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('3.3 State Management Patterns (Zustand)'))
    story.append(p(
        "The application uses three primary Zustand stores, each with a clear responsibility "
        "boundary. The useAuthStore manages authentication state including the current user, "
        "their role, tenant context, and JWT token. The useUIStore handles sidebar state, active "
        "module, theme preferences, and notification panel visibility. The useNotificationStore "
        "manages real-time notifications with unread counts and notification history."
    ))
    story.append(Spacer(1, 6))
    story.append(mkkv([
        ("useAuthStore", "User, role, tenantId, token, permissions, login/logout actions, role-based sidebar filtering"),
        ("useUIStore", "Sidebar open/close, active module path, theme mode, modal state (deprecated), view mode"),
        ("useNotificationStore", "Notification list, unread count, mark-as-read, real-time push integration"),
    ], cr=[0.25, 0.75]))
    story.append(cap('Table 3.3: Zustand Store Definitions'))
    story.append(p(
        "Zustand stores are accessed through custom hooks that provide memoized selectors to "
        "prevent unnecessary re-renders. The auth store includes a middleware that validates the "
        "JWT token on initialization and automatically redirects to login when tokens expire. The "
        "sidebar navigation items are filtered through the useAuthStore based on the user role, "
        "ensuring that users only see modules and features they have permission to access."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('3.4 API Route Conventions'))
    story.append(p(
        "API routes follow a consistent structure: each route file exports named HTTP method "
        "handlers (GET, POST, PUT, DELETE) that follow a middleware chain pattern. The first step "
        "in every handler is JWT token validation using the jose library, followed by role-based "
        "access checking, request body validation using Zod schemas, database operations through "
        "Prisma, and structured response formatting. Error handling follows a consistent pattern "
        "with try-catch blocks that return appropriate HTTP status codes and error messages."
    ))
    story.append(p(
        "Route files are organized by domain under src/app/api/, with each domain directory "
        "containing route.ts files for related endpoints. For example, the employees domain "
        "contains routes for CRUD operations, bulk import/export, and profile image upload. All "
        "routes return responses in a standardized format with success boolean, data payload, "
        "error string, and message fields, using appropriate HTTP status codes (200 for success, "
        "201 for creation, 400 for validation errors, 401 for unauthorized, 403 for forbidden, "
        "404 for not found, 500 for server errors)."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('3.5 Database and Prisma Conventions'))
    story.append(p(
        "Prisma models follow a consistent naming convention where model names use PascalCase "
        "singular form (Employee, not Employees), field names use camelCase, and enum values use "
        "SCREAMING_SNAKE_CASE. Every model that belongs to a tenant includes a tenantId field with "
        "a foreign key relation to the Tenant model. Relations are defined explicitly with "
        "onDelete: Cascade for dependent records and onDelete: SetNull for optional associations."
    ))
    story.append(p(
        "Database queries use Prisma generated client with type-safe findMany, findUnique, "
        "create, update, and delete operations. Complex queries use include for relation loading "
        "and where with logical operators for filtering. Transactions are implemented using Prisma "
        "interactive transactions for multi-step operations that require atomicity, such as payroll "
        "processing and employee onboarding workflows. The @prisma/adapter-neon adapter is "
        "configured for connection pooling with WebSocket support for real-time features."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('3.6 Naming Conventions'))
    story.append(mkkv([
        ("Components", "PascalCase: EmployeeList.tsx, LeaveRequestForm.tsx"),
        ("Hooks", "camelCase with use prefix: useAuthStore, useDebounce"),
        ("API Routes", "kebab-case directories: /api/salary-structures/, /api/ai-interview/"),
        ("Database Models", "PascalCase singular: Employee, LeaveType, JobPosting"),
        ("Database Fields", "camelCase: firstName, tenantId, startDate"),
        ("Enums", "SCREAMING_SNAKE_CASE values: SUPER_ADMIN, HR_ADMIN"),
        ("Constants", "SCREAMING_SNAKE_CASE: JWT_EXPIRY, MAX_PAGE_SIZE"),
        ("CSS Classes", "nexus- prefix tokens: nexus-card, nexus-badge, nexus-border"),
        ("Zustand Stores", "camelCase with use prefix: useAuthStore, useUIStore"),
        ("Type Interfaces", "PascalCase with suffix: EmployeeResponse, LeaveRequestInput"),
    ], cr=[0.25, 0.75]))
    story.append(cap('Table 3.6: Naming Convention Reference'))
    story.append(Spacer(1, 8))

    story.append(h2('3.7 Error Handling Patterns'))
    story.append(p(
        "Error handling follows a layered approach: API routes use try-catch blocks with specific "
        "error type checking, Prisma errors are caught and translated to user-friendly messages, "
        "and the frontend uses React Error Boundaries for component-level error isolation. All API "
        "errors return a consistent JSON structure with success: false, an error code string, and "
        "a human-readable message. The frontend toast notification system displays errors to users "
        "with severity-appropriate styling and auto-dismiss timing."
    ))
    story.append(p(
        "Common Prisma error codes are mapped to HTTP status codes: P2002 (unique constraint "
        "violation) maps to 409 Conflict, P2025 (record not found) maps to 404 Not Found, and "
        "P2003 (foreign key constraint) maps to 400 Bad Request. Validation errors from Zod "
        "schemas are formatted into field-level error objects that the frontend can display inline "
        "on form fields. Network errors and timeouts trigger retry logic with exponential backoff "
        "for non-critical operations."
    ))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 4: MODULE-WISE CODE EXPLANATION ═══════
    story.append(h1('4. Module-Wise Code Explanation'))
    story.append(Spacer(1, 6))
    story.append(p(
        "This section provides detailed technical documentation for all 35 modules organized by "
        "their functional category. Each module description covers the route structure, component "
        "hierarchy, API endpoints, database models, state management approach, and key "
        "implementation patterns used throughout the codebase."
    ))
    story.append(Spacer(1, 8))

    mod_sec = 1
    for cat_name, mod_list in MODULES:
        story.append(h2('4.%d %s' % (mod_sec, cat_name)))
        story.append(Spacer(1, 4))

        for idx, (mname, mdesc, mroute, mapi, mmodels) in enumerate(mod_list, 1):
            story.append(h3('4.%d.%d %s' % (mod_sec, idx, mname)))
            story.append(p(mdesc))
            story.append(Spacer(1, 4))
            story.append(mkkv([
                ("Route Path", mroute),
                ("API Endpoints", "/api/%s/ (GET, POST, PUT, DELETE with role-based access)" % mapi),
                ("Database Models", mmodels),
                ("State Management", "Local component state with Zustand auth context for role filtering"),
                ("Component Pattern", "Module landing page with icon tiles, context sidebar, inline forms, viewingId detail view"),
            ], cr=[0.25, 0.75]))
            story.append(Spacer(1, 6))

        mod_sec += 1

    # ═══════ SECTION 5: DESIGN SYSTEM ═══════
    story.append(h1('5. Design System'))
    story.append(Spacer(1, 6))

    story.append(h2('5.1 Design Tokens'))
    story.append(p(
        "The NEXUS HRMS design system is built on a set of custom design tokens that ensure "
        "visual consistency across all 35+ modules. These tokens are defined as Tailwind CSS "
        "utility classes with the nexus- prefix, providing a semantic naming system that abstracts "
        "away raw CSS values. Design tokens cover card surfaces, badges, borders, text hierarchy, "
        "and interactive states, ensuring that every component in the system maintains a cohesive "
        "visual language."
    ))
    story.append(Spacer(1, 6))
    story.append(mkkv([
        ("nexus-card", "Card surface with rounded corners, subtle shadow, and padding. Used for all module landing tiles and content containers."),
        ("nexus-badge", "Status indicator badge with rounded-full shape, colored backgrounds, and text. Used for status labels (Active, Pending, Closed)."),
        ("nexus-border", "Consistent border style with 1px width and muted color. Used for dividers, card edges, and section separators."),
        ("nexus-text-primary", "Primary text color (#242321) for headings and body content. Highest contrast and readability."),
        ("nexus-text-secondary", "Secondary text color for supporting information and descriptions. Reduced contrast for visual hierarchy."),
        ("nexus-text-muted", "Muted text color (#8a877e) for timestamps, captions, and placeholder text. Lowest contrast in the text scale."),
    ], cr=[0.25, 0.75]))
    story.append(cap('Table 5.1: Design Token Definitions'))
    story.append(Spacer(1, 8))

    story.append(h2('5.2 Component Patterns'))
    story.append(p(
        "All HRMS feature components follow a consistent architectural pattern that ensures "
        "predictability and maintainability. The Module Landing Page pattern displays a grid of "
        "icon tiles, each representing a sub-feature or action within the module. Clicking a tile "
        "navigates to the corresponding sub-module page or triggers an inline form expansion. This "
        "pattern provides an at-a-glance overview of module capabilities while maintaining a clean, "
        "uncluttered interface."
    ))
    story.append(p(
        "The Inline Form pattern is a core design principle that replaces traditional modal dialogs "
        "with embedded forms that expand within the content area. When a user initiates a create or "
        "edit action, the form slides open inline, pushing existing content downward. This approach "
        "preserves spatial context, eliminates jarring modal popups, and provides a smoother user "
        "experience. Form submission triggers an optimistic update to the UI with a background API "
        "call, and the form collapses on success or displays validation errors inline."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('5.3 Sidebar Navigation Architecture'))
    story.append(p(
        "The sidebar navigation implements an 11-section structure that organizes all 35+ modules "
        "into logical groupings. Each section is collapsible and displays its contained modules as "
        "navigation items. The active module is highlighted with the accent color, and the sidebar "
        "automatically expands the section containing the current route. The sidebar items are "
        "dynamically filtered based on the user role through the useAuthStore, ensuring that users "
        "only see navigation options they have permission to access."
    ))
    story.append(Spacer(1, 6))
    story.append(mktbl(
        ["Section", "Modules"],
        [(s, m) for s, m in SIDEBAR],
        cr=[0.25, 0.75]
    ))
    story.append(cap('Table 5.3: Sidebar Navigation Sections'))
    story.append(Spacer(1, 8))

    story.append(h2('5.4 Form Patterns (Inline, No Modals)'))
    story.append(p(
        "The embedded inline form system is the primary data entry mechanism across the platform. "
        "Forms are rendered inline within the content area using a state-driven pattern: when "
        "isFormOpen is true, the form component renders in place, and when false, it collapses. "
        "Each form maintains its own local state using React useState hooks, with Zod schema "
        "validation applied on submit. Error messages appear directly below the relevant form "
        "fields, providing immediate feedback without disrupting the user workflow."
    ))
    story.append(p(
        "Multi-step forms use a stepIndex state variable to track progression, rendering the "
        "appropriate step component at each stage. Navigation between steps includes validation "
        "of the current step before allowing progression, and a step indicator shows the user "
        "position in the workflow. This pattern is used extensively in complex workflows such as "
        "employee onboarding, payroll setup, and recruitment pipeline management."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('5.5 View and Read-Only Patterns'))
    story.append(p(
        "The view pattern uses a viewingId state variable to toggle between list and detail views "
        "without page navigation. When a user clicks the FiEye icon button next to a list item, "
        "the component sets viewingId to that record ID, triggering a conditional render that "
        "displays a detail panel with all record fields in a read-only format. The detail panel "
        "includes action buttons for editing (which switches to inline edit mode) and closing "
        "(which resets viewingId to null and returns to the list view)."
    ))
    story.append(p(
        "This pattern provides significant performance benefits over traditional page navigation, "
        "as the list data remains in memory and the detail view renders without additional data "
        "fetching for previously loaded records. For records that have not been fetched, the "
        "detail view triggers a single API call to load the complete record with all relations, "
        "displaying a loading skeleton during the fetch."
    ))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 6: API ARCHITECTURE ═══════
    story.append(h1('6. API Architecture'))
    story.append(Spacer(1, 6))

    story.append(h2('6.1 Authentication Middleware'))
    story.append(p(
        "Every API route implements a consistent authentication middleware pattern using the jose "
        "library for JWT verification. The middleware extracts the nexus_token from the "
        "Authorization header (Bearer token format), verifies the token signature using the HS256 "
        "algorithm with the configured JWT_SECRET, and decodes the payload to extract the user ID, "
        "role, and tenant ID. If the token is missing, expired, or invalid, the middleware returns "
        "a 401 Unauthorized response with a structured error message."
    ))
    story.append(p(
        "The JWT token is stored in localStorage under the key nexus_token and is automatically "
        "included in all API requests through an Axios interceptor configured in the API client "
        "library. Token expiry is set to 24 hours, and the application implements a silent refresh "
        "mechanism that checks token validity on application load and redirects to the login page "
        "when the token is within 5 minutes of expiry. The bcryptjs library with 12 salt rounds "
        "is used for password hashing during registration and verification during login."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('6.2 Request and Response Patterns'))
    story.append(p(
        "All API endpoints follow a standardized request/response pattern that ensures consistency "
        "and predictability. Request bodies are validated using Zod schemas before processing, and "
        "response payloads follow a uniform structure. Successful responses include a success: true "
        "flag along with the data payload, while error responses include success: false with an "
        "error code and human-readable message. Pagination is implemented using cursor-based "
        "pagination for large datasets and offset-based pagination for smaller collections."
    ))
    story.append(Spacer(1, 6))
    story.append(mkkv([
        ("Success Response", "{ success: true, data: T, message?: string }"),
        ("Error Response", "{ success: false, error: string, message: string }"),
        ("Paginated Response", "{ success: true, data: T[], pagination: { page, limit, total, totalPages } }"),
        ("Validation Error", "{ success: false, error: 'VALIDATION_ERROR', details: FieldError[] }"),
    ], cr=[0.25, 0.75]))
    story.append(cap('Table 6.2: API Response Format Standards'))
    story.append(Spacer(1, 8))

    story.append(h2('6.3 Error Handling'))
    story.append(p(
        "The API error handling system uses a layered approach that translates technical errors "
        "into user-friendly messages while preserving debugging information in server logs. At "
        "the outermost layer, a global error handler catches unhandled exceptions and returns a "
        "generic 500 Internal Server Error response. Within each route handler, specific error "
        "types are caught and mapped to appropriate HTTP status codes and error messages."
    ))
    story.append(p(
        "Prisma-specific errors are handled with dedicated mapping: P2002 (unique constraint) "
        "returns 409 Conflict with a message indicating which field caused the violation. P2025 "
        "(record not found) returns 404 Not Found. P2003 (foreign key constraint) returns 400 "
        "Bad Request with context about the invalid reference. P2014 (required relation violation) "
        "returns 400 Bad Request. All errors are logged with request context including the "
        "endpoint, user ID, and request parameters for debugging and audit purposes."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('6.4 Pagination'))
    story.append(p(
        "List endpoints implement pagination with a consistent interface: page (default 1), limit "
        "(default 20, max 100), and optional sort and filter parameters. The response includes a "
        "pagination object with the current page, items per page, total count, and total pages. "
        "For APIs that return large datasets such as employee lists and attendance records, "
        "cursor-based pagination is available using a cursor parameter that takes the ID of the "
        "last item from the previous page, providing more consistent performance on large tables."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('6.5 Role-Based Access Control'))
    story.append(p(
        "The API implements a five-tier database-level role system (super_admin, tenant_admin, "
        "hr_admin, manager, employee) with 14 application-level roles derived from these base "
        "roles. Each API route defines its required minimum role level, and the authentication "
        "middleware verifies the user role before allowing access. Super admin routes are isolated "
        "in the /api/super-admin/ directory with additional tenant-isolation checks."
    ))
    story.append(p(
        "Role-based access is implemented through a checkPermissions utility function that takes "
        "the required role and the user current role, returning a boolean or throwing a 403 "
        "Forbidden error. The system also supports resource-level permissions where a manager can "
        "only access data within their department, and an employee can only access their own "
        "records. These granular permissions are enforced at the Prisma query level using where "
        "clauses that filter by department or employee ID based on the user role and position."
    ))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 7: DATABASE SCHEMA ═══════
    story.append(h1('7. Database Schema'))
    story.append(Spacer(1, 6))

    story.append(h2('7.1 Entity Overview'))
    story.append(p(
        "The database schema consists of 40 Prisma models organized into functional domains. The "
        "core organizational hierarchy (Tenant, CompanyGroup, Company, Branch, Department) provides "
        "the structural foundation, while the User and Employee models serve as the central entities "
        "connecting to most other models. The schema uses PostgreSQL-specific features including enum "
        "types, JSON fields for flexible data storage, and timestamp columns with automatic management "
        "through Prisma @updatedAt and @createdAt annotations."
    ))
    story.append(Spacer(1, 6))

    # Split into tables of 20
    for i in range(0, len(DB_MODELS), 20):
        chunk = DB_MODELS[i:i+20]
        story.append(mktbl(
            ["Model", "Description"],
            [(m, d) for m, d in chunk],
            cr=[0.25, 0.75]
        ))
        story.append(cap('Table 7.1: Database Models (page %d)' % (i//20 + 1)))
        story.append(Spacer(1, 8))

    story.append(h2('7.2 Entity Relationships'))
    story.append(p(
        "The entity relationship model follows the organizational hierarchy as its primary axis. "
        "The Tenant model sits at the top of the hierarchy, with CompanyGroup, Subscription, and "
        "AuditLog as direct children. CompanyGroup contains Companies, which contain Branches, "
        "which contain Departments. The Employee model is the most connected entity in the schema, "
        "with foreign key relations to Department, User, and numerous functional entities including "
        "LeaveBalance, Attendance, Payroll, PerformanceReview, AssetAssignment, and many more."
    ))
    story.append(p(
        "The JobPosting and JobApplication models form the recruitment sub-graph, with "
        "JobApplication linking to Interview for the interview pipeline. The Project model connects "
        "to Client, ProjectTask, ProjectMilestone, and ProjectAllocation for project management. "
        "The Ticket model forms a self-contained helpdesk sub-graph with TicketCategory and "
        "TicketComment. All relations use explicit onDelete and onUpdate behaviors to maintain "
        "referential integrity, with Cascade for parent-child relationships and SetNull for "
        "optional associations."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('7.3 Multi-Tenant Data Isolation'))
    story.append(p(
        "Multi-tenant data isolation is enforced through a tenantId field on all top-level entities "
        "and inherited tenant context through parent relations on child entities. Prisma middleware "
        "intercepts all database queries and automatically injects the tenantId filter based on "
        "the authenticated user tenant context. This application-level isolation ensures that no "
        "query can access data belonging to another tenant, even if the query is manually "
        "constructed."
    ))
    story.append(p(
        "The isolation strategy uses a shared database approach rather than separate schemas or "
        "databases per tenant, which provides cost efficiency and simplified maintenance. The "
        "Tenant model includes configuration fields that control feature availability, data "
        "retention policies, and resource limits per tenant. Cross-tenant operations are "
        "exclusively available to the super_admin role through dedicated endpoints in the "
        "/api/super-admin/ route directory, which bypass the tenant filter with explicit "
        "authorization checks."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('7.4 Indexing Strategy'))
    story.append(p(
        "The indexing strategy is designed to optimize the most common query patterns in the HRMS "
        "application. Every model with a tenantId field has a composite index on (tenantId, id) to "
        "support efficient tenant-scoped queries. Foreign key fields are indexed individually to "
        "accelerate join operations. The Employee model has additional indexes on email, employeeId, "
        "and departmentId to support the frequent lookup patterns in the application."
    ))
    story.append(p(
        "Compound indexes are defined for frequently filtered combinations: LeaveRequest has an "
        "index on (tenantId, status, startDate), Attendance on (tenantId, employeeId, date), and "
        "Payroll on (tenantId, employeeId, month, year). Full-text search is supported on JobPosting "
        "and Employee models using PostgreSQL tsvector with GIN indexes on the title and description "
        "fields. The Prisma schema defines these indexes using the @@index annotation with explicit "
        "column lists."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('7.5 Migration Approach'))
    story.append(p(
        "Database migrations are managed through the Prisma migration system with a strict "
        "workflow: schema changes are made in schema.prisma, migrations are generated using "
        "prisma migrate dev during development, and applied using prisma migrate deploy in "
        "production. Each migration creates a timestamped SQL file in the prisma/migrations/ "
        "directory, which is version-controlled alongside the application code."
    ))
    story.append(p(
        "The migration strategy follows a zero-downtime approach where destructive changes (column "
        "removals, type changes) are executed in multiple steps: first add the new column, then "
        "migrate data, then update the application to use the new column, and finally remove the "
        "old column in a subsequent migration. For Neon-specific features, the schema leverages "
        "Neon branching capability to test migrations on a database branch before applying them "
        "to production, ensuring that migration issues are caught in a safe environment."
    ))
    story.append(Spacer(1, 8))

    # ═══════ SECTION 8: DEPLOYMENT AND DEVOPS ═══════
    story.append(h1('8. Deployment and DevOps'))
    story.append(Spacer(1, 6))

    story.append(h2('8.1 Vercel Configuration'))
    story.append(p(
        "The application is deployed on Vercel with a configuration optimized for Next.js 16 "
        "serverless functions and edge runtime. The vercel.json configuration specifies function "
        "execution regions for latency optimization, sets maximum function duration for long-running "
        "operations like payroll processing, and configures routing rules for API endpoints. The "
        "deployment automatically handles server-side rendering, static optimization, and "
        "incremental static regeneration based on page-level data requirements."
    ))
    story.append(p(
        "The Vercel edge network provides global CDN distribution for static assets and "
        "server-rendered pages, with automatic compression (Brotli and Gzip), image optimization "
        "through next/image, and intelligent caching based on cache-control headers. Preview "
        "deployments are created automatically for every pull request, enabling code review with "
        "live, shareable URLs before merging to the main branch."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('8.2 Environment Variables'))
    story.append(p(
        "Environment variables are managed through the Vercel encrypted environment variable "
        "system with separate configurations for Production, Preview, and Development environments. "
        "The database connection follows a strict fallback chain: POSTGRES_PRISMA_URL is the "
        "primary connection string optimized for the Prisma Neon adapter with pooled connections, "
        "POSTGRES_URL serves as the fallback for direct Neon connections, and DATABASE_URL provides "
        "the universal fallback for local development and non-Neon environments."
    ))
    story.append(p(
        "Sensitive variables including JWT_SECRET, database URLs, and API keys are marked as "
        "encrypted in Vercel and are never exposed to the client bundle. Variables prefixed with "
        "NEXT_PUBLIC_ are exposed to the browser and are limited to non-sensitive configuration "
        "such as the application URL and feature flags. The application validates the presence of "
        "all required environment variables at startup and fails fast with descriptive error "
        "messages if any are missing."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('8.3 Build Process'))
    story.append(p(
        "The build process follows the Next.js 16 optimized build pipeline, which analyzes each "
        "page and API route to determine the optimal rendering strategy (static, server-side, or "
        "edge). The build output includes a detailed analysis of bundle sizes, route configurations, "
        "and data requirements. Prisma generates its client during the postinstall hook, ensuring "
        "the latest schema is reflected in the generated types and query methods."
    ))
    story.append(p(
        "The build configuration includes TypeScript compilation with strict mode, ESLint checks "
        "with custom rules for React hooks and accessibility, and Tailwind CSS purging to minimize "
        "the CSS bundle. Production builds are optimized through Next.js automatic code splitting, "
        "tree shaking, and dead code elimination. The average build time is under 2 minutes, with "
        "incremental builds using the Vercel remote cache achieving sub-30-second rebuilds for "
        "typical changes."
    ))
    story.append(Spacer(1, 8))

    story.append(h2('8.4 CI/CD Considerations'))
    story.append(p(
        "The CI/CD pipeline is configured through the Vercel Git integration with additional "
        "quality gates enforced through GitHub Actions. The pipeline executes the following stages "
        "on every pull request: TypeScript type checking (tsc --noEmit), ESLint validation with "
        "zero-warning policy, unit test execution with Jest and React Testing Library, Prisma "
        "schema validation, and database migration dry-run against a Neon development branch."
    ))
    story.append(p(
        "Production deployments are triggered automatically on merges to the main branch after "
        "all quality gates pass. The deployment includes a health check phase that verifies the "
        "application responds correctly before traffic is routed to the new deployment. Rollback "
        "is achieved through the Vercel instant rollback feature that reverts to the previous "
        "deployment with a single click. Database migrations are applied as a pre-deployment step "
        "using prisma migrate deploy, ensuring schema changes are applied before the new code is "
        "active."
    ))
    story.append(Spacer(1, 12))

    # Build
    doc.multiBuild(story)
    print("Body PDF generated:", BODY_PDF)


def render_cover():
    generate_cover_html()
    subprocess.run([
        'python3', os.path.join(PDF_SKILL_DIR, 'scripts', 'poster_validate.py'),
        'check-html', COVER_HTML
    ], check=False)
    subprocess.run([
        'node', os.path.join(PDF_SKILL_DIR, 'scripts', 'html2poster.js'),
        COVER_HTML, '--output', COVER_PDF, '--width', '794px'
    ], check=True)
    print("Cover PDF generated:", COVER_PDF)


def merge_pdfs():
    from pypdf import PdfReader, PdfWriter, Transformation
    A4_W, A4_H = 595.28, 841.89

    def normalize_page(page):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
            sx, sy = A4_W / w, A4_H / h
            page.add_transformation(Transformation().scale(sx=sx, sy=sy))
            page.mediabox.lower_left = (0, 0)
            page.mediabox.upper_right = (A4_W, A4_H)
        return page

    writer = PdfWriter()
    cover_page = PdfReader(COVER_PDF).pages[0]
    writer.add_page(normalize_page(cover_page))
    for page in PdfReader(BODY_PDF).pages:
        writer.add_page(normalize_page(page))

    writer.add_metadata({
        '/Title': 'NEXUS HRMS Technical Documentation',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Complete Coding Standards & Architecture Reference for NEXUS HRMS Platform',
    })

    with open(FINAL_PDF, 'wb') as f:
        writer.write(f)

    sz = os.path.getsize(FINAL_PDF)
    sz_str = "%.1f MB" % (sz / (1024*1024)) if sz > 1024*1024 else "%.1f KB" % (sz / 1024)
    pc = len(PdfReader(FINAL_PDF).pages)
    print("Final PDF:", FINAL_PDF)
    print("Size:", sz_str)
    print("Pages:", pc)


if __name__ == '__main__':
    print("=== Step 1: Building body PDF ===")
    build_body()
    print("\n=== Step 2: Rendering cover PDF ===")
    render_cover()
    print("\n=== Step 3: Merging PDFs ===")
    merge_pdfs()
    print("\n=== Complete! ===")
