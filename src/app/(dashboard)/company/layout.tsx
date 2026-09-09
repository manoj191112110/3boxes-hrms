'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FiGrid, FiHome, FiMapPin, FiBriefcase, FiAward, FiLayers,
  FiClock, FiCalendar, FiFileText, FiSettings, FiBarChart2, FiChevronRight
} from 'react-icons/fi'

const subNavItems = [
  { label: 'Overview', href: '/company', icon: FiGrid },
  { label: 'Companies', href: '/company/companies', icon: FiHome },
  { label: 'Branches', href: '/company/branches', icon: FiMapPin },
  { label: 'Departments', href: '/company/departments', icon: FiBriefcase },
  { label: 'Designations', href: '/company/designations', icon: FiAward },
  { label: 'Grades', href: '/company/grades', icon: FiLayers },
  { label: 'Reports', href: '/company/reports', icon: FiBarChart2 },
]

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean)
  // Remove the route group segment (dashboard)
  const visibleSegments = segments.filter(s => !s.startsWith('(') && !s.endsWith(')'))
  
  const labelMap: Record<string, string> = {
    company: 'Company',
    companies: 'Companies',
    branches: 'Branches',
    departments: 'Departments',
    designations: 'Designations',
    grades: 'Grades',
    shifts: 'Shifts',
    holidays: 'Holidays',
    policies: 'Policies',
    settings: 'Settings',
    reports: 'Reports',
  }

  return (
    <nav className="flex items-center gap-1 text-sm mb-4" aria-label="Breadcrumb">
      {visibleSegments.map((segment, index) => {
        const isLast = index === visibleSegments.length - 1
        const href = '/' + segments.slice(0, segments.indexOf(segment) + 1).join('/')
        const label = labelMap[segment] || segment

        return (
          <React.Fragment key={segment}>
            {index > 0 && <FiChevronRight className="w-3 h-3 text-thb-text-muted mx-1" />}
            {isLast ? (
              <span className="font-medium text-thb-text-primary">{label}</span>
            ) : (
              <Link href={href} className="text-thb-text-muted hover:text-teal-500 transition-colors">
                {label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb pathname={pathname} />

      {/* Sub Navigation */}
      <div className="thb-card p-2">
        <nav className="flex flex-wrap gap-1" aria-label="Company sub-navigation">
          {subNavItems.map(item => {
            const Icon = item.icon
            const isActive = item.href === '/company' 
              ? pathname === '/company' || pathname === '/company/'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-thb-text-secondary hover:bg-slate-100 hover:text-thb-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  )
}
