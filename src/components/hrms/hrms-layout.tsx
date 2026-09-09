'use client';

import React from 'react';
import { useAppStore } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Dashboard } from './dashboard';
import { Recruitment } from './recruitment';
import { Employees } from './employees';
import { Attendance } from './attendance';
import { Leave } from './leave';
import { Payroll } from './payroll';
import { Performance } from './performance';
import { Learning } from './learning';
import { Engagement } from './engagement';
import { TravelExpense } from './travel-expense';
import { Assets } from './assets';
import { Helpdesk } from './helpdesk';
import { Compliance } from './compliance';
import { Workflow } from './workflow';
import { Analytics } from './analytics';
import { ClientPortal } from './client-portal';
import { VendorPortal } from './vendor-portal';
import { SubVendorPortal } from './sub-vendor-portal';
import { JobPortal } from './job-portal';
import { AIInterview } from './ai-interview';
import { AIChatbot } from './ai-chatbot';
import { Alumni } from './alumni';
import { Companies } from './companies';
import { Settings } from './settings';
import { Onboarding } from './onboarding';
import { HelpTraining } from './help-training';
import { TrialRequests } from './trial-requests';

const MODULE_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  recruitment: Recruitment,
  employees: Employees,
  attendance: Attendance,
  leave: Leave,
  payroll: Payroll,
  performance: Performance,
  learning: Learning,
  engagement: Engagement,
  travel_expense: TravelExpense,
  assets: Assets,
  helpdesk: Helpdesk,
  compliance: Compliance,
  workflow: Workflow,
  analytics: Analytics,
  client_portal: ClientPortal,
  vendor_portal: VendorPortal,
  sub_vendor_portal: SubVendorPortal,
  job_portal: JobPortal,
  ai_interview: AIInterview,
  ai_chatbot: AIChatbot,
  alumni: Alumni,
  companies: Companies,
  settings: Settings,
  onboarding: Onboarding,
  help_training: HelpTraining,
  trial_requests: TrialRequests,
};

// Per-module error boundary so one crashing module doesn't take down the whole app
interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  moduleName: string;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModuleErrorBoundary extends React.Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Module "${this.props.moduleName}" error:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-destructive">Module Error</h3>
            <p className="text-sm text-muted-foreground">
              The {this.props.moduleName} module encountered an error.
            </p>
            {this.state.error && (
              <details className="text-left bg-muted p-3 rounded-md text-xs text-muted-foreground max-w-md mx-auto">
                <summary className="cursor-pointer font-medium">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function HRMSLayout() {
  const { activeModule, sidebarCollapsed, darkMode } = useAppStore();

  const ActiveComponent = MODULE_COMPONENTS[activeModule] || Dashboard;

  return (
    <div className={cn('min-h-screen bg-background', darkMode && 'dark')}>
      <Sidebar />
      <div className={cn(
        'transition-all duration-300',
        sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
      )}>
        <Header />
        <main className="p-4 md:p-6">
          <ModuleErrorBoundary moduleName={activeModule}>
            <ActiveComponent />
          </ModuleErrorBoundary>
        </main>
      </div>
    </div>
  );
}
