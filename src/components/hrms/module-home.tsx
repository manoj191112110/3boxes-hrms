'use client'

import { useHRMSStore, type ModuleKey } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Crown, LayoutDashboard, Building2, Users, Briefcase, Globe, Sparkles,
  UserPlus, Clock, CalendarDays, Banknote, FolderKanban, TrendingUp,
  GraduationCap, LogOut, Settings, Headphones, MessageSquare,
  GitBranch, Shield, BarChart3, UserCircle, UsersRound, Search, Home
} from 'lucide-react'
import { useState, useMemo } from 'react'

interface ModuleCard {
  key: ModuleKey
  label: string
  icon: any
  description: string
  color: string
  badge?: string
}

const allModules: ModuleCard[] = [
  { key: 'super-admin', label: 'Super Admin', icon: Crown, description: 'Platform management, tenants & subscriptions', color: 'from-amber-500 to-amber-600', badge: 'SaaS' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'HR overview, stats & quick actions', color: 'from-emerald-500 to-emerald-600' },
  { key: 'company-management', label: 'Company Management', icon: Building2, description: 'Branches, departments, designations & policies', color: 'from-teal-500 to-teal-600' },
  { key: 'employees', label: 'Employees', icon: Users, description: 'Directory, org chart & employee lifecycle', color: 'from-cyan-500 to-cyan-600' },
  { key: 'recruitment', label: 'Recruitment', icon: Briefcase, description: 'Requisitions, job postings & offers', color: 'from-teal-500 to-teal-600', badge: 'AI' },
  { key: 'job-portal', label: 'Job Portal', icon: Globe, description: 'Public jobs, applications & registration', color: 'from-green-500 to-green-600' },
  { key: 'ai-interview', label: 'AI Interview', icon: Sparkles, description: 'AI-powered interview sessions & scoring', color: 'from-teal-500 to-teal-600', badge: 'AI' },
  { key: 'onboarding', label: 'Onboarding', icon: UserPlus, description: 'Pre-boarding, checklist & induction', color: 'from-green-500 to-green-600' },
  { key: 'attendance', label: 'Attendance', icon: Clock, description: 'Mark attendance, shifts & regularization', color: 'from-teal-500 to-teal-600' },
  { key: 'leave', label: 'Leave Management', icon: CalendarDays, description: 'Leave requests, balance & calendar', color: 'from-emerald-500 to-emerald-600' },
  { key: 'payroll', label: 'Payroll', icon: Banknote, description: 'Process payroll, structures & payslips', color: 'from-green-500 to-green-600' },
  { key: 'timesheet', label: 'Timesheet', icon: Clock, description: 'Time tracking & approval workflows', color: 'from-cyan-500 to-cyan-600' },
  { key: 'projects', label: 'Projects', icon: FolderKanban, description: 'Project list, kanban board & milestones', color: 'from-emerald-500 to-emerald-600' },
  { key: 'performance', label: 'Performance', icon: TrendingUp, description: 'Reviews, goals & feedback cycles', color: 'from-amber-500 to-amber-600' },
  { key: 'training', label: 'Training', icon: GraduationCap, description: 'Courses, learning paths & certifications', color: 'from-green-500 to-green-600' },
  { key: 'exit', label: 'Exit Management', icon: LogOut, description: 'Resignations, clearance & FNF settlement', color: 'from-red-500 to-red-600' },
  { key: 'clients', label: 'Clients', icon: Building2, description: 'Client list, tickets & service requests', color: 'from-teal-500 to-teal-600' },
  { key: 'vendors', label: 'Vendors', icon: Users, description: 'Vendor management & invoices', color: 'from-orange-500 to-orange-600' },
  { key: 'subvendors', label: 'Sub-Vendors', icon: UsersRound, description: 'Sub-vendor mapping & assignments', color: 'from-rose-500 to-rose-600' },
  { key: 'helpdesk', label: 'Helpdesk', icon: Headphones, description: 'HR & IT helpdesk, knowledge base', color: 'from-sky-500 to-sky-600' },
  { key: 'ai-chatbot', label: 'AI Chatbot', icon: Sparkles, description: 'AI-powered HR assistant & chat', color: 'from-teal-500 to-teal-600', badge: 'AI' },
  { key: 'workflows', label: 'Workflows', icon: GitBranch, description: 'Builder, active flows & templates', color: 'from-fuchsia-500 to-fuchsia-600' },
  { key: 'audit', label: 'Audit & Compliance', icon: Shield, description: 'Audit logs, compliance & data security', color: 'from-slate-500 to-slate-600' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, description: 'HR analytics, reports & exports', color: 'from-emerald-500 to-emerald-600' },
  { key: 'selfservice', label: 'Self-Service', icon: MessageSquare, description: 'My profile, leaves, payslips & requests', color: 'from-teal-500 to-teal-600' },
  { key: 'profile', label: 'My Profile', icon: UserCircle, description: 'Personal info, employment & documents', color: 'from-cyan-500 to-cyan-600' },
  { key: 'settings', label: 'Settings', icon: Settings, description: 'General, notifications & integrations', color: 'from-slate-500 to-slate-600' },
]

export default function ModuleHome() {
  const { selectModule, selectModuleWithSubItem } = useHRMSStore()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return allModules
    const q = searchQuery.toLowerCase()
    return allModules.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const handleModuleClick = (mod: ModuleCard) => {
    selectModule(mod.key)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-400" />
            3Boxes HRMS Modules
          </h1>
          <p className="text-slate-400 mt-1">Navigate to any module from here. Click a card to open.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-slate-300 placeholder:text-slate-500 h-9 text-sm focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Module cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredModules.map(mod => {
          const Icon = mod.icon
          return (
            <Card
              key={mod.key}
              className="bg-slate-900 border-slate-800 hover:border-emerald-500/30 cursor-pointer transition-all hover:shadow-lg hover:shadow-emerald-500/5 group"
              onClick={() => handleModuleClick(mod)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${mod.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {mod.badge && (
                    <Badge className="bg-emerald-600/20 text-emerald-400 text-[9px] border-emerald-500/30">{mod.badge}</Badge>
                  )}
                </div>
                <h3 className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">{mod.label}</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{mod.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredModules.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No modules found</p>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search query</p>
        </div>
      )}
    </div>
  )
}
