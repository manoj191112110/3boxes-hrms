'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen, Video, FileText, Search, Play, Clock, Users, Briefcase,
  GraduationCap, DollarSign, Heart, ShieldCheck, Plane, Monitor,
  Headphones, Bot, Globe, WorkflowIcon, Building2, Truck, UserCog,
  BarChart3, MessageSquare, UserMinus, Building, ClipboardList,
  ChevronRight, Download, ExternalLink, CheckCircle2, Circle,
  LayoutDashboard, CalendarDays, TrendingUp, Settings, HelpCircle,
  Lightbulb, ArrowRight, Star
} from 'lucide-react';

interface TrainingModule {
  id: string;
  key: string;
  title: string;
  icon: React.ReactNode;
  category: string;
  description: string;
  videoDuration: string;
  sopPages: number;
  tasks: { title: string; completed: boolean }[];
  keyFeatures: string[];
  workflowSteps: string[];
  tips: string[];
}

const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'tm-1', key: 'dashboard', title: 'Dashboard & Analytics', icon: <LayoutDashboard className="h-5 w-5" />,
    category: 'OVERVIEW', description: 'Learn how to navigate the 3Boxes HRMS dashboard, interpret key metrics, and use analytics to make data-driven HR decisions.',
    videoDuration: '12:30', sopPages: 8,
    tasks: [
      { title: 'Understanding the dashboard layout', completed: false },
      { title: 'Reading KPI cards and trends', completed: false },
      { title: 'Using department distribution charts', completed: false },
      { title: 'Reviewing recent activities feed', completed: false },
    ],
    keyFeatures: ['Real-time employee count and distribution', 'Department-wise headcount analytics', 'Attrition rate tracking', 'New hire onboarding pipeline', 'Pending approvals dashboard', 'Quick action shortcuts'],
    workflowSteps: ['Login to 3Boxes HRMS', 'Review dashboard KPIs for anomalies', 'Check pending approvals section', 'Navigate to Analytics for detailed reports', 'Export data for stakeholder meetings'],
    tips: ['Pin frequently used metrics to the top', 'Set up automated daily summary emails', 'Use keyboard shortcuts for quick navigation (Ctrl+K for search)'],
  },
  {
    id: 'tm-2', key: 'employees', title: 'Employee Management', icon: <Users className="h-5 w-5" />,
    category: 'PEOPLE', description: 'Master employee lifecycle management from onboarding to offboarding, including profile management, department assignments, and status tracking.',
    videoDuration: '18:45', sopPages: 14,
    tasks: [
      { title: 'Adding a new employee', completed: false },
      { title: 'Editing employee details', completed: false },
      { title: 'Filtering employees by department/status', completed: false },
      { title: 'Viewing employee profile details', completed: false },
    ],
    keyFeatures: ['Complete employee profile management', 'Grid and list view options', 'Department and status filters', 'Quick search across all fields', 'Employment type tracking (Full-time, Part-time, Contract, Intern)', 'Bulk status updates'],
    workflowSteps: ['Navigate to Employees module', 'Click "Add Employee" to create new record', 'Fill in personal and professional details', 'Assign department and branch', 'Set employment type and status', 'Verify and save the record'],
    tips: ['Use bulk import for mass employee onboarding', 'Always assign a department for proper analytics', 'Set probation end dates for new hires to trigger automatic reminders'],
  },
  {
    id: 'tm-3', key: 'recruitment', title: 'Recruitment (ATS)', icon: <Briefcase className="h-5 w-5" />,
    category: 'RECRUITMENT', description: 'Manage the complete recruitment pipeline from job requisition to candidate hiring, including job postings, applicant tracking, and interview scheduling.',
    videoDuration: '22:15', sopPages: 18,
    tasks: [
      { title: 'Creating a job posting', completed: false },
      { title: 'Reviewing candidate applications', completed: false },
      { title: 'Scheduling interviews', completed: false },
      { title: 'Moving candidates through pipeline stages', completed: false },
    ],
    keyFeatures: ['Full applicant tracking system', 'Kanban-style pipeline management', 'Automated resume parsing', 'Interview scheduling and feedback', 'Offer letter generation', 'Pipeline analytics and time-to-hire metrics'],
    workflowSteps: ['Create job requisition with requirements', 'Post to internal job portal and external boards', 'Review incoming applications', 'Screen candidates and shortlist', 'Schedule and conduct interviews', 'Collect interviewer feedback', 'Extend offer and track acceptance', 'Initiate onboarding for accepted candidates'],
    tips: ['Use AI-powered candidate scoring for faster screening', 'Create interview templates for consistency', 'Set up automated rejection emails for better candidate experience'],
  },
  {
    id: 'tm-4', key: 'attendance', title: 'Attendance & Time Tracking', icon: <Clock className="h-5 w-5" />,
    category: 'TIME', description: 'Track employee attendance, manage check-in/check-out, handle shift schedules, and monitor attendance patterns across the organization.',
    videoDuration: '14:20', sopPages: 10,
    tasks: [
      { title: 'Employee check-in/check-out', completed: false },
      { title: 'Viewing attendance reports', completed: false },
      { title: 'Managing shift schedules', completed: false },
      { title: 'Handling attendance exceptions', completed: false },
    ],
    keyFeatures: ['Web and mobile check-in/check-out', 'Geofenced attendance for field staff', 'Shift management and scheduling', 'Overtime calculation', 'Attendance pattern analytics', 'Automated late arrival alerts'],
    workflowSteps: ['Employee checks in via web or mobile app', 'System records time and location', 'Admin reviews daily attendance report', 'Exceptions flagged for manager approval', 'Monthly attendance summary generated', 'Data flows to payroll for processing'],
    tips: ['Enable geofencing for accurate field staff tracking', 'Set up automatic late arrival notifications', 'Use shift templates for recurring schedules'],
  },
  {
    id: 'tm-5', key: 'leave', title: 'Leave Management', icon: <CalendarDays className="h-5 w-5" />,
    category: 'TIME', description: 'Manage employee leave requests, track leave balances, configure leave policies, and maintain compliance with organizational leave rules.',
    videoDuration: '15:10', sopPages: 12,
    tasks: [
      { title: 'Applying for leave', completed: false },
      { title: 'Approving/rejecting leave requests', completed: false },
      { title: 'Checking leave balances', completed: false },
      { title: 'Configuring leave policies', completed: false },
    ],
    keyFeatures: ['Multi-type leave management (Casual, Sick, Earned, etc.)', 'Automatic balance calculation', 'Manager approval workflow', 'Leave calendar with team visibility', 'Carry-forward configuration', 'Holiday calendar integration'],
    workflowSteps: ['Employee submits leave request', 'System validates leave balance', 'Manager receives notification', 'Manager approves or rejects with comments', 'Employee notified of decision', 'Leave calendar updated automatically', 'Attendance records adjusted'],
    tips: ['Configure leave carry-forward rules at fiscal year start', 'Set up team leave calendar for better coverage planning', 'Enable half-day leave options for flexibility'],
  },
  {
    id: 'tm-6', key: 'payroll', title: 'Payroll Processing', icon: <DollarSign className="h-5 w-5" />,
    category: 'COMPENSATION', description: 'Process monthly payroll, manage salary structures, handle deductions and reimbursements, and generate payslips and compliance reports.',
    videoDuration: '25:40', sopPages: 22,
    tasks: [
      { title: 'Running monthly payroll', completed: false },
      { title: 'Reviewing payroll summary', completed: false },
      { title: 'Generating payslips', completed: false },
      { title: 'Handling tax deductions', completed: false },
    ],
    keyFeatures: ['Automated salary calculation', 'Tax computation and deduction management', 'Multi-currency support', 'Payslip generation and distribution', 'Bank file generation for salary transfer', 'Statutory compliance reports (PF, ESI, TDS)'],
    workflowSteps: ['Verify attendance data for the month', 'Review and approve overtime calculations', 'Process reimbursements and deductions', 'Run payroll calculation', 'Review payroll summary report', 'Approve and lock payroll', 'Generate bank payment file', 'Distribute digital payslips', 'File statutory returns'],
    tips: ['Always run a trial payroll before final processing', 'Verify tax computations against latest regulations', 'Set up automated payslip email distribution', 'Keep salary structures updated for mid-year changes'],
  },
  {
    id: 'tm-7', key: 'performance', title: 'Performance Management', icon: <TrendingUp className="h-5 w-5" />,
    category: 'GROWTH', description: 'Set goals, conduct performance reviews, manage appraisal cycles, and track employee growth and development plans.',
    videoDuration: '20:15', sopPages: 16,
    tasks: [
      { title: 'Setting employee goals', completed: false },
      { title: 'Conducting performance review', completed: false },
      { title: 'Managing appraisal cycles', completed: false },
      { title: 'Tracking goal progress', completed: false },
    ],
    keyFeatures: ['OKR and KPI-based goal tracking', '360-degree feedback collection', 'Customizable review templates', 'Appraisal cycle management', 'Calibration and normalization tools', 'Development plan tracking'],
    workflowSteps: ['HR configures appraisal cycle', 'Employees set individual goals', 'Managers review and approve goals', 'Mid-cycle check-in and progress update', 'Self-assessment by employee', 'Manager assessment and feedback', 'Calibration sessions', 'Final ratings and compensation recommendations'],
    tips: ['Set SMART goals with measurable outcomes', 'Schedule regular 1-on-1 check-ins for continuous feedback', 'Use calibration sessions to ensure fairness across teams'],
  },
  {
    id: 'tm-8', key: 'learning', title: 'Learning & Development', icon: <GraduationCap className="h-5 w-5" />,
    category: 'GROWTH', description: 'Manage training programs, track course completions, handle certifications, and measure the effectiveness of learning initiatives.',
    videoDuration: '16:30', sopPages: 12,
    tasks: [
      { title: 'Creating a training course', completed: false },
      { title: 'Assigning courses to employees', completed: false },
      { title: 'Tracking completion status', completed: false },
      { title: 'Managing certifications', completed: false },
    ],
    keyFeatures: ['Course catalog management', 'Automated course assignment', 'Progress tracking and completion reports', 'Certification management and expiry alerts', 'Skill gap analysis', 'Training effectiveness surveys'],
    workflowSteps: ['Create training course with content', 'Define target audience and prerequisites', 'Assign to employees or departments', 'Track enrollment and progress', 'Collect feedback post-training', 'Issue certificates upon completion', 'Schedule refresher courses as needed'],
    tips: ['Use mandatory training assignments for compliance courses', 'Set up certification expiry alerts well in advance', 'Gather post-training feedback to improve content quality'],
  },
  {
    id: 'tm-9', key: 'engagement', title: 'Employee Engagement', icon: <Heart className="h-5 w-5" />,
    category: 'ENGAGEMENT', description: 'Run engagement surveys, measure employee satisfaction, manage recognition programs, and build a positive workplace culture.',
    videoDuration: '13:50', sopPages: 10,
    tasks: [
      { title: 'Creating engagement surveys', completed: false },
      { title: 'Reviewing survey results', completed: false },
      { title: 'Managing recognition programs', completed: false },
      { title: 'Tracking engagement metrics', completed: false },
    ],
    keyFeatures: ['Customizable pulse surveys', 'Anonymous feedback collection', 'Peer recognition and rewards', 'Engagement score trending', 'Action planning tools', 'Culture analytics dashboard'],
    workflowSteps: ['Design engagement survey questions', 'Configure anonymity and frequency settings', 'Launch survey to target audience', 'Monitor response rates in real-time', 'Analyze results and generate insights', 'Create action plans based on feedback', 'Track progress on improvement initiatives'],
    tips: ['Run pulse surveys monthly for continuous feedback', 'Keep surveys short (5-10 questions) for higher response rates', 'Always communicate action plans back to employees after surveys'],
  },
  {
    id: 'tm-10', key: 'helpdesk', title: 'Helpdesk & Support', icon: <Headphones className="h-5 w-5" />,
    category: 'ENGAGEMENT', description: 'Manage internal support tickets, handle employee queries, track resolution times, and maintain a knowledge base for common issues.',
    videoDuration: '11:40', sopPages: 8,
    tasks: [
      { title: 'Creating a support ticket', completed: false },
      { title: 'Assigning tickets to agents', completed: false },
      { title: 'Tracking ticket resolution', completed: false },
      { title: 'Managing knowledge base articles', completed: false },
    ],
    keyFeatures: ['Multi-category ticket management', 'Priority-based routing', 'SLA tracking and alerts', 'Knowledge base integration', 'Automated ticket assignment', 'Satisfaction rating collection'],
    workflowSteps: ['Employee submits support ticket', 'System categorizes and assigns priority', 'Ticket routed to appropriate team', 'Agent acknowledges and works on resolution', 'Resolution communicated to employee', 'Employee rates the support experience', 'Common resolutions added to knowledge base'],
    tips: ['Set up auto-assignment rules for faster resolution', 'Create template responses for common queries', 'Monitor SLA compliance weekly and address bottlenecks'],
  },
  {
    id: 'tm-11', key: 'travel_expense', title: 'Travel & Expense Management', icon: <Plane className="h-5 w-5" />,
    category: 'OPERATIONS', description: 'Manage travel requests, track expense claims, handle reimbursements, and enforce travel and expense policies.',
    videoDuration: '17:25', sopPages: 14,
    tasks: [
      { title: 'Submitting a travel request', completed: false },
      { title: 'Filing an expense claim', completed: false },
      { title: 'Approving travel and expenses', completed: false },
      { title: 'Processing reimbursements', completed: false },
    ],
    keyFeatures: ['Travel request workflow', 'Multi-currency expense claims', 'Receipt upload and OCR', 'Policy compliance checking', 'Mileage calculation', 'Integration with payroll for reimbursement'],
    workflowSteps: ['Employee submits travel request', 'Manager reviews and approves itinerary', 'Employee travels and collects receipts', 'Expense claim submitted with receipts', 'Manager verifies against policy', 'Finance processes reimbursement', 'Amount credited through next payroll cycle'],
    tips: ['Configure per-diem rates by city/country for accuracy', 'Set up policy violation alerts for out-of-policy claims', 'Enable receipt OCR for faster expense entry'],
  },
  {
    id: 'tm-12', key: 'assets', title: 'Asset Management', icon: <Monitor className="h-5 w-5" />,
    category: 'OPERATIONS', description: 'Track company assets, manage asset assignments, handle maintenance schedules, and maintain asset lifecycle records.',
    videoDuration: '14:00', sopPages: 10,
    tasks: [
      { title: 'Adding a new asset', completed: false },
      { title: 'Assigning assets to employees', completed: false },
      { title: 'Scheduling maintenance', completed: false },
      { title: 'Processing asset returns', completed: false },
    ],
    keyFeatures: ['Complete asset inventory management', 'Assignment and return tracking', 'Maintenance scheduling and alerts', 'Depreciation calculation', 'QR code/Barcode tracking', 'Asset audit trail'],
    workflowSteps: ['Register new asset with details', 'Assign to employee during onboarding', 'Schedule regular maintenance', 'Track usage and condition', 'Process return on employee exit', 'Update asset status and depreciation'],
    tips: ['Use QR codes for quick asset identification during audits', 'Set up automated maintenance reminders', 'Include asset return in employee exit checklist'],
  },
  {
    id: 'tm-13', key: 'compliance', title: 'Compliance & Regulatory', icon: <ShieldCheck className="h-5 w-5" />,
    category: 'OPERATIONS', description: 'Manage regulatory compliance, track statutory requirements, handle audit trails, and ensure organizational adherence to labor laws and regulations.',
    videoDuration: '19:30', sopPages: 16,
    tasks: [
      { title: 'Setting up compliance requirements', completed: false },
      { title: 'Tracking compliance status', completed: false },
      { title: 'Running compliance audits', completed: false },
      { title: 'Managing document submissions', completed: false },
    ],
    keyFeatures: ['Statutory compliance calendar', 'Document management and tracking', 'Automated compliance reminders', 'Audit trail and reporting', 'Regulatory update notifications', 'Multi-jurisdiction support'],
    workflowSteps: ['Configure compliance requirements by jurisdiction', 'Set up calendar with filing deadlines', 'Assign responsible persons for each compliance', 'Track document collection and filing status', 'Run periodic compliance audits', 'Generate compliance reports for leadership'],
    tips: ['Set reminders at least 30 days before filing deadlines', 'Maintain a centralized document repository for easy access during audits', 'Review compliance status weekly to avoid last-minute rushes'],
  },
  {
    id: 'tm-14', key: 'workflow', title: 'Workflow Builder', icon: <WorkflowIcon className="h-5 w-5" />,
    category: 'AUTOMATION', description: 'Design and automate HR workflows, configure approval chains, set up triggers and conditions, and monitor workflow execution.',
    videoDuration: '21:00', sopPages: 18,
    tasks: [
      { title: 'Creating a workflow definition', completed: false },
      { title: 'Configuring approval steps', completed: false },
      { title: 'Setting up triggers', completed: false },
      { title: 'Monitoring workflow instances', completed: false },
    ],
    keyFeatures: ['Visual workflow designer', 'Multi-step approval chains', 'Conditional routing logic', 'Email and notification triggers', 'SLA and escalation configuration', 'Workflow analytics and bottleneck detection'],
    workflowSteps: ['Define workflow trigger (e.g., leave request created)', 'Design approval chain with roles', 'Configure conditions and routing rules', 'Set up notifications and reminders', 'Test workflow with sample data', 'Deploy and monitor execution', 'Analyze and optimize based on metrics'],
    tips: ['Start with simple workflows and add complexity gradually', 'Always include an escalation path for unattended approvals', 'Test thoroughly with different scenarios before deployment'],
  },
  {
    id: 'tm-15', key: 'ai_interview', title: 'AI Interview System', icon: <Bot className="h-5 w-5" />,
    category: 'RECRUITMENT', description: 'Set up AI-powered interviews, configure interview questions, manage candidate evaluations, and leverage AI insights for better hiring decisions.',
    videoDuration: '16:45', sopPages: 12,
    tasks: [
      { title: 'Configuring AI interview parameters', completed: false },
      { title: 'Setting up question templates', completed: false },
      { title: 'Reviewing AI-generated assessments', completed: false },
      { title: 'Comparing candidate scores', completed: false },
    ],
    keyFeatures: ['AI-powered question generation', 'Automated candidate scoring', 'Video interview recording and analysis', 'Competency-based evaluation', 'Bias detection and mitigation', 'Interview summary generation'],
    workflowSteps: ['Configure interview parameters for the role', 'Select or generate question templates', 'Invite candidates for AI interview', 'System conducts and records interview', 'AI analyzes responses and generates scores', 'Recruiter reviews AI assessment', 'Combine with human evaluation for final decision'],
    tips: ['Always review AI assessments alongside human judgment', 'Customize question templates for each role for better relevance', 'Use bias detection features to ensure fair evaluation'],
  },
];

const CATEGORIES = [
  { key: 'all', label: 'All Modules' },
  { key: 'OVERVIEW', label: 'Overview' },
  { key: 'PEOPLE', label: 'People' },
  { key: 'RECRUITMENT', label: 'Recruitment' },
  { key: 'TIME', label: 'Time' },
  { key: 'COMPENSATION', label: 'Compensation' },
  { key: 'GROWTH', label: 'Growth' },
  { key: 'ENGAGEMENT', label: 'Engagement' },
  { key: 'OPERATIONS', label: 'Operations' },
  { key: 'AUTOMATION', label: 'Automation' },
];

export function HelpTraining() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('training');
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  const filteredModules = TRAINING_MODULES.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleTask = (moduleId: string, taskIndex: number) => {
    const key = `${moduleId}-${taskIndex}`;
    setCompletedTasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getTaskStatus = (moduleId: string, taskIndex: number) => {
    return completedTasks[`${moduleId}-${taskIndex}`] || false;
  };

  const getModuleProgress = (module: TrainingModule) => {
    const completed = module.tasks.filter((_, i) => getTaskStatus(module.id, i)).length;
    return Math.round((completed / module.tasks.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600" />
            Help & Training Center
          </h2>
          <p className="text-muted-foreground mt-1">Master every module with training videos, SOPs, and technical documentation</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            {Object.keys(completedTasks).filter(k => completedTasks[k]).length} tasks completed
          </Badge>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search modules, features, or workflows..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <Button
              key={cat.key}
              variant={selectedCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.key)}
              className={selectedCategory === cat.key ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="training" className="flex items-center gap-2">
            <Video className="h-4 w-4" /> Training Videos
          </TabsTrigger>
          <TabsTrigger value="sops" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> SOPs & Guides
          </TabsTrigger>
          <TabsTrigger value="technical" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Technical Docs
          </TabsTrigger>
        </TabsList>

        {/* Training Videos Tab */}
        <TabsContent value="training" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModules.map(module => (
              <Card
                key={module.id}
                className={`cursor-pointer transition-all hover:shadow-md ${expandedModule === module.id ? 'ring-2 ring-emerald-500' : ''}`}
                onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                        {module.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{module.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px] mt-1">{module.category}</Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-2 line-clamp-2">{module.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Video Info */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {module.videoDuration}</span>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {module.sopPages} pages</span>
                      <span>{getModuleProgress(module)}% done</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${getModuleProgress(module)}%` }}
                      />
                    </div>

                    {/* Expanded Content */}
                    {expandedModule === module.id && (
                      <div className="space-y-4 pt-3 border-t">
                        {/* Training Tasks */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Learning Tasks
                          </h4>
                          <div className="space-y-2">
                            {module.tasks.map((task, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted p-1.5 rounded"
                                onClick={(e) => { e.stopPropagation(); toggleTask(module.id, idx); }}
                              >
                                {getTaskStatus(module.id, idx) ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={getTaskStatus(module.id, idx) ? 'line-through text-muted-foreground' : ''}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Key Features */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500" />
                            Key Features
                          </h4>
                          <div className="space-y-1">
                            {module.keyFeatures.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <ChevronRight className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Workflow */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <WorkflowIcon className="h-3.5 w-3.5 text-green-500" />
                            Workflow Steps
                          </h4>
                          <div className="space-y-1">
                            {module.workflowSteps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <span className="bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0 text-[9px] mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tips */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                            Pro Tips
                          </h4>
                          <div className="space-y-1.5">
                            {module.tips.map((tip, idx) => (
                              <div key={idx} className="bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded text-xs border border-yellow-200 dark:border-yellow-900">
                                {tip}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Watch Video Button */}
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm">
                          <Play className="h-4 w-4" /> Watch Training Video
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SOPs & Guides Tab */}
        <TabsContent value="sops" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Standard Operating Procedures</CardTitle>
              <CardDescription>Step-by-step guides for every HR process and workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {filteredModules.map(module => (
                  <AccordionItem key={module.id} value={module.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-emerald-100 rounded text-emerald-600">
                          {module.icon}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">{module.title} - SOP</p>
                          <p className="text-xs text-muted-foreground">{module.sopPages} pages | Last updated: May 2026</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-11">
                        {/* SOP Purpose */}
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Purpose</h4>
                          <p className="text-xs text-muted-foreground">{module.description}</p>
                        </div>

                        {/* SOP Procedure */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Procedure</h4>
                          <div className="space-y-2">
                            {module.workflowSteps.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-emerald-200 pl-3 py-1">
                                <span className="font-semibold text-emerald-600">Step {idx + 1}:</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Key Features Reference */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Key Features Used</h4>
                          <div className="grid grid-cols-2 gap-1">
                            {module.keyFeatures.map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Best Practices */}
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Best Practices</h4>
                          <div className="space-y-1">
                            {module.tips.map((tip, idx) => (
                              <div key={idx} className="bg-muted p-2 rounded text-xs">
                                <Lightbulb className="h-3 w-3 text-yellow-500 inline mr-1" />
                                {tip}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="gap-1">
                            <Download className="h-3 w-3" /> Download PDF
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="h-3 w-3" /> View on Wiki
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Docs Tab */}
        <TabsContent value="technical" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Architecture Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  System Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">Frontend:</strong> Next.js 16 with App Router, React 19, TypeScript 5</p>
                  <p><strong className="text-foreground">UI Library:</strong> shadcn/ui (Radix UI primitives) with Tailwind CSS 4</p>
                  <p><strong className="text-foreground">State Management:</strong> Zustand for global state, React hooks for local state</p>
                  <p><strong className="text-foreground">Backend:</strong> Next.js API Routes with Prisma ORM</p>
                  <p><strong className="text-foreground">Database:</strong> PostgreSQL (Neon serverless) with Prisma Client</p>
                  <p><strong className="text-foreground">Deployment:</strong> Vercel with automatic CI/CD from GitHub</p>
                  <p><strong className="text-foreground">Authentication:</strong> Custom auth with JWT tokens and role-based access</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <Download className="h-3 w-3" /> Download Architecture Diagram
                </Button>
              </CardContent>
            </Card>

            {/* API Documentation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-teal-600" />
                  API Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">Base URL:</strong> <code className="bg-muted px-1 rounded">/api/*</code></p>
                  <p><strong className="text-foreground">Auth:</strong> Session-based with role validation</p>
                  <p><strong className="text-foreground">Format:</strong> JSON request/response</p>
                  <p><strong className="text-foreground">Pagination:</strong> Cursor and offset based</p>
                  <p><strong className="text-foreground">Error Handling:</strong> Structured error responses with status codes</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Available Endpoints:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {['/api/auth', '/api/employees', '/api/departments', '/api/branches', '/api/companies',
                      '/api/attendance', '/api/leaves', '/api/payroll', '/api/jobs', '/api/candidates',
                      '/api/interviews', '/api/assets', '/api/travel', '/api/expenses', '/api/tickets',
                      '/api/clients', '/api/vendors', '/api/workflows', '/api/surveys', '/api/learning',
                      '/api/compliance', '/api/analytics', '/api/notifications', '/api/audit', '/api/dashboard'
                    ].map(endpoint => (
                      <code key={endpoint} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{endpoint}</code>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <ExternalLink className="h-3 w-3" /> View Full API Reference
                </Button>
              </CardContent>
            </Card>

            {/* Database Schema */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                  Database Schema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">ORM:</strong> Prisma with PostgreSQL</p>
                  <p><strong className="text-foreground">Schema:</strong> <code className="bg-muted px-1 rounded">prisma/schema.prisma</code></p>
                  <p><strong className="text-foreground">Migrations:</strong> Managed via <code className="bg-muted px-1 rounded">prisma db push</code></p>
                  <p><strong className="text-foreground">Connection:</strong> Pooled via Neon serverless driver</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Core Models:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {['User', 'Company', 'Employee', 'Department', 'Branch', 'Job', 'Candidate',
                      'Interview', 'Attendance', 'Leave', 'Payroll', 'Asset', 'TravelRequest',
                      'Expense', 'Ticket', 'Client', 'Vendor', 'WorkflowDefinition',
                      'WorkflowInstance', 'Survey', 'AuditLog', 'Notification', 'Shift', 'OnboardingTask'
                    ].map(model => (
                      <code key={model} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{model}</code>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <Download className="h-3 w-3" /> Download ER Diagram
                </Button>
              </CardContent>
            </Card>

            {/* Development Setup */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-teal-600" />
                  Development Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">Prerequisites:</strong> Node.js 20+, bun, PostgreSQL</p>
                  <p><strong className="text-foreground">Setup:</strong> <code className="bg-muted px-1 rounded">git clone → bun install → prisma generate → bun dev</code></p>
                  <p><strong className="text-foreground">Environment:</strong> <code className="bg-muted px-1 rounded">POSTGRES_URL</code> in .env</p>
                  <p><strong className="text-foreground">Linting:</strong> <code className="bg-muted px-1 rounded">bun run lint</code></p>
                  <p><strong className="text-foreground">Build:</strong> <code className="bg-muted px-1 rounded">bun run build</code></p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Project Structure:</p>
                  <div className="text-xs font-mono space-y-0.5 text-muted-foreground">
                    <p>src/app/api/ - API routes</p>
                    <p>src/components/hrms/ - Module components</p>
                    <p>src/components/ui/ - shadcn/ui components</p>
                    <p>src/lib/ - Utilities and API helpers</p>
                    <p>src/store/ - Zustand stores</p>
                    <p>prisma/ - Database schema</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1 w-full">
                  <ExternalLink className="h-3 w-3" /> View on GitHub
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Module-wise Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Module Technical Specifications</CardTitle>
              <CardDescription>Detailed technical documentation for each module</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {filteredModules.map(module => (
                  <AccordionItem key={module.id} value={module.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-green-100 rounded text-green-600">
                          {module.icon}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">{module.title}</p>
                          <p className="text-xs text-muted-foreground">API routes, data models, and integration points</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-11">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold mb-2">API Endpoints</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 text-[9px]">GET</Badge>
                                <code className="bg-muted px-1 rounded">/api/{module.key}</code>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 text-[9px]">POST</Badge>
                                <code className="bg-muted px-1 rounded">/api/{module.key}</code>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-yellow-100 text-yellow-800 text-[9px]">PUT</Badge>
                                <code className="bg-muted px-1 rounded">/api/{module.key}</code>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-red-100 text-red-800 text-[9px]">DELETE</Badge>
                                <code className="bg-muted px-1 rounded">/api/{module.key}</code>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold mb-2">Integration Points</h4>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {module.keyFeatures.slice(0, 4).map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <ArrowRight className="h-3 w-3 text-green-500 shrink-0" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold mb-2">Data Flow</h4>
                          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-2">
                            {module.workflowSteps.slice(0, 5).map((step, idx) => (
                              <React.Fragment key={idx}>
                                <span className="bg-muted px-2 py-1 rounded whitespace-nowrap">{step.split(' ').slice(0, 3).join(' ')}</span>
                                {idx < 4 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1">
                            <Download className="h-3 w-3" /> Download Module Spec
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="h-3 w-3" /> View Source Code
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-900">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-emerald-600" />
            Need More Help?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Documentation</h4>
              <p className="text-xs text-muted-foreground">Browse comprehensive docs on GitHub Wiki</p>
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3 w-3" /> GitHub Wiki
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Video Tutorials</h4>
              <p className="text-xs text-muted-foreground">Watch module-wise walkthroughs with voiceover</p>
              <Button variant="outline" size="sm" className="gap-1">
                <Video className="h-3 w-3" /> Video Library
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Support</h4>
              <p className="text-xs text-muted-foreground">Contact support for technical assistance</p>
              <Button variant="outline" size="sm" className="gap-1">
                <Headphones className="h-3 w-3" /> Contact Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
