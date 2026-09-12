# 📖 Module Guide

Comprehensive user guide for every module in NEXUS HRMS. Each section covers features, navigation, and key actions.

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Employees](#employees)
3. [Recruitment](#recruitment)
4. [Attendance](#attendance)
5. [Leave Management](#leave-management)
6. [Payroll](#payroll)
7. [Performance](#performance)
8. [Learning & Development](#learning--development)
9. [Engagement](#engagement)
10. [Helpdesk](#helpdesk)
11. [Travel & Expense](#travel--expense)
12. [Assets](#assets)
13. [Compliance](#compliance)
14. [Workflow Builder](#workflow-builder)
15. [AI Interview](#ai-interview)
16. [Job Portal](#job-portal)
17. [Client Portal](#client-portal)
18. [Vendor Portal](#vendor-portal)
19. [Analytics](#analytics)
20. [AI Chatbot](#ai-chatbot)
21. [Alumni](#alumni)
22. [Help & Training](#help--training)

---

## Dashboard

The Dashboard is the central hub providing a high-level overview of all HR activities.

### Features
- **Headcount Overview**: Total employees, active count, new hires, and exits
- **Attendance Summary**: Today's present, absent, late, and on-leave counts
- **Pending Actions**: Leave requests, tickets, and approvals awaiting action
- **Quick Stats Cards**: Key metrics at a glance
- **Charts & Trends**: Headcount trends, department distribution, attrition rate
- **Recent Activities**: Latest actions across all modules
- **Upcoming Events**: Birthdays, work anniversaries, holidays
- **Calendar**: Leave calendar, interview schedule, payroll dates

### Navigation
- Access from the sidebar or click the NEXUS HRMS logo
- Stats cards link to their respective modules

### Key Actions
| Action | How |
|--------|-----|
| View department breakdown | Click "Departments" stat card |
| See pending approvals | Click "Pending" badge in sidebar |
| Check attendance | Click "Attendance" stat card |
| Quick add employee | Click "+" button on Employees card |

---

## Employees

Complete employee lifecycle management from onboarding to offboarding.

### Features
- **Employee Directory**: Searchable, filterable list of all employees
- **Employee Profile**: Detailed view with personal, professional, and document info
- **Org Chart**: Visual organizational hierarchy
- **Bulk Operations**: Import/export employee data (CSV)
- **Employee Timeline**: Activity log for each employee

### Sub-sections
| Section | Description |
|---------|-------------|
| Directory | Full employee list with search and filters |
| Profile | Individual employee details |
| Org Chart | Visual hierarchy tree |
| Documents | Employee document management |
| Timeline | Activity and change history |

### Key Actions
| Action | How |
|--------|-----|
| Add new employee | Click "Add Employee" → Fill form → Submit |
| Edit employee | Open profile → Click "Edit" → Update fields |
| Filter by department | Use department dropdown in directory |
| Search employee | Type name/ID in search bar |
| View org chart | Click "Org Chart" tab |
| Export employee list | Click "Export" → Choose CSV/PDF |

---

## Recruitment

End-to-end recruitment pipeline from job posting to hiring.

### Features
- **Job Postings**: Create, edit, and manage job listings
- **Candidate Pipeline**: Track candidates through recruitment stages
- **Interview Scheduling**: Schedule and manage interviews
- **Offer Management**: Create and send offer letters
- **Recruitment Analytics**: Time-to-hire, source effectiveness, pipeline stats

### Recruitment Stages
```
Applied → Screening → Interview → Offer → Hired
   │                                       │
   └──────── Rejected ←────────────────────┘
```

### Key Actions
| Action | How |
|--------|-----|
| Create job posting | Recruitment → Jobs → "Post New Job" |
| Add candidate | Recruitment → Candidates → "Add Candidate" |
| Move candidate stage | Drag candidate card to next stage |
| Schedule interview | Open candidate → "Schedule Interview" |
| Send offer | Open candidate → "Send Offer" |
| View pipeline | Recruitment → Pipeline (Kanban board) |

---

## Attendance

Track employee attendance with check-in/check-out and reporting.

### Features
- **Daily Tracking**: Check-in/check-out times
- **Calendar View**: Monthly attendance calendar
- **Late Arrival Tracking**: Automatic late detection
- **Overtime Calculation**: Automatic overtime computation
- **Attendance Reports**: Daily, weekly, monthly summaries
- **Biometric Integration Ready**: API support for biometric devices

### Attendance Statuses
| Status | Description |
|--------|-------------|
| Present | Checked in and out on time |
| Late | Arrived after grace period |
| Half Day | Worked less than half the shift |
| Absent | No check-in recorded |
| Holiday | Company holiday |
| Weekend | Non-working day |
| On Leave | Approved leave |

### Key Actions
| Action | How |
|--------|-----|
| Check in | Click "Check In" on Attendance page |
| Check out | Click "Check Out" on Attendance page |
| View monthly report | Select month from calendar dropdown |
| Export report | Click "Export" → Choose format |

---

## Leave Management

Comprehensive leave request and approval system.

### Features
- **Leave Requests**: Submit and track leave applications
- **Approval Workflow**: Multi-level approval chain
- **Leave Balance**: Track available leave by type
- **Leave Calendar**: Visual calendar of team leaves
- **Leave Policies**: Configurable leave type rules

### Leave Types
| Type | Description | Typical Allocation |
|------|-------------|-------------------|
| Casual Leave | Personal errands | 12/year |
| Sick Leave | Medical reasons | 10/year |
| Annual Leave | Planned vacation | 15/year |
| Maternity Leave | Maternity | 26 weeks |
| Paternity Leave | Paternity | 15 days |
| Compensatory Off | Worked on holiday | 1:1 |
| Unpaid Leave | No pay | As needed |

### Key Actions
| Action | How |
|--------|-----|
| Apply for leave | Leave → "Apply Leave" → Fill form |
| Approve/reject | Leave → Pending → Click Approve/Reject |
| Check balance | Leave → "My Balance" tab |
| View team calendar | Leave → "Calendar" tab |

---

## Payroll

Automated payroll processing with tax calculations.

### Features
- **Salary Structure**: Configure salary components
- **Payroll Processing**: Run monthly payroll
- **Tax Calculation**: Automatic TDS, PF, ESI computation
- **Payslip Generation**: Downloadable PDF payslips
- **Payment Tracking**: Mark payments as paid
- **Payroll Reports**: Monthly and annual summaries

### Salary Components
```
Gross Salary
├── Earnings
│   ├── Basic Salary
│   ├── HRA (House Rent Allowance)
│   ├── DA (Dearness Allowance)
│   ├── Special Allowance
│   └── Other Allowances
└── Deductions
    ├── PF (Provident Fund)
    ├── ESI (Employee State Insurance)
    ├── TDS (Tax Deducted at Source)
    ├── Professional Tax
    └── Other Deductions

Net Salary = Gross Salary - Total Deductions
```

### Key Actions
| Action | How |
|--------|-----|
| Process payroll | Payroll → "Run Payroll" → Select month |
| View payslip | Payroll → Click employee → "View Payslip" |
| Download payslip | Open payslip → "Download PDF" |
| Mark as paid | Payroll → Select → "Mark as Paid" |

---

## Performance

Employee performance management and reviews.

### Features
- **Goal Setting**: Define and track individual/team goals
- **Performance Reviews**: 360° review cycles
- **KRA/KPI Management**: Key Result Areas and Indicators
- **Feedback**: Continuous feedback system
- **Performance Reports**: Rating distributions and trends

### Review Cycle
```
Goal Setting → Mid-Year Review → Self-Assessment → Manager Review →
Calibration → Final Rating → Improvement Plan
```

### Key Actions
| Action | How |
|--------|-----|
| Set goals | Performance → Goals → "Add Goal" |
| Submit review | Performance → Reviews → "Submit Review" |
| Give feedback | Performance → Feedback → "New Feedback" |
| View reports | Performance → Analytics |

---

## Learning & Development

Employee training and skill development platform.

### Features
- **Training Programs**: Create and manage training courses
- **Learning Paths**: Structured skill development tracks
- **Certifications**: Track employee certifications
- **Skill Matrix**: Map skills across the organization
- **Training Calendar**: Upcoming training schedules
- **Completion Tracking**: Monitor course progress

### Key Actions
| Action | How |
|--------|-----|
| Create training | Learning → "New Program" → Fill details |
| Enroll employee | Open program → "Enroll" → Select employee |
| Track progress | Learning → "Enrollments" → View status |
| Add certification | Learning → Certifications → "Add" |

---

## Engagement

Employee engagement and satisfaction measurement.

### Features
- **Surveys & Polls**: Create and distribute engagement surveys
- **Pulse Checks**: Quick mood/engagement checks
- **Recognition & Rewards**: Peer and manager recognition
- **Suggestion Box**: Anonymous feedback collection
- **Engagement Score**: Aggregate engagement metrics

### Key Actions
| Action | How |
|--------|-----|
| Create survey | Engagement → Surveys → "New Survey" |
| Take survey | Engagement → "Pending Surveys" |
| Give recognition | Engagement → Recognition → "Appreciate" |
| View score | Engagement → Dashboard |

---

## Helpdesk

Internal support ticket management system.

### Features
- **Ticket Creation**: Submit support requests
- **Ticket Tracking**: Real-time status updates
- **SLA Management**: Response and resolution time tracking
- **Knowledge Base**: Self-service articles
- **Escalation Rules**: Auto-escalation for overdue tickets

### Ticket Categories
| Category | Examples |
|----------|---------|
| IT | Laptop issues, VPN, software |
| HR | Policy questions, benefits |
| Facilities | Desk, parking, AC |
| Payroll | Salary queries, reimbursement |
| Admin | Access cards, documents |

### Priority Levels
| Priority | Response SLA | Resolution SLA |
|----------|-------------|----------------|
| Critical | 30 min | 4 hours |
| High | 2 hours | 8 hours |
| Medium | 4 hours | 24 hours |
| Low | 8 hours | 72 hours |

### Key Actions
| Action | How |
|--------|-----|
| Create ticket | Helpdesk → "New Ticket" → Fill form |
| Track status | Helpdesk → My Tickets |
| Add comment | Open ticket → Type comment → Submit |
| Rate resolution | Open resolved ticket → Rate (1-5) |

---

## Travel & Expense

Business travel management and expense reimbursement.

### Features
- **Travel Requests**: Submit and approve travel plans
- **Itinerary Management**: Detailed travel itineraries
- **Expense Claims**: Submit and track expense reimbursements
- **Policy Compliance**: Automatic policy checks
- **Budget Tracking**: Department and company travel budgets

### Key Actions
| Action | How |
|--------|-----|
| Submit travel request | Travel → "New Request" → Fill details |
| Submit expense | Expense → "New Claim" → Add items |
| Approve travel | Travel → Pending → Review → Approve |
| Approve expense | Expense → Pending → Review → Approve |

---

## Assets

Company asset tracking and allocation management.

### Features
- **Asset Registry**: Complete inventory of company assets
- **Allocation & Return**: Assign assets to employees
- **Maintenance Tracking**: Schedule and log maintenance
- **Depreciation**: Automatic depreciation calculation
- **Asset Audit**: Periodic asset verification

### Asset Categories
| Category | Examples |
|----------|---------|
| Laptop | MacBook, Dell, ThinkPad |
| Monitor | Dell, LG, Samsung |
| Phone | iPhone, Samsung Galaxy |
| Furniture | Desk, chair, cabinet |
| Vehicle | Company cars |
| Software | Licenses and subscriptions |

### Key Actions
| Action | How |
|--------|-----|
| Register asset | Assets → "Add Asset" → Fill details |
| Allocate asset | Open asset → "Allocate" → Select employee |
| Return asset | Open asset → "Return" |
| Schedule maintenance | Open asset → "Maintenance" → Schedule |

---

## Compliance

Regulatory compliance and document management.

### Features
- **Policy Management**: Create and distribute company policies
- **Compliance Checklists**: Track regulatory requirements
- **Document Expiry**: Track document and license expiry dates
- **Audit Trail**: Complete compliance audit trail
- **Statutory Reports**: Generate statutory compliance reports

---

## Workflow Builder

Visual workflow creation and management for business processes.

### Features
- **Visual Builder**: Drag-and-drop workflow designer
- **Pre-built Templates**: Common workflow templates
- **Approval Chains**: Multi-step approval processes
- **Condition Branching**: If/then logic in workflows
- **Integration Points**: Connect workflows to modules

### Workflow Types
| Type | Example |
|------|---------|
| Approval | Leave approval, expense approval |
| Request | Asset request, access request |
| Notification | Onboarding checklist, probation end |
| Custom | Any business process |

### Key Actions
| Action | How |
|--------|-----|
| Create workflow | Workflows → "New Workflow" → Design steps |
| Activate workflow | Open draft → "Activate" |
| Trigger workflow | Related module action (e.g., submit leave) |
| Monitor instances | Workflows → "Instances" tab |

---

## AI Interview

AI-powered interview scheduling and assistance.

### Features
- **Smart Scheduling**: AI suggests optimal interview slots
- **Question Generation**: AI-generated interview questions by role
- **Interview Scoring**: Structured evaluation criteria
- **Sentiment Analysis**: Analyze candidate responses
- **Interview Summary**: AI-generated interview summaries

---

## Job Portal

Public-facing job board for candidates.

### Features
- **Public Job Listings**: Searchable job board
- **Online Application**: Apply directly on the portal
- **Application Tracking**: Candidate self-service status
- **Company Branding**: Custom career page
- **SEO Optimized**: Search engine friendly listings

---

## Client Portal

Dedicated portal for client companies.

### Features
- **Contract Management**: View and manage contracts
- **Project Status**: Track project deliverables
- **Invoice Access**: View and download invoices
- **Communication**: Direct messaging channel
- **Document Sharing**: Secure document exchange

---

## Vendor Portal

Dedicated portal for vendor management.

### Features
- **Purchase Orders**: View and acknowledge POs
- **Invoice Submission**: Submit invoices for payment
- **Performance Metrics**: View vendor scorecard
- **Contract Details**: Access contract terms
- **Communication**: Direct messaging with procurement

---

## Analytics

Advanced analytics and reporting across all modules.

### Features
- **Dashboard Analytics**: Visual dashboards per module
- **Custom Reports**: Build custom report templates
- **Scheduled Reports**: Automatic report generation
- **Data Export**: Export in CSV, PDF, Excel formats
- **Predictive Analytics**: AI-powered trend predictions

### Report Categories
| Category | Reports |
|----------|---------|
| HR | Headcount, attrition, diversity |
| Recruitment | Time-to-hire, source analysis, offer rate |
| Attendance | Patterns, late arrivals, overtime |
| Payroll | Cost analysis, tax summary |
| Performance | Rating distribution, completion rate |

---

## AI Chatbot

Intelligent HR assistant powered by AI.

### Features
- **Natural Language Queries**: Ask questions in plain English
- **Quick Actions**: Perform tasks through chat
- **Policy Answers**: Instant answers to policy questions
- **Smart Suggestions**: Proactive recommendations
- **Multi-Context**: Understands your role and permissions

### Example Queries
| Query | Response |
|-------|----------|
| "How many employees are on leave today?" | "6 employees are on leave today..." |
| "What's the leave policy for new hires?" | "New hires are eligible for..." |
| "Approve pending leave requests" | "You have 3 pending requests..." |
| "Show me payroll summary for March" | "March 2024 payroll: Total $X..." |

---

## Alumni

Former employee network and alumni engagement.

### Features
- **Alumni Directory**: Searchable former employee database
- **Re-hire Tracking**: Track boomerang employees
- **Alumni Events**: Organize alumni meetups
- **Referral Program**: Alumni referral incentives
- **Exit Insights**: Analytics from exit interviews

---

## Help & Training

Self-service help and training resources.

### Features
- **Knowledge Base**: Searchable articles and guides
- **Video Tutorials**: Module-wise training videos
- **FAQs**: Frequently asked questions
- **Contact Support**: Direct support channel
- **Onboarding Guide**: New user walkthrough

---

*See also: [Role-Based Access](Role-Based-Access), [API Reference](API-Reference), [Troubleshooting](Troubleshooting)*
