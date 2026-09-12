'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiInfo,
  FiAlertTriangle,
  FiAlertCircle,
  FiClock,
  FiSearch,
  FiFilter,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'success': return <FiCheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'warning': return <FiAlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'error': return <FiAlertCircle className="w-5 h-5 text-red-500" />;
    case 'reminder': return <FiClock className="w-5 h-5 text-teal-500" />;
    default: return <FiInfo className="w-5 h-5 text-green-500" />;
  }
}

function getBorderColor(type: string) {
  const map: Record<string, string> = {
    info: 'border-l-green-500',
    warning: 'border-l-amber-500',
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    reminder: 'border-l-teal-500',
    login: 'border-l-green-500',
    logout: 'border-l-green-500',
    workflow: 'border-l-cyan-500',
  };
  return map[type] || 'border-l-slate-400';
}

/* ── Component ── */
const notificationsTips = [
  { title: 'Filter by Category', description: 'Use category filters to quickly find notifications related to leave, payroll, recruitment, or system alerts.' },
  { title: 'Mark as Read', description: 'Click on unread notifications to mark them as read, or use "Mark All as Read" to clear your queue.' },
  { title: 'Configure Preferences', description: 'Set up which notification types you want to receive and how — in-app, email, or both.' },
  { title: 'Use Quick Actions', description: 'Take action directly from notifications — approve leave, acknowledge alerts, or navigate to related modules.' },
  { title: 'Archive Old Notifications', description: 'Regularly archive read notifications to keep your inbox clean and focus on what matters.' },
];

const notificationsWorkflowSteps = [
  { step: 1, title: 'View All Notifications', description: 'Check your notification center for new alerts' },
  { step: 2, title: 'Filter by Category', description: 'Narrow down by type — info, warning, or action required' },
  { step: 3, title: 'Take Action', description: 'Respond to actionable notifications directly' },
  { step: 4, title: 'Mark as Read', description: 'Acknowledge notifications you have reviewed' },
  { step: 5, title: 'Configure Preferences', description: 'Customize which notifications you receive and how' },
  { step: 6, title: 'Archive Old Items', description: 'Clean up your inbox by archiving old notifications' },
];

/* ── Component ── */
export default function NotificationsPage() {
  const { user } = useAuthStore();
  void user;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  /* Fetch */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const params = new URLSearchParams({ limit: '100' });
      if (filterRead === 'unread') params.set('unread', 'true');
      const res = await fetch(`/api/notifications?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filterRead]);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Mark as Read */
  const handleMarkRead = async (id: string) => {
    try {
      setMarkingRead(id);
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed');
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(null);
    }
  };

  /* Mark All Read */
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ markAll: true }),
      });
      if (!res.ok) throw new Error('Failed');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  /* Filter */
  const filteredNotifications = notifications.filter(n => {
    const matchSearch = !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || n.type === filterType;
    const matchRead = filterRead === 'all' ||
      (filterRead === 'unread' && !n.isRead) ||
      (filterRead === 'read' && n.isRead);
    return matchSearch && matchType && matchRead;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBell className="w-6 h-6 text-green-500" />
            Notifications
          </h1>
          <p className="text-thb-text-secondary mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You\'re all caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
            <FiCheck className="w-4 h-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Module Tips & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModuleTips moduleKey="notifications" title="Notification Tips" tips={notificationsTips} userRole={user?.role} />
        <ModuleWorkflow moduleKey="notifications" title="How to Manage Notifications" steps={notificationsWorkflowSteps} accentColor="blue" userRole={user?.role} />
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              placeholder="Search notifications..."
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="pl-9 pr-8 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 appearance-none bg-white">
                <option value="">All Types</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="reminder">Reminder</option>
              </select>
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'unread', 'read'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterRead(opt)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors capitalize ${filterRead === opt ? 'bg-white text-thb-text-primary shadow-sm' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}
                >
                  {opt}
                  {opt === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-green-500 text-white rounded-full">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List - Card-based */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="thb-card p-4 animate-pulse border-l-4 border-l-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-64 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filteredNotifications.length === 0 ? (
          <div className="thb-card py-12 text-center">
            <FiBell className="w-12 h-12 text-thb-text-muted mx-auto mb-4" />
            <p className="text-thb-text-secondary font-medium text-lg">No notifications found</p>
            <p className="text-sm text-thb-text-muted mt-1">
              {search || filterType ? 'Try adjusting your filters' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={`thb-card border-l-4 ${getBorderColor(n.type)} transition-all cursor-pointer hover:shadow-md ${!n.isRead ? 'bg-green-50/40 border-l-4' : 'bg-white'}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!n.isRead ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium ${!n.isRead ? 'text-thb-text-primary' : 'text-thb-text-secondary'}`}>{n.title}</p>
                      {!n.isRead && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                    </div>
                    <p className={`text-sm mt-0.5 ${!n.isRead ? 'text-thb-text-secondary' : 'text-thb-text-muted'}`}>{n.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-thb-text-muted">{formatTimeAgo(n.createdAt)}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        n.type === 'info' ? 'bg-green-50 text-green-600' :
                        n.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                        n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                        n.type === 'error' ? 'bg-red-50 text-red-600' :
                        n.type === 'reminder' ? 'bg-teal-50 text-teal-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {n.type}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {n.category}
                      </span>
                    </div>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                      disabled={markingRead === n.id}
                      className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors flex-shrink-0"
                      title="Mark as read"
                    >
                      <FiCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
