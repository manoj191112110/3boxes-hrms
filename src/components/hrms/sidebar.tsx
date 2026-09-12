'use client';

import React from 'react';
import { useAppStore } from '@/store/app-store';
import type { ModuleKey, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, Users, UserPlus, Briefcase, Globe, Bot,
  Clock, CalendarDays, DollarSign, TrendingUp, GraduationCap,
  Heart, Headphones, Plane, Monitor, ShieldCheck, WorkflowIcon,
  Building2, Truck, UserCog, BarChart3, MessageSquare, UserMinus,
  Building, ClipboardList, Settings, ChevronLeft, ChevronRight,
  Hexagon, BookOpen, Video, FileText, Zap
} from 'lucide-react';

interface NavSection {
  label: string;
  items: { key: ModuleKey; label: string; icon: React.ReactNode; badge?: number }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'OVERVIEW',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { key: 'employees', label: 'Employees', icon: <Users className="h-4 w-4" /> },
      { key: 'onboarding', label: 'Onboarding', icon: <UserPlus className="h-4 w-4" />, badge: 3 },
    ],
  },
  {
    label: 'RECRUITMENT',
    items: [
      { key: 'recruitment', label: 'Recruitment (ATS)', icon: <Briefcase className="h-4 w-4" />, badge: 12 },
      { key: 'job_portal', label: 'Job Portal', icon: <Globe className="h-4 w-4" /> },
      { key: 'ai_interview', label: 'AI Interview', icon: <Bot className="h-4 w-4" /> },
    ],
  },
  {
    label: 'TIME',
    items: [
      { key: 'attendance', label: 'Attendance', icon: <Clock className="h-4 w-4" /> },
      { key: 'leave', label: 'Leave', icon: <CalendarDays className="h-4 w-4" />, badge: 5 },
    ],
  },
  {
    label: 'COMPENSATION',
    items: [
      { key: 'payroll', label: 'Payroll', icon: <DollarSign className="h-4 w-4" /> },
    ],
  },
  {
    label: 'GROWTH',
    items: [
      { key: 'performance', label: 'Performance', icon: <TrendingUp className="h-4 w-4" /> },
      { key: 'learning', label: 'Learning', icon: <GraduationCap className="h-4 w-4" /> },
    ],
  },
  {
    label: 'ENGAGEMENT',
    items: [
      { key: 'engagement', label: 'Engagement', icon: <Heart className="h-4 w-4" /> },
      { key: 'helpdesk', label: 'Helpdesk', icon: <Headphones className="h-4 w-4" />, badge: 8 },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { key: 'travel_expense', label: 'Travel & Expense', icon: <Plane className="h-4 w-4" /> },
      { key: 'assets', label: 'Assets', icon: <Monitor className="h-4 w-4" /> },
      { key: 'compliance', label: 'Compliance', icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: 'AUTOMATION',
    items: [
      { key: 'workflow', label: 'Workflow Builder', icon: <WorkflowIcon className="h-4 w-4" /> },
    ],
  },
  {
    label: 'ECOSYSTEM',
    items: [
      { key: 'client_portal', label: 'Client Portal', icon: <Building2 className="h-4 w-4" /> },
      { key: 'vendor_portal', label: 'Vendor Portal', icon: <Truck className="h-4 w-4" /> },
      { key: 'sub_vendor_portal', label: 'Sub-Vendor Portal', icon: <UserCog className="h-4 w-4" /> },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    label: 'AI',
    items: [
      { key: 'ai_chatbot', label: 'AI Chatbot', icon: <MessageSquare className="h-4 w-4" /> },
    ],
  },
  {
    label: 'ALUMNI',
    items: [
      { key: 'alumni', label: 'Alumni', icon: <UserMinus className="h-4 w-4" /> },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { key: 'companies', label: 'Companies', icon: <Building className="h-4 w-4" /> },
      { key: 'trial_requests', label: 'Trial Requests', icon: <Zap className="h-4 w-4" /> },
      { key: 'audit_logs', label: 'Audit Logs', icon: <ClipboardList className="h-4 w-4" /> },
      { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    ],
  },
  {
    label: 'HELP & TRAINING',
    items: [
      { key: 'help_training', label: 'Help & Training', icon: <BookOpen className="h-4 w-4" /> },
    ],
  },
];

const ROLE_VISIBILITY: Record<UserRole, ModuleKey[]> = {
  super_admin: NAV_SECTIONS.flatMap(s => s.items.map(i => i.key)),
  company_hr_admin: ['dashboard', 'employees', 'onboarding', 'recruitment', 'job_portal', 'ai_interview', 'attendance', 'leave', 'payroll', 'performance', 'learning', 'engagement', 'helpdesk', 'travel_expense', 'assets', 'compliance', 'workflow', 'client_portal', 'vendor_portal', 'analytics', 'ai_chatbot', 'alumni', 'settings', 'help_training'],
  hr_executive: ['dashboard', 'employees', 'onboarding', 'recruitment', 'job_portal', 'ai_interview', 'attendance', 'leave', 'performance', 'learning', 'engagement', 'helpdesk', 'assets', 'compliance', 'analytics', 'ai_chatbot', 'alumni', 'settings', 'help_training'],
  dept_head: ['dashboard', 'employees', 'recruitment', 'attendance', 'leave', 'performance', 'learning', 'engagement', 'helpdesk', 'travel_expense', 'assets', 'analytics', 'ai_chatbot', 'settings', 'help_training'],
  reporting_manager: ['dashboard', 'employees', 'recruitment', 'attendance', 'leave', 'performance', 'learning', 'engagement', 'helpdesk', 'travel_expense', 'analytics', 'ai_chatbot', 'settings', 'help_training'],
  employee: ['dashboard', 'attendance', 'leave', 'payroll', 'performance', 'learning', 'engagement', 'helpdesk', 'travel_expense', 'assets', 'job_portal', 'ai_chatbot', 'settings', 'help_training'],
  finance: ['dashboard', 'employees', 'payroll', 'travel_expense', 'analytics', 'ai_chatbot', 'settings', 'help_training'],
  it_admin: ['dashboard', 'employees', 'assets', 'compliance', 'workflow', 'analytics', 'ai_chatbot', 'settings', 'help_training'],
  recruiter: ['dashboard', 'recruitment', 'job_portal', 'ai_interview', 'analytics', 'ai_chatbot', 'settings', 'help_training'],
  vendor: ['dashboard', 'vendor_portal', 'ai_chatbot', 'settings', 'help_training'],
  sub_vendor: ['dashboard', 'sub_vendor_portal', 'ai_chatbot', 'settings', 'help_training'],
  client: ['dashboard', 'client_portal', 'ai_chatbot', 'settings', 'help_training'],
  auditor: ['dashboard', 'analytics', 'compliance', 'ai_chatbot', 'settings', 'help_training'],
  job_seeker: ['dashboard', 'job_portal', 'ai_interview', 'ai_chatbot', 'settings', 'help_training'],
};

export function Sidebar() {
  const { activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen, userRole, currentCompany } = useAppStore();

  const visibleKeys = ROLE_VISIBILITY[userRole] || ['dashboard'];

  const filteredSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => visibleKeys.includes(item.key)),
  })).filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300 flex flex-col',
          sidebarCollapsed ? 'w-[68px]' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            {currentCompany?.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={currentCompany.logo} alt={currentCompany.name} className="w-9 h-9 rounded-lg object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shrink-0">
                <Hexagon className="h-5 w-5 text-white" />
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-sm tracking-tight whitespace-nowrap">3Boxes HRMS</h1>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">{currentCompany?.name || 'Enterprise'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2" style={{ overflow: 'hidden' }}>
          <nav className="px-2 space-y-1">
            {filteredSections.map((section) => (
              <div key={section.label} className="mb-2">
                {!sidebarCollapsed && (
                  <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground tracking-widest">
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = activeModule === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveModule(item.key);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        sidebarCollapsed && 'justify-center px-2'
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5 bg-emerald-100 text-emerald-700">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
                <Separator className="my-1 opacity-50" />
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-border shrink-0 hidden lg:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full justify-center"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="ml-2 text-xs">Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
