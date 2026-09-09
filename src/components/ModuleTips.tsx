'use client';

import { useState, useCallback, useSyncExternalStore, useMemo, type ReactNode } from 'react';
import { FiZap, FiX, FiChevronDown, FiChevronRight, FiEye } from 'react-icons/fi';
import { getTipsForRole } from '@/lib/roleTips';

interface Tip {
  title: string;
  description: string;
}

interface ModuleTipsProps {
  moduleKey: string;
  title?: string;
  tips?: Tip[];
  userRole?: string; // optional role for filtering
  /**
   * Optional inline content. Rendered as a fallback when no `tips` prop is
   * supplied AND no role-tips are available. Used by OKRs / Invoices pages
   * to inject a single descriptive paragraph instead of a tip list.
   */
  children?: ReactNode;
}

const emptySubscribe = () => () => {};

function getStoredDismissed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * ModuleTips — always starts in a MINIMIZED state.
 *
 * UX contract (per user request):
 *  1. The panel is collapsed by default on every page load.
 *  2. Hovering over the collapsed bar reveals a floating preview popover
 *     with the tip contents — no click required. The preview disappears
 *     when the cursor leaves.
 *  3. Clicking the expand toggle pins the panel open so the content stays
 *     visible persistently. Clicking again collapses it back.
 *  4. The dismiss (X) button hides the panel entirely until the user
 *     clicks "Show Tips" to bring it back.
 */
export default function ModuleTips({ moduleKey, title = 'Tips', tips, userRole, children }: ModuleTipsProps) {
  const storageKey = `3boxes_tips_dismissed_${moduleKey}`;
  // Always default to collapsed (minimized) per global UX requirement.
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);

  // Use useSyncExternalStore for mounted state to avoid useEffect setState
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [dismissed, setDismissed] = useState(() => getStoredDismissed(storageKey));

  // Compute the effective tips based on role filtering
  // HARDENED: never return undefined — both `tips` prop and `getTipsForRole` result
  // can be undefined when callers omit the `tips` prop and moduleKey is not in
  // roleTipsConfig (e.g. 'okrs', 'invoices'). Previously crashed with
  // 'Cannot read properties of undefined (reading "length")' on those pages.
  const effectiveTips = useMemo<Tip[]>(() => {
    if (userRole) {
      try {
        const roleTips = getTipsForRole(moduleKey, userRole);
        if (Array.isArray(roleTips) && roleTips.length > 0) {
          return roleTips;
        }
      } catch {
        /* ignore — fall through to tips prop */
      }
    }
    return Array.isArray(tips) ? tips : [];
  }, [moduleKey, userRole, tips]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, 'true'); } catch { /* ignore */ }
  }, [storageKey]);

  const handleShowTips = useCallback(() => {
    setDismissed(false);
    // Restored from dismissed → start minimized as per UX contract.
    setCollapsed(true);
    try { localStorage.setItem(storageKey, 'false'); } catch { /* ignore */ }
  }, [storageKey]);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  if (!mounted) return null;

  // Nothing to show at all — bail out silently.
  if (effectiveTips.length === 0 && !children) return null;

  if (dismissed) {
    return (
      <button
        onClick={handleShowTips}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-gradient-to-r from-green-50 to-emerald-50 text-amber-700 text-xs font-medium hover:from-green-100 hover:to-emerald-100 transition-all duration-200 shadow-sm"
      >
        <FiZap className="w-3.5 h-3.5" />
        Show Tips
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
      <div className="thb-card overflow-hidden border border-green-100 shadow-sm">
        {/* Header — always visible. Acts as the minimized bar AND the expanded header. */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="flex items-center gap-2 text-left flex-1 min-w-0 group"
            title={collapsed ? 'Click to expand · hover to preview' : 'Click to collapse'}
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FiZap className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-thb-text-primary truncate">{title}</h3>
            <span className="text-[10px] font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              {effectiveTips.length > 0 ? `${effectiveTips.length} tips` : 'Info'}
            </span>
            {collapsed && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 ml-1">
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
              title="Dismiss tips"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded content — persistent when user clicks to expand */}
        {!collapsed && (
          <div className="p-4 bg-gradient-to-b from-green-50/50 to-emerald-50/30">
            {effectiveTips.length > 0 ? (
              <div className="space-y-3">
                {effectiveTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-thb-text-primary">{tip.title}</p>
                      <p className="text-xs text-thb-text-secondary mt-0.5 leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : children ? (
              <div className="text-sm text-thb-text-secondary leading-relaxed">
                {children}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Hover preview popover — only when minimized and hovered */}
      {showPreview && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1"
          role="tooltip"
        >
          <div className="thb-card border border-green-200 shadow-xl rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200 flex items-center gap-2">
              <FiEye className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">Preview · click to pin open</span>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-gradient-to-b from-green-50/60 to-emerald-50/40">
              {effectiveTips.length > 0 ? (
                <div className="space-y-3">
                  {effectiveTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-thb-text-primary">{tip.title}</p>
                        <p className="text-xs text-thb-text-secondary mt-0.5 leading-relaxed">{tip.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : children ? (
                <div className="text-sm text-thb-text-secondary leading-relaxed">
                  {children}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
