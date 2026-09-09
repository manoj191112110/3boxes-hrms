'use client';

import { useState, useEffect } from 'react';
import { FiBell, FiAlertCircle, FiSettings, FiCheck, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getTypeBadge(type: string) {
  const colors: Record<string, string> = {
    info: 'bg-blue-50 text-blue-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
    workflow: 'bg-green-50 text-green-700',
  };
  return colors[type] || 'bg-slate-100 text-slate-600';
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export default function GovernanceNotificationsPage() {
  const { token } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch notifications (${res.status})`);
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchNotifications();
    }
  }, [token]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        toast.success('All notifications marked as read');
        fetchNotifications();
      }
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiBell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Notifications</h1>
            <p className="text-sm text-thb-text-secondary">Governance · System and workflow notifications</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <FiCheck className="w-4 h-4" /> Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <FiSettings className="w-8 h-8 animate-spin text-green-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Data */}
      {!loading && !error && (
        <>
          {notifications.length === 0 ? (
            <div className="thb-card p-8 text-center">
              <FiBell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-thb-text-muted">No notifications yet</p>
            </div>
          ) : (
            <div className="thb-card overflow-hidden">
              <div className="divide-y divide-thb-border max-h-[600px] overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors ${!notif.isRead ? 'bg-green-50/30' : ''}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {!notif.isRead ? (
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent mt-1.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm truncate ${!notif.isRead ? 'font-semibold text-thb-text-primary' : 'font-medium text-thb-text-secondary'}`}>
                          {notif.title}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${getTypeBadge(notif.type)}`}>
                          {notif.type}
                        </span>
                      </div>
                      <p className="text-xs text-thb-text-muted line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-thb-text-muted mt-1">
                        <FiClock className="inline w-3 h-3 mr-0.5" />
                        {formatRelativeTime(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
