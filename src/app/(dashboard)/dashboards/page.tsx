'use client';

import { useRouter } from 'next/navigation';
import {
  FiGrid, FiShield, FiUser, FiBriefcase, FiUsers, FiDollarSign,
  FiTarget, FiClock, FiCreditCard, FiMonitor, FiPackage, FiHeadphones,
  FiArrowRight, FiTrendingUp, FiZap, FiCalendar,
} from 'react-icons/fi';

interface DashboardTile {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  gradient: string;
  iconColor: string;
  isNew?: boolean;
}

const DASHBOARD_CATEGORIES = [
  {
    label: 'General',
    icon: FiGrid,
    dashboards: [
      {
        title: 'Dashboard',
        description: 'Overview dashboard with key metrics, activities, and quick access to all modules',
        icon: FiGrid,
        route: '/home',
        gradient: 'from-emerald-500 to-green-600',
        iconColor: 'text-white',
      },
      {
        title: 'Admin Dashboard',
        description: 'System administration overview — users, departments, companies, audit logs, and platform health',
        icon: FiShield,
        route: '/dashboards/admin',
        gradient: 'from-rose-500 to-pink-600',
        iconColor: 'text-white',
      },
      {
        title: 'Employee Dashboard',
        description: 'Personal employee view — attendance, leave balance, payslips, schedule, and announcements',
        icon: FiUser,
        route: '/dashboards/employee',
        gradient: 'from-emerald-500 to-teal-600',
        iconColor: 'text-white',
      },
    ],
  },
  {
    label: 'HR & Recruitment',
    icon: FiUsers,
    dashboards: [
      {
        title: 'HR Dashboard',
        description: 'HR analytics — headcount, attrition, recruitment funnel, engagement, and pending HR actions',
        icon: FiUsers,
        route: '/dashboards/hr',
        gradient: 'from-teal-500 to-teal-600',
        iconColor: 'text-white',
        isNew: true,
      },
      {
        title: 'Recruitment Dashboard',
        description: 'Talent acquisition — open positions, applications pipeline, interviews, offers, and time-to-hire',
        icon: FiBriefcase,
        route: '/dashboards/recruitment',
        gradient: 'from-amber-500 to-orange-600',
        iconColor: 'text-white',
        isNew: true,
      },
    ],
  },
  {
    label: 'Finance & Payroll',
    icon: FiDollarSign,
    dashboards: [
      {
        title: 'Payroll Dashboard',
        description: 'Payroll analytics — gross pay, deductions, net pay, monthly trends, department breakdown, and compliance',
        icon: FiDollarSign,
        route: '/dashboards/payroll',
        gradient: 'from-cyan-500 to-green-600',
        iconColor: 'text-white',
        isNew: true,
      },
      {
        title: 'Finance Dashboard',
        description: 'Financial overview — revenue, expenses, invoices, budget utilization, and profit analysis',
        icon: FiCreditCard,
        route: '/dashboards/finance',
        gradient: 'from-emerald-500 to-green-600',
        iconColor: 'text-white',
        isNew: true,
      },
    ],
  },
  {
    label: 'Operations',
    icon: FiZap,
    dashboards: [
      {
        title: 'Attendance Dashboard',
        description: 'Attendance analytics — present/absent rates, late arrivals, department attendance, and trends',
        icon: FiClock,
        route: '/dashboards/attendance',
        gradient: 'from-green-500 to-emerald-600',
        iconColor: 'text-white',
        isNew: true,
      },
      {
        title: 'Asset Dashboard',
        description: 'Asset management — inventory, allocation, maintenance, depreciation, and lifecycle tracking',
        icon: FiPackage,
        route: '/dashboards/asset',
        gradient: 'from-teal-500 to-cyan-600',
        iconColor: 'text-white',
        isNew: true,
      },
      {
        title: 'IT Admin Dashboard',
        description: 'IT operations — device management, security alerts, system health, tickets, and storage',
        icon: FiMonitor,
        route: '/dashboards/it-admin',
        gradient: 'from-slate-600 to-gray-700',
        iconColor: 'text-white',
        isNew: true,
      },
      {
        title: 'Help Desk Dashboard',
        description: 'Support analytics — open tickets, SLA compliance, response times, agent performance, and satisfaction',
        icon: FiHeadphones,
        route: '/dashboards/helpdesk',
        gradient: 'from-pink-500 to-rose-600',
        iconColor: 'text-white',
        isNew: true,
      },
    ],
  },
  {
    label: 'Sales & CRM',
    icon: FiTarget,
    dashboards: [
      {
        title: 'Deals Dashboard',
        description: 'CRM deal pipeline — won/lost deals, pipeline value, win rates, and revenue forecasting',
        icon: FiBriefcase,
        route: '/dashboards/deals',
        gradient: 'from-orange-500 to-red-600',
        iconColor: 'text-white',
      },
      {
        title: 'Leads Dashboard',
        description: 'Lead management — lead sources, qualification, conversion rates, scoring, and assignment',
        icon: FiTarget,
        route: '/dashboards/leads',
        gradient: 'from-lime-500 to-green-600',
        iconColor: 'text-white',
      },
    ],
  },
];

export default function DashboardsIndexPage() {
  const router = useRouter();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
          <FiGrid className="w-6 h-6 text-emerald-500" />
          Dashboards
        </h1>
        <p className="text-thb-text-secondary mt-1">
          Access all specialized dashboards across 3Boxes HRMS — from HR and payroll to IT operations and sales CRM.
        </p>
      </div>

      {/* Dashboard Categories */}
      {DASHBOARD_CATEGORIES.map((category) => {
        const CatIcon = category.icon;
        return (
          <section key={category.label}>
            <div className="flex items-center gap-2 mb-4">
              <CatIcon className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">
                {category.label}
              </h2>
              <span className="text-xs text-thb-text-muted">({category.dashboards.length})</span>
            </div>
            <div className={`grid gap-4 ${
              category.dashboards.length === 1 ? 'grid-cols-1' :
              category.dashboards.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              category.dashboards.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {category.dashboards.map((dashboard) => {
                const Icon = dashboard.icon;
                return (
                  <button
                    key={dashboard.route}
                    onClick={() => router.push(dashboard.route)}
                    className="thb-card thb-card-hover p-5 text-left group transition-all duration-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dashboard.gradient} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-thb-text-primary group-hover:text-emerald-600 transition-colors inline-flex items-center gap-2">
                            {dashboard.title}
                            {dashboard.isNew && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700 uppercase tracking-wide">New</span>
                            )}
                          </h3>
                          <FiArrowRight className="w-4 h-4 text-thb-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-thb-text-muted mt-1 leading-relaxed line-clamp-2">
                          {dashboard.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Quick Stats */}
      <div className="thb-card p-6">
        <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider mb-4">
          Dashboard Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3">
            <p className="text-2xl font-bold text-emerald-600">12</p>
            <p className="text-xs text-thb-text-muted mt-1">Total Dashboards</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold text-emerald-600">6</p>
            <p className="text-xs text-thb-text-muted mt-1">New Dashboards</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold text-amber-600">5</p>
            <p className="text-xs text-thb-text-muted mt-1">Categories</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold text-teal-600">Live</p>
            <p className="text-xs text-thb-text-muted mt-1">Real-time Data</p>
          </div>
        </div>
      </div>
    </div>
  );
}
