'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiChevronRight } from 'react-icons/fi';

export interface DashboardTabConfig {
  label: string;
  key: string;
  icon: React.ReactNode;
  isNew?: boolean;
}

interface ModuleDashboardShellProps {
  moduleKey: string;            // e.g., 'company', 'employee' — matches navSections key
  moduleLabel: string;          // e.g., 'Company', 'Employee'
  moduleIcon: React.ReactNode;  // icon for the header
  gradientColor: string;        // e.g., 'from-emerald-500 to-green-600'
  tabs: DashboardTabConfig[];
  children: Record<string, ReactNode>;  // keyed by tab key
  overviewContent?: ReactNode;  // default/overview tab content
}

export default function ModuleDashboardShell({
  moduleKey,
  moduleLabel,
  moduleIcon,
  gradientColor,
  tabs,
  children,
  overviewContent,
}: ModuleDashboardShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get('tab');

  // Find the active tab
  const [activeTab, setActiveTab] = useState<string>(
    tabFromUrl && tabs.some(t => t.key === tabFromUrl) ? tabFromUrl : (tabs[0]?.key || 'overview')
  );

  // Sync with URL
  useEffect(() => {
    if (tabFromUrl && tabs.some(t => t.key === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, tabs]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  // Render the active tab's content
  const renderContent = () => {
    if (activeTab === 'overview' && overviewContent) {
      return overviewContent;
    }
    if (children[activeTab]) {
      return children[activeTab];
    }
    // Placeholder for tabs without content — provide navigation to dedicated pages
    const tabLabel = tabs.find(t => t.key === activeTab)?.label || activeTab;
    const tabKey = activeTab;
    // Build a link to the dedicated page if it's a reports or settings tab
    let navLink = '';
    if (tabKey === 'reports') navLink = `/${moduleKey === 'company' ? 'reports' : moduleKey === 'employee' ? 'employees/dashboard' : moduleKey}/reports`;
    else if (tabKey === 'settings') navLink = `/${moduleKey === 'company' ? 'settings' : moduleKey === 'employee' ? 'settings' : moduleKey === 'payroll' ? 'payroll/salary-settings' : moduleKey}/settings`;

    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientColor} flex items-center justify-center shadow-lg mb-4`}>
          {tabs.find(t => t.key === activeTab)?.icon || moduleIcon}
        </div>
        <h3 className="text-lg font-bold text-thb-text-primary mb-1">
          {tabLabel}
        </h3>
        <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
          {moduleLabel} {tabLabel} — view and manage {tabKey === 'reports' ? 'analytics and reports' : tabKey === 'settings' ? 'configuration and preferences' : 'details'}.
        </p>
        {navLink && (
          <a href={navLink} className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
            Go to {tabLabel}
          </a>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Module Header with Tabs */}
      <div className="mb-6">
        {/* Module Title Row */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center shadow-md`}>
            {moduleIcon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">{moduleLabel}</h1>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-thb-text-primary shadow-sm'
                    : 'text-thb-text-secondary hover:text-thb-text-primary hover:bg-white/50'
                }`}
              >
                <span className={isActive ? 'text-green-500' : 'text-thb-text-secondary'}>{tab.icon}</span>
                {tab.label}
                {tab.isNew && (
                  <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-100 text-emerald-600 border border-emerald-200">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}
