#!/usr/bin/env python3
"""Generate NEXUS HRMS SOP Documents PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'sop_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-SOP-Documents.pdf')

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

# ── 1. SOP Framework Overview ──
story.append(heading('1. SOP Framework Overview', 'H1', s, 0))
story.append(body('Standard Operating Procedures (SOPs) for the NEXUS HRMS platform provide step-by-step instructions for performing routine and critical operations across all modules. These SOPs ensure consistency, compliance, and quality in platform operations, serving as the authoritative reference for administrators, HR professionals, managers, and support staff.', s))
story.append(Spacer(1, 6))

story.append(heading('1.1 SOP Document Structure', 'H2', s, 1))
story.append(body('Each SOP follows a standardized structure to ensure completeness and usability:', s))
sop_structure = [
    '<b>SOP ID:</b> Unique identifier following the format NEXUS-[MODULE]-[NUMBER] (e.g., NEXUS-REC-001).',
    '<b>Title:</b> Descriptive title clearly identifying the procedure.',
    '<b>Purpose:</b> Explanation of why the procedure exists and what it achieves.',
    '<b>Scope:</b> Boundaries of the procedure — who it applies to and when.',
    '<b>Prerequisites:</b> Conditions that must be met before starting the procedure.',
    '<b>Procedure Steps:</b> Detailed, sequential instructions with screenshots where applicable.',
    '<b>Expected Outcome:</b> Clear description of the successful result.',
    '<b>Troubleshooting:</b> Common issues and their resolution steps.'
]
for item in sop_structure:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('1.2 SOP Maintenance', 'H2', s, 1))
story.append(body('SOPs are living documents that must be reviewed and updated regularly to remain accurate and relevant:', s))
maintenance_items = [
    '<b>Review Cycle:</b> All SOPs are reviewed at least quarterly or when significant system changes occur.',
    '<b>Version Control:</b> Each SOP version is tracked with revision number, date, and change description.',
    '<b>Approval Process:</b> SOP updates require approval from the module owner and HR leadership before publication.',
    '<b>Communication:</b> Updated SOPs are communicated to all affected users through the notification system.',
    '<b>Feedback Integration:</b> User feedback on SOP clarity and completeness is collected and incorporated in revisions.'
]
for item in maintenance_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('1.3 Role-Procedure Matrix', 'H2', s, 1))
role_matrix = make_table(
    ['Role', 'SOP Categories', 'Access Level'],
    [
        ['Super Admin', 'All SOPs', 'Full access, create/approve all'],
        ['Tenant Admin', 'All tenant SOPs', 'Full access within tenant, approve standard SOPs'],
        ['HR', 'Recruitment, Onboarding, Leave, Payroll, Performance, Separation, FNF', 'Execute, provide feedback'],
        ['Manager', 'Attendance, Leave, Performance, Projects', 'Execute team-level procedures'],
        ['IT Admin', 'Asset, Helpdesk, System Configuration', 'Execute IT procedures'],
        ['Employee', 'Self-service procedures', 'Execute self-service only'],
    ],
    s, [100, 220, 150]
)
story.append(role_matrix)
story.append(Spacer(1, 12))

# ── 2. Module-wise SOPs ──
story.append(heading('2. Module-wise Standard Operating Procedures', 'H1', s, 0))

# Define all SOPs
sops = [
    {
        'id': 'NEXUS-SA-001',
        'title': 'Tenant Creation and Configuration',
        'module': 'Super Admin',
        'purpose': 'This SOP defines the procedure for creating and configuring a new tenant organization on the NEXUS HRMS platform. It ensures that all necessary settings, modules, and initial configurations are properly set up for the new tenant to begin operations.',
        'scope': 'Applies to Super Admins responsible for onboarding new tenant organizations onto the platform.',
        'prerequisites': 'Platform admin access credentials, new tenant organization details (name, address, contact), subscription plan selection, initial admin user details for the tenant.',
        'steps': [
            'Log in to the NEXUS platform with Super Admin credentials.',
            'Navigate to Admin Panel → Tenant Management → Create New Tenant.',
            'Enter tenant organization details: legal name, display name, address, and contact information.',
            'Select the subscription plan and configure feature modules to be enabled.',
            'Set tenant configuration parameters: timezone, currency, date format, and fiscal year settings.',
            'Create the initial Tenant Admin account with email, name, and temporary password.',
            'Configure organization structure defaults: departments, designations, and reporting hierarchy.',
            'Enable and configure required modules (Recruitment, Payroll, Leave, etc.) as per the subscription.',
            'Set up default policies: leave policy, attendance policy, and probation period.',
            'Verify all configurations by reviewing the tenant setup checklist.',
            'Send the Tenant Admin activation email with login instructions and temporary credentials.',
            'Document the tenant creation in the platform audit log with configuration details.'
        ],
        'outcome': 'A fully configured tenant organization is created with an active Tenant Admin account, enabled modules, and default policies. The tenant is ready for the Tenant Admin to begin customizing and onboarding employees.',
        'troubleshooting': [
            'Tenant creation fails with "duplicate name" error: Verify the tenant name is unique across the platform. Check both active and deactivated tenants for name conflicts.',
            'Tenant Admin cannot log in: Verify the activation email was sent and the temporary password has not expired. Check that the admin account status is Active in the tenant user list.',
            'Modules not appearing after enabling: Clear the platform cache and refresh the tenant configuration. Verify the subscription plan includes the requested modules.'
        ]
    },
    {
        'id': 'NEXUS-TA-001',
        'title': 'Organization Policy Configuration',
        'module': 'Tenant Admin',
        'purpose': 'This SOP defines the procedure for configuring organization-specific policies in the NEXUS platform. It ensures that all HR policies, leave rules, and attendance configurations are properly set up to reflect the organization\'s operational requirements and legal compliance.',
        'scope': 'Applies to Tenant Admins and HR Managers responsible for setting up and maintaining organizational policies.',
        'prerequisites': 'Tenant Admin or HR Manager access, documented organization policies, legal requirements for the operating jurisdiction, approved leave structure and holiday list.',
        'steps': [
            'Log in to the NEXUS platform with Tenant Admin or HR Manager credentials.',
            'Navigate to Settings → Organization Policies.',
            'Configure Leave Policy: Define leave types, annual allocations, carry-forward rules, and encashment policies.',
            'Set up Attendance Policy: Define working hours, grace periods, half-day rules, and overtime calculation methods.',
            'Configure Holiday Calendar: Add all declared holidays for the current year, categorized as national, regional, and optional.',
            'Set up Probation Policy: Define default probation period, review checkpoints, and confirmation criteria.',
            'Configure Payroll Settings: Set pay period, salary structure templates, and statutory deduction rules.',
            'Define Notice Period Policy: Set notice period duration by role level and separation type.',
            'Review and validate all policy configurations against organizational policy documents.',
            'Submit policy configuration for approval (if multi-level approval is required).',
            'Publish approved policies and notify all employees through the notification system.',
            'Schedule the next policy review date in the compliance calendar.'
        ],
        'outcome': 'All organizational policies are configured, approved, and published in the NEXUS platform. Employees can view applicable policies through self-service, and the system enforces policy rules automatically.',
        'troubleshooting': [
            'Leave balance showing incorrect values: Verify the leave policy effective date matches the employee\'s joining date or policy change date. Check that carry-forward rules are correctly configured.',
            'Attendance policy not applying to new employees: Verify that the employee is assigned to the correct attendance policy group. Check the employee\'s shift assignment.',
            'Statutory deductions calculating incorrectly: Verify the payroll statutory configuration matches current government rates and thresholds. Check employee-specific exemption declarations.'
        ]
    },
    {
        'id': 'NEXUS-REC-001',
        'title': 'Job Requisition and Posting',
        'module': 'Recruitment',
        'purpose': 'This SOP defines the procedure for creating and managing job requisitions and postings in the NEXUS recruitment module. It ensures a standardized process for initiating hiring needs, obtaining approvals, and publishing job openings to attract qualified candidates.',
        'scope': 'Applies to hiring managers requesting new positions and HR teams managing the recruitment pipeline.',
        'prerequisites': 'Approved headcount plan or budget, detailed job description with role requirements, hiring manager and HR access to the recruitment module.',
        'steps': [
            'Hiring manager logs in and navigates to Recruitment → Job Requisitions → Create New.',
            'Fill in requisition details: position title, department, number of openings, employment type, and target start date.',
            'Enter the detailed job description including responsibilities, qualifications, and experience requirements.',
            'Specify compensation range and benefits applicable to the position.',
            'Select the interview process template (standard, AI-enhanced, or custom).',
            'Attach any supporting documents (headcount approval, budget allocation, etc.).',
            'Submit the requisition for approval through the configured approval chain.',
            'HR reviews the requisition for completeness and alignment with hiring policy.',
            'Upon approval, HR creates the job posting with application form configuration.',
            'Select sourcing channels (career portal, job boards, social media, employee referral program).',
            'Publish the job posting and monitor initial application flow.',
            'Set up AI screening parameters if AI-enhanced recruitment is enabled for this position.'
        ],
        'outcome': 'An approved job requisition with a published job posting attracting candidates through configured sourcing channels. AI screening parameters are set for automated candidate evaluation.',
        'troubleshooting': [
            'Requisition approval stuck: Check the approval chain configuration for missing approvers. Verify that designated approvers have active accounts and notification settings enabled.',
            'Job posting not appearing on career portal: Verify the posting status is Published. Check the posting date range and ensure the current date falls within the range.',
            'AI screening not triggering: Verify that AI screening is enabled for the position and that the screening parameters are configured with a valid job requirements description.'
        ]
    },
    {
        'id': 'NEXUS-OFF-001',
        'title': 'Offer Letter Creation and Dispatch',
        'module': 'Offers',
        'purpose': 'This SOP defines the procedure for creating, approving, and dispatching offer letters to selected candidates. It ensures that offers are consistent with organizational compensation policies and are processed through the proper approval chain.',
        'scope': 'Applies to HR personnel responsible for extending employment offers to selected candidates.',
        'prerequisites': 'Selected candidate from recruitment pipeline, approved compensation structure, offer letter template configured, approval chain defined.',
        'steps': [
            'Navigate to Recruitment → Offers → Create New Offer.',
            'Select the candidate from the shortlisted pool for the approved position.',
            'Enter compensation details: salary structure, variable pay, joining bonus, and benefits.',
            'Verify that compensation is within the approved budget and salary band for the role.',
            'Select the offer letter template appropriate for the employment type (permanent, contract, intern).',
            'Customize the offer letter with role-specific terms, reporting structure, and special conditions.',
            'Specify the offer validity period (typically 5-7 business days).',
            'Submit the offer for approval through the configured approval chain (HR → HR Head → Finance → Tenant Admin).',
            'Upon final approval, dispatch the offer letter via email with digital acceptance link.',
            'Set up automated follow-up reminders for offer response tracking.',
            'Monitor the offer status dashboard for candidate response.',
            'Upon acceptance, trigger the onboarding workflow automatically from the system.'
        ],
        'outcome': 'A properly approved and dispatched offer letter that the candidate can accept digitally. Upon acceptance, the onboarding workflow is automatically initiated.',
        'troubleshooting': [
            'Offer approval delayed: Check the approval chain for missing or inactive approvers. Use the escalation feature to remind pending approvers after SLA threshold.',
            'Candidate reports not receiving offer email: Verify the candidate\'s email address. Check the email delivery logs. Resend the offer through the system with an alternative delivery method.',
            'Compensation exceeding salary band: Request a salary band exception through the special approval process. Document the business justification for the exception.'
        ]
    },
    {
        'id': 'NEXUS-AI-001',
        'title': 'Conducting AI-Powered Interviews',
        'module': 'AI Interview',
        'purpose': 'This SOP defines the procedure for setting up and conducting AI-powered interviews using the NEXUS AI Interview module. It ensures proper configuration of AI interview parameters, candidate communication, and result interpretation.',
        'scope': 'Applies to recruiters and HR personnel using the AI Interview module for candidate assessment.',
        'prerequisites': 'Shortlisted candidate in the recruitment pipeline, AI Interview module enabled, interview configuration parameters defined (role, competencies, difficulty).',
        'steps': [
            'Navigate to AI Interview → Schedule Interview.',
            'Select the candidate and the job position from the recruitment pipeline.',
            'Configure interview parameters: competency areas, number of questions, difficulty level, and time limit.',
            'Review the AI-generated question preview and adjust parameters if needed.',
            'Schedule the interview date/time and configure candidate access window.',
            'Send the interview invitation to the candidate with access instructions and technical requirements.',
            'Monitor the interview dashboard for real-time status updates as the candidate takes the interview.',
            'Review the AI-generated results: composite score (aiScore), competency breakdown, and detailed feedback (aiFeedback).',
            'Check for bias detection flags and review any flagged assessments.',
            'Compare AI results with any parallel manual evaluation for holistic candidate assessment.',
            'Record the final interview decision (Proceed / Hold / Reject) with justification.',
            'Update the candidate status in the recruitment pipeline based on the interview outcome.'
        ],
        'outcome': 'A completed AI interview with comprehensive scoring, feedback, and bias assessment. The candidate\'s status is updated in the recruitment pipeline with documented evaluation results.',
        'troubleshooting': [
            'AI interview questions not generating: Verify that the job position has complete skill and competency data. Check the AI service health status. Ensure the interview parameters are within supported ranges.',
            'Candidate unable to access interview: Verify the interview access window is active. Check that the candidate\'s email link has not expired. Ensure the candidate is using a supported browser with JavaScript enabled.',
            'Bias detection flagging valid assessments: Review the bias detection sensitivity configuration. Adjust the standard deviation threshold if it is too aggressive. Add the assessment to a human review queue for verification.'
        ]
    },
    {
        'id': 'NEXUS-ONB-001',
        'title': 'New Employee Onboarding Process',
        'module': 'Onboarding',
        'purpose': 'This SOP defines the procedure for onboarding new employees from offer acceptance through their first 30 days. It ensures a consistent, organized onboarding experience that covers documentation, orientation, IT setup, and initial training.',
        'scope': 'Applies to HR teams, IT administrators, and hiring managers responsible for new employee onboarding.',
        'prerequisites': 'Candidate has accepted the offer letter, onboarding checklist template configured, IT provisioning process documented, orientation schedule prepared.',
        'steps': [
            'System auto-creates onboarding record upon offer acceptance notification.',
            'HR reviews the onboarding task checklist and customizes for the specific role and department.',
            'Send welcome email to the new hire with portal credentials, document upload links, and first-day instructions.',
            'New hire logs into the portal and completes personal information and emergency contact details.',
            'New hire uploads required documents (ID proof, address proof, education certificates, bank details).',
            'HR verifies uploaded documents and marks document verification tasks as complete.',
            'IT department provisions email account, system access, laptop/desktop, and software licenses.',
            'Admin/Facility assigns workspace, ID badge, and parking pass as applicable.',
            'Hiring manager receives notification of onboarding progress and prepares team introduction.',
            'Conduct orientation session covering company culture, policies, and organizational overview.',
            'Assign buddy/mentor from the team and schedule initial check-in meetings.',
            'Complete the 30-day onboarding milestone review and confirm all checklist items are resolved.'
        ],
        'outcome': 'A fully onboarded employee with completed documentation, IT access, orientation attendance, and initial task assignments. The onboarding checklist is fully marked complete and the employee transitions to probation period.',
        'troubleshooting': [
            'New hire cannot access the portal: Verify the welcome email was delivered and credentials are correct. Check that the employee record is in Active status. Reset the password if needed.',
            'Document upload failing: Check file size limits and supported formats (PDF, JPG, PNG). Verify the employee has the correct upload permissions in their onboarding checklist.',
            'IT provisioning delayed: Escalate to IT manager with the onboarding SLA reference. Use the onboarding dashboard to track provisioning status and send automated reminders.'
        ]
    },
    {
        'id': 'NEXUS-ATT-001',
        'title': 'Daily Attendance Recording and Regularization',
        'module': 'Attendance',
        'purpose': 'This SOP defines the procedure for daily attendance recording and the regularization process for missed or incorrect entries. It ensures accurate attendance tracking that feeds into payroll calculations and compliance reporting.',
        'scope': 'Applies to all employees for daily check-in/check-out and managers for regularization approval.',
        'prerequisites': 'Employee portal access, shift assignment configured, attendance policy defined with grace periods.',
        'steps': [
            'Employee logs into the NEXUS portal at the start of the workday.',
            'Click "Check In" on the Attendance dashboard to record the start time.',
            'System automatically applies the configured shift and grace period rules.',
            'For breaks, system tracks active time or employee manually logs break duration if required.',
            'Employee clicks "Check Out" at the end of the workday to record the end time.',
            'System calculates total working hours and flags any anomalies (late check-in, early check-out, missing check-out).',
            'If an anomaly is flagged, employee receives a notification to submit a regularization request.',
            'Employee navigates to Attendance → Regularization and submits the request with reason and corrected times.',
            'Manager reviews the regularization request and approves or rejects with comments.',
            'System updates the attendance record upon approval and recalculates working hours.',
            'At month-end, HR reviews attendance compliance reports for all employees.',
            'Validated attendance data is fed to the payroll module for salary computation.'
        ],
        'outcome': 'Accurate daily attendance records with all anomalies resolved through regularization. Clean attendance data is available for payroll processing and compliance reporting.',
        'troubleshooting': [
            'Check-in button not responding: Verify the employee has an active shift assignment. Check that the current time falls within the configured shift window. Clear browser cache and retry.',
            'Regularization request not reaching manager: Verify the reporting manager is assigned in the employee record. Check the notification configuration for regularization requests.',
            'Month-end attendance report showing discrepancies: Reconcile approved leave records with attendance data. Check for pending regularization requests that need resolution before payroll processing.'
        ]
    },
    {
        'id': 'NEXUS-LV-001',
        'title': 'Leave Application and Approval Process',
        'module': 'Leave',
        'purpose': 'This SOP defines the procedure for applying for, approving, and managing employee leaves. It ensures that leave requests comply with organizational policy, leave balances are accurately tracked, and approved leaves are properly reflected in attendance and payroll.',
        'scope': 'Applies to all employees submitting leave requests and managers responsible for approval.',
        'prerequisites': 'Employee leave balance configured, leave policy with rules and blackout periods defined, reporting manager assigned.',
        'steps': [
            'Employee navigates to Leave → Apply for Leave on the NEXUS portal.',
            'Select the leave type from available options (Casual, Sick, Earned, Comp-off, etc.).',
            'Specify the leave dates (from and to) including half-day selection if applicable.',
            'Enter the reason for the leave and attach supporting documents for Sick Leave or Comp-off.',
            'System validates the request: checks balance availability, blackout periods, and concurrent team leave conflicts.',
            'If validation passes, the request is submitted to the reporting manager for approval.',
            'Manager receives notification and reviews the request against team workload and policy compliance.',
            'Manager approves, rejects, or requests modification with comments.',
            'Upon approval, system deducts the leave from the balance and updates the attendance calendar.',
            'Employee receives notification of the approval or rejection decision.',
            'If the leave spans a payroll period, the system flags the leave for payroll deduction processing.',
            'Employee can cancel an approved leave before the leave start date, subject to policy conditions.'
        ],
        'outcome': 'A properly processed leave request with updated leave balance, attendance calendar, and payroll implications. The employee and manager have clear visibility of leave status.',
        'troubleshooting': [
            'Leave balance showing incorrect: Verify the leave policy effective date and carry-forward configuration. Check if any retroactive leave adjustments are pending approval.',
            'Leave request blocked by system validation: Review the specific validation error (insufficient balance, blackout period, concurrent conflict). Apply policy exception if authorized by HR.',
            'Approved leave not reflecting in attendance: Verify the integration between Leave and Attendance modules. Check the attendance calendar synchronization schedule.'
        ]
    },
    {
        'id': 'NEXUS-PAY-001',
        'title': 'Monthly Payroll Processing',
        'module': 'Payroll',
        'purpose': 'This SOP defines the end-to-end procedure for processing monthly payroll in NEXUS HRMS. It ensures accurate salary computation, statutory compliance, and timely disbursement for all employees in the organization.',
        'scope': 'Applies to HR and Finance teams responsible for payroll processing. Covers the complete payroll cycle from initiation to disbursement.',
        'prerequisites': 'All attendance and leave data finalized for the pay period, employee salary structures configured, statutory deduction rates updated, bank account details verified.',
        'steps': [
            'HR initiates the payroll cycle by navigating to Payroll → Run Payroll and selecting the pay period.',
            'System consolidates attendance data, leave records, overtime hours, and variable pay inputs for all employees.',
            'Review and resolve any data exceptions flagged during consolidation (missing attendance, unresolved leave, unverified bank details).',
            'Payroll engine computes gross salary, all allowances, deductions (PF, ESI, TDS, Professional Tax), and net pay for each employee.',
            'HR reviews the computation summary: total gross, total deductions, total net pay, and employee count.',
            'Investigate and resolve any computation exceptions (negative net pay, statutory threshold breaches, unusual variations).',
            'Finance team verifies statutory deduction calculations against current government rates and employee declarations.',
            'Submit the payroll register for final approval by the authorized approver (Finance Head / Tenant Admin).',
            'Upon approval, generate individual payslips in PDF format.',
            'Create the bank transfer file in the required format for the organization\'s banking partner.',
            'Process the bank transfer and upload the payment confirmation to the system.',
            'Lock the payroll register to prevent further modifications and archive with audit trail.'
        ],
        'outcome': 'All employees receive accurate salary disbursement with correct statutory deductions. Payslips are generated and accessible through the employee portal. The payroll register is locked and archived for compliance.',
        'troubleshooting': [
            'Payroll computation showing negative net pay: Check for excessive deductions or salary structure configuration errors. Verify that loan EMI deductions are not exceeding net pay thresholds.',
            'Statutory deductions not matching government rates: Verify the statutory configuration against the latest government circulars. Update rates if a new financial year or rate change has occurred.',
            'Bank transfer file generation failing: Verify the bank file format configuration matches the bank\'s requirements. Check that all employee bank account details are in the correct format.'
        ]
    },
    {
        'id': 'NEXUS-PERF-001',
        'title': 'Performance Review Cycle Execution',
        'module': 'Performance',
        'purpose': 'This SOP defines the procedure for executing a performance review cycle in NEXUS HRMS. It covers the complete cycle from initiation through final rating publication, ensuring a fair and consistent evaluation process across the organization.',
        'scope': 'Applies to HR teams initiating review cycles, employees completing self-assessment, and managers conducting evaluations.',
        'prerequisites': 'Review cycle template configured, goal setting period completed, competency framework defined, rating scale and calibration parameters set.',
        'steps': [
            'HR navigates to Performance → Review Cycles → Create New Cycle.',
            'Define the review period, cycle type (annual, semi-annual, quarterly), and deadlines for each phase.',
            'Select the rating scale and competency framework applicable to this cycle.',
            'Configure the approval workflow: self-assessment → manager review → skip-level review → calibration.',
            'Publish the review cycle and send notifications to all participants.',
            'Employees complete self-assessment by rating their goal achievement and competency demonstrations.',
            'System sends reminders to employees who have not completed self-assessment as deadlines approach.',
            'Managers receive completed self-assessments and conduct their evaluation with ratings and written feedback.',
            'Skip-level managers review a sample of evaluations for consistency and fairness.',
            'HR conducts calibration sessions with leadership to normalize ratings across teams and departments.',
            'Final ratings are published with individualized development recommendations.',
            'System triggers follow-up workflows: PIP for below expectations, promotion consideration for high performers, training recommendations for skill gaps.'
        ],
        'outcome': 'A completed performance review cycle with calibrated final ratings for all participants. Development recommendations are generated, and follow-up workflows are triggered for performance outliers.',
        'troubleshooting': [
            'Self-assessment not opening for employees: Verify the review cycle is in the self-assessment phase. Check that the employee has an active goal plan linked to the cycle.',
            'Manager evaluation not saving: Check for incomplete required fields in the evaluation form. Verify the evaluation deadline has not passed.',
            'Calibration session producing inconsistent results: Review the calibration guidelines with leadership. Ensure managers are using the same rating criteria. Use the system\'s rating distribution analysis to identify outliers.'
        ]
    },
    {
        'id': 'NEXUS-TRN-001',
        'title': 'Training Program Creation and Enrollment',
        'module': 'Training',
        'purpose': 'This SOP defines the procedure for creating training programs and managing employee enrollment in the NEXUS Training module. It ensures that training content is properly structured, enrollment is managed efficiently, and completion is tracked for compliance.',
        'scope': 'Applies to training coordinators creating programs and employees/managers managing enrollment.',
        'prerequisites': 'Training module enabled, training content prepared (materials, assessments), trainer or e-learning platform configured.',
        'steps': [
            'Training coordinator navigates to Training → Programs → Create New.',
            'Enter program details: title, description, category, objectives, and duration.',
            'Upload or link training content: presentation materials, videos, documents, and external e-learning URLs.',
            'Create the assessment quiz with questions, answer options, and passing score threshold.',
            'Configure enrollment settings: open enrollment, nomination-only, or automatic assignment by role/department.',
            'Set the schedule: start date, end date, session times for instructor-led programs.',
            'Assign a trainer or facilitator for instructor-led programs.',
            'Publish the program and notify eligible employees through the training catalog.',
            'Review enrollment list and approve/reject nominations as needed.',
            'Monitor training progress through the dashboard: enrollment count, completion rate, and assessment scores.',
            'Generate completion certificates for employees who pass the assessment.',
            'Collect post-training feedback and compile effectiveness report for the training program.'
        ],
        'outcome': 'A well-structured training program with enrolled participants, tracked completion, assessment results, and feedback. Completion records are linked to employee profiles for compliance reporting.',
        'troubleshooting': [
            'Training content not uploading: Verify file size limits and supported formats. Check storage quota allocation for the tenant. Use alternative upload methods or external content links.',
            'Low enrollment numbers: Verify that the program is visible to the target audience. Check that notification emails were delivered. Consider extending the enrollment deadline or expanding eligibility criteria.',
            'Assessment scoring errors: Review the question-answer mapping in the assessment configuration. Verify that the scoring rules (partial credit, negative marking) are set correctly.'
        ]
    },
    {
        'id': 'NEXUS-SEP-001',
        'title': 'Employee Separation Processing',
        'module': 'Separation',
        'purpose': 'This SOP defines the procedure for processing employee separations (resignation, termination, retirement) in the NEXUS platform. It ensures that all exit procedures are completed systematically, including notice period management, knowledge transfer, asset recovery, and final settlement initiation.',
        'scope': 'Applies to HR teams, managers, IT, and Finance personnel involved in the separation process.',
        'prerequisites': 'Separation request submitted and acknowledged, notice period policy applicable, exit checklist template configured.',
        'steps': [
            'HR receives and acknowledges the separation request (resignation letter or termination notice).',
            'Calculate the notice period end date based on the employee\'s role level and separation type.',
            'Create the exit task checklist assigning tasks to IT, Finance, Admin, and the departing employee.',
            'Manager plans and initiates knowledge transfer and work handover with documented transition plan.',
            'IT department schedules system access revocation and asset recovery for the last working day.',
            'HR schedules and conducts the exit interview, documenting feedback and reasons for departure.',
            'Admin/Facility collects physical assets (laptop, ID badge, keys, access cards) with signed handover receipt.',
            'Finance reviews all outstanding dues, advances, and loan balances for FNF settlement.',
            'HR confirms completion of all exit checklist items and marks the separation as processed.',
            'Update the employee record status to Separated and archive the employment record.',
            'Trigger the FNF (Full & Final Settlement) workflow for financial closure.',
            'Revoke all system access on the last working day and send the farewell communication.'
        ],
        'outcome': 'A completed separation process with all exit tasks resolved, assets recovered, knowledge transferred, and the FNF workflow initiated. The employee record is properly archived.',
        'troubleshooting': [
            'Notice period calculation incorrect: Verify the notice period policy for the employee\'s role level. Check if any notice period waiver has been approved by management.',
            'Exit tasks not being assigned: Check the exit checklist template configuration. Verify that responsible departments have active team members assigned.',
            'Employee record not updating to Separated: Ensure all mandatory exit checklist items are marked complete. Check for pending approvals in the separation workflow.'
        ]
    },
    {
        'id': 'NEXUS-FNF-001',
        'title': 'Full & Final Settlement Processing',
        'module': 'FNF',
        'purpose': 'This SOP defines the procedure for computing and processing the Full & Final (FNF) settlement for separated employees. It ensures that all financial obligations are accurately calculated, approved, and disbursed within the statutory timeline.',
        'scope': 'Applies to Finance and HR teams responsible for FNF settlement calculations and processing.',
        'prerequisites': 'Employee separation processed, exit checklist completed, all asset recoveries confirmed, attendance and leave data finalized for the settlement period.',
        'steps': [
            'System auto-creates the FNF case upon separation completion.',
            'Finance reviews unpaid salary: calculate salary for the last working period up to the separation date.',
            'Calculate leave encashment: determine unused earned leave balance at the applicable encashment rate.',
            'Review bonus and incentive provisions: determine pro-rata bonus eligibility and any pending variable pay.',
            'Calculate recoveries: notice period shortfall deduction, outstanding loan balance, advance adjustments, and asset damage charges if any.',
            'Verify gratuity eligibility and calculate the gratuity amount as per the Payment of Gratuity Act.',
            'Compute all statutory deductions: TDS on FNF, PF on dues, and any other applicable deductions.',
            'Prepare the FNF statement with all line items: earnings, deductions, and net payable amount.',
            'Submit the FNF statement for dual approval (HR Head and Finance Head).',
            'Upon approval, process the FNF payment through bank transfer.',
            'Generate the FNF acknowledgment document and share with the separated employee.',
            'Lock the FNF record and archive for statutory audit compliance.'
        ],
        'outcome': 'A fully processed FNF settlement with accurate calculations, proper approvals, and payment disbursed. The FNF record is locked and available for statutory audit.',
        'troubleshooting': [
            'FNF computation showing unexpected amounts: Verify the last working date is correct. Re-check leave encashment calculation against the leave policy. Ensure all recoveries have been accounted for.',
            'Gratuity calculation discrepancy: Verify the employee meets the 5-year continuous service requirement. Check that the last drawn salary used for calculation is correct (basic + DA).',
            'TDS calculation on FNF not matching: Verify the employee\'s tax regime selection. Check that the FNF components are correctly categorized for tax purposes (salary, gratuity, leave encashment have different tax treatments).'
        ]
    },
    {
        'id': 'NEXUS-HD-001',
        'title': 'Helpdesk Ticket Management',
        'module': 'Helpdesk',
        'purpose': 'This SOP defines the procedure for creating, managing, and resolving helpdesk tickets in the NEXUS platform. It ensures that employee support requests are handled efficiently with proper tracking, SLA compliance, and quality resolution.',
        'scope': 'Applies to employees submitting support requests and helpdesk agents managing ticket resolution.',
        'prerequisites': 'Helpdesk module enabled, ticket categories and SLA policies configured, agent teams assigned to categories.',
        'steps': [
            'Employee navigates to Helpdesk → Create Ticket and fills in the form with category, priority, and description.',
            'System performs AI-powered categorization verification and routes the ticket to the appropriate agent queue.',
            'Assigned agent receives notification and acknowledges the ticket, setting the expected resolution time.',
            'Agent investigates the issue by reviewing details, reproducing the problem, or consulting knowledge base articles.',
            'If additional information is needed, agent requests details from the employee through the ticket communication thread.',
            'Agent provides the resolution or workaround and updates the ticket status to Resolved.',
            'If the issue requires escalation (complexity or SLA breach risk), agent escalates to the next support tier with full context.',
            'Employee receives the resolution notification and verifies the solution.',
            'Employee confirms resolution and optionally provides a satisfaction rating (1-5 stars).',
            'If the employee confirms, ticket status is updated to Closed.',
            'System adds the resolution to the knowledge base for future reference.',
            'Helpdesk manager reviews ticket metrics (resolution time, SLA compliance, satisfaction scores) in the analytics dashboard.'
        ],
        'outcome': 'A resolved and closed helpdesk ticket with documented resolution, employee satisfaction rating, and knowledge base update. Ticket metrics contribute to service quality analytics.',
        'troubleshooting': [
            'Ticket not routing to any agent: Verify the category-to-agent mapping configuration. Check that agents in the target queue have active accounts and are not on leave.',
            'SLA breach occurring: Review the SLA policy configuration for the ticket category and priority. Identify bottlenecks in the resolution process. Consider increasing agent capacity or adjusting SLA targets.',
            'Employee not receiving ticket updates: Verify the employee\'s notification preferences. Check that email notifications are enabled for helpdesk ticket updates. Verify the email delivery service is operational.'
        ]
    },
    {
        'id': 'NEXUS-PRJ-001',
        'title': 'Project Creation and Team Assignment',
        'module': 'Projects',
        'purpose': 'This SOP defines the procedure for creating new projects and assigning team members in the NEXUS Project Management module. It ensures that projects are properly structured with clear scope, timelines, and resource allocation.',
        'scope': 'Applies to project managers and management personnel responsible for project initiation.',
        'prerequisites': 'Project budget approved, project scope documented, resource availability confirmed.',
        'steps': [
            'Project Manager navigates to Projects → Create New Project.',
            'Enter project details: name, description, client (if applicable), start date, and target end date.',
            'Define the project scope and objectives with measurable deliverables.',
            'Create the project budget allocation including resource costs and material expenses.',
            'Submit the project charter for management approval.',
            'Upon approval, create the work breakdown structure with milestones and task groups.',
            'Assign team members to the project based on skill requirements and availability.',
            'Define task assignments with estimated hours, deadlines, and dependencies.',
            'Configure project-level settings: time tracking, billing rates, and reporting frequency.',
            'Set up project communication channels and document sharing.',
            'Conduct the project kickoff meeting with all assigned team members.',
            'Begin tracking project progress through the project dashboard.'
        ],
        'outcome': 'A created and approved project with assigned team members, defined milestones, and active tracking. Team members can log time and update task status.',
        'troubleshooting': [
            'Project charter approval delayed: Verify the approval workflow is correctly configured. Send reminders through the system to pending approvers.',
            'Team members not seeing project assignments: Check that team members are assigned to the project and individual tasks. Verify that the project status is Active.',
            'Milestone dates overlapping: Review the project timeline for scheduling conflicts. Adjust task dependencies and deadlines to create a realistic project schedule.'
        ]
    },
    {
        'id': 'NEXUS-EXP-001',
        'title': 'Expense Claim Submission and Approval',
        'module': 'Expenses',
        'purpose': 'This SOP defines the procedure for submitting, reviewing, and approving employee expense claims. It ensures that expense claims comply with organizational policy, are properly documented, and are reimbursed in a timely manner.',
        'scope': 'Applies to all employees submitting expense claims and managers/finance reviewing and approving them.',
        'prerequisites': 'Expense policy configured with category limits and approval thresholds, employee has incurred legitimate business expenses.',
        'steps': [
            'Employee navigates to Expenses → Submit Claim.',
            'Select the expense category (travel, meals, accommodation, office supplies, other).',
            'Enter expense details: date, amount, vendor, and business purpose.',
            'Upload receipt/proof of expenditure (photo or PDF, within size limits).',
            'System validates the claim against expense policy: category limit, monthly limit, and documentation requirements.',
            'If validation passes, claim is submitted to the reporting manager for first-level approval.',
            'Manager reviews the claim for business justification and policy compliance.',
            'Manager approves, rejects, or requests additional information.',
            'If the claim amount exceeds the configured threshold, it is automatically routed to Finance for second-level approval.',
            'Finance verifies the expense against accounting rules and assigns the appropriate cost center.',
            'Upon final approval, the expense is queued for reimbursement in the next payroll cycle.',
            'Employee receives the reimbursement through payroll or direct transfer as configured.'
        ],
        'outcome': 'An approved and reimbursed expense claim with proper documentation and audit trail. The expense is recorded against the correct cost center for financial reporting.',
        'troubleshooting': [
            'Expense claim rejected by system validation: Review the specific validation error (category limit exceeded, missing receipt, policy violation). Correct the claim and resubmit or request a policy exception.',
            'Approval chain not progressing: Verify that all designated approvers have active accounts. Check for notification delivery issues. Use the escalation feature for delayed approvals.',
            'Reimbursement not received: Verify the claim is fully approved and queued for the next payroll cycle. Check that the employee\'s bank details are correctly configured.'
        ]
    },
    {
        'id': 'NEXUS-AST-001',
        'title': 'Asset Allocation and Recovery',
        'module': 'Assets',
        'purpose': 'This SOP defines the procedure for allocating organizational assets to employees and recovering them upon return or separation. It ensures proper tracking, documentation, and lifecycle management of all organizational assets.',
        'scope': 'Applies to IT and Admin teams managing asset inventory and employees receiving or returning assets.',
        'prerequisites': 'Asset registered in the inventory system, employee asset request approved, asset condition documented.',
        'steps': [
            'Employee submits an asset request through the self-service portal specifying the asset type and justification.',
            'Manager approves the asset request based on role requirements and business need.',
            'IT/Admin verifies asset availability in inventory and selects the specific asset for allocation.',
            'Prepare the asset for handover: install required software, configure security settings, and document the current condition.',
            'Conduct a physical handover with the employee, documenting the asset serial number, condition, and acknowledgment signature.',
            'Update the asset record in the system: change status to "Allocated," assign to the employee, and record the handover date.',
            'Set up maintenance schedule reminders for the asset based on warranty and service requirements.',
            'Employee reports any asset issues through the Helpdesk module, linking the ticket to the asset record.',
            'Upon separation or asset return, conduct a condition assessment and document any damage.',
            'Update the asset record: change status to "Returned," record the return date and condition.',
            'Process damaged assets through the disposal workflow if applicable.',
            'Return functional assets to available inventory for future allocation.'
        ],
        'outcome': 'Properly documented asset allocation and recovery with full audit trail. Asset inventory is accurately maintained with current status, location, and assigned employee information.',
        'troubleshooting': [
            'Asset not found in inventory: Verify the asset was registered in the system. Check if the asset was previously marked as disposed or written off. Search by serial number or asset tag.',
            'Asset condition dispute at return: Refer to the documented condition at allocation time. Review any maintenance or damage reports filed during the allocation period.',
            'Maintenance reminder not triggering: Verify the maintenance schedule is configured for the asset. Check the notification system for delivery issues.'
        ]
    },
]

# Generate SOP sections
for i, sop in enumerate(sops):
    story.append(heading(f'2.{i+1} {sop["module"]}: {sop["title"]}', 'H2', s, 1))
    
    # SOP ID and Title
    story.append(make_table(
        ['SOP ID', 'Title', 'Module'],
        [[sop['id'], sop['title'], sop['module']]],
        s, [120, 220, 100]
    ))
    story.append(Spacer(1, 6))
    
    # Purpose and Scope
    story.append(heading('Purpose', 'H3', s, 1))
    story.append(body(sop['purpose'], s))
    story.append(heading('Scope', 'H3', s, 1))
    story.append(body(sop['scope'], s))
    story.append(Spacer(1, 4))
    
    # Prerequisites
    story.append(heading('Prerequisites', 'H3', s, 1))
    story.append(body(sop['prerequisites'], s))
    story.append(Spacer(1, 4))
    
    # Step-by-step Procedure
    story.append(heading('Procedure', 'H3', s, 1))
    for j, step in enumerate(sop['steps'], 1):
        story.append(bullet(f'<b>Step {j}:</b> {step}', s))
    story.append(Spacer(1, 4))
    
    # Expected Outcome
    story.append(heading('Expected Outcome', 'H3', s, 1))
    story.append(body(sop['outcome'], s))
    story.append(Spacer(1, 4))
    
    # Troubleshooting
    story.append(heading('Troubleshooting', 'H3', s, 1))
    for issue in sop['troubleshooting']:
        story.append(bullet(issue, s))
    story.append(Spacer(1, 10))

# ── 3. Emergency Procedures ──
story.append(PageBreak())
story.append(heading('3. Emergency Procedures', 'H1', s, 0))
story.append(body('Emergency procedures define the actions to be taken during critical system events that affect platform availability, data integrity, or security. These procedures must be followed precisely and documented thoroughly.', s))
story.append(Spacer(1, 8))

story.append(heading('3.1 System Outage Procedure', 'H2', s, 1))
story.append(body('This procedure is activated when the NEXUS platform becomes unavailable or experiences significant performance degradation affecting user operations.', s))
outage_steps = [
    '<b>Step 1 — Detection:</b> Monitor alerts from Vercel deployment monitoring or user reports of inaccessible platform. Verify the outage is platform-wide vs. user-specific.',
    '<b>Step 2 — Assessment:</b> Determine the scope and severity: Is the frontend inaccessible? Are API endpoints failing? Is the database unreachable? Check Vercel status page and Neon status page.',
    '<b>Step 3 — Communication:</b> Notify all stakeholders through the emergency communication channel. Update the status page if applicable. Provide initial ETA if possible.',
    '<b>Step 4 — Escalation:</b> If the outage is infrastructure-level, contact Vercel support and/or Neon support. If application-level, engage the development team for diagnosis.',
    '<b>Step 5 — Diagnosis:</b> Review deployment logs, application logs, and database connectivity. Identify the root cause (deployment failure, database issue, third-party service outage).',
    '<b>Step 6 — Recovery:</b> Implement the appropriate recovery action: rollback deployment, restart database connection, or apply hotfix. Prioritize restoring read access first.',
    '<b>Step 7 — Verification:</b> Confirm all critical functionality is restored through systematic testing of key user workflows.',
    '<b>Step 8 — Post-Incident:</b> Document the incident timeline, root cause, resolution, and preventive measures. Schedule a post-incident review within 48 hours.'
]
for step in outage_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

story.append(heading('3.2 Data Recovery Procedure', 'H2', s, 1))
story.append(body('This procedure is activated when data loss or corruption is detected in the NEXUS platform.', s))
recovery_steps = [
    '<b>Step 1 — Containment:</b> Immediately prevent further data modifications by activating maintenance mode. This stops all write operations to the database.',
    '<b>Step 2 — Assessment:</b> Determine the scope of data loss: which tables, which tenants, what time period. Identify whether the loss is from accidental deletion, corruption, or malicious action.',
    '<b>Step 3 — Backup Verification:</b> Verify the most recent Neon backup is available and accessible. Confirm the backup timestamp and ensure it predates the data loss event.',
    '<b>Step 4 — Recovery Planning:</b> Determine the recovery strategy: point-in-time recovery using Neon PITR, selective data restoration from backup, or manual data re-entry.',
    '<b>Step 5 — Test Recovery:</b> Perform the recovery in a Neon branch (isolated copy) first to verify data integrity and application compatibility before applying to production.',
    '<b>Step 6 — Production Recovery:</b> Apply the verified recovery to production during a maintenance window. Monitor closely for any application errors or data inconsistencies.',
    '<b>Step 7 — Validation:</b> Verify data integrity through automated checks and manual spot-checks of critical records. Confirm with affected users that their data is restored.',
    '<b>Step 8 — Prevention:</b> Implement preventive measures identified during the incident review. Update backup frequency, add data protection rules, or implement additional monitoring.'
]
for step in recovery_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 10))

story.append(heading('3.3 Security Incident Procedure', 'H2', s, 1))
story.append(body('This procedure is activated when a security incident is detected, including unauthorized access, data breach, or suspicious activity.', s))
security_steps = [
    '<b>Step 1 — Containment:</b> Immediately revoke compromised credentials. If an account is compromised, disable the account and invalidate all active sessions. If a data breach is detected, restrict access to the affected data.',
    '<b>Step 2 — Assessment:</b> Determine the nature and scope of the incident: What was accessed? What data was exposed? How did the breach occur? Document all findings with timestamps.',
    '<b>Step 3 — Escalation:</b> Notify the security incident response team including Super Admin, IT Security, and Legal. For data breaches involving personal data, involve the Data Protection Officer.',
    '<b>Step 4 — Evidence Preservation:</b> Capture and preserve all relevant logs, screenshots, and forensic data. Do not modify or delete any evidence. Export audit logs for the affected period.',
    '<b>Step 5 — Communication:</b> Notify affected users if their personal data may have been compromised. Prepare a formal breach notification if required by GDPR or other regulations (typically within 72 hours).',
    '<b>Step 6 — Remediation:</b> Patch the vulnerability that enabled the breach. Reset all potentially compromised passwords. Review and update access controls. Deploy security updates.',
    '<b>Step 7 — Monitoring:</b> Implement enhanced monitoring for the affected systems and accounts. Watch for signs of persistent compromise or follow-up attacks.',
    '<b>Step 8 — Post-Incident Review:</b> Conduct a thorough post-incident review within one week. Document lessons learned, update security policies, and implement all recommended improvements.'
]
for step in security_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 12))

# ── 4. SOP Revision History ──
story.append(heading('4. SOP Revision History', 'H1', s, 0))
story.append(body('The SOP Revision History template tracks all changes to standard operating procedures. Each SOP must maintain a complete revision log for audit and compliance purposes.', s))
story.append(Spacer(1, 6))

story.append(heading('4.1 Revision Log Template', 'H2', s, 1))
rev_tbl = make_table(
    ['Version', 'Date', 'Author', 'Description of Changes', 'Approved By'],
    [
        ['1.0', '2026-06-01', 'Platform Team', 'Initial SOP document creation', 'CTO'],
        ['', '', '', '', ''],
        ['', '', '', '', ''],
        ['', '', '', '', ''],
    ],
    s, [50, 70, 80, 180, 80]
)
story.append(rev_tbl)
story.append(Spacer(1, 8))

story.append(heading('4.2 Revision Guidelines', 'H2', s, 1))
rev_guidelines = [
    '<b>Version Numbering:</b> Use major.minor versioning (e.g., 1.0, 1.1, 2.0). Minor versions for clarification and correction; major versions for procedure changes.',
    '<b>Mandatory Fields:</b> Every revision must include: version number, date, author name, description of changes, and approver name.',
    '<b>Change Description:</b> Clearly describe what was changed and why. Reference any incident or audit finding that prompted the change.',
    '<b>Approval Requirement:</b> All SOP revisions must be approved by the module owner and HR leadership before publication.',
    '<b>Distribution:</b> Updated SOPs must be distributed to all affected users through the notification system within 48 hours of approval.',
    '<b>Archival:</b> Previous versions must be archived and accessible for a minimum of 5 years for audit compliance.',
    '<b>Review Trigger:</b> SOPs must be reviewed and potentially revised after any system update, process change, or incident that reveals a procedure gap.',
    '<b>Annual Audit:</b> All SOPs undergo a comprehensive annual audit to verify accuracy, completeness, and compliance with current regulations.'
]
for guideline in rev_guidelines:
    story.append(bullet(guideline, s))

# ── Build ──
doc.multiBuild(story)

cover_pdf = generate_cover('Standard Operating<br/>Procedures', 'Module-wise SOP Documents for NEXUS HRMS', 'sop_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS SOP Documents')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
