'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompanyData } from '@/components/company/useCompanyData';
import {
  FiBriefcase, FiGrid, FiDatabase, FiSettings, FiFileText,
  FiHome, FiMapPin, FiAward, FiLayers,
  FiArrowRight
} from 'react-icons/fi';

function CompanyDashboardContent() {
  const { companies, branches, departments, designations, loading } = useCompanyData();

  const stats = [
    { label: 'Companies', value: companies.length, icon: <FiHome className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-50', href: '/company/companies' },
    { label: 'Branches', value: branches.length, icon: <FiMapPin className="w-4 h-4" />, color: 'text-green-500 bg-green-50', href: '/company/branches' },
    { label: 'Departments', value: departments.length, icon: <FiBriefcase className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-50', href: '/company/departments' },
    { label: 'Designations', value: designations.length, icon: <FiAward className="w-4 h-4" />, color: 'text-teal-500 bg-teal-50', href: '/company/designations' },
    { label: 'Grades', value: [...new Set(designations.map(d => d.level))].length, icon: <FiLayers className="w-4 h-4" />, color: 'text-teal-500 bg-teal-50', href: '/company/grades' },
  ];

  const masterLinks = [
    { title: 'Companies', desc: 'Manage company profiles, locations, and organizational hierarchy', href: '/company/companies', icon: <FiHome className="w-5 h-5" />, color: 'from-emerald-500 to-green-600', count: companies.length },
    { title: 'Branches', desc: 'Set up office locations linked to companies', href: '/company/branches', icon: <FiMapPin className="w-5 h-5" />, color: 'from-green-500 to-cyan-600', count: branches.length },
    { title: 'Departments', desc: 'Define functional departments within the organization', href: '/company/departments', icon: <FiBriefcase className="w-5 h-5" />, color: 'from-cyan-500 to-teal-600', count: departments.length },
    { title: 'Designations', desc: 'Create job titles with grade levels and salary ranges', href: '/company/designations', icon: <FiAward className="w-5 h-5" />, color: 'from-teal-500 to-teal-600', count: designations.length },
    { title: 'Grades', desc: 'View grades derived from designation levels', href: '/company/grades', icon: <FiLayers className="w-5 h-5" />, color: 'from-teal-500 to-pink-600', count: [...new Set(designations.map(d => d.level))].length },
  ];

  const featureLinks = [
    { title: 'Company Reports', desc: 'View reports on company structure, headcount & compliance', href: '/company/reports', icon: <FiFileText className="w-5 h-5" />, color: 'from-teal-500 to-emerald-600', isNew: true },
  ];

  const isLoading = loading.companies || loading.branches || loading.departments;

  return (
    <div className="space-y-8">
      {/* Module Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
          <FiBriefcase className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Company Management</h1>
          <p className="text-sm text-thb-text-secondary">Manage your company structure, masters, settings, and reports</p>
        </div>
      </div>

      {/* Quick Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100" />
                <div className="flex-1">
                  <div className="h-3 bg-slate-100 rounded w-12 mb-1" />
                  <div className="h-5 bg-slate-100 rounded w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[11px] text-thb-text-secondary font-medium">{stat.label}</p>
                  <p className="text-lg font-bold text-thb-text-primary">{stat.value}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Company Masters Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FiDatabase className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold text-thb-text-primary">Company Masters</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {masterLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-md text-white group-hover:scale-105 transition-transform`}>
                  {link.icon}
                </div>
                <span className="text-xs font-semibold text-thb-text-muted bg-slate-50 px-2 py-0.5 rounded-full">{link.count}</span>
              </div>
              <h3 className="text-sm font-bold text-thb-text-primary">{link.title}</h3>
              <p className="text-xs text-thb-text-secondary mt-1 leading-relaxed">{link.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-500 group-hover:text-emerald-600">
                Open <FiArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Company Settings & Reports Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FiSettings className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-bold text-thb-text-primary">Configuration & Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featureLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-left p-5 rounded-xl border border-slate-200 hover:border-green-300 bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-md text-white group-hover:scale-105 transition-transform`}>
                  {link.icon}
                </div>
                {link.isNew && (
                  <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 border border-emerald-200">NEW</span>
                )}
              </div>
              <h3 className="text-sm font-bold text-thb-text-primary flex items-center gap-2">
                {link.title}
              </h3>
              <p className="text-xs text-thb-text-secondary mt-1 leading-relaxed">{link.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-green-500 group-hover:text-green-600">
                Open <FiArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>}>
      <CompanyDashboardContent />
    </Suspense>
  );
}
