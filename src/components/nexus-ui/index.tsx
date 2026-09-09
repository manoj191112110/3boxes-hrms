'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react';
import {
  FiSearch,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiCheck,
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiPlus,
  FiDownload,
  FiTrash2,
  FiArrowRight,
  FiClock,
  FiFile,
  FiImage,
  FiFileText,
  FiArchive,
  FiTrendingUp,
  FiTrendingDown,
  FiLoader,
  FiSmile,
} from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { sanitizeSearch } from '@/lib/validators';

// ────────────────────────────────────────────────────────────────
// Shared Types & Color Maps
// ────────────────────────────────────────────────────────────────

type NexusColor = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan';

const colorMap: Record<
  NexusColor,
  { bg: string; text: string; border: string; light: string; glow: string; gradient: string }
> = {
  blue: {
    bg: 'bg-[#4F6BF6]',
    text: 'text-[#4F6BF6]',
    border: 'border-[#4F6BF6]/20',
    light: 'bg-[#EFF2FE]',
    glow: 'stat-glow-blue',
    gradient: 'from-[#4F6BF6] to-[#6B82F8]',
  },
  green: {
    bg: 'bg-[#10B981]',
    text: 'text-[#10B981]',
    border: 'border-[#10B981]/20',
    light: 'bg-[#ECFDF5]',
    glow: 'stat-glow-green',
    gradient: 'from-[#10B981] to-[#34D399]',
  },
  amber: {
    bg: 'bg-[#F59E0B]',
    text: 'text-[#F59E0B]',
    border: 'border-[#F59E0B]/20',
    light: 'bg-[#FFFBEB]',
    glow: 'stat-glow-amber',
    gradient: 'from-[#F59E0B] to-[#FBBF24]',
  },
  rose: {
    bg: 'bg-[#EF4444]',
    text: 'text-[#EF4444]',
    border: 'border-[#EF4444]/20',
    light: 'bg-[#FEF2F2]',
    glow: 'stat-glow-rose',
    gradient: 'from-[#EF4444] to-[#F87171]',
  },
  violet: {
    bg: 'bg-[#8B5CF6]',
    text: 'text-[#8B5CF6]',
    border: 'border-[#8B5CF6]/20',
    light: 'bg-[#F3EFFE]',
    glow: 'stat-glow-violet',
    gradient: 'from-[#8B5CF6] to-[#A78BFA]',
  },
  cyan: {
    bg: 'bg-[#06B6D4]',
    text: 'text-[#06B6D4]',
    border: 'border-[#06B6D4]/20',
    light: 'bg-[#ECFEFF]',
    glow: 'stat-glow-cyan',
    gradient: 'from-[#06B6D4] to-[#22D3EE]',
  },
};

const gradientPairs: Record<string, { from: string; to: string }> = {
  primary: { from: '#4F6BF6', to: '#8B5CF6' },
  warm: { from: '#F59E0B', to: '#EF4444' },
  cool: { from: '#06B6D4', to: '#4F6BF6' },
  success: { from: '#10B981', to: '#34D399' },
  violet: { from: '#8B5CF6', to: '#A78BFA' },
};

// ────────────────────────────────────────────────────────────────
// 1. ModuleHero
// ────────────────────────────────────────────────────────────────

export interface ModuleHeroStat {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export interface ModuleHeroProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  gradient?: { from: string; to: string };
  stats?: ModuleHeroStat[];
  primaryAction?: { label: string; onClick: () => void; icon?: ReactNode };
  secondaryAction?: { label: string; onClick: () => void; icon?: ReactNode };
  searchProps?: { value: string; onChange: (v: string) => void; placeholder?: string };
  className?: string;
}

export function ModuleHero({
  title,
  subtitle,
  icon,
  gradient = gradientPairs.primary,
  stats,
  primaryAction,
  secondaryAction,
  searchProps,
  className,
}: ModuleHeroProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--nexus-radius-xl)] p-6 md:p-8 text-white',
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
    >
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-white/80 text-sm mt-1">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {searchProps && (
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
                <input
                  type="text"
                  value={searchProps.value}
                  onChange={(e) => searchProps.onChange(e.target.value)}
                  placeholder={searchProps.placeholder || 'Search...'}
                  className="pl-9 pr-4 py-2 rounded-[var(--nexus-radius-md)] bg-white/15 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 w-48 md:w-64 transition-all"
                />
              </div>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="nexus-btn bg-white/15 backdrop-blur-sm text-white border border-white/20 hover:bg-white/25 text-sm"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </button>
            )}
            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                className="nexus-btn bg-white text-[#4F6BF6] font-semibold hover:bg-white/90 text-sm shadow-lg"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-[var(--nexus-radius-md)] p-3 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon && <span className="text-white/70">{stat.icon}</span>}
                  <span className="text-white/70 text-xs font-medium">{stat.label}</span>
                </div>
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 2. StatsStrip
// ────────────────────────────────────────────────────────────────

export interface StatsStripItem {
  label: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
  color?: NexusColor;
}

export interface StatsStripProps {
  stats: StatsStripItem[];
  className?: string;
}

export function StatsStrip({ stats, className }: StatsStripProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {stats.map((stat, i) => {
        const c = colorMap[stat.color || 'blue'];
        return (
          <div
            key={i}
            className={cn('nexus-card nexus-card-hover p-4', c.glow)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--nexus-text-secondary)] text-xs font-medium">
                {stat.label}
              </span>
              {stat.icon && (
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    c.light,
                    c.text
                  )}
                >
                  {stat.icon}
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[var(--nexus-text-primary)]">
                {stat.value}
              </span>
              {stat.change && (
                <span
                  className={cn(
                    'text-xs font-semibold mb-1',
                    stat.change.startsWith('+') || stat.change.startsWith('↑')
                      ? 'text-[#10B981]'
                      : stat.change.startsWith('-') || stat.change.startsWith('↓')
                        ? 'text-[#EF4444]'
                        : 'text-[var(--nexus-text-muted)]'
                  )}
                >
                  {stat.change}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 3. CounterStat
// ────────────────────────────────────────────────────────────────

export interface CounterStatProps {
  icon: ReactNode;
  label: string;
  value: number;
  change?: number;
  changeLabel?: string;
  color?: NexusColor;
  className?: string;
}

export function CounterStat({
  icon,
  label,
  value,
  change,
  changeLabel,
  color = 'blue',
  className,
}: CounterStatProps) {
  const c = colorMap[color];
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className={cn('nexus-card nexus-card-hover p-5', c.glow, className)}>
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            c.light,
            c.text
          )}
        >
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              isPositive ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'
            )}
          >
            {isPositive ? <FiTrendingUp className="w-3 h-3" /> : <FiTrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <AnimatedNumber value={value} className="text-3xl font-bold text-[var(--nexus-text-primary)]" />
      <p className="text-[var(--nexus-text-secondary)] text-sm mt-1">{label}</p>
      {changeLabel && (
        <p className="text-[var(--nexus-text-muted)] text-xs mt-0.5">{changeLabel}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 4. Card
// ────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: 'default' | 'glass' | 'elevated' | 'outline';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

export function Card({
  title,
  subtitle,
  icon,
  actions,
  children,
  variant = 'default',
  hoverable = false,
  padding = 'md',
  footer,
  className,
  ...rest
}: CardProps) {
  const variantClass = {
    default: 'nexus-card',
    glass: 'nexus-card-glass',
    elevated: 'nexus-card-elevated',
    outline: 'border border-[var(--nexus-border)] rounded-[var(--nexus-radius-lg)] bg-[var(--nexus-card-bg)]',
  }[variant];

  const paddingClass = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }[padding];

  return (
    <div
      className={cn(variantClass, hoverable && 'nexus-card-hover', paddingClass, className)}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="text-[var(--nexus-text-secondary)]">{icon}</span>
            )}
            <div>
              {title && (
                <h3 className="font-semibold text-[var(--nexus-text-primary)]">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-[var(--nexus-text-muted)] mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
      {footer && (
        <div className="mt-4 pt-4 border-t border-[var(--nexus-border)]">{footer}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 5. DataTable
// ────────────────────────────────────────────────────────────────

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

export function DataTable<T extends Record<string, unknown> = Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data found',
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(lower);
      })
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  return (
    <div className={cn('nexus-card overflow-hidden', className)}>
      {searchable && (
        <div className="p-4 border-b border-[var(--nexus-border)]">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--nexus-border)] bg-[var(--nexus-background)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-[var(--nexus-text-secondary)] uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-[var(--nexus-text-primary)]'
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <FiChevronUp className="w-3 h-3" />
                      ) : (
                        <FiChevronDown className="w-3 h-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  <p className="text-[var(--nexus-text-muted)] text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paged.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    'border-b border-[var(--nexus-border)] last:border-0 transition-colors hover:bg-[var(--nexus-primary-50)]',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row, ri) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm text-[var(--nexus-text-primary)]"
                    >
                      {col.render ? col.render(row, ri) : (row[col.key] as ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--nexus-border)]">
          <span className="text-xs text-[var(--nexus-text-muted)]">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-md hover:bg-[var(--nexus-primary-50)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--nexus-text-secondary)]"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[var(--nexus-text-secondary)] px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-md hover:bg-[var(--nexus-primary-50)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--nexus-text-secondary)]"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 6. StatusBadge
// ────────────────────────────────────────────────────────────────

export type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'warning'
  | 'error'
  | 'info'
  | 'success'
  | 'draft'
  | 'review';

const statusConfig: Record<
  StatusType,
  { label: string; color: string; bg: string; dot: string }
> = {
  active: { label: 'Active', color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', dot: 'bg-[#10B981]' },
  inactive: { label: 'Inactive', color: 'text-[var(--nexus-text-muted)]', bg: 'bg-[#F3F4F6]', dot: 'bg-[#9CA3AF]' },
  pending: { label: 'Pending', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', dot: 'bg-[#F59E0B]' },
  approved: { label: 'Approved', color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', dot: 'bg-[#10B981]' },
  rejected: { label: 'Rejected', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', dot: 'bg-[#EF4444]' },
  completed: { label: 'Completed', color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', dot: 'bg-[#10B981]' },
  cancelled: { label: 'Cancelled', color: 'text-[#6B7280]', bg: 'bg-[#F3F4F6]', dot: 'bg-[#9CA3AF]' },
  warning: { label: 'Warning', color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', dot: 'bg-[#F59E0B]' },
  error: { label: 'Error', color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', dot: 'bg-[#EF4444]' },
  info: { label: 'Info', color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', dot: 'bg-[#4F6BF6]' },
  success: { label: 'Success', color: 'text-[#059669]', bg: 'bg-[#ECFDF5]', dot: 'bg-[#10B981]' },
  draft: { label: 'Draft', color: 'text-[#6B7280]', bg: 'bg-[#F3F4F6]', dot: 'bg-[#9CA3AF]' },
  review: { label: 'In Review', color: 'text-[#7C3AED]', bg: 'bg-[#F3EFFE]', dot: 'bg-[#8B5CF6]' },
};

export interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'pill' | 'tag';
  label?: string;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  variant = 'pill',
  label,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.info;
  const displayLabel = label || config.label;

  const sizeClass = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const dotSize = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }[size];

  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center gap-1.5', sizeClass, className)}>
        <span className={cn('rounded-full', dotSize, config.dot)} />
        <span className={cn('font-medium', config.color)}>{displayLabel}</span>
      </div>
    );
  }

  if (variant === 'tag') {
    return (
      <span
        className={cn(
          'inline-flex items-center font-semibold rounded-md border',
          config.bg,
          config.color,
          config.dot.replace('bg-', 'border-'),
          sizeClass,
          className
        )}
      >
        {displayLabel}
      </span>
    );
  }

  // pill (default)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        config.bg,
        config.color,
        sizeClass,
        className
      )}
    >
      <span className={cn('rounded-full', dotSize, config.dot)} />
      {displayLabel}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// 7. GradientAvatar
// ────────────────────────────────────────────────────────────────

export interface GradientAvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  gradient?: string;
  className?: string;
}

export function GradientAvatar({
  name,
  src,
  size = 'md',
  gradient,
  className,
}: GradientAvatarProps) {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size];

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const gradients = [
    'from-[#4F6BF6] to-[#8B5CF6]',
    'from-[#10B981] to-[#06B6D4]',
    'from-[#F59E0B] to-[#EF4444]',
    'from-[#8B5CF6] to-[#EC4899]',
    'from-[#06B6D4] to-[#4F6BF6]',
    'from-[#EF4444] to-[#F59E0B]',
  ];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const defaultGradient = gradients[hash % gradients.length];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizeClass, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br',
        gradient || defaultGradient,
        sizeClass,
        className
      )}
    >
      {initials}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 8. PrimaryButton
// ────────────────────────────────────────────────────────────────

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
}

export function PrimaryButton({
  icon,
  loading = false,
  variant = 'primary',
  children,
  disabled,
  className,
  ...rest
}: PrimaryButtonProps) {
  const variantClass = {
    primary:
      'bg-gradient-to-r from-[#4F6BF6] to-[#8B5CF6] text-white shadow-[var(--nexus-shadow-sm),0_2px_8px_rgba(79,107,246,0.25)] hover:shadow-[var(--nexus-shadow-md),0_4px_16px_rgba(79,107,246,0.3)] hover:-translate-y-[1px]',
    ghost:
      'bg-transparent text-[var(--nexus-text-secondary)] border-[1.5px] border-[var(--nexus-border)] hover:bg-[var(--nexus-primary-50)] hover:text-[#4F6BF6] hover:border-[#4F6BF6]/30',
    outline:
      'bg-[var(--nexus-card-bg)] text-[#4F6BF6] border-[1.5px] border-[#4F6BF6]/30 hover:bg-[var(--nexus-primary-50)]',
    danger:
      'bg-gradient-to-r from-[#EF4444] to-[#F87171] text-white shadow-sm hover:shadow-md hover:-translate-y-[1px]',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'nexus-btn',
        variantClass,
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        className
      )}
      {...rest}
    >
      {loading ? (
        <FiLoader className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// 9. SearchBar
// ────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcut?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  shortcut,
  className,
}: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nexus-text-muted)] w-4 h-4" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(sanitizeSearch(e.target.value))}
        placeholder={placeholder}
        className="w-full pl-9 pr-12 py-2 rounded-[var(--nexus-radius-md)] bg-[var(--nexus-card-bg)] border border-[var(--nexus-border)] text-sm text-[var(--nexus-text-primary)] placeholder:text-[var(--nexus-text-muted)] focus:outline-none focus:border-[#4F6BF6] focus:ring-2 focus:ring-[#4F6BF6]/10 transition-all"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nexus-text-muted)] hover:text-[var(--nexus-text-primary)]"
        >
          <FiX className="w-4 h-4" />
        </button>
      ) : shortcut ? (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--nexus-text-muted)] bg-[var(--nexus-background)] px-1.5 py-0.5 rounded border border-[var(--nexus-border)]">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 10. TabBar
// ────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function TabBar({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className,
}: TabBarProps) {
  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center bg-[var(--nexus-background)] rounded-[var(--nexus-radius-md)] p-1 gap-0.5',
          className
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-[var(--nexus-radius-sm)] text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-[var(--nexus-card-bg)] text-[#4F6BF6] shadow-sm'
                : 'text-[var(--nexus-text-secondary)] hover:text-[var(--nexus-text-primary)] hover:bg-[var(--nexus-card-bg)]/50'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  activeTab === tab.id
                    ? 'bg-[#4F6BF6]/10 text-[#4F6BF6]'
                    : 'bg-[var(--nexus-border)] text-[var(--nexus-text-muted)]'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // underline variant
  return (
    <div className={cn('flex items-center border-b border-[var(--nexus-border)]', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px',
            activeTab === tab.id
              ? 'border-[#4F6BF6] text-[#4F6BF6]'
              : 'border-transparent text-[var(--nexus-text-secondary)] hover:text-[var(--nexus-text-primary)] hover:border-[var(--nexus-border)]'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                activeTab === tab.id
                  ? 'bg-[#4F6BF6]/10 text-[#4F6BF6]'
                  : 'bg-[var(--nexus-border)] text-[var(--nexus-text-muted)]'
              )}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 11. SidebarWidget
// ────────────────────────────────────────────────────────────────

export interface SidebarWidgetProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  className?: string;
}

export function SidebarWidget({
  title,
  icon,
  children,
  collapsible = false,
  className,
}: SidebarWidgetProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn('nexus-card p-4', className)}>
      <div
        className={cn(
          'flex items-center justify-between',
          collapsible && 'cursor-pointer'
        )}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--nexus-text-secondary)]">{icon}</span>}
          <h4 className="font-semibold text-sm text-[var(--nexus-text-primary)]">{title}</h4>
        </div>
        {collapsible && (
          <FiChevronDown
            className={cn(
              'w-4 h-4 text-[var(--nexus-text-muted)] transition-transform',
              collapsed && '-rotate-90'
            )}
          />
        )}
      </div>
      {!collapsed && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 12. EmptyState
// ────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--nexus-primary-50)] flex items-center justify-center text-[#4F6BF6] mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--nexus-text-primary)] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--nexus-text-secondary)] max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <PrimaryButton
          icon={<FiPlus className="w-4 h-4" />}
          onClick={onAction}
          className="mt-5"
        >
          {actionLabel}
        </PrimaryButton>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 13. PageHeader
// ────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[var(--nexus-text-muted)] mb-2">
          {breadcrumb.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <FiChevronRight className="w-3 h-3" />}
              {item.href ? (
                <a
                  href={item.href}
                  className="hover:text-[#4F6BF6] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-[var(--nexus-text-secondary)] font-medium">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--nexus-text-primary)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[var(--nexus-text-secondary)] mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 14. MetricCard
// ────────────────────────────────────────────────────────────────

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  sparklineData?: number[];
  icon?: ReactNode;
  color?: NexusColor;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  sparklineData,
  icon,
  color = 'blue',
  className,
}: MetricCardProps) {
  const c = colorMap[color];
  const maxVal = sparklineData ? Math.max(...sparklineData) : 1;

  return (
    <div className={cn('nexus-card nexus-card-hover p-5', c.glow, className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--nexus-text-secondary)]">{title}</span>
        {icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.light, c.text)}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-[var(--nexus-text-primary)]">{value}</span>
        {change && (
          <span
            className={cn(
              'text-xs font-semibold mb-1',
              change.startsWith('+') || change.startsWith('↑')
                ? 'text-[#10B981]'
                : change.startsWith('-') || change.startsWith('↓')
                  ? 'text-[#EF4444]'
                  : 'text-[var(--nexus-text-muted)]'
            )}
          >
            {change}
          </span>
        )}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="flex items-end gap-[2px] h-8">
          {sparklineData.map((val, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-sm bg-gradient-to-t', c.gradient, 'opacity-60')}
              style={{ height: `${Math.max((val / maxVal) * 100, 5)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 15. InfoCard
// ────────────────────────────────────────────────────────────────

export interface InfoCardItem {
  label: string;
  value: string | ReactNode;
}

export interface InfoCardProps {
  title: string;
  icon?: ReactNode;
  items: InfoCardItem[];
  className?: string;
}

export function InfoCard({ title, icon, items, className }: InfoCardProps) {
  return (
    <div className={cn('nexus-card p-5', className)}>
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-[var(--nexus-text-secondary)]">{icon}</span>}
        <h3 className="font-semibold text-[var(--nexus-text-primary)]">{title}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <span className="text-sm text-[var(--nexus-text-muted)] shrink-0">{item.label}</span>
            <span className="text-sm text-[var(--nexus-text-primary)] font-medium text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 16. ActionCard
// ────────────────────────────────────────────────────────────────

export interface ActionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  color?: NexusColor;
  className?: string;
}

export function ActionCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  color = 'blue',
  className,
}: ActionCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('nexus-card nexus-card-hover p-5 flex items-start gap-4', className)}>
      {icon && (
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', c.light, c.text)}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--nexus-text-primary)]">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--nexus-text-secondary)] mt-1 line-clamp-2">
            {description}
          </p>
        )}
        <button
          onClick={onAction}
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors',
            c.text,
            'hover:underline'
          )}
        >
          {actionLabel}
          <FiArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 17. ProgressRing
// ────────────────────────────────────────────────────────────────

export interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 80,
  color = '#4F6BF6',
  label,
  className,
}: ProgressRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference - percentage * circumference;
  const center = size / 2;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--nexus-border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[var(--nexus-text-primary)]">
            {Math.round(percentage * 100)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-[var(--nexus-text-secondary)] font-medium">{label}</span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 18. ProgressBar
// ────────────────────────────────────────────────────────────────

export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: NexusColor;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'blue',
  label,
  showPercentage = false,
  className,
}: ProgressBarProps) {
  const c = colorMap[color];
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs font-medium text-[var(--nexus-text-secondary)]">{label}</span>
          )}
          {showPercentage && (
            <span className="text-xs font-semibold text-[var(--nexus-text-primary)]">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 rounded-full bg-[var(--nexus-border)] overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', c.gradient)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 19. TimelineItem
// ────────────────────────────────────────────────────────────────

export interface TimelineItemProps {
  title: string;
  description?: string;
  date?: string;
  icon?: ReactNode;
  color?: NexusColor;
  isLast?: boolean;
  className?: string;
}

export function TimelineItem({
  title,
  description,
  date,
  icon,
  color = 'blue',
  isLast = false,
  className,
}: TimelineItemProps) {
  const c = colorMap[color];
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            c.light,
            c.text
          )}
        >
          {icon || <div className={cn('w-2.5 h-2.5 rounded-full', c.bg)} />}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-[var(--nexus-border)] my-1" />}
      </div>
      {/* Content */}
      <div className={cn('pb-6', isLast && 'pb-0')}>
        <h4 className="text-sm font-semibold text-[var(--nexus-text-primary)]">{title}</h4>
        {description && (
          <p className="text-xs text-[var(--nexus-text-secondary)] mt-0.5">{description}</p>
        )}
        {date && (
          <span className="text-[10px] text-[var(--nexus-text-muted)] mt-1 flex items-center gap-1">
            <FiClock className="w-3 h-3" />
            {date}
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 20. CommentCard
// ────────────────────────────────────────────────────────────────

export interface ReactionItem {
  emoji: string;
  count: number;
  active?: boolean;
}

export interface CommentCardProps {
  author: string;
  avatar?: string;
  content: string;
  timestamp: string;
  reactions?: ReactionItem[];
  className?: string;
}

export function CommentCard({
  author,
  avatar,
  content,
  timestamp,
  reactions,
  className,
}: CommentCardProps) {
  return (
    <div className={cn('nexus-card p-4', className)}>
      <div className="flex items-start gap-3">
        <GradientAvatar name={author} src={avatar} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-[var(--nexus-text-primary)]">
              {author}
            </span>
            <span className="text-[10px] text-[var(--nexus-text-muted)]">{timestamp}</span>
          </div>
          <p className="text-sm text-[var(--nexus-text-secondary)] leading-relaxed">
            {content}
          </p>
          {reactions && reactions.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {reactions.map((r, i) => (
                <button
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                    r.active
                      ? 'border-[#4F6BF6]/30 bg-[var(--nexus-primary-50)] text-[#4F6BF6]'
                      : 'border-[var(--nexus-border)] text-[var(--nexus-text-secondary)] hover:bg-[var(--nexus-background)]'
                  )}
                >
                  {r.emoji} {r.count}
                </button>
              ))}
              <button className="text-[var(--nexus-text-muted)] hover:text-[var(--nexus-text-secondary)] p-0.5">
                <FiSmile className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 21. FileCard
// ────────────────────────────────────────────────────────────────

export interface FileCardProps {
  name: string;
  size: string;
  type: string;
  onDownload?: () => void;
  onDelete?: () => void;
  className?: string;
}

const fileTypeIcons: Record<string, ReactNode> = {
  pdf: <FiFileText className="w-5 h-5" />,
  doc: <FiFileText className="w-5 h-5" />,
  docx: <FiFileText className="w-5 h-5" />,
  xls: <FiArchive className="w-5 h-5" />,
  xlsx: <FiArchive className="w-5 h-5" />,
  png: <FiImage className="w-5 h-5" />,
  jpg: <FiImage className="w-5 h-5" />,
  jpeg: <FiImage className="w-5 h-5" />,
  zip: <FiArchive className="w-5 h-5" />,
  default: <FiFile className="w-5 h-5" />,
};

const fileTypeColors: Record<string, NexusColor> = {
  pdf: 'rose',
  doc: 'blue',
  docx: 'blue',
  xls: 'green',
  xlsx: 'green',
  png: 'violet',
  jpg: 'violet',
  jpeg: 'violet',
  zip: 'amber',
};

export function FileCard({
  name,
  size,
  type,
  onDownload,
  onDelete,
  className,
}: FileCardProps) {
  const ext = type.toLowerCase().replace('.', '');
  const icon = fileTypeIcons[ext] || fileTypeIcons.default;
  const color = fileTypeColors[ext] || 'blue';
  const c = colorMap[color];

  return (
    <div
      className={cn(
        'nexus-card nexus-card-hover p-3 flex items-center gap-3',
        className
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          c.light,
          c.text
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--nexus-text-primary)] truncate">{name}</p>
        <p className="text-xs text-[var(--nexus-text-muted)]">
          {size} · {ext.toUpperCase()}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-1.5 rounded-md text-[var(--nexus-text-muted)] hover:text-[#4F6BF6] hover:bg-[var(--nexus-primary-50)] transition-colors"
            title="Download"
          >
            <FiDownload className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-[var(--nexus-text-muted)] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
            title="Delete"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 22. TagInput
// ────────────────────────────────────────────────────────────────

export interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder = 'Add tag...',
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !tags.includes(val)) {
        onAdd(val);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--nexus-radius-md)] bg-[var(--nexus-card-bg)] border border-[var(--nexus-border)] focus-within:border-[#4F6BF6] focus-within:ring-2 focus-within:ring-[#4F6BF6]/10 transition-all min-h-[38px]',
        className
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--nexus-primary-50)] text-[#4F6BF6] text-xs font-medium"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="hover:text-[#EF4444] transition-colors"
          >
            <FiX className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-[var(--nexus-text-primary)] placeholder:text-[var(--nexus-text-muted)] outline-none"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 23. Modal
// ────────────────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
}: ModalProps) {
  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        className={cn(
          'relative w-full nexus-card-elevated rounded-[var(--nexus-radius-xl)] animate-scale-in overflow-hidden',
          sizeClass,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--nexus-border)]">
          <h2 className="text-lg font-semibold text-[var(--nexus-text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--nexus-text-muted)] hover:text-[var(--nexus-text-primary)] hover:bg-[var(--nexus-background)] transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 24. ConfirmDialog
// ────────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const iconMap = {
    danger: <FiAlertCircle className="w-6 h-6 text-[#EF4444]" />,
    warning: <FiAlertTriangle className="w-6 h-6 text-[#F59E0B]" />,
    info: <FiInfo className="w-6 h-6 text-[#4F6BF6]" />,
  };
  const btnVariant = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    info: 'primary' as const,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm nexus-card-elevated rounded-[var(--nexus-radius-xl)] p-6 animate-scale-in">
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">{iconMap[variant]}</div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--nexus-text-primary)] mb-1">
              {title}
            </h3>
            <p className="text-sm text-[var(--nexus-text-secondary)]">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6">
          <PrimaryButton variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </PrimaryButton>
          <PrimaryButton variant={btnVariant[variant]} onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 25. Dropdown
// ────────────────────────────────────────────────────────────────

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={cn('relative inline-block', className)} ref={ref}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[180px] nexus-card-elevated rounded-[var(--nexus-radius-md)] py-1 animate-scale-in shadow-lg',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.divider && i > 0 && (
                <div className="my-1 border-t border-[var(--nexus-border)]" />
              )}
              <button
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  item.danger
                    ? 'text-[#EF4444] hover:bg-[#FEF2F2]'
                    : 'text-[var(--nexus-text-primary)] hover:bg-[var(--nexus-background)]'
                )}
              >
                {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 26. Toast / showToast
// ────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

// We use a simple custom toast system to avoid dependency on react-hot-toast internals
// and keep it self-contained within this library.
const toastListeners: Set<(toast: ToastData) => void> = new Set();

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastCounter = 0;

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
  const id = `toast-${++toastCounter}`;
  const data: ToastData = { id, message, type, duration };
  toastListeners.forEach((listener) => listener(data));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<ToastData & { leaving?: boolean }>>([]);

  useEffect(() => {
    const handler = (toast: ToastData) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === toast.id ? { ...t, leaving: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 300);
      }, toast.duration || 4000);
    };
    toastListeners.add(handler);
    return () => {
      toastListeners.delete(handler);
    };
  }, []);

  const typeConfig: Record<
    ToastType,
    { icon: ReactNode; color: string; bg: string; border: string }
  > = {
    success: {
      icon: <FiCheckCircle className="w-5 h-5" />,
      color: 'text-[#10B981]',
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#10B981]/20',
    },
    error: {
      icon: <FiAlertCircle className="w-5 h-5" />,
      color: 'text-[#EF4444]',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#EF4444]/20',
    },
    warning: {
      icon: <FiAlertTriangle className="w-5 h-5" />,
      color: 'text-[#F59E0B]',
      bg: 'bg-[#FFFBEB]',
      border: 'border-[#F59E0B]/20',
    },
    info: {
      icon: <FiInfo className="w-5 h-5" />,
      color: 'text-[#4F6BF6]',
      bg: 'bg-[#EFF2FE]',
      border: 'border-[#4F6BF6]/20',
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const config = typeConfig[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[var(--nexus-radius-md)] border shadow-lg min-w-[280px] max-w-sm',
              config.bg,
              config.border,
              toast.leaving ? 'animate-fade-out' : 'animate-slide-in-right'
            )}
          >
            <span className={config.color}>{config.icon}</span>
            <span className="text-sm font-medium text-[var(--nexus-text-primary)] flex-1">
              {toast.message}
            </span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="text-[var(--nexus-text-muted)] hover:text-[var(--nexus-text-primary)] shrink-0"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 27. Skeleton
// ────────────────────────────────────────────────────────────────

export interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle' | 'table';
  count?: number;
  className?: string;
}

export function Skeleton({ variant = 'text', count = 1, className }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  // Pre-generate deterministic widths for text variant (seeded by index)
  const textWidths = useMemo(
    () => Array.from({ length: count }, (_, i) => 65 + ((i * 37 + 13) % 35)),
    [count]
  );

  if (variant === 'card') {
    return (
      <div className={cn('space-y-4', className)}>
        {items.map((i) => (
          <div key={i} className="nexus-card p-5 space-y-3">
            <div className="shimmer h-4 w-1/3 rounded" />
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {items.map((i) => (
          <div key={i} className="shimmer w-10 h-10 rounded-full" />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('nexus-card overflow-hidden', className)}>
        <div className="p-4 border-b border-[var(--nexus-border)] flex gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer h-3 w-24 rounded" />
          ))}
        </div>
        {Array.from({ length: Math.min(count, 5) }, (_, ri) => (
          <div key={ri} className="px-4 py-3 border-b border-[var(--nexus-border)] last:border-0 flex gap-4">
            {Array.from({ length: 4 }, (_, ci) => (
              <div key={ci} className="shimmer h-3 w-20 rounded" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // text variant
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((i) => (
        <div
          key={i}
          className="shimmer h-4 rounded"
          style={{ width: `${textWidths[i]}%` }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 28. Divider
// ────────────────────────────────────────────────────────────────

export interface DividerProps {
  label?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ label, orientation = 'horizontal', className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div className={cn('inline-flex items-center h-full min-h-[24px]', className)}>
        <div className="w-px h-full bg-[var(--nexus-border)]" />
        {label && (
          <span className="px-2 text-xs text-[var(--nexus-text-muted)] font-medium">{label}</span>
        )}
        <div className="w-px h-full bg-[var(--nexus-border)]" />
      </div>
    );
  }

  if (label) {
    return (
      <div className={cn('nexus-divider', className)}>
        <span>{label}</span>
      </div>
    );
  }

  return <hr className={cn('border-[var(--nexus-border)]', className)} />;
}

// ────────────────────────────────────────────────────────────────
// 29. Tooltip
// ────────────────────────────────────────────────────────────────

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={cn('nexus-tooltip absolute z-50 animate-fade-in', positionClass)}>
          {content}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 30. IconBox
// ────────────────────────────────────────────────────────────────

export interface IconBoxProps {
  icon: ReactNode;
  color?: NexusColor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function IconBox({ icon, color = 'blue', size = 'md', className }: IconBoxProps) {
  const c = colorMap[color];
  const sizeClass = {
    sm: 'w-8 h-8 rounded-lg text-sm',
    md: 'w-10 h-10 rounded-xl text-base',
    lg: 'w-14 h-14 rounded-2xl text-xl',
  }[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        c.light,
        c.text,
        sizeClass,
        className
      )}
    >
      {icon}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 31. AnimatedNumber
// ────────────────────────────────────────────────────────────────

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// 32. CopyButton
// ────────────────────────────────────────────────────────────────

export interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
        copied
          ? 'bg-[#ECFDF5] text-[#059669]'
          : 'text-[var(--nexus-text-muted)] hover:text-[var(--nexus-text-secondary)] hover:bg-[var(--nexus-background)]',
        className
      )}
    >
      {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// 33. DateDisplay
// ────────────────────────────────────────────────────────────────

export interface DateDisplayProps {
  date: string | Date;
  format?: 'short' | 'long' | 'relative' | 'time';
  className?: string;
}

export function DateDisplay({ date, format = 'short', className }: DateDisplayProps) {
  const d = useMemo(() => (typeof date === 'string' ? new Date(date) : date), [date]);

  const formatted = useMemo(() => {
    if (isNaN(d.getTime())) return 'Invalid date';

    if (format === 'relative') {
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffWeeks < 4) return `${diffWeeks}w ago`;
      if (diffMonths < 12) return `${diffMonths}mo ago`;
      return d.toLocaleDateString();
    }

    if (format === 'time') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (format === 'long') {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    // short
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [d, format]);

  return (
    <span className={cn('text-sm text-[var(--nexus-text-secondary)]', className)}>
      {formatted}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Utility exports used by org-chart and other pages
// ────────────────────────────────────────────────────────────────

export const AVATAR_COLORS = [
  '#4F6BF6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

export const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: '#4F6BF6',
  Marketing: '#10B981',
  Sales: '#F59E0B',
  HR: '#8B5CF6',
  Finance: '#06B6D4',
  Operations: '#EF4444',
  Product: '#EC4899',
  Design: '#14B8A6',
  Legal: '#F97316',
  Admin: '#6366F1',
};

export function getDeptColor(dept: string): string {
  return DEPARTMENT_COLORS[dept] || AVATAR_COLORS[dept.length % AVATAR_COLORS.length];
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function firstInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('tb_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Re-export convenience aliases used by some pages
export const SectionHeader = PageHeader;
export const StatCard = MetricCard;
export const Badge = ({ children, variant = 'default', className: cls }: { children: ReactNode; variant?: 'default' | 'info' | 'success' | 'warning' | 'error'; className?: string }) => {
  const variantStyles: Record<string, string> = {
    default: 'bg-[var(--nexus-bg-secondary)] text-[var(--nexus-text-primary)]',
    info: 'bg-green-100 text-green-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', variantStyles[variant] || variantStyles.default, cls)}>
      {children}
    </span>
  );
};
export const LoadingSpinner = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center justify-center py-12', className)}>
    <FiLoader className="h-6 w-6 animate-spin text-[var(--nexus-text-secondary)]" />
  </div>
);
export const PageContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}>{children}</div>
);
export const TwoColumnLayout = ({ left, right, className }: { left: ReactNode; right: ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-6', className)}>
    <div className="lg:col-span-2">{left}</div>
    <div>{right}</div>
  </div>
);
