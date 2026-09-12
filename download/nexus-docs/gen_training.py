#!/usr/bin/env python3
"""Generate NEXUS HRMS Training Video Scripts PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'training_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-Training-Video-Scripts.pdf')

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

# ── 1. Training Video Production Guide ──
story.append(heading('1. Training Video Production Guide', 'H1', s, 0))
story.append(body('This document provides comprehensive training video scripts for the NEXUS HRMS platform. Each script includes detailed screen flows, voiceover narration, and on-screen callouts designed for consistent, high-quality video production across all modules.', s))
story.append(Spacer(1, 6))

story.append(heading('1.1 Video Production Standards', 'H2', s, 1))
standards = [
    '<b>Resolution:</b> Record at 1920x1080 (Full HD) minimum. Use 2560x1440 (2K) for detailed UI demonstrations.',
    '<b>Frame Rate:</b> 30fps standard; 60fps for smooth animation demonstrations.',
    '<b>Audio:</b> Record voiceover in a quiet environment with a quality microphone. Target -16 LUFS loudness with -1 dB peak.',
    '<b>Branding:</b> Include NEXUS HRMS intro card (3 seconds) and outro card with support contact (5 seconds) on every video.',
    '<b>Duration:</b> Target 5-10 minutes per module video. Split longer content into Part 1, Part 2 segments.',
    '<b>Accessibility:</b> Include closed captions (SRT format) and ensure minimum 4.5:1 contrast ratio for all on-screen text.',
    '<b>Format:</b> Export as MP4 (H.264/AAC) for platform hosting. Maintain source files for future edits.'
]
for std in standards:
    story.append(bullet(std, s))
story.append(Spacer(1, 8))

story.append(heading('1.2 Script Conventions', 'H2', s, 1))
conventions = [
    '<b>[SCREEN]</b> describes what the viewer sees on screen.',
    '<b>[VO]</b> is the voiceover narration script.',
    '<b>[CALLOUT]</b> is on-screen text overlay or annotation.',
    '<b>[TRANSITION]</b> indicates a visual transition between scenes.',
    '<b>[CLICK]</b> indicates a mouse click action to demonstrate.',
    '<b>[TYPE]</b> indicates typing input to demonstrate.',
    '<b>[PAUSE]</b> indicates a brief pause for viewer comprehension (2-3 seconds).'
]
for conv in conventions:
    story.append(bullet(conv, s))
story.append(Spacer(1, 12))

# ── 2. Module-wise Training Scripts ──
story.append(heading('2. Module-wise Training Scripts', 'H1', s, 0))

# Define all training scripts
scripts = [
    {
        'num': '2.1',
        'title': 'Getting Started — Home & Navigation',
        'duration': '6 minutes',
        'objectives': [
            'Understand the NEXUS HRMS dashboard layout and navigation structure',
            'Learn how to access different modules through the sidebar menu',
            'Customize the dashboard view and access quick actions',
            'Understand the notification center and global search functionality'
        ],
        'scenes': [
            {'screen': 'Login page → Dashboard', 'vo': 'Welcome to NEXUS HRMS! After logging in with your credentials, you\'ll land on your personalized dashboard. The dashboard provides a quick overview of pending tasks, announcements, and key metrics relevant to your role.', 'callout': 'Dashboard — Your Command Center'},
            {'screen': 'Sidebar navigation menu', 'vo': 'The sidebar on the left contains all your available modules. Your menu items are filtered based on your role — employees see self-service options, while managers see additional approval and team management features.', 'callout': 'Sidebar — Role-Based Navigation'},
            {'screen': 'Dashboard widgets and quick actions', 'vo': 'Dashboard widgets show your leave balance, attendance summary, upcoming events, and pending approvals at a glance. Click any widget to navigate directly to the detailed view. Use quick action buttons to perform common tasks like applying for leave or submitting expenses.', 'callout': 'Quick Actions — One-Click Tasks'},
            {'screen': 'Notification center', 'vo': 'The notification bell in the top right corner alerts you to pending items, approvals, and system messages. Click to view all notifications, and click individual items to navigate directly to the relevant action.', 'callout': 'Notifications — Stay Updated'},
            {'screen': 'Global search', 'vo': 'Use the search bar at the top to quickly find employees, policies, or help articles. The search supports natural language queries and provides instant results across all modules you have access to.', 'callout': 'Search — Find Anything Fast'},
            {'screen': 'Profile menu and settings', 'vo': 'Click your profile picture in the top right to access your profile settings, change your password, and switch themes between light and dark mode. This is also where you\'ll find the logout option.', 'callout': 'Profile — Your Account'},
        ]
    },
    {
        'num': '2.2',
        'title': 'Employees Module',
        'duration': '8 minutes',
        'objectives': [
            'Navigate the employee directory and view employee profiles',
            'Understand the employee information sections and data organization',
            'Learn how employees update their own profile information',
            'Understand the employee document management workflow'
        ],
        'scenes': [
            {'screen': 'Employee list view with filters', 'vo': 'The Employees module is your central hub for workforce management. The list view shows all employees with key information. Use filters on the left to narrow by department, designation, or status. The search bar allows quick lookup by name or employee ID.', 'callout': 'Employee Directory — Filter & Search'},
            {'screen': 'Individual employee profile page', 'vo': 'Click any employee to view their complete profile. The profile page organizes information into tabs: Personal Details, Employment Info, Documents, Leave History, and more. HR and managers have access to all tabs, while employees see their own information based on configured visibility rules.', 'callout': 'Employee Profile — Complete View'},
            {'screen': 'Profile self-service update', 'vo': 'Employees can update certain personal details directly. Navigate to My Profile, click Edit on the section you want to update, make your changes, and submit. Some changes require manager or HR approval, while others like emergency contacts update immediately.', 'callout': 'Self-Service — Update Your Info'},
            {'screen': 'Document upload and verification', 'vo': 'The Documents tab shows all required and submitted documents. Click Upload to add a new document, select the document type, choose the file, and submit. HR will review and verify your documents, with status visible in your profile.', 'callout': 'Documents — Upload & Verify'},
            {'screen': 'Employee organization chart view', 'vo': 'The Organization Chart shows the reporting hierarchy visually. Navigate up and down the tree to explore team structures. This view helps you understand reporting lines and find the right contact for cross-functional collaboration.', 'callout': 'Org Chart — Visual Hierarchy'},
        ]
    },
    {
        'num': '2.3',
        'title': 'Recruitment Module',
        'duration': '9 minutes',
        'objectives': [
            'Create and manage job requisitions and postings',
            'Review and screen candidates using AI-powered tools',
            'Manage the interview scheduling and feedback process',
            'Understand the candidate pipeline and status tracking'
        ],
        'scenes': [
            {'screen': 'Recruitment dashboard overview', 'vo': 'The Recruitment dashboard gives you a complete view of your hiring pipeline. At the top, you\'ll see key metrics: open positions, active candidates, interviews scheduled this week, and offers pending. Below, the pipeline view shows candidates at each stage of the hiring process.', 'callout': 'Recruitment Dashboard — Pipeline View'},
            {'screen': 'Creating a job requisition', 'vo': 'To start a new hiring process, click Create Requisition. Fill in the position details, job description, compensation range, and required qualifications. Select the interview process template — standard, AI-enhanced, or custom. Submit for approval through the configured workflow.', 'callout': 'Job Requisition — Start Hiring'},
            {'screen': 'Candidate screening with AI', 'vo': 'When candidates apply, the AI screening engine automatically analyzes their resumes against job requirements. Each candidate receives a screening score based on skills match, experience relevance, and qualification alignment. Scores are displayed in the candidate list, making it easy to prioritize your review.', 'callout': 'AI Screening — Smart Ranking'},
            {'screen': 'Interview scheduling interface', 'vo': 'Shortlist candidates by clicking the Shortlist button, then schedule interviews. Choose between AI-powered interviews that run automatically, or manual panel interviews. For AI interviews, configure the competency areas and difficulty level. For manual interviews, select the panel and send calendar invitations.', 'callout': 'Interview Scheduling — AI or Manual'},
            {'screen': 'Candidate pipeline management', 'vo': 'The pipeline kanban board visualizes all candidates across stages: Applied, Screening, Shortlisted, Interviewing, Offer, and Hired. Drag candidates between stages or use action buttons. The system maintains a complete audit trail of all status changes and communications.', 'callout': 'Pipeline — Track Every Candidate'},
        ]
    },
    {
        'num': '2.4',
        'title': 'AI Interview Module',
        'duration': '7 minutes',
        'objectives': [
            'Configure and launch AI-powered interviews for candidates',
            'Understand the AI scoring system and feedback generation',
            'Review and interpret AI interview results and bias indicators',
            'Combine AI and manual evaluation for comprehensive assessment'
        ],
        'scenes': [
            {'screen': 'AI Interview configuration screen', 'vo': 'The AI Interview module automates candidate assessment with intelligent question generation and scoring. Start by selecting the candidate and position. Configure the interview by setting competency areas, difficulty level, number of questions, and time limit. The system generates a preview of question types before you schedule.', 'callout': 'AI Interview — Configure & Launch'},
            {'screen': 'Candidate interview experience', 'vo': 'When the candidate opens the interview link, they see a clean interface with one question at a time. The AI generates questions dynamically based on the configured parameters and the candidate\'s previous responses. A timer tracks the remaining time, and the interface supports both text and multiple-choice responses.', 'callout': 'Candidate View — Interview Interface'},
            {'screen': 'AI scoring and feedback results', 'vo': 'After the interview completes, the AI evaluates all responses and generates a comprehensive assessment. The results page shows the composite AI score on a 0-10 scale, a breakdown by competency area, detailed feedback for each response, and an overall hiring recommendation. The aiScore and aiFeedback are stored permanently in the interview record.', 'callout': 'AI Results — Score & Feedback'},
            {'screen': 'Bias detection indicators', 'vo': 'The bias detection panel shows any flags raised during the assessment. If the system detects scoring patterns that may indicate bias, it highlights the affected questions and provides a bias risk score. Flagged interviews must be reviewed by a human evaluator before any hiring decision is made.', 'callout': 'Bias Detection — Fair Assessment'},
            {'screen': 'Combining AI with manual evaluation', 'vo': 'For the most comprehensive assessment, combine AI and manual evaluation. The comparison view shows AI scores alongside human evaluator ratings, making discrepancies easy to spot. Use the AI assessment as a data point in your overall decision, not as the sole criterion. The final decision always requires human judgment.', 'callout': 'Hybrid Assessment — AI + Human'},
        ]
    },
    {
        'num': '2.5',
        'title': 'Onboarding Module',
        'duration': '7 minutes',
        'objectives': [
            'Understand the onboarding workflow from offer acceptance to active employee',
            'Manage the onboarding task checklist and track completion',
            'Guide new hires through document submission and verification',
            'Coordinate with IT and Admin for provisioning activities'
        ],
        'scenes': [
            {'screen': 'Onboarding dashboard with task tracking', 'vo': 'The Onboarding module automatically activates when a candidate accepts an offer. The dashboard shows all new hires in the onboarding pipeline with their task completion progress. Each onboarding case has a checklist of tasks assigned to the new hire, HR, IT, and the hiring manager.', 'callout': 'Onboarding Dashboard — Track Progress'},
            {'screen': 'Onboarding task checklist', 'vo': 'The task checklist is organized by category and responsible party. HR tasks include document verification and orientation scheduling. IT tasks include account creation and equipment provisioning. The new hire\'s tasks include profile completion and document uploads. Each task has a deadline and status indicator.', 'callout': 'Task Checklist — Organized & Tracked'},
            {'screen': 'New hire self-service portal', 'vo': 'New hires receive a welcome email with portal access. Upon logging in, they see a guided onboarding experience that walks them through completing their personal information, uploading required documents, and acknowledging company policies. The progress bar shows completion percentage.', 'callout': 'New Hire Portal — Guided Experience'},
            {'screen': 'Document collection and verification', 'vo': 'The Documents section shows all required documents with their current status: Pending, Uploaded, or Verified. New hires upload documents through a simple drag-and-drop interface. HR reviews submissions and marks them as Verified or requests re-upload with comments.', 'callout': 'Documents — Collect & Verify'},
        ]
    },
    {
        'num': '2.6',
        'title': 'Attendance & Leave Module',
        'duration': '8 minutes',
        'objectives': [
            'Record daily attendance using the check-in/check-out system',
            'Submit and manage leave requests with policy-compliant workflows',
            'Handle attendance regularization for missed or incorrect entries',
            'Review leave balances and attendance reports'
        ],
        'scenes': [
            {'screen': 'Attendance check-in/check-out interface', 'vo': 'Recording your daily attendance is simple. Click the Check In button when you start your workday, and Check Out when you finish. The system automatically calculates your total working hours and compares against your shift schedule. Late arrivals and early departures are flagged according to your organization\'s grace period policy.', 'callout': 'Attendance — Check In & Out'},
            {'screen': 'Attendance calendar and anomaly alerts', 'vo': 'The attendance calendar provides a visual overview of your monthly attendance. Green indicates full days, yellow shows half days, and red flags anomalies that need regularization. Click any flagged day to see the issue and submit a regularization request with your explanation.', 'callout': 'Calendar — Visual Attendance Tracking'},
            {'screen': 'Leave application form', 'vo': 'To apply for leave, navigate to the Leave module and click Apply. Select your leave type, specify the dates, and provide a reason. The system validates your request against available balance, blackout periods, and team leave conflicts before submitting to your manager for approval.', 'callout': 'Leave Application — Apply with Ease'},
            {'screen': 'Leave balance and history', 'vo': 'The Leave Dashboard shows your current balance for each leave type: Casual, Sick, Earned, and Comp-off. The balance updates in real-time as leaves are approved. Below the balance cards, your leave history shows all past applications with their status and approvals.', 'callout': 'Leave Balance — Know Your Entitlement'},
            {'screen': 'Regularization request process', 'vo': 'When the system flags an attendance anomaly, you\'ll receive a notification. Navigate to Attendance, select the flagged date, and click Regularize. Choose the reason, enter the correct times, and submit. Your manager will review and approve the request, updating your attendance record accordingly.', 'callout': 'Regularization — Fix Anomalies'},
        ]
    },
    {
        'num': '2.7',
        'title': 'Payroll Module',
        'duration': '8 minutes',
        'objectives': [
            'Understand the monthly payroll processing cycle',
            'Review payslips and understand salary component breakdowns',
            'Navigate payroll reports and statutory compliance views',
            'Understand salary structure configuration (admin view)'
        ],
        'scenes': [
            {'screen': 'Payroll processing workflow', 'vo': 'The Payroll module handles the complete salary processing cycle. HR initiates the payroll run by selecting the pay period. The system automatically consolidates attendance, leave, and overtime data, computes salaries with all components, and generates a computation summary for review. After approval, payslips are generated and bank transfer files are created.', 'callout': 'Payroll Cycle — End-to-End Processing'},
            {'screen': 'Payslip view for employees', 'vo': 'Employees access their payslips through the Payroll section. Each payslip shows a detailed breakdown: basic salary, HRA, special allowance, and other earnings, followed by deductions including PF, ESI, TDS, Professional Tax, and any loan EMIs. The net pay is prominently displayed at the bottom.', 'callout': 'Payslip — Complete Breakdown'},
            {'screen': 'Salary structure configuration (admin)', 'vo': 'For administrators, the salary structure configuration allows defining earning and deduction components. Each component has rules for calculation — fixed amount, percentage of basic, or formula-based. Structures can be templated and applied to groups of employees, with individual overrides when needed.', 'callout': 'Salary Structure — Configure Components'},
            {'screen': 'Payroll reports and analytics', 'vo': 'The Payroll Reports section provides comprehensive analytics: monthly cost trends, department-wise salary distribution, statutory compliance summaries, and year-to-date comparisons. Export any report to PDF or Excel for further analysis or compliance filing.', 'callout': 'Reports — Payroll Analytics'},
        ]
    },
    {
        'num': '2.8',
        'title': 'Performance Reviews Module',
        'duration': '8 minutes',
        'objectives': [
            'Understand the performance review cycle from initiation to rating publication',
            'Complete self-assessment and goal documentation as an employee',
            'Conduct team member evaluations as a manager',
            'Review performance analytics and calibration results'
        ],
        'scenes': [
            {'screen': 'Performance review cycle overview', 'vo': 'The Performance module manages the complete review cycle. When HR initiates a new cycle, you\'ll receive a notification with the timeline and instructions. The cycle progresses through phases: goal confirmation, self-assessment, manager review, calibration, and final rating publication.', 'callout': 'Review Cycle — Phases & Timeline'},
            {'screen': 'Self-assessment form', 'vo': 'During the self-assessment phase, evaluate your own performance against defined goals and competencies. Rate each goal on achievement level, add comments on challenges and accomplishments, and identify areas for development. Be thorough and honest — self-assessment is the foundation of a fair review.', 'callout': 'Self-Assessment — Reflect & Document'},
            {'screen': 'Manager evaluation interface', 'vo': 'Managers review each team member\'s self-assessment and provide their own ratings. The evaluation form shows the employee\'s self-ratings alongside the manager\'s rating fields. Add constructive feedback for each competency and goal. The system prompts you to consider specific examples and avoid vague language.', 'callout': 'Manager Evaluation — Rate & Coach'},
            {'screen': 'Calibration and final ratings', 'vo': 'After all managers submit evaluations, HR conducts calibration to ensure rating consistency across teams. The calibration dashboard shows rating distributions by department and level. HR can adjust individual ratings with documented justification. Final ratings are then published to employees with development recommendations.', 'callout': 'Calibration — Fair & Consistent'},
        ]
    },
    {
        'num': '2.9',
        'title': 'Training & Learning Module',
        'duration': '7 minutes',
        'objectives': [
            'Browse and enroll in available training programs',
            'Complete e-learning courses and assessments',
            'Track training completion and certification status',
            'Provide feedback on training programs'
        ],
        'scenes': [
            {'screen': 'Training catalog and enrollment', 'vo': 'The Training module houses all available learning programs. Browse the catalog by category or search for specific topics. Each program card shows the title, duration, format, and enrollment status. Click Enroll to register for available programs, or request nomination for restricted courses through your manager.', 'callout': 'Training Catalog — Browse & Enroll'},
            {'screen': 'Course content and assessment', 'vo': 'Once enrolled, access your active courses from the My Learning dashboard. Each course presents content in sequential modules — watch videos, read materials, and complete practice exercises. At the end, take the assessment quiz. You must achieve the passing score to receive your certificate.', 'callout': 'Course View — Learn & Assess'},
            {'screen': 'Training progress and certificates', 'vo': 'The My Learning dashboard shows your progress for all enrolled courses with visual progress bars. Completed courses show your assessment score and a downloadable certificate. Your training history is automatically linked to your employee profile, making it easy to demonstrate qualifications.', 'callout': 'My Learning — Track Progress'},
        ]
    },
    {
        'num': '2.10',
        'title': 'Helpdesk & AI Assistant Module',
        'duration': '7 minutes',
        'objectives': [
            'Create and track helpdesk support tickets',
            'Use the AI Assistant for instant HR query resolution',
            'Understand the escalation process for complex issues',
            'Review ticket history and satisfaction ratings'
        ],
        'scenes': [
            {'screen': 'Helpdesk ticket creation', 'vo': 'When you need support, the Helpdesk module makes it easy to get help. Click Create Ticket, select the category that best matches your issue, set the priority, and describe your problem in detail. Attach screenshots if helpful. The system routes your ticket to the right support team automatically.', 'callout': 'Helpdesk — Get Support Fast'},
            {'screen': 'AI Assistant chat interface', 'vo': 'For quick questions about policies, leave balances, or HR procedures, try the AI Assistant first. Click the chat icon in the bottom right corner to open the assistant. Ask your question in natural language — the AI understands context and can retrieve information from company policies and your personal data. It\'s like having an HR expert available 24/7.', 'callout': 'AI Assistant — Instant Answers'},
            {'screen': 'Ticket tracking and resolution', 'vo': 'Track all your support requests in the My Tickets view. Open tickets show their current status and assigned agent. When an agent responds, you\'ll receive a notification. Review the resolution and confirm it solves your problem, or request further assistance. After closure, rate your satisfaction to help improve service quality.', 'callout': 'Ticket Tracking — Stay Informed'},
            {'screen': 'Smart escalation to human agents', 'vo': 'If the AI Assistant cannot resolve your query, it will automatically offer to connect you with a human agent. The full conversation context is transferred, so you don\'t need to repeat your issue. The system routes your escalation to the appropriate team based on your query category.', 'callout': 'Smart Escalation — AI to Human'},
        ]
    },
    {
        'num': '2.11',
        'title': 'Projects Module',
        'duration': '7 minutes',
        'objectives': [
            'Navigate the project dashboard and understand project status views',
            'Log time against project tasks using the timesheet feature',
            'Update task status and collaborate with team members',
            'Review project reports and utilization metrics'
        ],
        'scenes': [
            {'screen': 'Project dashboard overview', 'vo': 'The Projects module gives you visibility into all your assigned projects. The dashboard shows project cards with key metrics: progress percentage, days remaining, and team size. Click any project to view its detailed task board, timeline, and team members.', 'callout': 'Projects — Your Work at a Glance'},
            {'screen': 'Task board and task details', 'vo': 'Inside a project, the task board shows all tasks organized by status: To Do, In Progress, and Done. Click any task to view details, including description, assignee, due date, and any attached files. Update the task status by dragging to the next column or using the status dropdown.', 'callout': 'Task Board — Visual Progress'},
            {'screen': 'Time logging against project tasks', 'vo': 'Log your working time against specific project tasks. Navigate to the Timesheet section, select the date, choose the project and task, and enter the hours worked. Add notes about what you accomplished. Your logged time feeds into project costing and utilization reports.', 'callout': 'Timesheet — Log Your Work'},
        ]
    },
    {
        'num': '2.12',
        'title': 'Reports & Analytics Module',
        'duration': '6 minutes',
        'objectives': [
            'Navigate the analytics dashboard and understand available reports',
            'Generate custom reports with filters and parameters',
            'Export report data in multiple formats',
            'Understand scheduled report configuration'
        ],
        'scenes': [
            {'screen': 'Analytics dashboard overview', 'vo': 'The Reports & Analytics module provides data-driven insights across all HR functions. The main dashboard shows key organizational metrics with interactive charts. Navigate between report categories: Employee, Attendance, Leave, Payroll, Performance, and Recruitment. Each category has pre-built reports and the option to create custom analyses.', 'callout': 'Analytics — Data-Driven HR'},
            {'screen': 'Generating a custom report', 'vo': 'To create a custom report, select the report type, set your date range, and apply filters such as department, location, or employee category. Click Generate to create the report with real-time data. The results display in a combination of charts and data tables that you can sort, filter, and drill down into.', 'callout': 'Custom Reports — Your Data, Your Way'},
            {'screen': 'Exporting and sharing reports', 'vo': 'Export any report in your preferred format: PDF for presentation, Excel for further analysis, or CSV for data processing. Scheduled reports can be configured to auto-generate and email to specified recipients on a daily, weekly, or monthly basis.', 'callout': 'Export & Schedule — Share Insights'},
        ]
    },
    {
        'num': '2.13',
        'title': 'Settings Module',
        'duration': '7 minutes',
        'objectives': [
            'Navigate the Settings module and understand configuration categories',
            'Configure organization-level policies and preferences',
            'Manage user roles and access permissions',
            'Set up module-specific configurations'
        ],
        'scenes': [
            {'screen': 'Settings dashboard with categories', 'vo': 'The Settings module is the control center for platform configuration. The dashboard organizes settings into categories: Organization, Users & Roles, Policies, Modules, and Integrations. Your available settings depend on your role — Tenant Admins see all settings, while HR Managers see HR-relevant configurations only.', 'callout': 'Settings — Platform Configuration'},
            {'screen': 'Organization policy configuration', 'vo': 'Under Organization settings, configure company details, working hours, holiday calendar, and regional preferences. Policy settings control leave rules, attendance policies, and probation periods. Changes to policies are version-tracked and may require approval before taking effect.', 'callout': 'Policies — Define the Rules'},
            {'screen': 'User roles and permissions', 'vo': 'The Users & Roles section manages access control. View all users and their assigned roles. The role matrix shows which permissions each role has across modules. Add new users, modify roles, or deactivate accounts. Changes to roles take effect immediately upon saving.', 'callout': 'Roles — Control Access'},
            {'screen': 'Module configuration', 'vo': 'Each module has its own configuration section. Enable or disable modules, set default behaviors, and configure module-specific rules. For example, in the AI Interview configuration, you can set scoring thresholds and bias detection sensitivity. In the Payroll configuration, you set pay periods and statutory rules.', 'callout': 'Modules — Feature Configuration'},
        ]
    },
]

for script in scripts:
    story.append(heading(f'{script["num"]} {script["title"]}', 'H2', s, 1))
    
    # Video Title and Duration
    story.append(make_table(
        ['Video Title', 'Estimated Duration'],
        [[script['title'], script['duration']]],
        s, [300, 120]
    ))
    story.append(Spacer(1, 6))
    
    # Learning Objectives
    story.append(heading('Learning Objectives', 'H3', s, 1))
    for obj in script['objectives']:
        story.append(bullet(obj, s))
    story.append(Spacer(1, 6))
    
    # Screen Flow, Voiceover Script, and Callouts
    story.append(heading('Screen Flow & Script', 'H3', s, 1))
    
    for i, scene in enumerate(script['scenes'], 1):
        story.append(body(f'<b>Scene {i}</b>', s))
        story.append(body(f'<b>[SCREEN]</b> {scene["screen"]}', s))
        story.append(body(f'<b>[VO]</b> {scene["vo"]}', s))
        story.append(body(f'<b>[CALLOUT]</b> {scene["callout"]}', s))
        story.append(Spacer(1, 4))
    
    story.append(Spacer(1, 10))

# ── 3. Video Production Guidelines ──
story.append(PageBreak())
story.append(heading('3. Video Production Guidelines', 'H1', s, 0))
story.append(body('This section provides technical guidelines for producing high-quality training videos for the NEXUS HRMS platform. Following these standards ensures consistent production quality across all module videos.', s))
story.append(Spacer(1, 6))

story.append(heading('3.1 Screen Recording Setup', 'H2', s, 1))
recording_setup = [
    '<b>Recording Software:</b> Use OBS Studio (free) or Camtasia (licensed) for screen recording. Configure recording area to capture the browser window at 1920x1080 resolution.',
    '<b>Browser Setup:</b> Use Google Chrome in a clean profile with no extensions except those needed for the demonstration. Set browser zoom to 100%. Disable browser auto-fill and password prompts.',
    '<b>Test Data:</b> Use a dedicated training tenant with sample data. Ensure all employee names, email addresses, and phone numbers use clearly fictional data (e.g., "John Demo," "demo@company.com").',
    '<b>Cursor Visibility:</b> Enable cursor highlighting in the recording software. Use a custom cursor with a colored ring to make clicks visible. Add click animations for important interactions.',
    '<b>Loading States:</b> Edit out any loading spinners or wait times in post-production. Keep the video focused on the user interaction, not system processing time.',
    '<b>Multi-Page Flows:</b> For workflows spanning multiple pages, record the complete flow in one take, then trim in editing. This ensures consistent timing and natural transitions.'
]
for item in recording_setup:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.2 Audio Quality Standards', 'H2', s, 1))
audio_standards = [
    '<b>Microphone:</b> Use a USB condenser microphone (e.g., Blue Yeti, Audio-Technica ATR2100x) for consistent audio quality. Avoid laptop built-in microphones.',
    '<b>Recording Environment:</b> Record in a quiet room with soft furnishings to reduce echo. Close windows and doors. Disable air conditioning during recording if it creates audible noise.',
    '<b>Voice Technique:</b> Speak clearly and at a moderate pace. Use an enthusiastic but professional tone. Pause briefly between sentences. Emphasize key terms and action items.',
    '<b>Audio Processing:</b> Apply noise reduction, compression, and normalization in post-production. Target -16 LUFS loudness standard with -1 dB peak limit. Remove mouth clicks and breathing sounds.',
    '<b>Background Music:</b> If used, keep background music at -30 dB or lower. Choose neutral, corporate-style music that does not distract from the narration.',
    '<b>File Format:</b> Export audio as WAV (48kHz, 24-bit) for editing, and render final as AAC 256kbps for MP4 output.'
]
for item in audio_standards:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('3.3 Editing & Post-Production Tips', 'H2', s, 1))
editing_tips = [
    '<b>Pacing:</b> Keep scenes moving — viewers should see something change every 3-5 seconds. Use zoom-ins for detail, highlight boxes for callouts, and smooth transitions between scenes.',
    '<b>Callout Style:</b> Use rounded rectangle annotations with the NEXUS accent color (#b54925) for callouts. Add subtle fade-in/fade-out animations (0.3 seconds). Keep callouts on screen for at least 3 seconds.',
    '<b>Zoom Effects:</b> Use smooth zoom animations to highlight specific UI elements. Zoom to 150-200% for text readability. Always zoom back out to show context before transitioning.',
    '<b>Cursor Path:</b> If the original cursor path was erratic, use editing software to create a smooth cursor path that follows the logical flow of the demonstration.',
    '<b>Cut Editing:</b> Remove "ums," long pauses, and mistakes. Use jump cuts sparingly — prefer short cross-dissolves (0.2 seconds) for smoother transitions.',
    '<b>Chapter Markers:</b> Add chapter markers at each scene boundary for easy navigation. Chapter titles should match the scene titles from the script.',
    '<b>Thumbnail:</b> Create a custom thumbnail for each video featuring the module icon, video title, and NEXUS branding. Use high contrast and large text for visibility at small sizes.',
    '<b>Closed Captions:</b> Generate captions using the voiceover script as a base. Review and adjust timing to match the actual audio. Export as SRT format for platform compatibility.'
]
for item in editing_tips:
    story.append(bullet(item, s))

# ── Build ──
doc.multiBuild(story)

cover_pdf = generate_cover('Training Video<br/>Scripts', 'Module-wise Training Content with Screen Flows &amp; Voiceover', 'training_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS Training Video Scripts')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
