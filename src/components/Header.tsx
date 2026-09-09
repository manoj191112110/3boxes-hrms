'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiMenu,
  FiSearch,
  FiBell,
  FiUser,
  FiSettings,
  FiLogOut,
  FiCheck,
  FiCheckCircle,
  FiInfo,
  FiAlertTriangle,
  FiAlertCircle,
} from 'react-icons/fi';
import { HiShieldCheck } from 'react-icons/hi';
import type { Notification } from '@/store/notificationStore';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { sanitizeSearch } from '@/lib/validators';
import CompanySwitcher from '@/components/CompanySwitcher';
import LocaleSwitcher from '@/components/LocaleSwitcher';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'success':
      return <FiCheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'warning':
      return <FiAlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'error':
      return <FiAlertCircle className="w-4 h-4 text-red-500" />;
    case 'login':
    case 'logout':
      return <HiShieldCheck className="w-4 h-4 text-teal-500" />;
    case 'workflow':
      return <FiInfo className="w-4 h-4 text-orange-500" />;
    default:
      return <FiInfo className="w-4 h-4 text-green-500" />;
  }
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface HeaderProps {
  onSidebarToggle: () => void;
}

const MODULE_SEARCH_MAP: Record<string, string> = {
  // ── Company Module ──
  company: '/company',
  'company-dashboard': '/company',
  companies: '/company/companies',
  branches: '/company/branches',
  branch: '/company/branches',
  departments: '/company/departments',
  department: '/company/departments',
  designations: '/company/designations',
  designation: '/company/designations',
  grades: '/company/grades',
  grade: '/company/grades',
  shifts: '/attendance/shifts',
  shift: '/attendance/shifts',
  holidays: '/attendance/holidays',
  holiday: '/attendance/holidays',
  policies: '/leave/leave-policy',
  policy: '/leave/leave-policy',
  'company-reports': '/company/reports',

  // ── Employee Module ──
  employees: '/employees',
  employee: '/employees',
  'employee-dashboard': '/employees/dashboard',
  'add-employee': '/employees/add',
  probation: '/employees/probation',
  transfer: '/employees/transfer',
  resignation: '/employees/resignation',
  termination: '/employees/termination',

  // ── Leave Module ──
  leave: '/leave',
  'apply-leave': '/leave/apply',
  'apply-leave-by-hr': '/leave/apply-by-hr',
  'leave-by-hr': '/leave/apply-by-hr',

  // ── Payroll Module ──
  payroll: '/payroll',

  // ── Attendance Module ──
  attendance: '/attendance',
  'apply-attendance-by-hr': '/attendance/apply-by-hr',
  'attendance-by-hr': '/attendance/apply-by-hr',
  regularize: '/attendance/regularize',
  'gatepass': '/attendance/gatepass',
  overtime: '/attendance/overtime',
  'comp-off': '/attendance/comp-off',
  'wfh': '/attendance/wfh',
  permission: '/attendance/permission',

  // ── Recruitment Module ──
  recruitment: '/recruitment',

  // ── Helpdesk Module ──
  helpdesk: '/helpdesk',

  // ── Other Modules ──
  settings: '/settings',
  reports: '/reports',
  performance: '/performance',
  'performance-appraisal': '/performance',
  appraisal: '/performance',
  training: '/training',
  assets: '/assets',
  projects: '/projects',
  project: '/projects',
  expenses: '/expenses',
  'travel-expense': '/expenses',
  travel: '/travel',
  onboarding: '/onboarding',
  preboarding: '/onboarding',
  offboarding: '/separation',
  separation: '/separation',
  exit: '/separation',
  timesheets: '/timesheets',
  timesheet: '/timesheets',
  dashboard: '/dashboard',
  home: '/home',
  analytics: '/analytics',
  compliance: '/governance',
  governance: '/governance',
  profile: '/my-profile',
  'my-profile': '/my-profile',
  myprofile: '/my-profile',
  roles: '/settings',
  'roles-access': '/settings',
  modules: '/modules',
  'audit-logs': '/super-admin/audit-logs',
  audit: '/super-admin/audit-logs',
  notifications: '/notifications',
  calendar: '/calendar',
  documents: '/documents',
  docs: '/docs',
  okrs: '/okrs',
  engagement: '/engagement',
  vendors: '/vendors',
  clients: '/clients',
  accounts: '/accounts',
  crm: '/crm',
  invoices: '/invoices',
  offers: '/offers',
  requisitions: '/requisitions',
  workflows: '/workflows',
  subscriptions: '/super-admin/subscriptions',
  packages: '/super-admin/packages',
  'feature-flags': '/super-admin/feature-flags',
  'sso-providers': '/super-admin/sso-providers',
  rbac: '/super-admin/rbac',
  support: '/helpdesk',
  collaboration: '/collaboration',
  knowledge: '/knowledge',
  marketplace: '/marketplace',
};

export default function Header({ onSidebarToggle }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Compute search suggestions based on query
  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const matches: { key: string; route: string }[] = [];
    const seenRoutes = new Set<string>();
    for (const [key, route] of Object.entries(MODULE_SEARCH_MAP)) {
      if (key === query || key.startsWith(query) || key.includes(query)) {
        if (!seenRoutes.has(route)) {
          seenRoutes.add(route);
          matches.push({ key, route });
        }
      }
      if (matches.length >= 8) break; // max 8 suggestions
    }
    return matches;
  }, [searchQuery]);

  const handleSearchSelect = useCallback((route: string) => {
    router.push(route);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setActiveSuggestionIndex(-1);
  }, [router]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Sidebar Toggle */}
      <button
        onClick={onSidebarToggle}
        className="p-2 rounded-lg text-thb-text-secondary hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
        title="Toggle sidebar"
      >
        <FiMenu className="w-5 h-5" />
      </button>

      {/* 3Boxes Logo + Name in Header */}
      <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-sm shadow-green-500/20">
          <svg viewBox="0 0 35 11" className="w-5 h-3.5" fill="none">
            <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
          </svg>
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-extrabold text-slate-800 tracking-tight">3Boxes</span>
          <span className="text-[10px] font-bold text-green-500 ml-1 tracking-wider">HRMS</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl relative" ref={searchRef}>
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 z-10" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(sanitizeSearch(e.target.value));
            setShowSearchDropdown(true);
            setActiveSuggestionIndex(-1);
          }}
          onFocus={() => {
            if (searchQuery.trim()) setShowSearchDropdown(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && searchSuggestions.length > 0) {
              e.preventDefault();
              setActiveSuggestionIndex((prev) =>
                prev < searchSuggestions.length - 1 ? prev + 1 : 0
              );
            } else if (e.key === 'ArrowUp' && searchSuggestions.length > 0) {
              e.preventDefault();
              setActiveSuggestionIndex((prev) =>
                prev > 0 ? prev - 1 : searchSuggestions.length - 1
              );
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (activeSuggestionIndex >= 0 && searchSuggestions[activeSuggestionIndex]) {
                handleSearchSelect(searchSuggestions[activeSuggestionIndex].route);
              } else {
                const query = searchQuery.trim().toLowerCase();
                if (!query) return;
                const route = MODULE_SEARCH_MAP[query];
                if (route) {
                  handleSearchSelect(route);
                } else {
                  const partialMatch = Object.keys(MODULE_SEARCH_MAP).find(
                    (key) => key.startsWith(query) || key.includes(query)
                  );
                  if (partialMatch) {
                    handleSearchSelect(MODULE_SEARCH_MAP[partialMatch]);
                  } else {
                    toast.error(`No module found for '${searchQuery.trim()}'`);
                  }
                }
              }
            } else if (e.key === 'Escape') {
              setShowSearchDropdown(false);
              setActiveSuggestionIndex(-1);
            }
          }}
          placeholder="Search modules, company, employees..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-green-200 bg-green-50/30 text-sm text-thb-text-primary placeholder:text-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:bg-white transition-all"
        />

        {/* Search Suggestions Dropdown */}
        {showSearchDropdown && searchSuggestions.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
            {searchSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.route + '-' + suggestion.key}
                onClick={() => handleSearchSelect(suggestion.route)}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  index === activeSuggestionIndex
                    ? 'bg-green-50 text-green-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FiSearch className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="capitalize truncate">{suggestion.key.replace(/-/g, ' ')}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-mono truncate max-w-[40%]">{suggestion.route}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Company Switcher */}
      <CompanySwitcher />

      {/* Locale Switcher (i18n — REQ-REC-06, REQ-ONB-03, REQ-PER-03, REQ-EXIT-05) */}
      <LocaleSwitcher />

      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-thb-text-secondary hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
          >
            <FiBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 thb-card shadow-xl animate-slide-in-down overflow-hidden z-50">
              <div className="flex items-center justify-between p-4 border-b border-thb-border">
                <h3 className="font-semibold text-thb-text-primary">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      await markAllAsRead();
                      toast.success('All notifications marked as read');
                    }}
                    className="text-xs text-green-500 hover:text-green-700 font-medium flex items-center gap-1"
                  >
                    <FiCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <FiBell className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
                    <p className="text-sm text-thb-text-muted">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif: Notification) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 p-4 border-b border-thb-border/50 hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notif.isRead ? 'bg-green-50/30' : ''
                      }`}
                      onClick={async () => {
                        if (!notif.isRead) {
                          await markAsRead(notif.id);
                        }
                        if (notif.link) {
                          window.location.href = notif.link;
                        }
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${!notif.isRead ? 'font-semibold text-thb-text-primary' : 'font-medium text-thb-text-secondary'}`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-thb-text-muted mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-thb-text-muted mt-1">
                          {formatTimeAgo(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/notifications"
                onClick={() => setShowNotifications(false)}
                className="block text-center py-3 text-sm font-medium text-green-500 hover:text-green-700 hover:bg-slate-50 border-t border-thb-border transition-colors"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user?.name ? getInitials(user.name) : '??'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-thb-text-primary leading-tight">{user?.name}</p>
              <p className="text-[10px] text-thb-text-muted capitalize leading-tight">{user?.role?.replace('_', ' ')}</p>
            </div>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 thb-card shadow-xl animate-slide-in-down overflow-hidden py-1 z-50">
              <div className="px-4 py-3 border-b border-thb-border">
                <p className="text-sm font-semibold text-thb-text-primary">{user?.name}</p>
                <p className="text-xs text-thb-text-muted mt-0.5">{user?.email}</p>
              </div>
              <Link
                href="/my-profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors"
              >
                <FiUser className="w-4 h-4" />
                My Profile
              </Link>
              {['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '') && (
              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors"
              >
                <FiSettings className="w-4 h-4" />
                Settings
              </Link>
              )}
              <div className="border-t border-thb-border my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors w-full"
              >
                <FiLogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
