'use client';

import Link from 'next/link';
import {
  FiUsers,
  FiClock,
  FiCoffee,
  FiDollarSign,
  FiBriefcase,
  FiSmile,
  FiTarget,
  FiBarChart2,
  FiShield,
  FiGlobe,
  FiClipboard,
  FiAward,
  FiCpu,
  FiHeart,
  FiFileText,
  FiPhoneCall,
  FiZap,
  FiPackage,
  FiLayers,
  FiLock,
  FiGrid,
  FiArrowRight,
} from 'react-icons/fi';

/* ─── Module Data with Categories ─── */
const moduleCategories = [
  {
    name: 'Core HR',
    color: 'from-green-500 to-emerald-600',
    badgeColor: 'bg-green-50 text-green-700 border-green-200',
    modules: [
      { icon: FiUsers, name: 'Employee Management', desc: 'Profiles, documents & lifecycle', longDesc: 'Complete employee database with personal details, job history, documents, and lifecycle tracking from hire to retire.' },
      { icon: FiClock, name: 'Attendance', desc: 'Biometric, GPS & shifts', longDesc: 'Multi-mode attendance capture including biometric, GPS geofencing, shift scheduling, overtime tracking, and WFH snapshots.' },
      { icon: FiCoffee, name: 'Leave Management', desc: 'Types, balances & approvals', longDesc: 'Comprehensive leave policy engine with auto accrual, multi-level approval chains, blackout rules, and real-time balance tracking.' },
      { icon: FiDollarSign, name: 'Payroll', desc: 'Salary, runs & payslips', longDesc: 'Flexible salary structures with automated payroll runs, statutory deductions, bank file generation, and digital payslips.' },
      { icon: FiLayers, name: 'Company Management', desc: 'Multi-company & groups', longDesc: 'Manage multiple group companies, branches, and entities from a single dashboard with unified control and reporting.' },
      { icon: FiLock, name: 'Role-Based Access', desc: 'Permissions & RBAC', longDesc: 'Granular permission control with role-based access, custom roles, field-level security, and audit logging.' },
    ],
  },
  {
    name: 'Talent Management',
    color: 'from-emerald-500 to-teal-500',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    modules: [
      { icon: FiBriefcase, name: 'Recruitment (ATS)', desc: 'Jobs, pipeline & offers', longDesc: 'Full recruitment lifecycle: job posting, AI resume screening, visual candidate pipeline, interview scheduling, and offer management.' },
      { icon: FiSmile, name: 'Onboarding', desc: 'Tasks & welcome flows', longDesc: 'Automated onboarding with task checklists, document collection, welcome flows, and integration with employee lifecycle.' },
      { icon: FiTarget, name: 'Performance', desc: 'Reviews, goals & OKRs', longDesc: '360° review cycles, OKR tracking, continuous feedback, calibration sessions, and performance analytics dashboards.' },
      { icon: FiHeart, name: 'Engagement', desc: 'Surveys & sentiment', longDesc: 'Employee engagement surveys, pulse checks, sentiment analysis, eNPS tracking, and actionable insights.' },
      { icon: FiAward, name: 'Learning & Training', desc: 'Courses & enrollments', longDesc: 'Course catalog management, enrollment tracking, certification tracking, and skill development analytics.' },
      { icon: FiPhoneCall, name: 'AI Interview', desc: 'Proctoring & scoring', longDesc: 'AI-powered interview scheduling, video proctoring, automated scoring, and candidate assessment reports.' },
    ],
  },
  {
    name: 'Operations',
    color: 'from-teal-500 to-green-500',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    modules: [
      { icon: FiGlobe, name: 'Travel & Expense', desc: 'Requests & claims', longDesc: 'Travel request workflows, expense claim processing, approval routing, and reimbursement tracking.' },
      { icon: FiClipboard, name: 'Helpdesk', desc: 'Tickets & SLA tracking', longDesc: 'Internal HR helpdesk with ticket management, SLA tracking, auto-routing, and resolution analytics.' },
      { icon: FiPackage, name: 'Assets', desc: 'Tracking & assignments', longDesc: 'Asset inventory management, employee assignment tracking, return workflows, and depreciation calculations.' },
      { icon: FiZap, name: 'Workflows', desc: 'Automation engine', longDesc: 'Visual workflow builder with conditional logic, parallel approvals, automated triggers, and process analytics.' },
    ],
  },
  {
    name: 'Admin & Analytics',
    color: 'from-green-600 to-emerald-500',
    badgeColor: 'bg-lime-50 text-lime-700 border-lime-200',
    modules: [
      { icon: FiBarChart2, name: 'Analytics', desc: 'Dashboards & reports', longDesc: 'Real-time HR dashboards, custom report builder, predictive analytics, and data visualization tools.' },
      { icon: FiShield, name: 'Compliance', desc: 'Statutory & audit', longDesc: 'Statutory compliance engine for PF, ESI, TDS, PT with audit trails, alerts, and auto-filing support.' },
      { icon: FiFileText, name: 'Documents', desc: 'DMS & e-signatures', longDesc: 'Document management system with e-signatures, version control, access permissions, and compliance archival.' },
      { icon: FiCpu, name: 'AI Chatbot', desc: 'HR assistant & analytics', longDesc: 'AI-powered HR assistant for employee queries, policy lookups, predictive attrition, burnout detection, and anomaly insights.' },
    ],
  },
];

export default function ModulesPage() {
  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative pt-12 sm:pt-20 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-green-50/40 to-white" />
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/3 w-96 h-96 bg-green-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
            <FiGrid className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Modules
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            20+ HR Modules{' '}
            <span className="gradient-text">at Your Fingertips</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            A comprehensive suite covering every HR function, designed to work together seamlessly.
            Explore each module and see how it fits your organization.
          </p>
        </div>
      </section>

      {/* ─── Module Categories ─── */}
      {moduleCategories.map((category, catIdx) => (
        <section
          key={catIdx}
          className={`py-12 sm:py-16 ${catIdx % 2 === 0 ? 'bg-white' : 'bg-gradient-to-b from-green-50/30 to-white'}`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${category.color} text-white shadow-lg`}>
                <FiGrid className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{category.name}</h2>
                <p className="text-sm text-slate-500">{category.modules.length} modules</p>
              </div>
              <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold border ${category.badgeColor}`}>
                {category.name}
              </span>
            </div>

            {/* Module Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
              {category.modules.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={idx}
                    className="group p-5 sm:p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-green-200 transition-all duration-300"
                  >
                    {/* Icon + Name row */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${category.color} text-white shadow-md`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">{mod.name}</h4>
                    </div>

                    {/* Short description */}
                    <p className="text-xs text-slate-500 leading-snug mb-3">{mod.desc}</p>

                    {/* Long description */}
                    <p className="text-sm text-slate-600 leading-relaxed">{mod.longDesc}</p>

                    {/* Hover gradient */}
                    <div
                      className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* ─── All 20 Modules Overview ─── */}
      <section className="py-12 sm:py-16 bg-gradient-to-b from-white to-green-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              All Modules at a Glance
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Quick overview of all 20 modules across every HR function.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {moduleCategories.flatMap((cat) =>
              cat.modules.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={`${cat.name}-${idx}`}
                    className="group p-4 sm:p-5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-200 text-center"
                  >
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${cat.color} text-white mb-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">{mod.name}</h4>
                    <p className="text-xs text-slate-500 leading-snug">{mod.desc}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-green-600 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Choose the Modules Your Team Needs
          </h2>
          <p className="mt-4 text-lg text-green-200">
            Customize your HRMS experience by selecting the modules that matter most to your organization.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/landing/trial"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-green-600 text-base font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Start Free Trial <FiArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/landing/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-green-500/30 text-white text-base font-semibold border border-green-400/40 hover:bg-green-500/40 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
