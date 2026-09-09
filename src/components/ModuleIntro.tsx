'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { FiChevronDown, FiChevronRight, FiInfo } from 'react-icons/fi';

/**
 * ModuleIntro
 *
 * Reusable "intro / opening section" header for module landing pages.
 * Implements the same minimized-by-default + hover-preview + click-to-pin
 * pattern as ModuleTips and ModuleWorkflow, to save vertical space across
 * the app while keeping SRS-aligned descriptions accessible on hover.
 *
 * Usage:
 *   <ModuleIntro
 *     title="Recruitment"
 *     subtitle="Manage job postings, applications, interviews, and offers"
 *     srsRef="REQ-ATS-01..12"
 *     icon={<FiBriefcase className="w-4 h-4" />}
 *     accent="violet"  // violet | blue | emerald | amber | rose | sky | indigo
 *   >
 *     <p>Detailed intro paragraphs...</p>
 *     <ul>...</ul>
 *   </ModuleIntro>
 *
 * Behavior:
 *   - Default: collapsed (shows only title + subtitle + SRS badge + chevron)
 *   - Hover: shows a preview popover with the children content
 *   - Click: pins expanded / collapsed state
 */

type AccentColor = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'sky' | 'indigo';

const ACCENTS: Record<AccentColor, { icon: string; badge: string; border: string }> = {
  violet:  { icon: 'bg-teal-100 text-teal-600',    badge: 'bg-teal-50 text-teal-700 border-teal-200',    border: 'hover:border-teal-300' },
  blue:    { icon: 'bg-green-100 text-green-600',        badge: 'bg-green-50 text-green-700 border-green-200',          border: 'hover:border-green-300' },
  emerald: { icon: 'bg-emerald-100 text-emerald-600',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'hover:border-emerald-300' },
  amber:   { icon: 'bg-amber-100 text-amber-600',      badge: 'bg-amber-50 text-amber-700 border-amber-200',       border: 'hover:border-amber-300' },
  rose:    { icon: 'bg-rose-100 text-rose-600',        badge: 'bg-rose-50 text-rose-700 border-rose-200',          border: 'hover:border-rose-300' },
  sky:     { icon: 'bg-sky-100 text-sky-600',          badge: 'bg-sky-50 text-sky-700 border-sky-200',             border: 'hover:border-sky-300' },
  indigo:  { icon: 'bg-emerald-100 text-emerald-600',    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',    border: 'hover:border-emerald-300' },
};

interface ModuleIntroProps {
  title: string;
  subtitle?: string;
  srsRef?: string;
  icon?: ReactNode;
  accent?: AccentColor;
  /** Optional quick stats to show in the collapsed header (e.g. "12 open · 5 in interview") */
  quickStats?: ReactNode;
  children?: ReactNode;
}

export default function ModuleIntro({
  title,
  subtitle,
  srsRef,
  icon,
  accent = 'violet',
  quickStats,
  children,
}: ModuleIntroProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (pinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHovering(true), 200);
  };
  const handleMouseLeave = () => {
    if (pinned) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHovering(false);
  };
  const handleClick = () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    setCollapsed(!newPinned);
    if (!newPinned) setHovering(false);
  };

  const colors = ACCENTS[accent] || ACCENTS.violet;
  const showPreview = hovering && collapsed && !pinned;
  const showFull = !collapsed || pinned;

  return (
    <div className="mb-4">
      {/* Collapsed header (always visible) */}
      <div
        className={`rounded-xl border border-slate-200 bg-white overflow-hidden cursor-pointer transition-all hover:shadow-sm ${colors.border}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="px-4 py-2.5 flex items-center gap-3">
          {icon && (
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colors.icon}`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {srsRef && (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${colors.badge}`}>
                  {srsRef}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {quickStats && (
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 flex-shrink-0">
              {quickStats}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-slate-400 hidden lg:inline">
              {pinned ? 'Click to collapse' : 'Hover to preview · click to expand'}
            </span>
            {pinned
              ? <FiChevronDown className="w-4 h-4 text-slate-500" />
              : <FiChevronRight className="w-4 h-4 text-slate-500" />}
          </div>
        </div>
      </div>

      {/* Hover-preview popover */}
      {showPreview && children && (
        <div
          className="mt-1 rounded-xl border border-slate-200 bg-white shadow-lg p-4 z-30 relative max-h-80 overflow-y-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-xs text-slate-600 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      )}

      {/* Full expanded view (pinned) */}
      {showFull && children && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <FiInfo className="w-3.5 h-3.5 text-slate-400" />
            <span>Module overview · click the header to collapse</span>
          </div>
          <div className="px-5 py-4 text-sm text-slate-700 leading-relaxed space-y-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
