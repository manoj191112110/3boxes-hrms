'use client';

import Link from 'next/link';
import {
  FiZap,
  FiClock,
  FiCheck,
  FiTrendingUp,
  FiArrowRight,
  FiUserPlus,
  FiFile,
  FiClipboard,
  FiCpu,
  FiSearch,
  FiCalendar,
  FiStar,
  FiSend,
  FiUsers,
  FiDollarSign,
  FiShield,
  FiFileText,
  FiBarChart2,
  FiTarget,
} from 'react-icons/fi';

/* ─── Workflow Infographic Data ─── */
const workflows = [
  {
    title: 'Employee Onboarding',
    subtitle: 'From hire to productive team member in days, not weeks',
    steps: [
      { icon: FiUserPlus, label: 'Create Employee', desc: 'Add new hire with personal & job details' },
      { icon: FiFile, label: 'Document Collection', desc: 'Auto-request ID proofs, certificates & bank info' },
      { icon: FiClipboard, label: 'Task Assignment', desc: 'Assign onboarding checklist to stakeholders' },
      { icon: FiCpu, label: 'AI Welcome Bot', desc: 'Automated introductions, policies & FAQ answers' },
      { icon: FiCheck, label: 'Go Live', desc: 'Employee activated with access to all modules' },
    ],
    accent: 'emerald',
  },
  {
    title: 'Recruitment Pipeline',
    subtitle: 'End-to-end hiring — from job posting to sealed offer letter',
    steps: [
      { icon: FiSearch, label: 'Post Job', desc: 'Publish requisitions across portals & social' },
      { icon: FiCpu, label: 'AI Screening', desc: 'Auto-rank resumes, flag top-fit candidates' },
      { icon: FiCalendar, label: 'Interview Schedule', desc: 'Panel scheduling, AI proctored assessments' },
      { icon: FiStar, label: 'Evaluate & Score', desc: 'Structured feedback, scorecards & calibration' },
      { icon: FiSend, label: 'Offer & Hire', desc: 'Generate offer letter, track acceptance & onboard' },
    ],
    accent: 'teal',
  },
  {
    title: 'Payroll Processing',
    subtitle: 'Accurate, compliant salary runs every month — automatically',
    steps: [
      { icon: FiUsers, label: 'Attendance Sync', desc: 'Pull leave, OT & shift data into payroll' },
      { icon: FiDollarSign, label: 'Salary Compute', desc: 'Auto-calculate tax, PF, ESI & deductions' },
      { icon: FiShield, label: 'Compliance Check', desc: 'Statutory validation & audit trail logging' },
      { icon: FiFileText, label: 'Payslip & Bank File', desc: 'Generate payslips & bank upload formats' },
      { icon: FiTrendingUp, label: 'Analytics', desc: 'Cost breakdown reports & payroll dashboards' },
    ],
    accent: 'green',
  },
  {
    title: 'Leave Management',
    subtitle: 'Smart leave workflows with policy-driven auto-balances',
    steps: [
      { icon: FiCalendar, label: 'Apply Leave', desc: 'Employee submits request via app or chatbot' },
      { icon: FiTarget, label: 'Policy Check', desc: 'Auto-validate against balance & blackout rules' },
      { icon: FiUsers, label: 'Approval Chain', desc: 'Multi-level manager routing & delegation' },
      { icon: FiClock, label: 'Balance Update', desc: 'Real-time accrual & deduction tracking' },
      { icon: FiBarChart2, label: 'Team Calendar', desc: 'Visibility of team availability & conflicts' },
    ],
    accent: 'lime',
  },
];

/* ─── Workflow Stats Data ─── */
const workflowStats = [
  { icon: FiZap, label: 'Automated Steps', value: '85%', desc: 'of HR tasks run on auto-pilot' },
  { icon: FiClock, label: 'Time Saved', value: '60%', desc: 'reduction in manual processing' },
  { icon: FiCheck, label: 'Error Rate', value: '< 1%', desc: 'with built-in compliance checks' },
  { icon: FiTrendingUp, label: 'Adoption', value: '94%', desc: 'employee self-service usage' },
];

/* ─── Workflow Diagram Component ─── */
function WorkflowDiagram({ workflow }: { workflow: typeof workflows[number] }) {
  const accentMap: Record<string, { bg: string; iconBg: string; iconText: string; ring: string; line: string; glow: string }> = {
    emerald: { bg: 'bg-emerald-50', iconBg: 'bg-gradient-to-br from-emerald-500 to-green-600', iconText: 'text-white', ring: 'ring-emerald-200', line: 'border-emerald-300', glow: 'shadow-emerald-500/20' },
    teal:    { bg: 'bg-teal-50', iconBg: 'bg-gradient-to-br from-teal-500 to-emerald-600', iconText: 'text-white', ring: 'ring-teal-200', line: 'border-teal-300', glow: 'shadow-teal-500/20' },
    green:   { bg: 'bg-green-50', iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600', iconText: 'text-white', ring: 'ring-green-200', line: 'border-green-300', glow: 'shadow-green-500/20' },
    lime:    { bg: 'bg-lime-50', iconBg: 'bg-gradient-to-br from-lime-500 to-green-600', iconText: 'text-white', ring: 'ring-lime-200', line: 'border-lime-300', glow: 'shadow-lime-500/20' },
  };
  const a = accentMap[workflow.accent];

  return (
    <div className="group relative rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      {/* Header */}
      <div className={`${a.bg} px-6 py-5 border-b ${a.line}`}>
        <h3 className="text-xl font-bold text-slate-900">{workflow.title}</h3>
        <p className="text-sm text-slate-600 mt-1">{workflow.subtitle}</p>
      </div>

      {/* Steps - horizontal pipeline */}
      <div className="p-6">
        {/* Mobile: vertical layout */}
        <div className="hidden sm:flex items-center justify-between gap-0">
          {workflow.steps.map((step, idx) => {
            const StepIcon = step.icon;
            return (
              <div key={idx} className="flex flex-col items-center relative" style={{ flex: 1, minWidth: 0 }}>
                {/* Connector line */}
                {idx < workflow.steps.length - 1 && (
                  <div className={`absolute top-5 left-[55%] right-[-45%] h-0.5 ${a.line} z-0`} />
                )}
                {/* Step circle */}
                <div className={`relative z-10 w-10 h-10 rounded-full ${a.iconBg} ${a.iconText} flex items-center justify-center shadow-lg ${a.glow} ring-4 ${a.ring}`}>
                  <StepIcon className="w-5 h-5" />
                </div>
                {/* Step number */}
                <span className="mt-2 text-xs font-bold text-slate-400">Step {idx + 1}</span>
                {/* Label */}
                <span className="mt-1 text-sm font-semibold text-slate-900 text-center leading-tight">{step.label}</span>
                {/* Description */}
                <span className="mt-0.5 text-xs text-slate-500 text-center leading-snug">{step.desc}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical layout */}
        <div className="sm:hidden space-y-4">
          {workflow.steps.map((step, idx) => {
            const StepIcon = step.icon;
            return (
              <div key={idx} className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${a.iconBg} ${a.iconText} flex items-center justify-center shadow-lg ${a.glow} ring-4 ${a.ring}`}>
                  <StepIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Step {idx + 1}</span>
                    <span className="text-sm font-semibold text-slate-900">{step.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative pt-12 sm:pt-20 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-green-50/40 to-white" />
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/3 w-96 h-96 bg-green-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
            <FiZap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Smart Workflows
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            Visualize Your{' '}
            <span className="gradient-text">HR Workflows</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Every HR process is mapped, automated, and trackable. See how 3Boxes HRMS transforms
            manual chaos into streamlined pipelines.
          </p>
        </div>
      </section>

      {/* ─── Workflow Diagrams ─── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-green-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {workflows.map((wf, idx) => (
              <WorkflowDiagram key={idx} workflow={wf} />
            ))}
          </div>

          {/* Workflow Stats Bar */}
          <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {workflowStats.map((stat, idx) => {
              const StatIcon = stat.icon;
              return (
                <div key={idx} className="p-4 rounded-xl bg-white border border-green-100 shadow-sm text-center hover:shadow-md transition-shadow">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 mb-2">
                    <StatIcon className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{stat.label}</div>
                  <div className="text-xs text-slate-500">{stat.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-green-600 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Automate Your HR Workflows?
          </h2>
          <p className="mt-4 text-lg text-green-200">
            Experience 85% automation and 60% time savings with 3Boxes HRMS smart workflows.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/landing/trial"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-green-600 text-base font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Start Free Trial <FiArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/landing/features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-green-500/30 text-white text-base font-semibold border border-green-400/40 hover:bg-green-500/40 transition-all"
            >
              View Features
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
