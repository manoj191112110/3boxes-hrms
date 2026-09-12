#!/usr/bin/env python3
"""Generate NEXUS HRMS Workflow Documentation PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'workflow_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-Workflow-Documentation.pdf')

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

# ── 1. Introduction ──
story.append(heading('1. Introduction to NEXUS Workflow System', 'H1', s, 0))
story.append(body('The NEXUS HRMS Workflow System provides a comprehensive, configurable process automation engine that governs every business process across the platform. Each module implements structured state machines with defined transitions, approval gates, and notification triggers that ensure compliance, accountability, and operational efficiency.', s))
story.append(body('Workflows in NEXUS are built on a status-transition model where records move through well-defined states (e.g., Draft → Pending → Approved → Completed). Each transition is governed by role-based permissions, validation rules, and optional automated actions. The system supports single-step and multi-step approval chains, parallel approvals, and conditional routing based on business rules.', s))
story.append(body('This document provides module-wise workflow specifications for all 35+ modules, cross-module end-to-end process flows, and guidance on workflow configuration and automation through the built-in rules engine.', s))
story.append(Spacer(1, 8))

# ── 2. Module-wise Workflows ──
story.append(heading('2. Module-wise Workflows', 'H1', s, 0))
story.append(body('This section details the workflow for each module in the NEXUS HRMS platform, including step-by-step process flows, status transitions, and key participants.', s))
story.append(Spacer(1, 6))

modules = [
    {
        'name': '2.1 Super Admin Workflow',
        'desc': 'The Super Admin module governs platform-wide configuration, tenant management, and system-level operations. It provides the highest level of control for managing the multi-tenant SaaS platform.',
        'steps': [
            'Super Admin logs into the platform dashboard and views system-wide analytics.',
            'Navigates to Tenant Management to create, modify, or deactivate tenant organizations.',
            'Configures platform-level settings including feature toggles and subscription plans.',
            'Reviews and manages global user roles and permission templates.',
            'Monitors system health, audit logs, and security alerts.',
            'Performs database maintenance tasks such as backup verification and schema migrations.',
            'Approves or escalates critical system-level change requests.',
            'Reviews AI module configurations and cost tracking dashboards.'
        ],
        'transitions': [
            ['Platform Boot', 'Active', 'System startup', 'Super Admin'],
            ['Tenant Creation', 'Provisioned', 'Tenant onboarding', 'Super Admin'],
            ['Tenant Suspension', 'Suspended', 'Policy violation', 'Super Admin'],
            ['Config Change', 'Pending Review', 'Critical settings change', 'Super Admin'],
            ['Config Approved', 'Active', 'Review passed', 'Super Admin'],
        ],
        'roles': 'Super Admin, System Administrator'
    },
    {
        'name': '2.2 Tenant Admin Workflow',
        'desc': 'Tenant Admin workflow manages organization-specific configuration including employee setup, policy definition, and module activation. It serves as the primary administrative interface for each tenant organization.',
        'steps': [
            'Tenant Admin accesses the organization dashboard and reviews pending items.',
            'Configures company policies including leave rules, attendance policies, and payroll schedules.',
            'Sets up organizational structure (departments, designations, reporting hierarchies).',
            'Manages employee onboarding and offboarding processes at the organization level.',
            'Reviews and approves escalation items from subordinate managers.',
            'Configures module-specific settings for recruitment, performance, and training.',
            'Generates and reviews organization-wide reports and analytics.',
            'Manages integrations with third-party services and AI feature configurations.'
        ],
        'transitions': [
            ['Org Setup', 'Configured', 'Initial configuration', 'Tenant Admin'],
            ['Policy Draft', 'Active', 'Policy approved', 'Tenant Admin / HR'],
            ['Employee Onboarding', 'In Progress', 'New hire initiated', 'HR / Tenant Admin'],
            ['Module Activation', 'Enabled', 'Module turned on', 'Tenant Admin'],
            ['Report Generation', 'Completed', 'Report delivered', 'Tenant Admin / Manager'],
        ],
        'roles': 'Tenant Admin, HR Manager, System Administrator'
    },
    {
        'name': '2.3 Employee Management Workflow',
        'desc': 'The Employee Management workflow handles the complete employee lifecycle from profile creation through active employment to separation. It serves as the central registry for all workforce data.',
        'steps': [
            'HR creates a new employee record with personal and professional details.',
            'Employee receives credentials and completes profile self-service update.',
            'Manager reviews and approves employee profile changes.',
            'HR updates employment terms (promotion, transfer, salary revision).',
            'System automatically tracks probation period and triggers review notifications.',
            'Employee submits document updates (address, bank details, emergency contacts).',
            'HR verifies and approves document submissions.',
            'System maintains complete audit trail of all profile changes.'
        ],
        'transitions': [
            ['Profile Created', 'Active', 'Onboarding complete', 'HR'],
            ['Profile Update', 'Pending Approval', 'Change submitted', 'Employee'],
            ['Update Approved', 'Active', 'Manager/HR approved', 'Manager / HR'],
            ['Probation End', 'Review Due', 'Probation period ended', 'System'],
            ['Separated', 'Inactive', 'Offboarding complete', 'HR'],
        ],
        'roles': 'HR, Manager, Employee, Tenant Admin'
    },
    {
        'name': '2.4 Recruitment Workflow',
        'desc': 'The Recruitment workflow manages the complete hiring pipeline from job requisition through candidate selection and offer management. It integrates with AI-powered screening and interview modules.',
        'steps': [
            'Hiring manager submits a job requisition with role details and requirements.',
            'HR reviews and approves the requisition, creating a job posting.',
            'Candidates apply through the career portal or are sourced by recruiters.',
            'System performs initial screening using AI-powered resume analysis and score-based ranking.',
            'Recruiters shortlist candidates based on AI scores and manual review.',
            'Shortlisted candidates are scheduled for AI-powered or manual interviews.',
            'Interview panel evaluates candidates and submits feedback and scores.',
            'Selected candidates move to the offer stage for approval and dispatch.'
        ],
        'transitions': [
            ['Requisition Draft', 'Pending Approval', 'Submitted by manager', 'Hiring Manager'],
            ['Requisition Approved', 'Open', 'HR approved', 'HR'],
            ['Application Received', 'Screening', 'Candidate applied', 'System / Recruiter'],
            ['Screening Complete', 'Shortlisted / Rejected', 'AI + manual review', 'Recruiter'],
            ['Interview Scheduled', 'In Progress', 'Interview date set', 'Recruiter'],
            ['Interview Complete', 'Selected / Rejected', 'Panel decision', 'Interview Panel'],
            ['Offer Draft', 'Pending Approval', 'Offer created', 'HR'],
            ['Offer Approved', 'Sent', 'Authorized by management', 'HR / Tenant Admin'],
        ],
        'roles': 'Hiring Manager, HR, Recruiter, Interview Panel, Tenant Admin'
    },
    {
        'name': '2.5 Offer Management Workflow',
        'desc': 'The Offer Management workflow handles the creation, approval, and tracking of job offers extended to selected candidates. It integrates with the recruitment pipeline and onboarding module.',
        'steps': [
            'HR creates an offer letter based on approved compensation structure.',
            'Offer undergoes multi-level approval (HR Head, Finance, Tenant Admin as needed).',
            'Approved offer is sent to the candidate via email with digital acceptance link.',
            'Candidate reviews, negotiates, or accepts the offer.',
            'Upon acceptance, system triggers onboarding preparation workflow.',
            'If candidate declines, the position reverts to shortlist stage for alternate selection.',
            'HR tracks offer status through a centralized offer dashboard.',
            'System sends automated reminders for pending offer responses.'
        ],
        'transitions': [
            ['Offer Draft', 'Pending Approval', 'Created by HR', 'HR'],
            ['Offer Approved', 'Sent', 'Approved by management', 'HR Head / Tenant Admin'],
            ['Offer Sent', 'Pending Response', 'Delivered to candidate', 'System'],
            ['Offer Accepted', 'Accepted', 'Candidate confirmed', 'Candidate'],
            ['Offer Declined', 'Declined', 'Candidate refused', 'Candidate'],
            ['Offer Negotiated', 'Revised', 'Counter-offer made', 'HR / Candidate'],
        ],
        'roles': 'HR, HR Head, Finance, Tenant Admin, Candidate'
    },
    {
        'name': '2.6 AI Interview Workflow',
        'desc': 'The AI Interview workflow automates the interview process using the z-ai-web-dev-sdk for question generation, response evaluation, and scoring. It provides bias detection and consistent assessment standards.',
        'steps': [
            'Recruiter configures interview parameters (role, competency areas, difficulty level).',
            'AI engine generates contextual interview questions based on job requirements.',
            'Candidate completes the AI-driven interview with real-time interaction.',
            'AI evaluates responses using scoring algorithms with configurable thresholds.',
            'System generates detailed feedback including strengths and improvement areas.',
            'Bias detection module flags any potential scoring inconsistencies.',
            'Results are compiled into an Interview record with aiScore and aiFeedback fields.',
            'Recruiter reviews AI assessment alongside manual evaluation for final decision.'
        ],
        'transitions': [
            ['Interview Configured', 'Scheduled', 'Parameters set', 'Recruiter'],
            ['Interview Scheduled', 'In Progress', 'Candidate started', 'Candidate / AI'],
            ['Interview Complete', 'Evaluating', 'Responses collected', 'AI System'],
            ['Evaluation Complete', 'Scored', 'AI scoring done', 'AI System'],
            ['Bias Check Complete', 'Verified / Flagged', 'Bias analysis done', 'AI System'],
            ['Final Review', 'Approved / Rejected', 'Recruiter decision', 'Recruiter'],
        ],
        'roles': 'Recruiter, AI System, HR Manager, Candidate'
    },
    {
        'name': '2.7 Onboarding Workflow',
        'desc': 'The Onboarding workflow manages the transition of new hires from offer acceptance to fully productive employees. It includes task assignment, document collection, and orientation scheduling.',
        'steps': [
            'System automatically creates onboarding record upon offer acceptance.',
            'HR defines onboarding task checklist customized for the role and department.',
            'New hire receives welcome email with portal credentials and document upload links.',
            'Employee completes personal information and uploads required documents.',
            'IT department provisions equipment, accounts, and access credentials.',
            'HR schedules orientation sessions and department introductions.',
            'Manager assigns initial training modules and buddy/mentor pairing.',
            'System tracks task completion and triggers probation period start.'
        ],
        'transitions': [
            ['Onboarding Initiated', 'In Progress', 'Offer accepted', 'System'],
            ['Document Upload', 'Pending Verification', 'Documents submitted', 'Employee'],
            ['Documents Verified', 'Verified', 'HR verified', 'HR'],
            ['IT Provisioning', 'Completed', 'Accounts created', 'IT'],
            ['Orientation Complete', 'Active', 'All tasks done', 'HR / Manager'],
        ],
        'roles': 'HR, IT, Manager, New Hire, Tenant Admin'
    },
    {
        'name': '2.8 Attendance Workflow',
        'desc': 'The Attendance workflow handles daily time tracking, regularization, and compliance monitoring. It supports multiple tracking methods and integrates with the payroll module for accurate compensation.',
        'steps': [
            'Employee records check-in time through the web portal or mobile app.',
            'System tracks active time and calculates breaks automatically.',
            'Employee records check-out, completing the attendance record.',
            'System flags anomalies (late arrival, early departure, missing check-out).',
            'Employee submits regularization request for missed or incorrect entries.',
            'Manager reviews and approves or rejects regularization requests.',
            'HR reviews attendance compliance reports at month-end.',
            'System feeds validated attendance data to the payroll calculation engine.'
        ],
        'transitions': [
            ['Checked In', 'Present', 'Daily check-in', 'Employee'],
            ['Anomaly Detected', 'Regularization Required', 'Policy violation', 'System'],
            ['Regularization Submitted', 'Pending Approval', 'Request filed', 'Employee'],
            ['Regularization Approved', 'Regularized', 'Manager approved', 'Manager'],
            ['Regularization Rejected', 'Anomaly', 'Manager rejected', 'Manager'],
        ],
        'roles': 'Employee, Manager, HR, System'
    },
    {
        'name': '2.9 Leave Management Workflow',
        'desc': 'The Leave Management workflow handles leave requests, approvals, balance tracking, and policy enforcement. It integrates with attendance and payroll for accurate leave deductions.',
        'steps': [
            'Employee views available leave balance and submits leave request with dates and reason.',
            'System validates leave against policies (balance, blackout periods, concurrency rules).',
            'Request is routed to the reporting manager for approval.',
            'Manager approves, rejects, or requests modification to the leave request.',
            'System updates leave balance and reflects the absence in the attendance calendar.',
            'If leave overlaps with payroll period, deduction details are sent to payroll.',
            'Employee can cancel approved leaves subject to policy conditions.',
            'HR can override leave decisions and manage comp-off entries.'
        ],
        'transitions': [
            ['Leave Requested', 'Pending Approval', 'Submitted by employee', 'Employee'],
            ['Leave Approved', 'Approved', 'Manager approved', 'Manager'],
            ['Leave Rejected', 'Rejected', 'Manager declined', 'Manager'],
            ['Leave Cancelled', 'Cancelled', 'Employee/HR cancelled', 'Employee / HR'],
            ['Leave Availed', 'Completed', 'Leave period ended', 'System'],
        ],
        'roles': 'Employee, Manager, HR, Tenant Admin'
    },
    {
        'name': '2.10 Payroll Workflow',
        'desc': 'The Payroll workflow manages the complete salary processing cycle from data consolidation through disbursement. It handles statutory compliance, tax calculations, and multi-component salary structures.',
        'steps': [
            'HR initiates payroll cycle for the defined pay period.',
            'System consolidates attendance, leave, overtime, and variable pay data.',
            'Payroll engine calculates gross pay, deductions, taxes, and net pay per employee.',
            'HR reviews computation results and resolves any flagged exceptions.',
            'Finance team verifies statutory deductions (PF, ESI, TDS, Professional Tax).',
            'Authorized approver gives final payroll approval for processing.',
            'System generates payslips and initiates bank transfer files.',
            'Payroll register is locked and archived with audit trail.'
        ],
        'transitions': [
            ['Payroll Initiated', 'Data Collection', 'Cycle started', 'HR'],
            ['Data Collection', 'Computation', 'Data consolidated', 'System'],
            ['Computation', 'Review', 'Calculations done', 'System'],
            ['Review', 'Pending Approval', 'HR reviewed', 'HR'],
            ['Pending Approval', 'Approved', 'Authorized', 'Finance / Tenant Admin'],
            ['Approved', 'Processed', 'Disbursement done', 'System / Finance'],
            ['Processed', 'Locked', 'Archive complete', 'System'],
        ],
        'roles': 'HR, Finance, Tenant Admin, System'
    },
    {
        'name': '2.11 Performance Management Workflow',
        'desc': 'The Performance Management workflow handles the complete review cycle including goal setting, self-assessment, manager evaluation, and calibration. It supports both periodic and continuous feedback models.',
        'steps': [
            'HR initiates the performance review cycle and defines timelines.',
            'Employees set or confirm goals aligned with organizational objectives.',
            'Employees complete self-assessment against defined competencies and goals.',
            'Managers evaluate team members with ratings, feedback, and development plans.',
            'Review undergoes calibration to ensure rating consistency across teams.',
            'Final ratings are published with individualized development recommendations.',
            'System triggers relevant workflows (promotion, salary revision, PIP).',
            'HR compiles organization-wide performance analytics and trends.'
        ],
        'transitions': [
            ['Review Cycle Initiated', 'Goal Setting', 'Cycle started', 'HR'],
            ['Goal Setting', 'Self Assessment', 'Goals confirmed', 'Employee'],
            ['Self Assessment', 'Manager Review', 'Self-assessment done', 'Employee'],
            ['Manager Review', 'Calibration', 'Manager submitted', 'Manager'],
            ['Calibration', 'Final Rating', 'Calibration done', 'HR / Leadership'],
            ['Final Rating', 'Published', 'Ratings finalized', 'HR'],
        ],
        'roles': 'Employee, Manager, HR, Leadership, Tenant Admin'
    },
    {
        'name': '2.12 Training & Learning Workflow',
        'desc': 'The Training workflow manages the learning lifecycle from needs identification through course delivery and impact assessment. It supports both mandatory and developmental training programs.',
        'steps': [
            'HR or manager identifies training needs through performance gaps or organizational requirements.',
            'Training coordinator creates a course with objectives, content, and schedule.',
            'Employees are nominated or self-enroll for available training programs.',
            'Trainer delivers the course through in-person sessions or e-learning modules.',
            'Participants complete assessments and provide course feedback.',
            'System tracks completion status and issues certificates for passed participants.',
            'Manager reviews training effectiveness and skill improvement metrics.',
            'HR aggregates training data for compliance reporting and budget analysis.'
        ],
        'transitions': [
            ['Training Need Identified', 'Course Created', 'Course designed', 'HR / Manager'],
            ['Course Created', 'Enrollment Open', 'Published', 'Training Coordinator'],
            ['Enrolled', 'In Progress', 'Training started', 'Employee'],
            ['In Progress', 'Assessment', 'Course completed', 'Employee'],
            ['Assessment', 'Passed / Failed', 'Evaluation done', 'System'],
            ['Passed', 'Certified', 'Certificate issued', 'System'],
        ],
        'roles': 'HR, Training Coordinator, Manager, Employee, Trainer'
    },
    {
        'name': '2.13 Separation Workflow',
        'desc': 'The Separation workflow manages the complete offboarding process from resignation submission through final settlement. It ensures compliance with notice periods, exit procedures, and asset recovery.',
        'steps': [
            'Employee submits resignation or manager initiates termination with reason.',
            'HR reviews and acknowledges the separation request with notice period calculation.',
            'System triggers exit task checklist across departments (IT, Finance, Admin).',
            'Manager conducts knowledge transfer and handover planning.',
            'Exit interview is scheduled and conducted by HR.',
            'IT revokes system access and recovers organizational assets.',
            'Finance processes final settlement including deductions and dues.',
            'Employee record is updated to Separated status and archived.'
        ],
        'transitions': [
            ['Resignation Submitted', 'Pending Acknowledgment', 'Resignation filed', 'Employee'],
            ['Resignation Acknowledged', 'Notice Period', 'HR accepted', 'HR'],
            ['Notice Period', 'Exit Processing', 'Notice period ending', 'System'],
            ['Exit Processing', 'FNF Pending', 'Tasks completed', 'Multiple'],
            ['FNF Pending', 'Separated', 'Settlement done', 'Finance / HR'],
        ],
        'roles': 'Employee, Manager, HR, IT, Finance, Admin'
    },
    {
        'name': '2.14 Full & Final Settlement Workflow',
        'desc': 'The FNF (Full & Final) Settlement workflow handles the financial closure of separated employees including salary dues, recoveries, and statutory settlements.',
        'steps': [
            'System creates FNF case upon separation initiation.',
            'HR reviews pending dues: unpaid salary, leave encashment, bonus provisions.',
            'Finance calculates recoveries: notice period shortfall, advance adjustments, loan balances.',
            'IT and Admin confirm asset recovery status and report outstanding items.',
            'System computes net payable amount after all adjustments.',
            'FNF statement is reviewed and approved by HR and Finance.',
            'Payment is processed and FNF acknowledgment is generated.',
            'FNF record is locked with complete audit trail for compliance.'
        ],
        'transitions': [
            ['FNF Initiated', 'Dues Calculation', 'Case created', 'System'],
            ['Dues Calculation', 'Recovery Assessment', 'Dues computed', 'HR / Finance'],
            ['Recovery Assessment', 'Net Computation', 'Recoveries verified', 'Finance'],
            ['Net Computation', 'Pending Approval', 'Amount finalized', 'System'],
            ['Pending Approval', 'Approved', 'Authorized', 'HR Head / Finance'],
            ['Approved', 'Paid', 'Disbursement done', 'Finance'],
        ],
        'roles': 'HR, Finance, HR Head, IT, Admin'
    },
    {
        'name': '2.15 Helpdesk Workflow',
        'desc': 'The Helpdesk workflow manages internal support requests from ticket creation through resolution. It integrates with the AI Assistant for intelligent routing and self-service resolution.',
        'steps': [
            'Employee creates a support ticket with category, priority, and description.',
            'System performs AI-powered categorization and routes to appropriate team.',
            'Assigned agent acknowledges and accepts the ticket.',
            'Agent investigates and provides resolution or requests additional information.',
            'If escalation needed, ticket is escalated to higher support tier.',
            'Employee confirms resolution and provides satisfaction rating.',
            'System closes the ticket and updates the knowledge base.',
            'Analytics engine processes ticket data for trend identification and SLA monitoring.'
        ],
        'transitions': [
            ['Ticket Created', 'Open', 'Submitted by employee', 'Employee'],
            ['Open', 'Assigned', 'Routed to agent', 'System / AI'],
            ['Assigned', 'In Progress', 'Agent accepted', 'Agent'],
            ['In Progress', 'Resolved', 'Solution provided', 'Agent'],
            ['Resolved', 'Closed', 'Employee confirmed', 'Employee'],
            ['Any State', 'Escalated', 'SLA breach/complexity', 'System / Agent'],
        ],
        'roles': 'Employee, Support Agent, Helpdesk Manager, AI System'
    },
    {
        'name': '2.16 Project Management Workflow',
        'desc': 'The Project Management workflow handles project lifecycle from initiation through closure. It manages resource allocation, task tracking, and milestone monitoring.',
        'steps': [
            'Project Manager creates a project with scope, timeline, and resource requirements.',
            'Management approves the project charter and budget allocation.',
            'Team members are assigned and project plan is detailed with milestones.',
            'Tasks are created, assigned, and tracked through the project dashboard.',
            'Team members update task progress and log time against project activities.',
            'Project Manager reviews progress against milestones and manages risks.',
            'Project undergoes review gates at defined milestone checkpoints.',
            'Upon completion, project is closed with final documentation and lessons learned.'
        ],
        'transitions': [
            ['Project Draft', 'Pending Approval', 'Charter created', 'Project Manager'],
            ['Pending Approval', 'Approved', 'Charter approved', 'Management'],
            ['Approved', 'In Progress', 'Kickoff done', 'Project Manager'],
            ['In Progress', 'On Hold / At Risk', 'Issue identified', 'Project Manager'],
            ['In Progress', 'Completed', 'All milestones done', 'Project Manager'],
            ['Completed', 'Closed', 'Documentation done', 'Management'],
        ],
        'roles': 'Project Manager, Team Member, Management, Tenant Admin'
    },
    {
        'name': '2.17 Expense Management Workflow',
        'desc': 'The Expense workflow handles employee expense claims from submission through reimbursement. It enforces policy compliance, multi-level approval, and integrates with payroll for disbursement.',
        'steps': [
            'Employee submits expense claim with category, amount, and receipt attachments.',
            'System validates claim against expense policy limits and category rules.',
            'Reporting manager reviews and approves or requests clarification.',
            'If amount exceeds threshold, claim routes to second-level approval (Finance/HR).',
            'Finance team verifies expense validity and accounting code allocation.',
            'Approved expenses are queued for reimbursement in the next payroll cycle.',
            'System processes reimbursement through payroll or direct bank transfer.',
            'Expense records are archived for audit and tax compliance purposes.'
        ],
        'transitions': [
            ['Expense Submitted', 'Pending Approval', 'Claim filed', 'Employee'],
            ['Pending Approval', 'Manager Approved', 'First level passed', 'Manager'],
            ['Manager Approved', 'Finance Review', 'Threshold exceeded', 'System'],
            ['Finance Review', 'Approved', 'Finance verified', 'Finance'],
            ['Approved', 'Reimbursed', 'Payment processed', 'Finance / Payroll'],
            ['Any State', 'Rejected', 'Policy violation', 'Manager / Finance'],
        ],
        'roles': 'Employee, Manager, Finance, HR'
    },
    {
        'name': '2.18 Asset Management Workflow',
        'desc': 'The Asset Management workflow tracks organizational assets from procurement through disposal. It manages allocation, maintenance, and recovery of assets assigned to employees.',
        'steps': [
            'Admin or IT registers new assets with specifications, value, and warranty details.',
            'Employee requests asset allocation through the self-service portal.',
            'Manager approves asset allocation request.',
            'Asset is issued to the employee with documented handover acknowledgment.',
            'System tracks asset lifecycle including maintenance schedules and warranty expiry.',
            'Employee reports asset issues or maintenance requests.',
            'Upon separation, asset recovery is triggered as part of the exit checklist.',
            'Retired or damaged assets undergo disposal workflow with proper documentation.'
        ],
        'transitions': [
            ['Asset Registered', 'Available', 'Added to inventory', 'Admin / IT'],
            ['Allocation Request', 'Pending Approval', 'Employee requested', 'Employee'],
            ['Allocation Approved', 'Allocated', 'Manager approved', 'Manager'],
            ['Allocated', 'In Use', 'Handover done', 'IT / Admin'],
            ['In Use', 'Maintenance', 'Issue reported', 'Employee'],
            ['In Use', 'Returned', 'Recovery at separation', 'IT / Admin'],
            ['Returned', 'Available / Disposed', 'Assessment done', 'Admin'],
        ],
        'roles': 'Employee, Manager, IT, Admin, HR'
    },
    {
        'name': '2.19 Travel Management Workflow',
        'desc': 'The Travel workflow manages business travel from request through reimbursement. It handles itinerary planning, advance processing, and expense settlement for employee travel.',
        'steps': [
            'Employee submits travel request with destination, dates, and purpose.',
            'System validates against travel policy (class, budget, advance limits).',
            'Manager approves the travel request with itinerary confirmation.',
            'Finance processes travel advance if applicable.',
            'Employee undertakes travel and retains all expense documentation.',
            'Employee submits travel expense report upon return with receipts.',
            'Manager and Finance review and approve travel expense settlement.',
            'System reconciles advance against actual expenses and processes differential payment.'
        ],
        'transitions': [
            ['Travel Requested', 'Pending Approval', 'Request submitted', 'Employee'],
            ['Pending Approval', 'Approved', 'Manager approved', 'Manager'],
            ['Approved', 'Advance Processed', 'Finance released', 'Finance'],
            ['Travel Complete', 'Expense Report Due', 'Travel ended', 'System'],
            ['Expense Submitted', 'Pending Review', 'Report filed', 'Employee'],
            ['Pending Review', 'Settled', 'Approved and paid', 'Finance'],
        ],
        'roles': 'Employee, Manager, Finance, Travel Coordinator'
    },
    {
        'name': '2.20 Document Management Workflow',
        'desc': 'The Document Management workflow handles organizational document creation, review, approval, and archival. It ensures document version control and compliance with retention policies.',
        'steps': [
            'Author creates a new document or revision in the document repository.',
            'Document enters review cycle with designated reviewers.',
            'Reviewers provide feedback and approval or request revisions.',
            'Author incorporates feedback and resubmits for approval.',
            'Final approved document is published to the organization.',
            'System manages version control and access permissions.',
            'Document reaches retention review date for archival or renewal.',
            'Archived documents are stored per compliance requirements.'
        ],
        'transitions': [
            ['Draft', 'Under Review', 'Submitted for review', 'Author'],
            ['Under Review', 'Revision Required', 'Reviewer feedback', 'Reviewer'],
            ['Revision Required', 'Under Review', 'Resubmitted', 'Author'],
            ['Under Review', 'Approved', 'All reviewers approved', 'Reviewer'],
            ['Approved', 'Published', 'Published to org', 'Author / Admin'],
            ['Published', 'Archived', 'Retention period ended', 'System'],
        ],
        'roles': 'Author, Reviewer, Admin, HR'
    },
    {
        'name': '2.21 Shift Management Workflow',
        'desc': 'The Shift Management workflow handles shift scheduling, rotation, and compliance for organizations with shift-based operations. It ensures optimal coverage and adherence to labor regulations.',
        'steps': [
            'Admin or HR defines shift types with timing, grace periods, and rules.',
            'Shift schedule is created for the defined period with employee assignments.',
            'System validates shift coverage and alerts for understaffed slots.',
            'Employees view their assigned shifts and can request shift swaps.',
            'Manager approves or denies shift swap requests.',
            'System tracks actual shift adherence against scheduled shifts.',
            'Discrepancies trigger regularization or overtime calculations.',
            'Shift data feeds into attendance and payroll processing.'
        ],
        'transitions': [
            ['Shift Defined', 'Active', 'Configuration complete', 'Admin / HR'],
            ['Schedule Created', 'Published', 'Schedule finalized', 'HR / Manager'],
            ['Swap Requested', 'Pending Approval', 'Employee requested', 'Employee'],
            ['Swap Approved', 'Swapped', 'Manager approved', 'Manager'],
            ['Shift Deviation', 'Flagged', 'Non-compliance detected', 'System'],
        ],
        'roles': 'HR, Manager, Employee, Admin'
    },
    {
        'name': '2.22 Holiday Management Workflow',
        'desc': 'The Holiday Management workflow handles the definition and management of organizational holidays, regional holiday lists, and holiday policy compliance.',
        'steps': [
            'HR defines the holiday calendar for the year with dates and categories.',
            'Regional or location-specific holiday lists are configured for multi-location organizations.',
            'Holiday calendar is published and visible to all employees.',
            'Employees can view applicable holidays based on their location and policy.',
            'System integrates holidays with leave and attendance calculations.',
            'HR can add or modify holidays during the year with appropriate approvals.',
            'System adjusts payroll calculations for holidays falling in pay periods.',
            'Year-end process archives the holiday calendar and initiates next year planning.'
        ],
        'transitions': [
            ['Holiday List Draft', 'Pending Approval', 'HR created list', 'HR'],
            ['Pending Approval', 'Published', 'Management approved', 'Tenant Admin / HR'],
            ['Published', 'Active', 'Effective period', 'System'],
            ['Modification Requested', 'Pending Approval', 'Change needed', 'HR'],
            ['Active', 'Archived', 'Year ended', 'System'],
        ],
        'roles': 'HR, Tenant Admin, Employee, System'
    },
    {
        'name': '2.23 Company Directory Workflow',
        'desc': 'The Company Directory workflow manages the organizational contact directory, ensuring accurate and accessible employee contact information across the organization.',
        'steps': [
            'Employee profiles are automatically populated from the Employee Management module.',
            'Employees update their contact details and professional information.',
            'HR reviews and verifies directory updates for accuracy.',
            'Directory search and browse functionality is available to all authorized users.',
            'Organization chart is generated from reporting hierarchy data.',
            'Department and team views are maintained with current personnel data.',
            'System ensures data privacy controls limit visibility of sensitive fields.',
            'Directory data syncs with other modules requiring employee information.'
        ],
        'transitions': [
            ['Profile Synced', 'Active', 'Auto-populated', 'System'],
            ['Update Submitted', 'Pending Verification', 'Employee updated', 'Employee'],
            ['Update Verified', 'Active', 'HR verified', 'HR'],
        ],
        'roles': 'Employee, HR, All Authorized Users'
    },
    {
        'name': '2.24 Notifications Workflow',
        'desc': 'The Notifications workflow manages the generation, delivery, and tracking of system notifications across all modules. It supports in-app, email, and configurable notification channels.',
        'steps': [
            'Module event triggers notification generation based on configured rules.',
            'System creates notification record with recipient, content, and priority.',
            'In-app notification is delivered to the recipient\'s notification center.',
            'Email notification is dispatched if configured for the event type.',
            'Recipient views and acknowledges the notification.',
            'Unread notifications trigger reminder cycles per escalation rules.',
            'System tracks notification delivery status and read receipts.',
            'Notification analytics are compiled for engagement and effectiveness metrics.'
        ],
        'transitions': [
            ['Notification Generated', 'Delivered', 'Sent to recipient', 'System'],
            ['Delivered', 'Read', 'Recipient viewed', 'Recipient'],
            ['Read', 'Actioned', 'Recipient acted', 'Recipient'],
            ['Delivered (Unread)', 'Reminder Sent', 'Escalation timer', 'System'],
        ],
        'roles': 'System, All Users, HR Admin'
    },
    {
        'name': '2.25 Reports & Analytics Workflow',
        'desc': 'The Reports & Analytics workflow manages report generation, scheduling, and distribution across the platform. It provides data-driven insights for organizational decision-making.',
        'steps': [
            'User selects report type from the analytics dashboard or report catalog.',
            'System validates user permissions for the requested report.',
            'Report parameters are configured (date range, department, filters).',
            'Report engine queries the database and generates the report with visualizations.',
            'User reviews the report and can export to PDF, Excel, or CSV.',
            'Scheduled reports are auto-generated and distributed per defined cadence.',
            'Custom report requests are processed by HR or IT with appropriate data access.',
            'Report usage and data access are logged for audit compliance.'
        ],
        'transitions': [
            ['Report Requested', 'Generating', 'Parameters set', 'User'],
            ['Generating', 'Ready', 'Data compiled', 'System'],
            ['Ready', 'Viewed', 'User accessed', 'User'],
            ['Ready', 'Exported', 'Downloaded', 'User'],
            ['Scheduled', 'Auto-Generated', 'Schedule trigger', 'System'],
        ],
        'roles': 'All Authorized Users, HR, Management, IT'
    },
    {
        'name': '2.26 AI Assistant Workflow',
        'desc': 'The AI Assistant workflow manages the intelligent chatbot interaction for employee self-service and HR query resolution using the z-ai-web-dev-sdk.',
        'steps': [
            'Employee initiates a conversation with the AI Assistant through the chat interface.',
            'AI engine processes the query using NLP and intent classification.',
            'System retrieves relevant knowledge from the HR knowledge base.',
            'AI generates a contextual response or performs the requested action.',
            'Conversation context is maintained for multi-turn dialogues.',
            'If the query exceeds AI capability, smart escalation to human agent is triggered.',
            'All interactions are logged in the AIChatLog model for analytics.',
            'AI continuously learns from feedback to improve response accuracy.'
        ],
        'transitions': [
            ['Query Received', 'Processing', 'NLP analysis', 'AI System'],
            ['Processing', 'Knowledge Retrieval', 'Intent classified', 'AI System'],
            ['Knowledge Retrieval', 'Response Generated', 'Data retrieved', 'AI System'],
            ['Response Generated', 'Delivered', 'Response sent', 'AI System'],
            ['Processing', 'Escalated', 'AI limit reached', 'AI System'],
            ['Escalated', 'Human Agent Assigned', 'Agent picked up', 'Helpdesk'],
        ],
        'roles': 'Employee, AI System, Helpdesk Agent, HR'
    },
    {
        'name': '2.27 Goals & OKR Workflow',
        'desc': 'The Goals & OKR workflow manages organizational and individual objective setting, tracking, and alignment. It ensures cascade alignment from company objectives to individual goals.',
        'steps': [
            'Leadership defines company-level OKRs for the period.',
            'Department heads create team OKRs aligned with company objectives.',
            'Individuals set personal goals linked to team and company OKRs.',
            'System validates goal alignment and identifies orphaned objectives.',
            'Employees update goal progress with key result check-ins.',
            'Managers review progress and provide coaching feedback.',
            'End-of-period evaluation assesses goal completion and alignment scores.',
            'Goal outcomes feed into performance review and calibration processes.'
        ],
        'transitions': [
            ['Goal Draft', 'Pending Alignment', 'Goal created', 'Employee / Manager'],
            ['Pending Alignment', 'Active', 'Alignment confirmed', 'Manager'],
            ['Active', 'In Progress', 'Progress updated', 'Employee'],
            ['In Progress', 'Under Review', 'Period ended', 'System'],
            ['Under Review', 'Completed', 'Evaluation done', 'Manager'],
        ],
        'roles': 'Employee, Manager, Leadership, HR'
    },
    {
        'name': '2.28 Timesheet Workflow',
        'desc': 'The Timesheet workflow handles weekly/daily time tracking against projects and tasks. It ensures accurate time logging for billing, productivity analysis, and payroll integration.',
        'steps': [
            'Employee logs daily time entries against assigned projects and tasks.',
            'System validates time entries against project allocation and working hours.',
            'Employee submits the timesheet for the defined period (weekly/bi-weekly).',
            'Manager reviews timesheet entries for accuracy and project validity.',
            'Manager approves or returns the timesheet with feedback.',
            'Approved timesheet data feeds into project costing and billing calculations.',
            'Timesheet hours are reconciled with attendance records.',
            'System generates productivity reports and utilization metrics.'
        ],
        'transitions': [
            ['Time Entry', 'In Progress', 'Daily logging', 'Employee'],
            ['Timesheet Submitted', 'Pending Approval', 'Period submitted', 'Employee'],
            ['Pending Approval', 'Approved', 'Manager verified', 'Manager'],
            ['Pending Approval', 'Returned', 'Corrections needed', 'Manager'],
            ['Approved', 'Processed', 'Data integrated', 'System'],
        ],
        'roles': 'Employee, Manager, Project Manager, Finance'
    },
    {
        'name': '2.29 Compliance Workflow',
        'desc': 'The Compliance workflow manages regulatory compliance tracking, document submissions, and audit preparedness across the organization.',
        'steps': [
            'Compliance officer defines applicable regulatory requirements for the organization.',
            'System creates compliance tasks with deadlines and responsible parties.',
            'Assigned teams gather required documentation and evidence.',
            'Compliance officer reviews submissions for completeness and accuracy.',
            'System tracks submission status and sends deadline reminders.',
            'External audit findings are recorded with corrective action plans.',
            'Corrective actions are tracked to closure with verification.',
            'Compliance dashboard provides real-time status of all regulatory obligations.'
        ],
        'transitions': [
            ['Compliance Defined', 'Tasks Created', 'Requirements mapped', 'Compliance Officer'],
            ['Tasks Created', 'In Progress', 'Work started', 'Assigned Team'],
            ['In Progress', 'Submitted', 'Evidence provided', 'Assigned Team'],
            ['Submitted', 'Verified', 'Officer verified', 'Compliance Officer'],
            ['Audit Finding', 'Corrective Action', 'Action plan created', 'Compliance Officer'],
            ['Corrective Action', 'Closed', 'Verified resolved', 'Compliance Officer'],
        ],
        'roles': 'Compliance Officer, HR, Management, Assigned Teams'
    },
    {
        'name': '2.30 Benefits Administration Workflow',
        'desc': 'The Benefits Administration workflow manages employee benefit plans including enrollment, changes, claims, and termination. It supports health insurance, retirement plans, and other perk programs.',
        'steps': [
            'HR defines available benefit plans with eligibility criteria and coverage details.',
            'Employees review benefit options during open enrollment or life event windows.',
            'Employee selects and enrolls in desired benefit plans.',
            'System validates enrollment against eligibility rules.',
            'HR processes enrollment with benefit providers and confirms coverage.',
            'Employee submits benefit claims through the self-service portal.',
            'HR or provider reviews and processes claims for reimbursement.',
            'Benefit changes are processed upon qualifying life events or annual renewal.'
        ],
        'transitions': [
            ['Enrollment Open', 'Selection', 'Employee choosing', 'Employee'],
            ['Selection', 'Pending Validation', 'Submitted', 'Employee'],
            ['Pending Validation', 'Enrolled', 'Eligibility confirmed', 'System / HR'],
            ['Claim Submitted', 'Under Review', 'Claim filed', 'Employee'],
            ['Under Review', 'Approved / Denied', 'Review complete', 'HR / Provider'],
            ['Enrolled', 'Terminated', 'Separation/Change', 'System / HR'],
        ],
        'roles': 'Employee, HR, Benefits Administrator, Provider'
    },
    {
        'name': '2.31 Loan & Advance Workflow',
        'desc': 'The Loan & Advance workflow manages employee loan applications, approvals, disbursement, and repayment tracking. It integrates with payroll for EMI deductions.',
        'steps': [
            'Employee submits loan or advance application with amount and purpose.',
            'System validates eligibility based on employment tenure and policy limits.',
            'HR reviews the application and verifies employee standing.',
            'Finance approves the loan based on organizational policy and budget.',
            'Loan amount is disbursed through payroll or direct transfer.',
            'System sets up EMI deduction schedule in the payroll module.',
            'Monthly EMI deductions are processed through payroll automatically.',
            'Loan closure is processed upon full repayment or separation settlement.'
        ],
        'transitions': [
            ['Application Submitted', 'Pending HR Review', 'Employee applied', 'Employee'],
            ['Pending HR Review', 'Pending Finance Approval', 'HR verified', 'HR'],
            ['Pending Finance Approval', 'Approved', 'Finance approved', 'Finance'],
            ['Approved', 'Disbursed', 'Amount released', 'Finance'],
            ['Disbursed', 'Active Repayment', 'EMI setup done', 'System'],
            ['Active Repayment', 'Closed', 'Full repayment', 'System'],
        ],
        'roles': 'Employee, HR, Finance, System'
    },
    {
        'name': '2.32 Grievance Workflow',
        'desc': 'The Grievance workflow handles employee complaints and grievances with confidentiality, fair investigation, and resolution tracking. It ensures compliance with labor law requirements.',
        'steps': [
            'Employee submits a grievance through the confidential portal with category and details.',
            'System assigns the grievance to an appropriate investigator ensuring no conflict of interest.',
            'Investigator reviews the grievance and conducts preliminary assessment.',
            'Investigation includes interviews, document review, and evidence gathering.',
            'Investigator submits findings and recommended resolution.',
            'Management reviews and approves or modifies the resolution.',
            'Resolution is communicated to the aggrieved employee with action plan.',
            'Follow-up is conducted to ensure resolution effectiveness and prevent recurrence.'
        ],
        'transitions': [
            ['Grievance Filed', 'Under Investigation', 'Assigned to investigator', 'System / HR'],
            ['Under Investigation', 'Findings Submitted', 'Investigation complete', 'Investigator'],
            ['Findings Submitted', 'Resolution Pending', 'Management review', 'Management'],
            ['Resolution Pending', 'Resolved', 'Action approved', 'Management'],
            ['Resolved', 'Follow-up', 'Monitoring effectiveness', 'HR'],
            ['Follow-up', 'Closed', 'Confirmed resolved', 'HR'],
        ],
        'roles': 'Employee, HR, Investigator, Management'
    },
    {
        'name': '2.33 Policy Management Workflow',
        'desc': 'The Policy Management workflow handles creation, review, approval, and communication of organizational policies. It ensures version control and employee acknowledgment tracking.',
        'steps': [
            'Policy owner drafts a new policy or revision with comprehensive content.',
            'Legal and HR review the draft for compliance and consistency.',
            'Reviewed policy is submitted for management approval.',
            'Management approves and publishes the policy with effective date.',
            'System notifies all affected employees of the new or updated policy.',
            'Employees review and acknowledge receipt and understanding.',
            'System tracks acknowledgment status and sends reminders to non-responders.',
            'Policy version history is maintained for audit and reference purposes.'
        ],
        'transitions': [
            ['Policy Draft', 'Under Review', 'Submitted for review', 'Policy Owner'],
            ['Under Review', 'Revision Required', 'Feedback provided', 'Legal / HR'],
            ['Revision Required', 'Under Review', 'Revised', 'Policy Owner'],
            ['Under Review', 'Pending Approval', 'Review complete', 'Legal / HR'],
            ['Pending Approval', 'Published', 'Management approved', 'Management'],
            ['Published', 'Acknowledgment Tracking', 'Notifications sent', 'System'],
        ],
        'roles': 'Policy Owner, Legal, HR, Management, All Employees'
    },
    {
        'name': '2.34 Background Verification Workflow',
        'desc': 'The Background Verification workflow manages pre-employment and periodic verification checks for employees. It coordinates with external agencies and tracks verification status.',
        'steps': [
            'HR initiates background verification for a selected candidate or employee.',
            'System generates verification consent form for candidate signature.',
            'Candidate provides consent and required personal information.',
            'Verification agency conducts checks (education, employment, criminal, address).',
            'Agency submits verification reports for each check category.',
            'HR reviews reports and flags any discrepancies for investigation.',
            'Discrepancies are discussed with the candidate for clarification.',
            'Final verification status is updated in the employee record.'
        ],
        'transitions': [
            ['BGV Initiated', 'Consent Pending', 'Request created', 'HR'],
            ['Consent Pending', 'Verification In Progress', 'Consent received', 'Candidate'],
            ['Verification In Progress', 'Reports Received', 'Agency submitted', 'Agency'],
            ['Reports Received', 'Review Complete', 'HR reviewed', 'HR'],
            ['Review Complete', 'Cleared / Flagged', 'Decision made', 'HR'],
        ],
        'roles': 'HR, Candidate, Verification Agency, Management'
    },
    {
        'name': '2.35 Probation Workflow',
        'desc': 'The Probation workflow manages the probation period for new employees from onboarding through confirmation or extension. It ensures timely reviews and compliance with probation policies.',
        'steps': [
            'System sets probation period based on role and organizational policy upon onboarding.',
            'Manager receives notification at mid-probation review checkpoint.',
            'Manager conducts mid-probation review and provides feedback.',
            'System triggers end-of-probation review notification before expiry.',
            'Manager completes end-of-probation evaluation with recommendation.',
            'HR reviews the evaluation and decides confirmation, extension, or separation.',
            'If confirmed, employee status is updated with permanent employment terms.',
            'If extended, new probation end date is set with specific improvement goals.'
        ],
        'transitions': [
            ['Probation Started', 'Mid-Review Due', 'Mid-point reached', 'System'],
            ['Mid-Review Due', 'Mid-Review Complete', 'Feedback given', 'Manager'],
            ['Mid-Review Complete', 'End Review Due', 'End of probation', 'System'],
            ['End Review Due', 'Evaluation Submitted', 'Manager evaluated', 'Manager'],
            ['Evaluation Submitted', 'Confirmed / Extended / Separated', 'HR decision', 'HR'],
        ],
        'roles': 'Manager, HR, Employee, System'
    },
    {
        'name': '2.36 Event Management Workflow',
        'desc': 'The Event Management workflow handles planning, coordination, and execution of organizational events. It manages invitations, RSVPs, logistics, and post-event feedback.',
        'steps': [
            'Event organizer creates an event with details, venue, date, and budget.',
            'Management approves the event proposal and budget allocation.',
            'System sends invitations to targeted employee groups with RSVP tracking.',
            'Logistics team arranges venue, catering, and other requirements.',
            'Organizer manages RSVPs and sends reminders to non-responders.',
            'Event is conducted as per the planned schedule.',
            'Post-event feedback is collected from attendees.',
            'Organizer compiles event summary with attendance, costs, and feedback analysis.'
        ],
        'transitions': [
            ['Event Proposed', 'Pending Approval', 'Organizer created', 'Organizer'],
            ['Pending Approval', 'Approved', 'Management approved', 'Management'],
            ['Approved', 'Invitations Sent', 'Published to employees', 'System'],
            ['Invitations Sent', 'RSVP Tracking', 'Responses received', 'System'],
            ['Event Conducted', 'Feedback Collection', 'Event completed', 'Organizer'],
            ['Feedback Collection', 'Closed', 'Summary completed', 'Organizer'],
        ],
        'roles': 'Event Organizer, Management, Employees, Admin'
    },
]

# Generate module workflows
for mod in modules:
    story.append(heading(mod['name'], 'H2', s, 1))
    story.append(body(mod['desc'], s))
    story.append(Spacer(1, 4))
    story.append(heading('Process Flow', 'H3', s, 1))
    for i, step in enumerate(mod['steps'], 1):
        story.append(bullet(f'<b>Step {i}:</b> {step}', s))
    story.append(Spacer(1, 6))
    story.append(heading('Status Transitions', 'H3', s, 1))
    t_headers = ['From State', 'To State', 'Trigger', 'Role']
    story.append(make_table(t_headers, mod['transitions'], s, [100, 100, 140, 120]))
    story.append(Spacer(1, 4))
    story.append(heading('Key Participants', 'H3', s, 1))
    story.append(body(f'<b>Roles:</b> {mod["roles"]}', s))
    story.append(Spacer(1, 10))

# ── 3. Cross-Module End-to-End Workflows ──
story.append(PageBreak())
story.append(heading('3. Cross-Module End-to-End Workflows', 'H1', s, 0))
story.append(body('Cross-module workflows represent complete business processes that span multiple NEXUS modules. These end-to-end workflows ensure seamless data flow and process continuity across organizational functions.', s))
story.append(Spacer(1, 8))

# Hire-to-Retire
story.append(heading('3.1 Hire-to-Retire', 'H2', s, 1))
story.append(body('The Hire-to-Retire workflow represents the complete employee lifecycle from recruitment through retirement or separation. It is the most comprehensive cross-module workflow in NEXUS, spanning over 15 modules.', s))
hire_to_retire_steps = [
    'Recruitment: Job requisition → Candidate sourcing → Screening → Interview → Selection',
    'Offer Management: Offer creation → Approval → Dispatch → Acceptance',
    'Background Verification: Consent → Agency checks → Clearance',
    'Onboarding: Welcome → Document collection → IT provisioning → Orientation → Task completion',
    'Probation: Mid-review → End-review → Confirmation/Extension',
    'Active Employment: Attendance tracking → Leave management → Performance reviews → Training',
    'Career Progression: Promotions → Transfers → Salary revisions → Goal alignment',
    'Separation: Resignation → Notice period → Exit processing → FNF settlement → Record archival'
]
for step in hire_to_retire_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 4))
ht_tbl = make_table(
    ['Phase', 'Modules Involved', 'Key Status', 'Duration'],
    [
        ['Recruitment', 'Recruitment, AI Interview, Offers', 'Requisition → Selection', '2-8 weeks'],
        ['Onboarding', 'Onboarding, IT, Employee Mgmt', 'Initiated → Active', '1-4 weeks'],
        ['Active Employment', 'Attendance, Leave, Performance, Training', 'Active', 'Ongoing'],
        ['Career Growth', 'Performance, Goals, Training', 'Promoted / Transferred', 'As needed'],
        ['Separation', 'Separation, FNF, Asset, Helpdesk', 'Resigned → Separated', '1-3 months'],
    ],
    s, [90, 140, 120, 100]
)
story.append(ht_tbl)
story.append(Spacer(1, 10))

# Requisition-to-Onboarding
story.append(heading('3.2 Requisition-to-Onboarding', 'H2', s, 1))
story.append(body('This workflow covers the complete process from identifying a staffing need to having a new employee fully onboarded and productive.', s))
req_steps = [
    'Hiring manager identifies staffing gap and submits job requisition with JD and budget.',
    'HR reviews requisition, aligns with headcount plan, and approves the position.',
    'Recruitment team creates job posting and initiates candidate sourcing.',
    'AI-powered screening ranks candidates based on resume matching and score analysis.',
    'Shortlisted candidates undergo AI Interview and/or manual panel interviews.',
    'Selection committee finalizes candidate(s) based on composite scoring.',
    'HR creates offer letter routed through approval chain (HR Head → Finance → Tenant Admin).',
    'Candidate accepts offer, triggering automatic onboarding workflow initiation.'
]
for step in req_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

# Leave-to-Payroll
story.append(heading('3.3 Leave-to-Payroll', 'H2', s, 1))
story.append(body('This workflow illustrates how leave data flows through the system to impact attendance records and ultimately payroll calculations.', s))
ltp_steps = [
    'Employee submits leave request through the Leave Management module.',
    'System validates leave against available balance, blackout periods, and concurrent leaves.',
    'Manager approves or rejects the leave request with comments.',
    'Approved leave is reflected in the Attendance calendar and employee leave balance.',
    'During payroll data consolidation, system retrieves leave data for the pay period.',
    'Unpaid leaves are calculated as per-day deductions based on salary structure.',
    'Leave encashment for eligible leaves is added to the payroll computation.',
    'Final payroll reflects all leave-based adjustments in the payslip breakdown.'
]
for step in ltp_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

# Performance-to-Promotion
story.append(heading('3.4 Performance-to-Promotion', 'H2', s, 1))
story.append(body('This workflow demonstrates how performance review outcomes trigger career progression actions including promotions, salary revisions, and development plans.', s))
ptp_steps = [
    'HR initiates the periodic performance review cycle with defined timelines.',
    'Employees complete self-assessment and goal progress documentation.',
    'Managers evaluate with ratings, competency assessments, and development feedback.',
    'Calibration sessions ensure rating consistency across teams and departments.',
    'Final ratings are published with performance bands (Exceeds, Meets, Below Expectations).',
    'High performers are identified for promotion consideration by leadership.',
    'Promotion proposals are submitted with compensation revision recommendations.',
    'Approved promotions trigger employee record updates, salary revisions, and role changes.'
]
for step in ptp_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

# Travel-to-Reimbursement
story.append(heading('3.5 Travel-to-Reimbursement', 'H2', s, 1))
story.append(body('This workflow covers the complete business travel process from request through expense settlement.', s))
ttr_steps = [
    'Employee submits travel request with itinerary, estimated costs, and business purpose.',
    'Manager approves the travel request with policy compliance verification.',
    'Finance processes travel advance as per organizational policy limits.',
    'Employee undertakes the approved travel and retains all expense documentation.',
    'Upon return, employee submits travel expense report with categorized receipts.',
    'Manager reviews expense report for reasonableness and policy adherence.',
    'Finance verifies expense calculations and accounting allocations.',
    'Approved expenses are reimbursed through payroll or direct bank transfer.'
]
for step in ttr_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

# Ticket-to-Resolution
story.append(heading('3.6 Ticket-to-Resolution', 'H2', s, 1))
story.append(body('This workflow covers the complete helpdesk ticket lifecycle from issue reporting through resolution and feedback.', s))
ttr2_steps = [
    'Employee creates a support ticket with category, priority, and detailed description.',
    'AI-powered classification categorizes and routes the ticket to the appropriate team.',
    'Assigned agent acknowledges the ticket and begins investigation.',
    'Agent provides resolution or requests additional information from the employee.',
    'If SLA is at risk, system automatically escalates to higher support tier.',
    'Employee verifies the resolution and provides satisfaction rating.',
    'Ticket is closed with resolution details added to the knowledge base.',
    'Analytics dashboard updates with resolution metrics for trend analysis.'
]
for step in ttr2_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 12))

# ── 4. Workflow Automation & Rules Engine ──
story.append(PageBreak())
story.append(heading('4. Workflow Automation & Rules Engine', 'H1', s, 0))
story.append(body('The NEXUS Workflow Automation & Rules Engine provides a configurable framework for automating business process decisions, routing, and actions without requiring code changes. It enables organizations to adapt workflows to their unique policies and compliance requirements.', s))
story.append(Spacer(1, 6))

story.append(heading('4.1 Automation Capabilities', 'H2', s, 1))
auto_caps = [
    '<b>Conditional Routing:</b> Route workflow steps based on data values such as amount thresholds, department, location, or role. For example, expense claims above $500 automatically route to Finance review.',
    '<b>Auto-Approval Rules:</b> Configure rules that automatically approve workflow steps meeting predefined criteria. For example, leave requests of 1 day with sufficient balance can be auto-approved.',
    '<b>Escalation Triggers:</b> Define time-based escalation rules that automatically escalate pending items after specified durations. For example, helpdesk tickets unresolved after 4 hours escalate to Tier 2.',
    '<b>Notification Rules:</b> Configure event-driven notifications to specific roles or individuals at any workflow transition point.',
    '<b>Parallel Processing:</b> Enable simultaneous approval steps where multiple approvers can review independently, with configurable completion criteria (any one, majority, or all).',
    '<b>Data-Driven Actions:</b> Trigger automated actions based on workflow data, such as sending onboarding checklists upon offer acceptance or initiating FNF upon separation confirmation.',
    '<b>Scheduled Workflow Actions:</b> Set up periodic workflow actions such as probation review reminders, performance cycle initiation, and compliance deadline alerts.',
    '<b>Integration Triggers:</b> Configure webhooks and API calls at workflow transition points for integration with external systems.'
]
for cap in auto_caps:
    story.append(bullet(cap, s))
story.append(Spacer(1, 8))

story.append(heading('4.2 Rules Engine Architecture', 'H2', s, 1))
story.append(body('The Rules Engine operates on an event-condition-action (ECA) model. When a workflow event occurs (e.g., status change), the engine evaluates all applicable rules against the current context and executes matching actions in priority order.', s))
story.append(Spacer(1, 4))
rules_tbl = make_table(
    ['Component', 'Description', 'Example'],
    [
        ['Event Trigger', 'Workflow state change or data update', 'Leave request status changed to Approved'],
        ['Condition Evaluator', 'Rule-based logic evaluation', 'If leave days > 3 AND department = "Engineering"'],
        ['Action Executor', 'Performs the determined action', 'Route to Department Head for secondary approval'],
        ['Priority Engine', 'Resolves conflicting rules by priority', 'Higher priority rules override lower ones'],
        ['Audit Logger', 'Records all rule evaluations and actions', 'Rule X triggered, condition met, action Y executed'],
    ],
    s, [100, 180, 180]
)
story.append(rules_tbl)
story.append(Spacer(1, 8))

story.append(heading('4.3 Rule Configuration Example', 'H2', s, 1))
story.append(body('Below is an example of configuring an expense approval rule in the Rules Engine:', s))
rule_examples = [
    '<b>Rule Name:</b> High-Value Expense Approval',
    '<b>Event:</b> Expense claim submitted',
    '<b>Condition:</b> Claim amount > $1,000 OR category = "International Travel"',
    '<b>Action:</b> Route to Finance Manager → CFO (two-level approval)',
    '<b>Priority:</b> High (overrides standard manager-only approval)',
    '<b>SLA:</b> Finance Manager must respond within 24 hours; CFO within 48 hours',
    '<b>Escalation:</b> If no response within SLA, auto-escalate to Tenant Admin',
    '<b>Notification:</b> Notify claimant at each approval step with status update'
]
for ex in rule_examples:
    story.append(bullet(ex, s))
story.append(Spacer(1, 12))

# ── 5. Workflow Configuration Guide ──
story.append(PageBreak())
story.append(heading('5. Workflow Configuration Guide', 'H1', s, 0))
story.append(body('This section provides practical guidance for configuring and customizing workflows in NEXUS HRMS. It covers the configuration interface, best practices, and common customization scenarios.', s))
story.append(Spacer(1, 6))

story.append(heading('5.1 Configuration Interface', 'H2', s, 1))
story.append(body('The Workflow Configuration interface is accessible to Tenant Admins through Settings → Workflow Configuration. The interface provides a visual workflow editor with drag-and-drop capability for defining process flows, status transitions, and approval chains.', s))
config_features = [
    '<b>Visual Workflow Builder:</b> Drag-and-drop interface for creating and modifying workflow diagrams with states, transitions, and conditions.',
    '<b>Status Management:</b> Define custom statuses with color coding, SLAs, and notification triggers for each workflow.',
    '<b>Approval Chain Editor:</b> Configure multi-level approval chains with parallel or sequential approval steps.',
    '<b>Rule Builder:</b> Visual rule builder for creating conditional logic without coding, supporting AND/OR conditions.',
    '<b>Notification Templates:</b> Customizable notification templates for each workflow transition with variable substitution.',
    '<b>Preview & Test:</b> Simulate workflow execution with test data before deploying changes to production.',
    '<b>Version Control:</b> Track workflow configuration changes with version history and rollback capability.',
    '<b>Import/Export:</b> Export workflow configurations as JSON for backup and import across tenants.'
]
for feat in config_features:
    story.append(bullet(feat, s))
story.append(Spacer(1, 8))

story.append(heading('5.2 Best Practices', 'H2', s, 1))
best_practices = [
    '<b>Start with Standard Workflows:</b> Use the predefined workflow templates as a starting point and customize incrementally rather than building from scratch.',
    '<b>Define Clear SLAs:</b> Set realistic SLAs for each approval step to ensure timely processing and automatic escalation when needed.',
    '<b>Limit Approval Levels:</b> Keep approval chains to 2-3 levels maximum. Excessive levels create bottlenecks and delay processing.',
    '<b>Use Conditional Routing:</b> Leverage conditional rules to simplify workflows rather than creating separate workflows for each scenario.',
    '<b>Test Thoroughly:</b> Always test workflow changes in the preview environment before deploying. Verify all transition paths and edge cases.',
    '<b>Document Customizations:</b> Maintain documentation for all custom workflow configurations, including the business rationale and approval matrix.',
    '<b>Review Periodically:</b> Conduct quarterly reviews of workflow configurations to identify bottlenecks, unused paths, and optimization opportunities.',
    '<b>Monitor Analytics:</b> Use workflow analytics to track processing times, approval rates, and escalation frequency for continuous improvement.'
]
for bp in best_practices:
    story.append(bullet(bp, s))
story.append(Spacer(1, 8))

story.append(heading('5.3 Common Customization Scenarios', 'H2', s, 1))
scenarios_tbl = make_table(
    ['Scenario', 'Configuration', 'Modules Affected'],
    [
        ['Multi-location leave policy', 'Define location-specific leave rules and approval chains', 'Leave, Attendance, Payroll'],
        ['Expense threshold-based approval', 'Set amount-based routing rules with tiered approval', 'Expense, Finance'],
        ['Probation auto-confirmation', 'Configure auto-confirmation if no negative feedback received', 'Probation, Employee Mgmt'],
        ['Shift-based attendance rules', 'Define grace periods and policies per shift type', 'Shift, Attendance, Payroll'],
        ['Department-specific recruitment', 'Route requisitions through department heads before HR', 'Recruitment, Offers'],
        ['AI interview scoring thresholds', 'Configure pass/fail thresholds with automatic shortlisting', 'AI Interview, Recruitment'],
    ],
    s, [130, 230, 120]
)
story.append(scenarios_tbl)
story.append(Spacer(1, 8))

story.append(heading('5.4 Troubleshooting Configuration Issues', 'H2', s, 1))
trouble_items = [
    '<b>Workflow Stuck:</b> Check if all required approval steps have assigned approvers. Verify that notification rules are active and SLA timers are configured. Use the Workflow Inspector to trace the exact point of blockage.',
    '<b>Incorrect Routing:</b> Review conditional rule logic and verify that data fields used in conditions are populated correctly. Check rule priority order as higher-priority rules may override expected routing.',
    '<b>Missing Notifications:</b> Verify notification template configuration and recipient mapping. Check that the notification service is running and email configurations are correct.',
    '<b>Approval Bypass:</b> Review auto-approval rules to ensure they are not overly broad. Check conditional logic for unintended matches that trigger auto-approval.',
    '<b>Performance Issues:</b> Complex workflows with many rules and transitions can impact processing time. Consider simplifying rule conditions and reducing the number of concurrent workflow evaluations.'
]
for item in trouble_items:
    story.append(bullet(item, s))

# ── Build ──
doc.multiBuild(story)

# Generate cover and merge
cover_pdf = generate_cover('Workflow<br/>Documentation', 'Module-wise Process Flows &amp; Workflow Specifications', 'workflow_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS Workflow Documentation')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
