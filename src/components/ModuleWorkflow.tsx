'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiInfo,
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiCheck,
  FiArrowRight,
  FiEye,
} from 'react-icons/fi';
import { getWorkflowForRole } from '@/lib/roleTips';

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  route?: string;
}

interface ModuleWorkflowProps {
  moduleKey: string;
  title: string;
  subtitle?: string;
  steps: WorkflowStep[];
  accentColor?: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'cyan';
  completedSteps?: Set<number>;
  userRole?: string;
}

const emptySubscribe = () => () => {};

const accentColorMap = {
  emerald: {
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
    headerBorder: 'border-emerald-100',
    headerIconBg: 'bg-emerald-100',
    headerIconColor: 'text-emerald-600',
    badgeBg: 'text-emerald-700 bg-emerald-100',
    infoBannerBg: 'bg-emerald-50 border-emerald-100',
    infoBannerText: 'text-emerald-700',
    completeBg: 'bg-emerald-500',
    completeShadow: 'shadow-emerald-500/25',
    completeText: 'text-emerald-600',
    arrowColor: 'text-emerald-400',
    lineColor: 'bg-emerald-300',
    previewBorder: 'border-emerald-200',
    previewHeader: 'from-emerald-100 to-teal-100 text-emerald-700',
  },
  blue: {
    headerBg: 'bg-gradient-to-r from-green-50 to-emerald-50',
    headerBorder: 'border-green-100',
    headerIconBg: 'bg-green-100',
    headerIconColor: 'text-green-600',
    badgeBg: 'text-green-700 bg-green-100',
    infoBannerBg: 'bg-green-50 border-green-100',
    infoBannerText: 'text-green-700',
    completeBg: 'bg-green-500',
    completeShadow: 'shadow-green-500/25',
    completeText: 'text-green-600',
    arrowColor: 'text-green-400',
    lineColor: 'bg-green-300',
    previewBorder: 'border-green-200',
    previewHeader: 'from-green-100 to-emerald-100 text-green-700',
  },
  violet: {
    headerBg: 'bg-gradient-to-r from-teal-50 to-teal-50',
    headerBorder: 'border-teal-100',
    headerIconBg: 'bg-teal-100',
    headerIconColor: 'text-teal-600',
    badgeBg: 'text-teal-700 bg-teal-100',
    infoBannerBg: 'bg-teal-50 border-teal-100',
    infoBannerText: 'text-teal-700',
    completeBg: 'bg-teal-500',
    completeShadow: 'shadow-teal-500/25',
    completeText: 'text-teal-600',
    arrowColor: 'text-teal-400',
    lineColor: 'bg-teal-300',
    previewBorder: 'border-teal-200',
    previewHeader: 'from-teal-100 to-teal-100 text-teal-700',
  },
  amber: {
    headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50',
    headerBorder: 'border-amber-100',
    headerIconBg: 'bg-amber-100',
    headerIconColor: 'text-amber-600',
    badgeBg: 'text-amber-700 bg-amber-100',
    infoBannerBg: 'bg-amber-50 border-amber-100',
    infoBannerText: 'text-amber-700',
    completeBg: 'bg-amber-500',
    completeShadow: 'shadow-amber-500/25',
    completeText: 'text-amber-600',
    arrowColor: 'text-amber-400',
    lineColor: 'bg-amber-300',
    previewBorder: 'border-amber-200',
    previewHeader: 'from-amber-100 to-orange-100 text-amber-700',
  },
  rose: {
    headerBg: 'bg-gradient-to-r from-rose-50 to-pink-50',
    headerBorder: 'border-rose-100',
    headerIconBg: 'bg-rose-100',
    headerIconColor: 'text-rose-600',
    badgeBg: 'text-rose-700 bg-rose-100',
    infoBannerBg: 'bg-rose-50 border-rose-100',
    infoBannerText: 'text-rose-700',
    completeBg: 'bg-rose-500',
    completeShadow: 'shadow-rose-500/25',
    completeText: 'text-rose-600',
    arrowColor: 'text-rose-400',
    lineColor: 'bg-rose-300',
    previewBorder: 'border-rose-200',
    previewHeader: 'from-rose-100 to-pink-100 text-rose-700',
  },
  cyan: {
    headerBg: 'bg-gradient-to-r from-cyan-50 to-sky-50',
    headerBorder: 'border-cyan-100',
    headerIconBg: 'bg-cyan-100',
    headerIconColor: 'text-cyan-600',
    badgeBg: 'text-cyan-700 bg-cyan-100',
    infoBannerBg: 'bg-cyan-50 border-cyan-100',
    infoBannerText: 'text-cyan-700',
    completeBg: 'bg-cyan-500',
    completeShadow: 'shadow-cyan-500/25',
    completeText: 'text-cyan-600',
    arrowColor: 'text-cyan-400',
    lineColor: 'bg-cyan-300',
    previewBorder: 'border-cyan-200',
    previewHeader: 'from-cyan-100 to-sky-100 text-cyan-700',
  },
};

/**
 * ModuleWorkflow — always starts in a MINIMIZED state.
 *
 * UX contract (per user request):
 *  1. The workflow panel is collapsed by default on every page load.
 *  2. Hovering over the collapsed bar reveals a floating preview popover
 *     with the step contents — no click required. The preview disappears
 *     when the cursor leaves.
 *  3. Clicking the expand toggle pins the panel open so the content stays
 *     visible persistently. Clicking again collapses it back.
 *  4. The dismiss (X) button hides the panel entirely until the user
 *     clicks "Show Workflow" to bring it back.
 */
export default function ModuleWorkflow({
  moduleKey,
  title,
  subtitle,
  steps,
  accentColor = 'emerald',
  completedSteps = new Set(),
  userRole,
}: ModuleWorkflowProps) {
  const router = useRouter();

  // Determine which steps to display based on userRole
  const roleFilteredSteps = userRole ? (getWorkflowForRole(moduleKey, userRole) || []) : [];
  const activeSteps = roleFilteredSteps.length > 0 ? roleFilteredSteps : (Array.isArray(steps) ? steps : []);

  const dismissKey = `3boxes_workflow_dismissed_${moduleKey}`;

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Always start minimized per global UX contract.
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(dismissKey) === 'true'; } catch { return false; }
  });

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, 'true'); } catch { /* ignore */ }
  }, [dismissKey]);

  const handleShowWorkflow = useCallback(() => {
    setDismissed(false);
    // Restored from dismissed → start minimized.
    setCollapsed(true);
    try { localStorage.setItem(dismissKey, 'false'); } catch { /* ignore */ }
  }, [dismissKey]);

  const handleNavigate = useCallback((route: string) => {
    router.push(route);
  }, [router]);

  if (!mounted) return null;

  // Nothing to render — bail silently.
  if (!activeSteps || activeSteps.length === 0) return null;

  const colors = accentColorMap[accentColor];
  const completedCount = activeSteps.filter(s => completedSteps.has(s.step)).length;

  const getStepStatus = (step: WorkflowStep): 'complete' | 'current' | 'pending' => {
    if (completedSteps.has(step.step)) return 'complete';
    const firstIncomplete = activeSteps.find(s => !completedSteps.has(s.step));
    if (firstIncomplete && firstIncomplete.step === step.step) return 'current';
    return 'pending';
  };

  if (dismissed) {
    return (
      <button
        onClick={handleShowWorkflow}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 text-xs font-medium hover:from-emerald-100 hover:to-teal-100 transition-all duration-200 shadow-sm"
      >
        <FiInfo className="w-3.5 h-3.5" />
        Show Workflow
      </button>
    );
  }

  const showPreview = collapsed && hovered;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="thb-card overflow-hidden border border-slate-100">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${colors.headerBg} border-b ${colors.headerBorder}`}>
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="flex items-center gap-3 text-left flex-1 min-w-0 group"
            title={collapsed ? 'Click to expand · hover to preview' : 'Click to collapse'}
          >
            <div className={`w-8 h-8 rounded-lg ${colors.headerIconBg} flex items-center justify-center flex-shrink-0`}>
              <FiInfo className={`w-4 h-4 ${colors.headerIconColor}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-thb-text-primary truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-thb-text-secondary mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <span className={`text-[10px] font-medium ${colors.badgeBg} px-2 py-0.5 rounded-full ml-2 whitespace-nowrap`}>
              {completedCount}/{activeSteps.length} complete
            </span>
            {collapsed && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] text-slate-400 ml-1">
                <FiEye className="w-3 h-3" /> hover to preview · click to expand
              </span>
            )}
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleToggleCollapse}
              className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-white/60 transition-colors"
              title={collapsed ? 'Expand' : 'Collapse'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4 rotate-90" />}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Dismiss workflow"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded body — persistent when pinned open */}
        {!collapsed && (
          <>
            {/* Info Banner */}
            {completedCount < activeSteps.length && (
              <div className={`mx-5 mt-4 px-4 py-3 rounded-lg ${colors.infoBannerBg} border flex items-center gap-3`}>
                <FiInfo className={`w-4 h-4 ${colors.infoBannerText} flex-shrink-0`} />
                <p className={`text-xs ${colors.infoBannerText}`}>
                  <span className="font-medium">Getting started?</span> Follow this step-by-step workflow to complete the process. Each step links to the relevant section.
                </p>
              </div>
            )}

            <div className="p-5">
              {/* Desktop: Horizontal scrollable */}
              <div className="hidden md:block">
                <div className="flex items-start gap-0 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-slate-50">
                  {activeSteps.map((step, index) => {
                    const status = getStepStatus(step);
                    const isClickable = !!step.route;
                    return (
                      <div key={step.step} className="flex items-start flex-shrink-0">
                        <button
                          onClick={() => isClickable && handleNavigate(step.route!)}
                          className={`flex flex-col items-center text-center w-28 group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                          title={`Step ${step.step}: ${step.title}`}
                          disabled={!isClickable}
                        >
                          {/* Step Circle */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 group-hover:scale-110 ${
                              status === 'complete'
                                ? `${colors.completeBg} text-white shadow-md ${colors.completeShadow}`
                                : status === 'current'
                                ? 'bg-green-500 text-white shadow-md shadow-green-500/25 ring-4 ring-green-100'
                                : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                            }`}
                          >
                            {status === 'complete' ? (
                              <FiCheck className="w-5 h-5" />
                            ) : (
                              step.step
                            )}
                          </div>
                          {/* Title */}
                          <p
                            className={`text-[11px] font-medium mt-2 leading-tight ${
                              status === 'complete'
                                ? colors.completeText
                                : status === 'current'
                                ? 'text-green-600'
                                : 'text-slate-400 group-hover:text-slate-500'
                            }`}
                          >
                            {step.title}
                          </p>
                          {/* Description */}
                          <p className="text-[9px] text-slate-400 mt-0.5 leading-tight line-clamp-2">
                            {step.description}
                          </p>
                        </button>
                        {/* Arrow connector */}
                        {index < activeSteps.length - 1 && (
                          <div className="flex items-center pt-3 px-1">
                            <FiArrowRight className={`w-4 h-4 flex-shrink-0 ${
                              status === 'complete' ? colors.arrowColor : 'text-slate-200'
                            }`} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile: Vertical layout */}
              <div className="md:hidden space-y-0">
                {activeSteps.map((step, index) => {
                  const status = getStepStatus(step);
                  const isClickable = !!step.route;
                  return (
                    <div key={step.step} className="flex items-start">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <button
                          onClick={() => isClickable && handleNavigate(step.route!)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                            status === 'complete'
                              ? `${colors.completeBg} text-white shadow-sm`
                              : status === 'current'
                              ? 'bg-green-500 text-white shadow-sm ring-2 ring-green-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                          disabled={!isClickable}
                        >
                          {status === 'complete' ? <FiCheck className="w-4 h-4" /> : step.step}
                        </button>
                        {index < activeSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${
                            status === 'complete' ? colors.lineColor : 'bg-slate-200'
                          }`} />
                        )}
                      </div>
                      {/* Step content */}
                      <button
                        onClick={() => isClickable && handleNavigate(step.route!)}
                        className="flex-1 ml-3 pb-3 text-left group"
                        disabled={!isClickable}
                      >
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-semibold ${
                              status === 'complete'
                                ? colors.completeText
                                : status === 'current'
                                ? 'text-green-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.title}
                          </p>
                          {status === 'current' && (
                            <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              Next Step
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-thb-text-muted mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className={`w-4 h-4 rounded-full ${colors.completeBg} flex items-center justify-center`}>
                    <FiCheck className="w-2.5 h-2.5 text-white" />
                  </span>
                  <span className="text-[10px] text-thb-text-muted">Complete</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">•</span>
                  </span>
                  <span className="text-[10px] text-thb-text-muted">Current Step</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-100" />
                  <span className="text-[10px] text-thb-text-muted">Pending</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hover preview popover — only when minimized and hovered */}
      {showPreview && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1"
          role="tooltip"
        >
          <div className={`thb-card border ${colors.previewBorder} shadow-xl rounded-xl overflow-hidden`}>
            <div className={`px-4 py-2 bg-gradient-to-r ${colors.previewHeader} border-b ${colors.previewBorder} flex items-center gap-2`}>
              <FiEye className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">Preview · click to pin open</span>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-white">
              {/* Vertical compact preview */}
              <div className="space-y-0">
                {activeSteps.map((step, index) => {
                  const status = getStepStatus(step);
                  const isClickable = !!step.route;
                  return (
                    <div key={step.step} className="flex items-start">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            status === 'complete'
                              ? `${colors.completeBg} text-white`
                              : status === 'current'
                              ? 'bg-green-500 text-white ring-2 ring-green-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {status === 'complete' ? <FiCheck className="w-3 h-3" /> : step.step}
                        </div>
                        {index < activeSteps.length - 1 && (
                          <div className={`w-0.5 h-6 ${status === 'complete' ? colors.lineColor : 'bg-slate-200'}`} />
                        )}
                      </div>
                      <div className="flex-1 ml-3 pb-2">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${
                            status === 'complete'
                              ? colors.completeText
                              : status === 'current'
                              ? 'text-green-600'
                              : 'text-slate-600'
                          }`}>
                            {step.title}
                          </p>
                          {status === 'current' && (
                            <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              Next
                            </span>
                          )}
                          {isClickable && (
                            <span className="text-[9px] text-slate-400">→ click to open</span>
                          )}
                        </div>
                        <p className="text-[11px] text-thb-text-muted mt-0.5 leading-relaxed line-clamp-2">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
