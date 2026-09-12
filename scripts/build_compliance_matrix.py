#!/usr/bin/env python3
"""
Build SRS Addendum Compliance Matrix as a multi-sheet Excel workbook.

Sheets:
  1. Executive Summary   — KPI dashboard + status breakdown by section
  2. Compliance Matrix   — all 44 requirements (filterable, trackable)
  3. P0 Broken Models    — 6 runtime-crashing API surfaces
  4. Cross-Cutting Gaps  — gaps that block multiple requirements
  5. Roadmap             — prioritized remediation plan
"""

import sys, os

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.worksheet.table import Table, TableStyleInfo

from base import (
    FONT_NAME, HEADER_BOLD,
    PRIMARY, PRIMARY_LIGHT, SECONDARY,
    ACCENT_POSITIVE, ACCENT_NEGATIVE, ACCENT_WARNING,
    NEUTRAL_900, NEUTRAL_600, NEUTRAL_200, NEUTRAL_100, NEUTRAL_0,
    CF_POSITIVE_FILL, CF_POSITIVE_FONT,
    CF_NEGATIVE_FILL, CF_NEGATIVE_FONT,
    CF_WARNING_FILL, CF_WARNING_FONT,
    font_title, font_header, font_subheader, font_body, font_caption,
    fill_header, fill_total, fill_data_row,
    border_header, border_total,
    align_title, align_header, align_number, align_text,
    setup_sheet, style_header_row, style_data_row, style_total_row,
    auto_fit_columns,
)

OUT_PATH = "/home/z/my-project/download/Nexus_HRMS_SRS_Compliance_Matrix.xlsx"

# ==========================================================================
# DATA — All 44 requirements from the SRS Addendum audit
# ==========================================================================

# (Section, Req ID, Requirement, Status, Evidence, Gap, Priority)
# Status: Full / Partial / Placeholder / Missing
REQUIREMENTS = [
    # ---- 2. Recruitment ----
    ("Recruitment", "REQ-REC-01", "Manpower Requisitions (Requests to Hire)",
     "Full",
     "Requisition model + /api/requisitions/** + UI form (Manpower Requisitions page)",
     "Minor UX: dept/designation are free-text inputs instead of dropdowns",
     "P3"),
    ("Recruitment", "REQ-REC-02", "Tenant Admin Approval (budget/headcount thresholds)",
     "Partial",
     "3-stage approval workflow (pending → manager_approved → hr_approved → budget_approved | rejected); Company.maxEmployees & CompanyGroup.maxEmployees exist as caps",
     "No automatic trigger based on budget/headcount thresholds; no role guard on PATCH endpoint; salaryBudget is free-text String (no numeric comparison)",
     "P2"),
    ("Recruitment", "REQ-REC-03", "Multi-Currency Budgeting (CTC local + Group base display)",
     "Missing",
     "Requisition.salaryBudget is free-text String; Offer.offeredCurrency/offeredCTC exist; CurrencyConfig + ExchangeRate models exist but unused in recruitment",
     "No numeric CTC capture, no FX conversion to group base currency, no UI display of converted amounts",
     "P1"),
    ("Recruitment", "REQ-REC-04", "AI Resume Parsing (multi-lingual)",
     "Placeholder",
     "/api/recruitment-ai action=parse_resume exists but returns hardcoded 'John Smith' object",
     "No file upload, no ZAI call, no language detection, no PDF/DOCX parsing",
     "P2"),
    ("Recruitment", "REQ-REC-05", "AI Matching (skills, experience, semantic)",
     "Placeholder",
     "/api/recruitment-ai action=score_candidates returns 4 hardcoded entries; ignores jobPostingId parameter",
     "No real AI matching engine; no semantic analysis; no skill vector comparison",
     "P2"),
    ("Recruitment", "REQ-REC-06", "Multi-Lingual Job Posting + AI auto-translate",
     "Missing",
     "JobPosting model has only title/description/requirements — no language field",
     "No translation pipeline; no i18n library installed in project",
     "P2"),
    ("Recruitment", "REQ-REC-07", "Interview Scheduler (calendar + multi-timezone)",
     "Partial",
     "Interview model with date/time/duration/meetingUrl; scheduler dialog in AI Interview page",
     "No Google/Outlook/iCal integration; time stored as raw String with no timezone metadata; Company.timezone never consulted",
     "P3"),
    ("Recruitment", "REQ-REC-08", "AI Interview Insights (Fit Score + red-flag risks)",
     "Partial",
     "Real ZAI evaluation in /api/ai-interview/evaluate returns overall/communication/grammar/skill scores; ProctoringLog tracks red-flags (tab_switch, face_not_detected, audio_anomaly, etc.)",
     "No 'Fit Score' label; analyzes text transcripts only, not audio/video recordings",
     "P3"),

    # ---- 3. Onboarding & Lifecycle ----
    ("Onboarding", "REQ-ONB-01", "Dynamic Offer Letters (GDPR/APAC compliant clauses)",
     "Partial",
     "Offer model + CRUD + status workflow (draft → pending_approval → approved → sent → accepted/rejected)",
     "No PDF generation; no country detection; no GDPR/APAC legal clause injection; no template model; no e-signature",
     "P2"),
    ("Onboarding", "REQ-ONB-02", "Onboarding Task Checklist (IT/HR/Admin)",
     "Partial",
     "OnboardingTask model with category field (general, it_setup, hr_docs, training); CRUD endpoints",
     "No admin_desk category; not wired to AssetAssignment for laptop/access provisioning; categories are free-text not enum",
     "P2"),
    ("Onboarding", "REQ-ONB-03", "AI Onboarding Buddy (24/7 native-language)",
     "Partial",
     "Generic HR chatbot via ZAI exists at /api/ai-chat; AIChatLog persists sessions",
     "No buddy persona; no onboarding-specific KB; no native-language selector; same chatbot as general HR queries",
     "P3"),
    ("Onboarding", "REQ-ONB-04", "Cross-Group Project Assignment",
     "Partial",
     "ProjectAllocation schema permits cross-company assignment (no constraint); Employee.companyId + Project.companyId exist",
     "No UI surface (Team tab is read-only); no audit; home sub-company not visible in allocation UI",
     "P2"),

    # ---- 4. Project Management ----
    ("Project Mgmt", "REQ-PM-01", "Projects linked to Clients or Internal Initiatives",
     "Partial",
     "Project model has clientId FK + projectType enum (internal, client, r_and_d, support); POST accepts both fields",
     "Client dropdown NOT rendered in Create/Edit form — field silently sent as empty",
     "P2"),
    ("Project Mgmt", "REQ-PM-02", "Budget & Multi-Currency per Project",
     "Partial",
     "Project.currency/budgetAmount/billingRate/costRate; Client.billingCurrency; ExchangeRate model exists",
     "Currency list hardcoded to 4 values (USD/EUR/INR/GBP); billingRate/costRate NOT exposed in UI; no FX in PM context",
     "P2"),
    ("Project Mgmt", "REQ-PM-03", "Cross-Company Allocation (Tenant Admin)",
     "Missing",
     "ProjectAllocation schema allows it (no company-scoping constraint); POST endpoint accepts any employeeId",
     "Allocation POST never called from UI; no Tenant Admin cross-company workflow; no validation; no audit",
     "P2"),
    ("Project Mgmt", "REQ-PM-04", "Visual Gantt Charts (group resource availability)",
     "Missing",
     "No Gantt library in package.json (only recharts); no /dashboard/gantt page; no /api/gantt endpoint",
     "Entire feature missing — no timeline visualization, no group resource view, no DnD scheduling",
     "P3"),
    ("Project Mgmt", "REQ-PM-05", "AI Capacity Planning (burnout/under-allocation)",
     "Missing",
     "No Capacity/Workload/Burnout model; no /api/capacity route; ZAI not used in PM context",
     "Entire feature missing — no workload aggregation, no AI analysis, no risk suggestions",
     "P3"),
    ("Project Mgmt", "REQ-PM-06", "Utilization Rates (billable vs non-billable)",
     "Missing",
     "ProjectTask.isBillable + ProjectAllocation.billingStatus exist; no aggregation; Timesheet has no billable flag",
     "Entire feature missing — no per-employee or per-sub-company utilization tracking; no /api/utilization endpoint",
     "P2"),
    ("Project Mgmt", "REQ-PM-07", "Timesheets (log hours against projects/tasks)",
     "Partial",
     "Timesheet model + UI + POST/PATCH endpoints; weekly summary on dashboard",
     "project/task are plain String? (NOT FKs to Project/ProjectTask); @@unique([employeeId, date]) blocks multi-project/day entries",
     "P1"),
    ("Project Mgmt", "REQ-PM-08", "Timesheet Approval Workflow (PM + Tenant Admin)",
     "Partial",
     "Timesheet.status (draft/submitted/approved/rejected) + approvedBy/approvedAt; PATCH endpoint stamps approver",
     "No PM-specific role distinction (any manager can approve); no Tenant Admin group-wide pending view; no rejection reason",
     "P2"),
    ("Project Mgmt", "REQ-PM-09", "Multi-Currency Invoicing from timesheets",
     "Missing",
     "No Invoice or InvoiceLineItem model; no /api/invoices route; no /dashboard/invoices page",
     "Entire feature missing — no invoice generation, no FX-to-client-currency conversion, no draft persistence",
     "P2"),

    # ---- 5. Performance & Engagement ----
    ("Performance", "REQ-PER-01", "OKR Cascade (Company → SubCo → Project → Individual)",
     "Missing",
     "Goal model is employee-only flat (no companyId, projectId, or parent-child); OKR API exists but calls prisma.oKR (BROKEN — model not in schema)",
     "OKR model + cascade hierarchy entirely missing; existing OKR API is non-functional placeholder",
     "P2"),
    ("Performance", "REQ-PER-02", "AI Performance Nudges (30-day feedback)",
     "Missing",
     "No nudge/remindManager/feedbackReminder logic anywhere; no scheduler/cron jobs; performance-ai route only does insights/predictions",
     "No feedback-gap detection; no scheduled reminder job; no AI nudge generator",
     "P3"),
    ("Performance", "REQ-PER-03", "Project-Based Feedback (clients, multi-lingual)",
     "Missing",
     "Feedback model only handles employee-to-employee (fromId/toId/type); no clientId/projectId; no ProjectFeedback model",
     "No client/project feedback model; no submission endpoint; no multi-lingual UI; no auto-translation",
     "P3"),

    # ---- 6. Exit Management ----
    ("Exit", "REQ-EXIT-01", "Employee Self-Service Resignation",
     "Missing",
     "Admin-only /separation page; self-service.tsx has no resignation tab; /api/exit-workflow references db.exitRequest (BROKEN — model missing)",
     "No employee-facing resignation initiation; admin-only separation page exists instead",
     "P2"),
    ("Exit", "REQ-EXIT-02", "Automated Clearance Workflow (IT/Finance/PM triggers)",
     "Placeholder",
     "Seeded 'Offboarding Workflow' WorkflowDefinition template with 4 steps (Manager/IT/Finance/HR clearance)",
     "Template only — no code instantiates WorkflowInstance on Separation creation; no automated triggers",
     "P2"),
    ("Exit", "REQ-EXIT-03", "Identify Active Projects on Resignation",
     "Missing",
     "ProjectAllocation model exists but no logic in /api/separation queries it on Separation creation",
     "No code path enumerates exiting employee's active project allocations",
     "P2"),
    ("Exit", "REQ-EXIT-04", "PM Must Reassign Tasks Before Exit Completes",
     "Missing",
     "ProjectTask.assignedToId exists; /api/separation/[id] allows status=completed with no validation",
     "No guard, validation, or UI requiring task reassignment prior to exit completion",
     "P2"),
    ("Exit", "REQ-EXIT-05", "Digital Exit Interview Forms (multi-lingual)",
     "Partial",
     "API exists at /api/exit-interview with full CRUD shape — but calls prisma.exitInterview (BROKEN); Separation.exitInterview is free-text String",
     "ExitInterview model missing (API crashes); no multi-lingual form framework; no structured questions",
     "P2"),
    ("Exit", "REQ-EXIT-06", "AI Sentiment Analysis on Exit Interviews",
     "Missing",
     "No ZAI call processes exit interview text; only hardcoded sentiment strings in engagement module",
     "No AI sentiment analysis on exit interviews; no trend aggregation",
     "P3"),
    ("Exit", "REQ-EXIT-07", "Final Settlement (leave, bonus, severance)",
     "Partial",
     "FNFCalculation model + /api/fnf + /api/payroll/fnf; manual form with pendingSalary, leaveEncashment, bonus, noticeRecovery, etc.",
     "No auto-calc from LeaveBalance; no severance field; no pro-rated bonus engine; separationId optional (not enforced)",
     "P2"),
    ("Exit", "REQ-EXIT-08", "Service/Relieving Letters (labor-law compliant)",
     "Missing",
     "Only hardcoded relievingLetterIssued boolean checkbox in dead code; no PDF generation; no template model",
     "No letter generation whatsoever; no compliance rules engine",
     "P3"),

    # ---- 7.1 Super Admin ----
    ("Super Admin", "SA-1", "Global Talent Pool (cross-region candidate suggestions)",
     "Missing",
     "No Candidate model — denormalized across JobApplication/Offer/InterviewSession; /api/candidates returns demo data on every call",
     "No first-class Candidate entity; no cross-tenant search UI; no API to surface candidates globally",
     "P2"),
    ("Super Admin", "SA-2", "Project Profitability Dashboard (currency normalized)",
     "Missing",
     "Project has currency/budgetAmount/billingRate/costRate but NO billingCurrency field; PLATFORM_BASE_CURRENCY='USD' hardcoded; src/lib/currency.ts has formatCurrency but NO convertCurrency()",
     "No Most-vs-Least-Profitable aggregation; no FX normalization layer; no /api/super-admin/profitability endpoint",
     "P2"),
    ("Super Admin", "SA-3", "Audit Trails + Context Swapping (impersonation)",
     "Partial",
     "/api/audit/context-swap writes AuditLog row with action=CONTEXT_SWAP; /api/super-admin/audit-logs paginates + filters",
     "Only logs the swap event — no impersonation UI; no drill-down for 'why was this candidate rejected' or 'why was budget overridden'",
     "P2"),
    ("Super Admin", "SA-4", "System Config (cost-per-hire, utilization thresholds)",
     "Missing",
     "No SystemConfig model; PLATFORM_BASE_CURRENCY hardcoded with comment 'could be moved to a SystemConfig table later'",
     "No configurable platform metrics; FeatureFlag.config is freeform JSON unused by cost-per-hire logic",
     "P3"),

    # ---- 7.2 Tenant Admin ----
    ("Tenant Admin", "TA-1", "Group Resource View + Drag-and-Drop from Bench",
     "Missing",
     "No 'bench' / 'unallocated' flag on Employee; no centralized group-employee page; no DnD library (react-dnd, @dnd-kit)",
     "No bench concept; no cross-company allocation UI; no DnD from bench → project",
     "P3"),
    ("Tenant Admin", "TA-2", "Recruitment Budgeting + Freeze Hiring",
     "Missing",
     "No recruitmentBudget/hiringFrozen/hiringLimit fields on Company or CompanyGroup; only Tenant.status='suspended' exists",
     "No recruitment-cost aggregation; no per-sub-company hiring-freeze toggle",
     "P2"),
    ("Tenant Admin", "TA-3", "Cross-Billing Visibility (internal resource sharing)",
     "Missing",
     "Zero matches for cross-billing/internal-billing anywhere; no InterCompanyTransfer/InternalBilling model",
     "No inter-company billing model; no report; no UI",
     "P3"),
    ("Tenant Admin", "TA-4", "Exit Oversight (senior management resignations)",
     "Missing",
     "Separation model has no isCritical/isSeniorManagement/designationLevel flag; zero matches for critical exit",
     "No seniority classification on Separation; no instant-oversight view",
     "P2"),
    ("Tenant Admin", "TA-5", "AI Group Insights (deadline-miss predictions)",
     "Missing",
     "/api/reports/ai returns flightRisk/attrition (heuristic, not real AI); no 'Project X likely to miss deadline' prediction",
     "No project-deadline AI; no transfer-recommendation AI",
     "P3"),

    # ---- 8. Security ----
    ("Security", "REQ-SEC-10", "Candidate Data Privacy (GDPR/CCPA, 2-yr purge)",
     "Missing",
     "No retentionUntil/anonymizedAt fields on JobApplication/Offer/InterviewSession; no retention job/scheduler; no DSAR endpoint",
     "No automated 2-year purge/anonymization; no consent management; no right-to-be-forgotten endpoint",
     "P2"),
    ("Security", "REQ-SEC-11", "Project Confidentiality (no cross-project financials)",
     "Missing",
     "/api/projects/[id] returns full financials to ANY authenticated user; only check is verifyToken; no ProjectMember model",
     "No project-level RBAC; any auth user can read any project's financials",
     "P1"),
    ("Security", "REQ-SEC-12", "Timesheet Immutability (lock when approved+invoiced)",
     "Missing",
     "Timesheet has only status/approvedBy/approvedAt — no invoiced/locked/version fields; PUT/PATCH/DELETE open to all; no TimesheetHistory model",
     "Approved/invoiced timesheets can be edited or deleted freely by any auth user; no Super-Admin override path",
     "P1"),
]

# (Surface, Missing Model, Affected Route, Symptom, Fix Approach)
BROKEN_MODELS = [
    ("Preboarding pipeline", "PreboardingCandidate",
     "/api/preboarding/** + /dashboard/preboarding",
     "UI silently shows demo data — API call falls into catch block",
     "Add PreboardingCandidate model to prisma/schema.prisma + migration"),
    ("Exit Workflow", "ExitRequest",
     "/api/exit-workflow/** + exit-workflow.tsx",
     "Every call throws TypeError (db.exitRequest is undefined)",
     "Add ExitRequest model OR remove dead routes and use Separation model"),
    ("OKR API", "OKR, KeyResult",
     "/api/okrs/** + /okr (no page exists)",
     "Runtime error — prisma.oKR is not a function",
     "Add OKR + KeyResult models with cascade fields (companyId, projectId, parentOkrId)"),
    ("Exit Interview", "ExitInterview",
     "/api/exit-interview/**",
     "Runtime error — prisma.exitInterview is not a function",
     "Add ExitInterview model linked to Separation"),
    ("Engagement Surveys", "Survey, SurveyResponse, Recognition",
     "/api/engagement/** + /dashboard/engagement",
     "Runtime error — all engagement endpoints crash",
     "Add Survey, SurveyResponse, Recognition models"),
    ("AI Admin Console", "AIConfig, AIPromptLog",
     "/api/ai-admin/** + /dashboard/ai-admin",
     "Entire AI Admin Console crashes — prisma.aIConfig is not a function",
     "Add AIConfig + AIPromptLog models (only AIChatLog currently exists)"),
]

# (Gap, Affects, Current State, Fix Approach, Priority)
CROSS_CUTTING_GAPS = [
    ("No i18n library installed (no next-intl / react-intl / i18next)",
     "REQ-REC-06, REQ-ONB-03, REQ-PER-03, REQ-EXIT-05",
     "All UI strings are hardcoded English; Tenant.language and Company.language fields are essentially inert",
     "Install next-intl + add src/locales/{en,es,fr,de,pt-BR,hi,zh,ja}/common.json + wire NextIntlClientProvider in app/layout.tsx",
     "P1"),
    ("No convertCurrency() utility — ExchangeRate table exists but is never consumed",
     "REQ-REC-03, REQ-PM-09, SA-2, TA-3",
     "src/lib/currency.ts only has formatCurrency (locale display); PLATFORM_BASE_CURRENCY hardcoded to 'USD'",
     "Add convertCurrency(amount, from, to, date?) to src/lib/currency.ts that reads latest ExchangeRate row",
     "P1"),
    ("No Candidate first-class model",
     "SA-1, REQ-SEC-10",
     "Candidate info denormalized into JobApplication.candidateName/Email/Phone + Offer.candidateId/Name/Email",
     "Promote to a first-class Candidate model with tenantId, retentionUntil, anonymizedAt fields",
     "P2"),
    ("No project-level RBAC (ProjectMember / ProjectPermission models)",
     "REQ-SEC-11",
     "src/lib/roleAccess.ts is module-level only; /api/projects/[id] returns financials to any auth user",
     "Add ProjectMember + ProjectPermission models; gate financial fields in /api/projects/[id] GET",
     "P1"),
    ("No Invoice model",
     "REQ-PM-09, SA-2",
     "ProjectMilestone.invoiceStatus is a string status only — no invoice record is ever created",
     "Add Invoice + InvoiceLineItem models; build generation pipeline from approved Timesheets + ProjectAllocation.billingRate",
     "P2"),
    ("No Utilization model or /api/utilization endpoint",
     "REQ-PM-06",
     "ProjectTask.isBillable + ProjectAllocation.billingStatus exist but are never aggregated",
     "Add Utilization model + aggregation endpoint computing billable vs non-billable hours per employee/sub-company",
     "P2"),
    ("No Gantt library in package.json",
     "REQ-PM-04",
     "Only recharts ^3.8.1 installed; no frappe-gantt, @bryntum/gantt, dhtmlx-gantt",
     "Install frappe-gantt or @bryntum/gantt; build /dashboard/gantt page + /api/gantt endpoint",
     "P3"),
    ("No scheduler/cron for nudges, retention purge, auto-task triggers",
     "REQ-PER-02, REQ-SEC-10, REQ-EXIT-02",
     "Only Next.js route handlers exist; no Vercel Cron configuration",
     "Use Vercel Cron + /api/cron/* routes for: 30-day feedback nudges, 2-year candidate purge, separation clearance triggers",
     "P2"),
    ("Timesheet schema broken — project/task are Strings (not FKs); @@unique blocks multi-project/day",
     "REQ-PM-07, REQ-PM-08, REQ-PM-09, REQ-SEC-12",
     "Timesheet.project and Timesheet.task are String? not FK; @@unique([employeeId, date]) allows only 1 entry/day",
     "Migrate Timesheet.project → projectId FK; Timesheet.task → taskId FK; drop per-day unique constraint",
     "P1"),
    ("AI routes use mock data instead of real ZAI calls",
     "REQ-REC-04, REQ-REC-05, REQ-PER-02, TA-5",
     "parse_resume returns hardcoded 'John Smith'; score_candidates returns 4 hardcoded entries; reports/ai is heuristic+random",
     "Replace mocks with real z-ai-web-dev-sdk calls; add capacity-ai and sentiment-ai routes",
     "P2"),
    ("Multi-tenant row scoping inconsistent across APIs",
     "Multi-Tenancy (cross-cutting)",
     "Most APIs verify JWT but don't re-scope DB queries by decoded.tenantId (e.g., /api/timesheets has no tenant filter; /api/projects/[id] has no tenant check)",
     "Add tenant scoping middleware/helper that re-scopes every DB query by decoded.tenantId",
     "P2"),
]

# (Phase, Task, Req IDs Unlocked, Effort Estimate, Dependencies)
ROADMAP = [
    ("Phase 1 — Stabilize", "Fix 6 broken Prisma models (add to schema.prisma + migrate)",
     "Unblocks: REQ-PER-01, REQ-EXIT-05, REQ-EXIT-01, Engagement, AI Admin", "2-3 days", "None"),
    ("Phase 1 — Stabilize", "Fix Timesheet schema (project/task → FK, drop @@unique)",
     "Unblocks: REQ-PM-07, REQ-PM-08, REQ-PM-09, REQ-SEC-12", "1 day", "None"),
    ("Phase 1 — Stabilize", "Add ProjectMember model + project-level RBAC on /api/projects/[id]",
     "Delivers: REQ-SEC-11", "2 days", "None"),
    ("Phase 1 — Stabilize", "Add Timesheet lock fields (locked, invoicedStatus) + Super Admin override",
     "Delivers: REQ-SEC-12", "1 day", "Timesheet schema fix"),
    ("Phase 1 — Stabilize", "Add convertCurrency() utility + wire ExchangeRate table",
     "Unblocks: REQ-REC-03, REQ-PM-09, SA-2, TA-3", "1 day", "None"),
    ("Phase 1 — Stabilize", "Install next-intl + create locale skeleton",
     "Unblocks: REQ-REC-06, REQ-ONB-03, REQ-PER-03, REQ-EXIT-05", "2 days", "None"),

    ("Phase 2 — Foundations", "Add Invoice + InvoiceLineItem models + /api/invoices",
     "Delivers: REQ-PM-09", "3-4 days", "convertCurrency + Timesheet schema fix"),
    ("Phase 2 — Foundations", "Add Candidate first-class model + /api/candidates refactor",
     "Delivers: SA-1, REQ-SEC-10 (partial)", "2-3 days", "None"),
    ("Phase 2 — Foundations", "Add Utilization model + /api/utilization aggregation endpoint",
     "Delivers: REQ-PM-06", "2-3 days", "Timesheet schema fix"),
    ("Phase 2 — Foundations", "Add OKR + KeyResult models with cascade fields",
     "Delivers: REQ-PER-01", "2-3 days", "Phase 1 model fixes"),
    ("Phase 2 — Foundations", "Add ExitInterview model + ExitRequest + ClearanceTask",
     "Delivers: REQ-EXIT-01, REQ-EXIT-02, REQ-EXIT-03, REQ-EXIT-04, REQ-EXIT-05", "3-4 days", "Phase 1 model fixes"),
    ("Phase 2 — Foundations", "Add SystemConfig model + cost-per-hire / utilization thresholds",
     "Delivers: SA-4", "1-2 days", "None"),
    ("Phase 2 — Foundations", "Add recruitmentBudget + hiringFrozen to Company/CompanyGroup",
     "Delivers: TA-2", "1 day", "None"),
    ("Phase 2 — Foundations", "Add isCritical flag to Separation + Tenant Admin oversight widget",
     "Delivers: TA-4", "1 day", "None"),
    ("Phase 2 — Foundations", "Add Vercel Cron + /api/cron routes (nudges, retention, triggers)",
     "Delivers: REQ-PER-02, REQ-SEC-10 (purge), REQ-EXIT-02 (automation)", "2-3 days", "Phase 2 model fixes"),

    ("Phase 3 — AI", "Replace mock parse_resume + score_candidates with real ZAI calls",
     "Delivers: REQ-REC-04, REQ-REC-05", "3-4 days", "Candidate model"),
    ("Phase 3 — AI", "Add /api/capacity-ai route for burnout/under-allocation analysis",
     "Delivers: REQ-PM-05", "2-3 days", "Utilization model"),
    ("Phase 3 — AI", "Add sentiment analysis to /api/exit-interview POST",
     "Delivers: REQ-EXIT-06", "1-2 days", "ExitInterview model"),
    ("Phase 3 — AI", "Add /api/tenant-admin/ai-insights for deadline-miss predictions",
     "Delivers: TA-5", "2-3 days", "Utilization + Invoice models"),
    ("Phase 3 — AI", "Add ZAI auto-translation for job postings + client feedback",
     "Delivers: REQ-REC-06, REQ-PER-03", "2-3 days", "next-intl"),

    ("Phase 4 — UX", "Build /dashboard/gantt with frappe-gantt",
     "Delivers: REQ-PM-04", "3-4 days", "None"),
    ("Phase 4 — UX", "Build Tenant Admin cross-company allocation UI with @dnd-kit",
     "Delivers: TA-1, REQ-PM-03", "3-4 days", "None"),
    ("Phase 4 — UX", "Build Super Admin Project Profitability dashboard",
     "Delivers: SA-2", "2-3 days", "Invoice + convertCurrency"),
    ("Phase 4 — UX", "Build Super Admin impersonation (context swap) UI with audit drill-down",
     "Delivers: SA-3 (full)", "2-3 days", "None"),
    ("Phase 4 — UX", "Build PDF generation for Offer Letters + Service/Relieving Letters",
     "Delivers: REQ-ONB-01, REQ-EXIT-08", "3-4 days", "Compliance rules engine"),
    ("Phase 4 — UX", "Add admin_desk category to OnboardingTask + wire to AssetAssignment",
     "Delivers: REQ-ONB-02 (full)", "1-2 days", "None"),
    ("Phase 4 — UX", "Fork /api/ai-chat into /api/onboarding-buddy with persona + KB",
     "Delivers: REQ-ONB-03 (full)", "2 days", "next-intl"),
    ("Phase 4 — UX", "Add Client dropdown to Project create/edit form",
     "Delivers: REQ-PM-01 (full)", "0.5 days", "None"),
    ("Phase 4 — UX", "Add ClientFeedback model + multi-lingual portal",
     "Delivers: REQ-PER-03", "2-3 days", "next-intl"),
    ("Phase 4 — UX", "Add severance + pro-rated bonus + auto-calc from LeaveBalance to FNFCalculation",
     "Delivers: REQ-EXIT-07 (full)", "2 days", "None"),
]

# ==========================================================================
# BUILD WORKBOOK
# ==========================================================================

wb = Workbook()
wb.properties.creator = "Z.ai"
wb.properties.title = "Nexus HRMS SRS Addendum Compliance Matrix"
wb.properties.subject = "Audit of Recruitment, Onboarding, PM, Performance, Exit modules vs SRS Addendum"

# Remove default sheet — we'll create our own
default = wb.active
wb.remove(default)

# Status color mapping
STATUS_FILLS = {
    "Full":        PatternFill('solid', fgColor='E8F5E9'),
    "Partial":     PatternFill('solid', fgColor='FEF9E7'),
    "Placeholder": PatternFill('solid', fgColor='FFE5B4'),
    "Missing":     PatternFill('solid', fgColor='FDEDEC'),
}
STATUS_FONTS = {
    "Full":        Font(name=FONT_NAME, size=11, color=ACCENT_POSITIVE, bold=True),
    "Partial":     Font(name=FONT_NAME, size=11, color=ACCENT_WARNING, bold=True),
    "Placeholder": Font(name=FONT_NAME, size=11, color='B85C1E', bold=True),
    "Missing":     Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True),
}

PRIORITY_FONTS = {
    "P1": Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True),
    "P2": Font(name=FONT_NAME, size=11, color=ACCENT_WARNING, bold=True),
    "P3": Font(name=FONT_NAME, size=11, color=NEUTRAL_600, bold=True),
}

# --------------------------------------------------------------------------
# SHEET 1: Executive Summary
# --------------------------------------------------------------------------
def build_summary_sheet(wb):
    ws = wb.create_sheet("Executive Summary")
    ws.sheet_view.showGridLines = False

    # Column widths
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 28
    ws.column_dimensions['C'].width = 14
    ws.column_dimensions['D'].width = 14
    ws.column_dimensions['E'].width = 14
    ws.column_dimensions['F'].width = 14
    ws.column_dimensions['G'].width = 14
    ws.column_dimensions['H'].width = 14

    # Title
    ws['B2'] = "Nexus HRMS — SRS Addendum Compliance Audit"
    ws['B2'].font = Font(name=FONT_NAME, size=18, bold=HEADER_BOLD, color=PRIMARY)
    ws['B2'].alignment = Alignment(horizontal='left', vertical='center')
    ws.merge_cells('B2:H2')
    ws.row_dimensions[2].height = 36

    ws['B3'] = "Audit scope: Recruitment, Onboarding, Project Mgmt, Performance, Exit, Admin Integration, Security"
    ws['B3'].font = Font(name=FONT_NAME, size=10, color=NEUTRAL_600, italic=True)
    ws.merge_cells('B3:H3')

    # ----- KPI Block -----
    ws['B5'] = "Compliance KPIs"
    ws['B5'].font = Font(name=FONT_NAME, size=13, bold=HEADER_BOLD, color=PRIMARY)
    ws.merge_cells('B5:H5')
    ws.row_dimensions[5].height = 24

    total_reqs = len(REQUIREMENTS)
    counts = {"Full": 0, "Partial": 0, "Placeholder": 0, "Missing": 0}
    for r in REQUIREMENTS:
        counts[r[3]] += 1
    compliance_pct = (counts["Full"] / total_reqs) * 100
    partial_pct = (counts["Partial"] / total_reqs) * 100
    missing_pct = ((counts["Missing"] + counts["Placeholder"]) / total_reqs) * 100

    kpi_data = [
        ("Total Requirements", total_reqs, "integer"),
        ("Fully Implemented", counts["Full"], "positive"),
        ("Partially Implemented", counts["Partial"], "warning"),
        ("Placeholder Only", counts["Placeholder"], "warning"),
        ("Missing", counts["Missing"], "negative"),
        ("Compliance Rate", f"{compliance_pct:.1f}%", "positive"),
        ("At-Risk Rate (Missing + Placeholder)", f"{missing_pct:.1f}%", "negative"),
    ]

    for i, (label, value, kind) in enumerate(kpi_data):
        row = 6 + i
        ws.cell(row=row, column=2, value=label).font = Font(name=FONT_NAME, size=11, color=NEUTRAL_900)
        ws.cell(row=row, column=2).alignment = Alignment(horizontal='left', vertical='center')
        ws.cell(row=row, column=2).fill = PatternFill('solid', fgColor=NEUTRAL_100 if i % 2 == 0 else NEUTRAL_0)

        cell = ws.cell(row=row, column=3, value=value)
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.font = Font(name=FONT_NAME, size=14, bold=True,
                         color={"positive": ACCENT_POSITIVE,
                                "warning": ACCENT_WARNING,
                                "negative": ACCENT_NEGATIVE,
                                "integer": PRIMARY}.get(kind, NEUTRAL_900))
        cell.fill = PatternFill('solid', fgColor=NEUTRAL_100 if i % 2 == 0 else NEUTRAL_0)
        ws.row_dimensions[row].height = 22

    # ----- Status Breakdown by Section -----
    ws['B15'] = "Status Breakdown by SRS Section"
    ws['B15'].font = Font(name=FONT_NAME, size=13, bold=HEADER_BOLD, color=PRIMARY)
    ws.merge_cells('B15:H15')
    ws.row_dimensions[15].height = 24

    # Aggregate by section
    sections_order = ["Recruitment", "Onboarding", "Project Mgmt", "Performance",
                      "Exit", "Super Admin", "Tenant Admin", "Security"]
    section_stats = {s: {"Full": 0, "Partial": 0, "Placeholder": 0, "Missing": 0, "Total": 0} for s in sections_order}
    for r in REQUIREMENTS:
        s = r[0]
        section_stats[s][r[3]] += 1
        section_stats[s]["Total"] += 1

    # Header row
    headers = ["Section", "Full", "Partial", "Placeholder", "Missing", "Total", "Compliance %"]
    for col_idx, h in enumerate(headers, start=2):
        cell = ws.cell(row=17, column=col_idx, value=h)
    style_header_row(ws, row_num=17, col_start=2, col_end=8)
    ws.row_dimensions[17].height = 28

    # Data rows
    for i, section in enumerate(sections_order):
        row = 18 + i
        s = section_stats[section]
        comp_pct = (s["Full"] / s["Total"]) * 100 if s["Total"] else 0

        ws.cell(row=row, column=2, value=section)
        ws.cell(row=row, column=3, value=s["Full"])
        ws.cell(row=row, column=4, value=s["Partial"])
        ws.cell(row=row, column=5, value=s["Placeholder"])
        ws.cell(row=row, column=6, value=s["Missing"])
        ws.cell(row=row, column=7, value=s["Total"])
        ws.cell(row=row, column=8, value=f"{comp_pct:.0f}%")

        style_data_row(ws, row_num=row, col_start=2, col_end=8, row_index=i)
        # Center numeric cells
        for c in range(3, 9):
            ws.cell(row=row, column=c).alignment = Alignment(horizontal='center', vertical='center')
        # Color the status count cells
        if s["Full"] > 0:
            ws.cell(row=row, column=3).font = Font(name=FONT_NAME, size=11, color=ACCENT_POSITIVE, bold=True)
        if s["Partial"] > 0:
            ws.cell(row=row, column=4).font = Font(name=FONT_NAME, size=11, color=ACCENT_WARNING, bold=True)
        if s["Placeholder"] > 0:
            ws.cell(row=row, column=5).font = Font(name=FONT_NAME, size=11, color='B85C1E', bold=True)
        if s["Missing"] > 0:
            ws.cell(row=row, column=6).font = Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True)

    # Totals row
    total_row = 18 + len(sections_order)
    ws.cell(row=total_row, column=2, value="TOTAL")
    ws.cell(row=total_row, column=3, value=counts["Full"])
    ws.cell(row=total_row, column=4, value=counts["Partial"])
    ws.cell(row=total_row, column=5, value=counts["Placeholder"])
    ws.cell(row=total_row, column=6, value=counts["Missing"])
    ws.cell(row=total_row, column=7, value=total_reqs)
    ws.cell(row=total_row, column=8, value=f"{compliance_pct:.1f}%")
    style_total_row(ws, row_num=total_row, col_start=2, col_end=8)
    for c in range(3, 9):
        ws.cell(row=total_row, column=c).alignment = Alignment(horizontal='center', vertical='center')

    # ----- Critical Issues Callout -----
    callout_row = total_row + 3
    ws.cell(row=callout_row, column=2, value="🚨 Critical Issues (P0 — Runtime Crashes)")
    ws.cell(row=callout_row, column=2).font = Font(name=FONT_NAME, size=13, bold=HEADER_BOLD, color=ACCENT_NEGATIVE)
    ws.merge_cells(start_row=callout_row, start_column=2, end_row=callout_row, end_column=8)
    ws.row_dimensions[callout_row].height = 24

    callouts = [
        "6 API surfaces call Prisma models that don't exist in schema.prisma — every request crashes or returns mock data",
        "Affected: Preboarding, Exit Workflow, OKR API, Exit Interview, Engagement Surveys, AI Admin Console",
        "Timesheet schema is broken (project/task are Strings not FKs; @@unique blocks multi-project/day logging)",
        "Project Confidentiality fails open — any auth user can read any project's financials (REQ-SEC-11)",
        "Timesheet Immutability fails open — approved+invoiced timesheets can be edited/deleted by anyone (REQ-SEC-12)",
    ]
    for i, txt in enumerate(callouts):
        r = callout_row + 1 + i
        ws.cell(row=r, column=2, value=f"• {txt}")
        ws.cell(row=r, column=2).font = Font(name=FONT_NAME, size=10, color=NEUTRAL_900)
        ws.cell(row=r, column=2).alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
        ws.cell(row=r, column=2).fill = PatternFill('solid', fgColor='FDEDEC')
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=8)
        ws.row_dimensions[r].height = 22

    ws.freeze_panes = 'A4'


build_summary_sheet(wb)

# --------------------------------------------------------------------------
# SHEET 2: Compliance Matrix (master sheet — filterable as Excel Table)
# --------------------------------------------------------------------------
def build_matrix_sheet(wb):
    ws = wb.create_sheet("Compliance Matrix")
    ws.sheet_view.showGridLines = False

    # Column widths
    widths = {'A': 3, 'B': 14, 'C': 14, 'D': 12, 'E': 50, 'F': 12, 'G': 60, 'H': 60, 'I': 9}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    # Title
    ws['B2'] = "SRS Addendum Compliance Matrix — All Requirements"
    ws['B2'].font = Font(name=FONT_NAME, size=16, bold=HEADER_BOLD, color=PRIMARY)
    ws['B2'].alignment = Alignment(horizontal='left', vertical='center')
    ws.merge_cells('B2:I2')
    ws.row_dimensions[2].height = 32

    ws['B3'] = "Filter the table below by Section, Status, or Priority. Use Excel's filter dropdowns on row 4."
    ws['B3'].font = Font(name=FONT_NAME, size=10, color=NEUTRAL_600, italic=True)
    ws.merge_cells('B3:I3')

    # Header row at row 4
    headers = ["Section", "Req ID", "Status", "Requirement", "Priority", "Evidence (file paths / API routes)", "Gap (what's missing)"]
    for col_idx, h in enumerate(headers, start=2):
        ws.cell(row=4, column=col_idx, value=h)
    style_header_row(ws, row_num=4, col_start=2, col_end=8)
    ws.row_dimensions[4].height = 32

    # Data rows
    for i, (section, req_id, req_text, status, evidence, gap, priority) in enumerate(REQUIREMENTS):
        row = 5 + i
        ws.cell(row=row, column=2, value=section)
        ws.cell(row=row, column=3, value=req_id)
        ws.cell(row=row, column=4, value=status)
        ws.cell(row=row, column=5, value=req_text)
        ws.cell(row=row, column=6, value=priority)
        ws.cell(row=row, column=7, value=evidence)
        ws.cell(row=row, column=8, value=gap)

        # Base alternating fill
        fill_color = NEUTRAL_0 if i % 2 == 0 else NEUTRAL_100
        for c in range(2, 9):
            cell = ws.cell(row=row, column=c)
            cell.fill = PatternFill('solid', fgColor=fill_color)
            cell.font = Font(name=FONT_NAME, size=10, color=NEUTRAL_900)
            cell.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        # Override status cell with status color
        status_cell = ws.cell(row=row, column=4)
        status_cell.fill = STATUS_FILLS[status]
        status_cell.font = STATUS_FONTS[status]
        status_cell.alignment = Alignment(horizontal='center', vertical='center')

        # Override priority cell
        priority_cell = ws.cell(row=row, column=6)
        priority_cell.font = PRIORITY_FONTS[priority]
        priority_cell.alignment = Alignment(horizontal='center', vertical='center')

        # Req ID and Section centered
        ws.cell(row=row, column=2).alignment = Alignment(horizontal='left', vertical='top')
        ws.cell(row=row, column=3).alignment = Alignment(horizontal='center', vertical='top')

        ws.row_dimensions[row].height = 60

    # Convert range to Excel Table for native filtering
    last_row = 4 + len(REQUIREMENTS)
    table_range = f"B4:H{last_row}"
    tbl = Table(displayName="ComplianceMatrix", ref=table_range)
    style = TableStyleInfo(name="TableStyleLight1", showFirstColumn=False,
                           showLastColumn=False, showRowStripes=False, showColumnStripes=False)
    tbl.tableStyleInfo = style
    ws.add_table(tbl)

    # Freeze panes — keep title and header visible
    ws.freeze_panes = 'B5'


build_matrix_sheet(wb)

# --------------------------------------------------------------------------
# SHEET 3: P0 Broken Models
# --------------------------------------------------------------------------
def build_broken_models_sheet(wb):
    ws = wb.create_sheet("P0 Broken Models")
    ws.sheet_view.showGridLines = False

    widths = {'A': 3, 'B': 28, 'C': 30, 'D': 45, 'E': 50, 'F': 50}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws['B2'] = "P0 — Broken Prisma Models (Runtime Crashes)"
    ws['B2'].font = Font(name=FONT_NAME, size=16, bold=HEADER_BOLD, color=ACCENT_NEGATIVE)
    ws['B2'].alignment = Alignment(horizontal='left', vertical='center')
    ws.merge_cells('B2:F2')
    ws.row_dimensions[2].height = 32

    ws['B3'] = ("These API surfaces reference Prisma models that do NOT exist in prisma/schema.prisma. "
                "Every request either throws TypeError or silently falls back to mock data. Fix first.")
    ws['B3'].font = Font(name=FONT_NAME, size=10, color=NEUTRAL_600, italic=True)
    ws['B3'].alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
    ws.merge_cells('B3:F3')
    ws.row_dimensions[3].height = 32

    headers = ["Surface", "Missing Model(s)", "Affected Route(s)", "Symptom", "Fix Approach"]
    for col_idx, h in enumerate(headers, start=2):
        ws.cell(row=5, column=col_idx, value=h)
    style_header_row(ws, row_num=5, col_start=2, col_end=6)
    ws.row_dimensions[5].height = 28

    for i, (surface, model, route, symptom, fix) in enumerate(BROKEN_MODELS):
        row = 6 + i
        ws.cell(row=row, column=2, value=surface)
        ws.cell(row=row, column=3, value=model)
        ws.cell(row=row, column=4, value=route)
        ws.cell(row=row, column=5, value=symptom)
        ws.cell(row=row, column=6, value=fix)

        fill_color = 'FDEDEC'  # always red-tinted for P0
        for c in range(2, 7):
            cell = ws.cell(row=row, column=c)
            cell.fill = PatternFill('solid', fgColor=fill_color)
            cell.font = Font(name=FONT_NAME, size=10, color=NEUTRAL_900)
            cell.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        # Surface and Model bold + red
        ws.cell(row=row, column=2).font = Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True)
        ws.cell(row=row, column=3).font = Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True)

        ws.row_dimensions[row].height = 70

    ws.freeze_panes = 'B6'


build_broken_models_sheet(wb)

# --------------------------------------------------------------------------
# SHEET 4: Cross-Cutting Gaps
# --------------------------------------------------------------------------
def build_gaps_sheet(wb):
    ws = wb.create_sheet("Cross-Cutting Gaps")
    ws.sheet_view.showGridLines = False

    widths = {'A': 3, 'B': 50, 'C': 35, 'D': 60, 'E': 60, 'F': 9}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws['B2'] = "Cross-Cutting Gaps (block multiple requirements)"
    ws['B2'].font = Font(name=FONT_NAME, size=16, bold=HEADER_BOLD, color=PRIMARY)
    ws['B2'].alignment = Alignment(horizontal='left', vertical='center')
    ws.merge_cells('B2:F2')
    ws.row_dimensions[2].height = 32

    ws['B3'] = "Foundational gaps that, when fixed, unblock multiple SRS requirements simultaneously. Highest leverage."
    ws['B3'].font = Font(name=FONT_NAME, size=10, color=NEUTRAL_600, italic=True)
    ws.merge_cells('B3:F3')

    headers = ["Gap", "Affects (Req IDs)", "Current State", "Fix Approach", "Priority"]
    for col_idx, h in enumerate(headers, start=2):
        ws.cell(row=5, column=col_idx, value=h)
    style_header_row(ws, row_num=5, col_start=2, col_end=6)
    ws.row_dimensions[5].height = 28

    for i, (gap, affects, current, fix, priority) in enumerate(CROSS_CUTTING_GAPS):
        row = 6 + i
        ws.cell(row=row, column=2, value=gap)
        ws.cell(row=row, column=3, value=affects)
        ws.cell(row=row, column=4, value=current)
        ws.cell(row=row, column=5, value=fix)
        ws.cell(row=row, column=6, value=priority)

        fill_color = NEUTRAL_0 if i % 2 == 0 else NEUTRAL_100
        for c in range(2, 7):
            cell = ws.cell(row=row, column=c)
            cell.fill = PatternFill('solid', fgColor=fill_color)
            cell.font = Font(name=FONT_NAME, size=10, color=NEUTRAL_900)
            cell.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        # Priority cell color
        priority_cell = ws.cell(row=row, column=6)
        priority_cell.font = PRIORITY_FONTS[priority]
        priority_cell.alignment = Alignment(horizontal='center', vertical='center')

        ws.row_dimensions[row].height = 65

    # Convert to table for filtering
    last_row = 5 + len(CROSS_CUTTING_GAPS)
    table_range = f"B5:F{last_row}"
    tbl = Table(displayName="CrossCuttingGaps", ref=table_range)
    style = TableStyleInfo(name="TableStyleLight1", showFirstColumn=False,
                           showLastColumn=False, showRowStripes=False, showColumnStripes=False)
    tbl.tableStyleInfo = style
    ws.add_table(tbl)

    ws.freeze_panes = 'B6'


build_gaps_sheet(wb)

# --------------------------------------------------------------------------
# SHEET 5: Roadmap
# --------------------------------------------------------------------------
def build_roadmap_sheet(wb):
    ws = wb.create_sheet("Remediation Roadmap")
    ws.sheet_view.showGridLines = False

    widths = {'A': 3, 'B': 22, 'C': 60, 'D': 55, 'E': 16, 'F': 32}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w

    ws['B2'] = "Remediation Roadmap — Phased Delivery Plan"
    ws['B2'].font = Font(name=FONT_NAME, size=16, bold=HEADER_BOLD, color=PRIMARY)
    ws['B2'].alignment = Alignment(horizontal='left', vertical='center')
    ws.merge_cells('B2:F2')
    ws.row_dimensions[2].height = 32

    ws['B3'] = "Sequenced phases — each phase's tasks unlock later phases. P0 (stabilize) → P1 (foundations) → P2 (AI) → P3 (UX)."
    ws['B3'].font = Font(name=FONT_NAME, size=10, color=NEUTRAL_600, italic=True)
    ws.merge_cells('B3:F3')

    headers = ["Phase", "Task", "Unlocks / Delivers", "Effort", "Dependencies"]
    for col_idx, h in enumerate(headers, start=2):
        ws.cell(row=5, column=col_idx, value=h)
    style_header_row(ws, row_num=5, col_start=2, col_end=6)
    ws.row_dimensions[5].height = 28

    # Phase color map
    phase_fills = {
        "Phase 1 — Stabilize":  PatternFill('solid', fgColor='FDEDEC'),
        "Phase 2 — Foundations": PatternFill('solid', fgColor='FEF9E7'),
        "Phase 3 — AI":          PatternFill('solid', fgColor='E3F2FD'),
        "Phase 4 — UX":          PatternFill('solid', fgColor='E8F5E9'),
    }
    phase_fonts = {
        "Phase 1 — Stabilize":  Font(name=FONT_NAME, size=11, color=ACCENT_NEGATIVE, bold=True),
        "Phase 2 — Foundations": Font(name=FONT_NAME, size=11, color=ACCENT_WARNING, bold=True),
        "Phase 3 — AI":          Font(name=FONT_NAME, size=11, color='1565C0', bold=True),
        "Phase 4 — UX":          Font(name=FONT_NAME, size=11, color=ACCENT_POSITIVE, bold=True),
    }

    current_phase = None
    for i, (phase, task, unlocks, effort, deps) in enumerate(ROADMAP):
        row = 6 + i

        ws.cell(row=row, column=2, value=phase if phase != current_phase else "")
        ws.cell(row=row, column=3, value=task)
        ws.cell(row=row, column=4, value=unlocks)
        ws.cell(row=row, column=5, value=effort)
        ws.cell(row=row, column=6, value=deps)

        # Apply phase fill to phase cell
        phase_cell = ws.cell(row=row, column=2)
        phase_cell.fill = phase_fills[phase]
        phase_cell.font = phase_fonts[phase]
        phase_cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

        # Other cells get alternating neutral fill
        fill_color = NEUTRAL_0 if i % 2 == 0 else NEUTRAL_100
        for c in range(3, 7):
            cell = ws.cell(row=row, column=c)
            cell.fill = PatternFill('solid', fgColor=fill_color)
            cell.font = Font(name=FONT_NAME, size=10, color=NEUTRAL_900)
            cell.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        # Effort centered
        ws.cell(row=row, column=5).alignment = Alignment(horizontal='center', vertical='center')

        ws.row_dimensions[row].height = 50
        current_phase = phase

    # Summary at bottom
    summary_row = 6 + len(ROADMAP) + 2
    ws.cell(row=summary_row, column=2, value="Phase Summary:")
    ws.cell(row=summary_row, column=2).font = Font(name=FONT_NAME, size=12, bold=HEADER_BOLD, color=PRIMARY)
    ws.merge_cells(start_row=summary_row, start_column=2, end_row=summary_row, end_column=6)

    phase_totals = {}
    for phase, _, _, effort, _ in ROADMAP:
        phase_totals.setdefault(phase, {"count": 0, "effort": "varies"})
        phase_totals[phase]["count"] += 1

    for i, (phase, info) in enumerate(phase_totals.items()):
        r = summary_row + 1 + i
        ws.cell(row=r, column=2, value=phase)
        ws.cell(row=r, column=2).fill = phase_fills[phase]
        ws.cell(row=r, column=2).font = phase_fonts[phase]
        ws.cell(row=r, column=2).alignment = Alignment(horizontal='left', vertical='center')

        ws.cell(row=r, column=3, value=f"{info['count']} tasks")
        ws.cell(row=r, column=3).font = Font(name=FONT_NAME, size=11, color=NEUTRAL_900)
        ws.cell(row=r, column=3).alignment = Alignment(horizontal='left', vertical='center')

    ws.freeze_panes = 'B6'


build_roadmap_sheet(wb)

# --------------------------------------------------------------------------
# SAVE
# --------------------------------------------------------------------------
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
wb.save(OUT_PATH)

print(f"✅ Workbook saved to: {OUT_PATH}")
print(f"   Sheets: {wb.sheetnames}")
print(f"   Requirements tracked: {len(REQUIREMENTS)}")
print(f"   P0 broken models: {len(BROKEN_MODELS)}")
print(f"   Cross-cutting gaps: {len(CROSS_CUTTING_GAPS)}")
print(f"   Roadmap tasks: {len(ROADMAP)}")
