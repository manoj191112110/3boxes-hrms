'use client';

import Link from 'next/link';
import {
  FiLayers,
  FiUsers,
  FiClock,
  FiDollarSign,
  FiBriefcase,
  FiTarget,
  FiCpu,
  FiStar,
  FiArrowRight,
  FiCheck,
  FiZap,
} from 'react-icons/fi';

/* ─── Feature Data ─── */
const features = [
  {
    icon: FiLayers,
    title: 'Multi-Company Management',
    description: 'Manage multiple group companies, branches, and entities from a single dashboard with unified control and reporting.',
    color: 'from-green-500 to-emerald-600',
    details: [
      'Multi-branch & multi-entity support',
      'Unified reporting across all companies',
      'Centralized policy management',
      'Cross-company employee transfers',
    ],
  },
  {
    icon: FiUsers,
    title: 'Employee Lifecycle',
    description: 'Complete hire-to-retire management — onboarding, transfers, promotions, resignations, and alumni tracking.',
    color: 'from-emerald-500 to-teal-500',
    details: [
      'Automated onboarding workflows',
      'Transfer & promotion tracking',
      'Resignation & offboarding process',
      'Alumni network management',
    ],
  },
  {
    icon: FiClock,
    title: 'Attendance & Leave',
    description: 'Biometric, GPS, and shift-based attendance with geofencing, overtime, WFH snapshots, and smart leave workflows.',
    color: 'from-teal-500 to-green-500',
    details: [
      'Biometric & GPS-based tracking',
      'Shift scheduling & geofencing',
      'WFH snapshot verification',
      'Smart leave policy automation',
    ],
  },
  {
    icon: FiDollarSign,
    title: 'Payroll & Compliance',
    description: 'Flexible salary structures, statutory compliance, bank files, payslips, and multi-country payroll processing.',
    color: 'from-green-600 to-emerald-500',
    details: [
      'Flexible salary structures',
      'PF, ESI, TDS statutory compliance',
      'Bank file generation',
      'Multi-country payroll support',
    ],
  },
  {
    icon: FiBriefcase,
    title: 'Recruitment ATS',
    description: 'Post jobs, track candidates through a visual pipeline, AI resume screening, interview scheduling, and offer management.',
    color: 'from-emerald-600 to-teal-400',
    details: [
      'Job posting across multiple portals',
      'AI-powered resume screening',
      'Visual candidate pipeline',
      'Interview scheduling & scoring',
    ],
  },
  {
    icon: FiTarget,
    title: 'Performance Management',
    description: '360° reviews, goal setting, OKRs, continuous feedback, calibration, and performance analytics dashboards.',
    color: 'from-green-500 to-lime-500',
    details: [
      '360° review cycles',
      'OKR & goal tracking',
      'Continuous feedback tools',
      'Performance analytics dashboards',
    ],
  },
  {
    icon: FiCpu,
    title: 'AI-Powered',
    description: 'AI chatbot for HR queries, resume screening, predictive analytics, burnout detection, and anomaly insights.',
    color: 'from-teal-600 to-emerald-400',
    details: [
      'HR AI chatbot assistant',
      'Predictive attrition analytics',
      'Burnout detection & alerts',
      'Anomaly & fraud insights',
    ],
  },
];

/* ─── Feature Comparison Table ─── */
const comparisonFeatures = [
  { feature: 'Employee Management', starter: true, professional: true, enterprise: true },
  { feature: 'Attendance & Leave', starter: true, professional: true, enterprise: true },
  { feature: 'Basic Payroll', starter: true, professional: true, enterprise: true },
  { feature: 'Recruitment ATS', starter: true, professional: true, enterprise: true },
  { feature: 'Multi-Company Support', starter: false, professional: true, enterprise: true },
  { feature: 'Performance & OKRs', starter: false, professional: true, enterprise: true },
  { feature: 'Advanced Payroll & Compliance', starter: false, professional: true, enterprise: true },
  { feature: 'AI Chatbot & Analytics', starter: false, professional: true, enterprise: true },
  { feature: 'Custom Workflows', starter: false, professional: true, enterprise: true },
  { feature: 'AI-Powered Insights', starter: false, professional: false, enterprise: true },
  { feature: 'Custom Integrations', starter: false, professional: false, enterprise: true },
  { feature: 'Dedicated Account Manager', starter: false, professional: false, enterprise: true },
];

export default function FeaturesPage() {
  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative pt-12 sm:pt-20 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-50/80 via-emerald-50/40 to-white" />
        <div className="absolute top-10 left-1/3 w-72 h-72 bg-green-400/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/3 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-100 mb-4">
            <FiStar className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              Key Features
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900">
            Everything You Need to{' '}
            <span className="gradient-text">Manage HR</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            From attendance tracking to AI-powered analytics, 3Boxes HRMS covers every aspect of
            modern human resource management.
          </p>
        </div>
      </section>

      {/* ─── Feature Cards ─── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="group relative p-6 sm:p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-green-200 transition-all duration-300"
                >
                  {/* Icon */}
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg mb-5`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed mb-4">{feature.description}</p>

                  {/* Details list */}
                  <div className="space-y-2">
                    {feature.details.map((detail, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-2">
                        <FiCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{detail}</span>
                      </div>
                    ))}
                  </div>

                  {/* Hover gradient */}
                  <div
                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Feature Comparison Table ─── */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-green-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 mb-4">
              <FiZap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                Compare Plans
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Feature Comparison
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              See which features are included in each plan. Upgrade anytime as your team grows.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-green-600 to-emerald-600">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Feature</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Starter</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white bg-emerald-700">Professional</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-white">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-green-50 transition-colors`}
                  >
                    <td className="px-6 py-3.5 text-sm font-medium text-slate-900">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center">
                      {row.starter ? (
                        <FiCheck className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center bg-emerald-50/30">
                      {row.professional ? (
                        <FiCheck className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {row.enterprise ? (
                        <FiCheck className="w-5 h-5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <Link
              href="/landing/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-105 transition-all"
            >
              View Pricing Plans <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
