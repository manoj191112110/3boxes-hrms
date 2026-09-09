'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiMessageCircle, FiVideo, FiBarChart2, FiCheckCircle, FiClock, FiAlertTriangle, FiFileText, FiLayers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type ReportType = 'chat-activity' | 'call-analytics' | 'productivity';

interface ChatActivityReport {
  totalMessages: number;
  totalRooms: number;
  dailyActivity: { date: string; count: number }[];
  recentMessages: { id: string; body: string; sender: string; room: string; createdAt: string }[];
}

interface CallAnalyticsReport {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  avgDurationSec: number;
  dailyCalls: { date: string; count: number }[];
}

interface ProductivityReport {
  totalTodos: number;
  completedTodos: number;
  overdueTodos: number;
  todoCompletionRate: number;
  totalNotes: number;
  totalFiles: number;
}

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'chat-activity', label: 'Chat Activity', icon: <FiMessageCircle className="w-5 h-5" />, desc: 'Messaging activity overview' },
  { key: 'call-analytics', label: 'Call Analytics', icon: <FiVideo className="w-5 h-5" />, desc: 'Video/audio call metrics' },
  { key: 'productivity', label: 'Productivity', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Collaboration productivity' },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function CollaborationReportsPage() {
  const scopeQuery = useCompanyContextStore((s) => s.scopeQuery);
  const [activeReport, setActiveReport] = useState<ReportType>('chat-activity');
  const [loading, setLoading] = useState(true);
  const [chatActivity, setChatActivity] = useState<ChatActivityReport | null>(null);
  const [callAnalytics, setCallAnalytics] = useState<CallAnalyticsReport | null>(null);
  const [productivity, setProductivity] = useState<ProductivityReport | null>(null);

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/collaboration/reports?type=${type}&period=30d${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      const report = data.report;
      if (type === 'chat-activity') setChatActivity(report);
      else if (type === 'call-analytics') setCallAnalytics(report);
      else setProductivity(report);
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    fetchReport(activeReport);
  }, [activeReport, scopeQuery, fetchReport]);

  const handleExport = () => {
    let data: any = null;
    let filename = '';
    if (activeReport === 'chat-activity') { data = chatActivity; filename = 'chat-activity-report.json'; }
    else if (activeReport === 'call-analytics') { data = callAnalytics; filename = 'call-analytics-report.json'; }
    else { data = productivity; filename = 'productivity-report.json'; }

    if (!data) { toast.error('No data to export'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const maxBarHeight = 120;

  const renderChatActivity = () => {
    if (!chatActivity) return <p className="text-sm text-thb-text-muted text-center py-8">No data available</p>;
    const maxCount = Math.max(...chatActivity.dailyActivity.map((d) => d.count), 1);

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <FiMessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{chatActivity.totalMessages.toLocaleString()}</p>
              <p className="text-xs text-thb-text-muted">Total Messages</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
              <FiLayers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{chatActivity.totalRooms.toLocaleString()}</p>
              <p className="text-xs text-thb-text-muted">Active Rooms</p>
            </div>
          </div>
        </div>

        {/* Daily Activity Chart */}
        {chatActivity.dailyActivity.length > 0 && (
          <div className="thb-card p-4">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Daily Message Activity (Last 30 Days)</h3>
            <div className="flex items-end gap-1 h-32">
              {chatActivity.dailyActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
                  <div
                    className="w-full bg-green-400 rounded-t-sm transition-all hover:bg-green-500"
                    style={{ height: `${Math.max((d.count / maxCount) * maxBarHeight, 2)}px` }}
                    title={`${formatDate(d.date)}: ${d.count} messages`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {chatActivity.dailyActivity.length > 0 && (
                <>
                  <span className="text-[10px] text-thb-text-muted">{formatDate(chatActivity.dailyActivity[0].date)}</span>
                  <span className="text-[10px] text-thb-text-muted">{formatDate(chatActivity.dailyActivity[chatActivity.dailyActivity.length - 1].date)}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Recent Messages */}
        {chatActivity.recentMessages.length > 0 && (
          <div className="thb-card p-4">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Recent Messages</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {chatActivity.recentMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                    {msg.sender?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-thb-text-primary">{msg.sender}</span>
                      <span className="text-[10px] text-thb-text-muted">in {msg.room}</span>
                      <span className="text-[10px] text-thb-text-muted ml-auto">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs text-thb-text-secondary truncate">{msg.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCallAnalytics = () => {
    if (!callAnalytics) return <p className="text-sm text-thb-text-muted text-center py-8">No data available</p>;
    const maxCount = Math.max(...callAnalytics.dailyCalls.map((d) => d.count), 1);
    const completionRate = callAnalytics.totalCalls > 0 ? Math.round((callAnalytics.completedCalls / callAnalytics.totalCalls) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <FiVideo className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{callAnalytics.totalCalls}</p>
              <p className="text-xs text-thb-text-muted">Total Calls</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
              <FiCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{callAnalytics.completedCalls}</p>
              <p className="text-xs text-thb-text-muted">Completed</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{callAnalytics.missedCalls}</p>
              <p className="text-xs text-thb-text-muted">Missed</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
              <FiClock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{formatDuration(Math.round(callAnalytics.avgDurationSec))}</p>
              <p className="text-xs text-thb-text-muted">Avg Duration</p>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-2">Call Completion Rate</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-thb-text-primary">{completionRate}%</span>
          </div>
        </div>

        {/* Daily Calls Chart */}
        {callAnalytics.dailyCalls.length > 0 && (
          <div className="thb-card p-4">
            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Daily Calls (Last 30 Days)</h3>
            <div className="flex items-end gap-1 h-32">
              {callAnalytics.dailyCalls.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
                  <div
                    className="w-full bg-blue-400 rounded-t-sm transition-all hover:bg-blue-500"
                    style={{ height: `${Math.max((d.count / maxCount) * maxBarHeight, 2)}px` }}
                    title={`${formatDate(d.date)}: ${d.count} calls`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {callAnalytics.dailyCalls.length > 0 && (
                <>
                  <span className="text-[10px] text-thb-text-muted">{formatDate(callAnalytics.dailyCalls[0].date)}</span>
                  <span className="text-[10px] text-thb-text-muted">{formatDate(callAnalytics.dailyCalls[callAnalytics.dailyCalls.length - 1].date)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderProductivity = () => {
    if (!productivity) return <p className="text-sm text-thb-text-muted text-center py-8">No data available</p>;
    const completionPct = Math.round(productivity.todoCompletionRate * 100);

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <FiCheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{productivity.completedTodos}/{productivity.totalTodos}</p>
              <p className="text-xs text-thb-text-muted">Todos Completed</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
              <FiAlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{productivity.overdueTodos}</p>
              <p className="text-xs text-thb-text-muted">Overdue Todos</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
              <FiBarChart2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{completionPct}%</p>
              <p className="text-xs text-thb-text-muted">Completion Rate</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-yellow-50 text-yellow-600">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{productivity.totalNotes}</p>
              <p className="text-xs text-thb-text-muted">Shared Notes</p>
            </div>
          </div>
          <div className="thb-card p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
              <FiLayers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-thb-text-primary">{productivity.totalFiles}</p>
              <p className="text-xs text-thb-text-muted">Shared Files</p>
            </div>
          </div>
        </div>

        {/* Completion Rate Bar */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-2">Todo Completion Rate</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-lg font-bold text-thb-text-primary">{completionPct}%</span>
          </div>
          <div className="flex justify-between mt-2 text-xs text-thb-text-muted">
            <span>{productivity.completedTodos} completed</span>
            <span>{productivity.totalTodos - productivity.completedTodos} remaining</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Collaboration Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export collaboration analytics</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {reports.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`thb-card p-4 text-left hover:shadow-md transition-all ${activeReport === r.key ? 'ring-2 ring-green-500 shadow-md' : ''}`}
          >
            <div className={`p-2 rounded-lg inline-flex ${activeReport === r.key ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'} mb-2`}>{r.icon}</div>
            <p className="text-sm font-semibold text-thb-text-primary">{r.label}</p>
            <p className="text-xs text-thb-text-muted mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      <div className="thb-card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : (
          <>
            <h2 className="text-base font-semibold text-thb-text-primary mb-4">
              {reports.find((r) => r.key === activeReport)?.label} — Last 30 Days
            </h2>
            {activeReport === 'chat-activity' && renderChatActivity()}
            {activeReport === 'call-analytics' && renderCallAnalytics()}
            {activeReport === 'productivity' && renderProductivity()}
          </>
        )}
      </div>
    </div>
  );
}
