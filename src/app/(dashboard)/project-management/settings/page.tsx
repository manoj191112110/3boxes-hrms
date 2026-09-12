'use client';

import { useState, useEffect } from 'react';
import {
  FiSettings, FiSave, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-sm">
      {enabled ? (
        <><FiToggleRight className="w-6 h-6 text-green-500" /><span className="text-green-600 font-medium">On</span></>
      ) : (
        <><FiToggleLeft className="w-6 h-6 text-slate-400" /><span className="text-slate-400 font-medium">Off</span></>
      )}
    </button>
  );
}

export default function ProjectSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [sprintDuration, setSprintDuration] = useState('2weeks');
  const [autoAssign, setAutoAssign] = useState(false);
  const [timeTrackingMandatory, setTimeTrackingMandatory] = useState(true);
  const [sprintDeadlineAlerts, setSprintDeadlineAlerts] = useState(true);
  const [dailyStandupReminders, setDailyStandupReminders] = useState(true);
  const [overdueTaskEscalation, setOverdueTaskEscalation] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [defaultView, setDefaultView] = useState('grid');
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [autoTimesheetApproval, setAutoTimesheetApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings from API on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch('/api/project-settings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const s = data.settings;
          if (s.sprintDuration !== undefined) setSprintDuration(String(s.sprintDuration));
          if (s.autoAssign !== undefined) setAutoAssign(!!s.autoAssign);
          if (s.timeTrackingEnabled !== undefined) setTimeTrackingMandatory(!!s.timeTrackingEnabled);
          if (s.notifyOnDeadline !== undefined) setSprintDeadlineAlerts(!!s.notifyOnDeadline);
          if (s.requireApproval !== undefined) setRequireApproval(!!s.requireApproval);
          if (s.defaultView !== undefined) setDefaultView(String(s.defaultView));
          if (s.overtimeEnabled !== undefined) setOvertimeEnabled(!!s.overtimeEnabled);
          if (s.autoTimesheetApproval !== undefined) setAutoTimesheetApproval(!!s.autoTimesheetApproval);
        }
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        sprintDuration,
        autoAssign,
        timeTrackingEnabled: timeTrackingMandatory,
        requireApproval,
        defaultView,
        overtimeEnabled,
        notifyOnDeadline: sprintDeadlineAlerts,
        autoTimesheetApproval,
      };
      const res = await fetch('/api/project-settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success('Project settings saved successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Project Settings</h1>
            <p className="text-sm text-thb-text-secondary">Loading settings...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="thb-card p-5 space-y-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-8 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="thb-card p-5 space-y-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-6 bg-slate-100 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Project Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure project defaults and notification preferences</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Defaults */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Project Defaults</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Default settings for new projects</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Sprint Duration */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Sprint Duration</label>
              <select
                value={sprintDuration}
                onChange={(e) => setSprintDuration(e.target.value)}
                className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              >
                <option value="1week">1 Week</option>
                <option value="2weeks">2 Weeks</option>
                <option value="3weeks">3 Weeks</option>
                <option value="4weeks">4 Weeks</option>
              </select>
              <p className="text-xs text-thb-text-muted mt-1">Default sprint length for new projects</p>
            </div>

            {/* Default View */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Default Project View</label>
              <select
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
                className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              >
                <option value="grid">Grid View</option>
                <option value="list">List View</option>
                <option value="kanban">Kanban Board</option>
              </select>
              <p className="text-xs text-thb-text-muted mt-1">Default view when opening project list</p>
            </div>

            {/* Auto-assign Tasks */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Auto-assign Tasks</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Automatically assign tasks based on team capacity and skills</p>
              </div>
              <Toggle enabled={autoAssign} onToggle={() => setAutoAssign(!autoAssign)} />
            </div>

            {/* Require Approval */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Require Approval</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Require manager approval for project changes</p>
              </div>
              <Toggle enabled={requireApproval} onToggle={() => setRequireApproval(!requireApproval)} />
            </div>

            {/* Time Tracking Mandatory */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Time Tracking Mandatory</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Require team members to log time on all tasks</p>
              </div>
              <Toggle enabled={timeTrackingMandatory} onToggle={() => setTimeTrackingMandatory(!timeTrackingMandatory)} />
            </div>
          </div>
        </div>

        {/* Notification & Approval Preferences */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Notification &amp; Approval Preferences</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Configure project-related notifications and approvals</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Sprint Deadline Alerts */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Sprint Deadline Alerts</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Notify team when sprint deadlines are approaching</p>
              </div>
              <Toggle enabled={sprintDeadlineAlerts} onToggle={() => setSprintDeadlineAlerts(!sprintDeadlineAlerts)} />
            </div>

            {/* Daily Standup Reminders */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Daily Standup Reminders</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Send reminders for daily standup meetings</p>
              </div>
              <Toggle enabled={dailyStandupReminders} onToggle={() => setDailyStandupReminders(!dailyStandupReminders)} />
            </div>

            {/* Overdue Task Escalation */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Overdue Task Escalation</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Escalate overdue tasks to project manager automatically</p>
              </div>
              <Toggle enabled={overdueTaskEscalation} onToggle={() => setOverdueTaskEscalation(!overdueTaskEscalation)} />
            </div>

            {/* Overtime Tracking */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Overtime Tracking</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Enable overtime tracking for project work</p>
              </div>
              <Toggle enabled={overtimeEnabled} onToggle={() => setOvertimeEnabled(!overtimeEnabled)} />
            </div>

            {/* Auto Timesheet Approval */}
            <div className="flex items-center justify-between pt-4 border-t border-thb-border">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Auto Timesheet Approval</p>
                <p className="text-xs text-thb-text-muted mt-0.5">Automatically approve submitted timesheets</p>
              </div>
              <Toggle enabled={autoTimesheetApproval} onToggle={() => setAutoTimesheetApproval(!autoTimesheetApproval)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
