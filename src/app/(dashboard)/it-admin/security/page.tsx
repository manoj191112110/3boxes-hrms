'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiShield, FiAlertTriangle, FiCheckCircle, FiLock,
  FiKey, FiEye, FiDatabase, FiClock, FiTrendingUp,
} from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

/* ================================================================
   Security Center – 3Boxes HRMS IT Admin
   ================================================================ */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#64748B'];

interface Threat {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
}

interface Policy {
  id: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
  description: string;
}

interface Compliance {
  name: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  score: number;
}

interface TimelineEvent {
  id: string;
  title: string;
  type: 'alert' | 'fix' | 'update' | 'scan';
  timestamp: string;
  description: string;
}

const SEVERITY_CFG: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', icon: '🔴' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🟠' },
  medium:   { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🟡' },
  low:      { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '🟢' },
};

const COMPLIANCE_CFG: Record<string, { bg: string; text: string }> = {
  compliant:      { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  partial:        { bg: 'bg-amber-100', text: 'text-amber-700' },
  'non-compliant': { bg: 'bg-red-100', text: 'text-red-700' },
};

function getDemoData() {
  const securityScore = 78;

  const threats: Threat[] = [
    { id: '1', title: 'Unauthorized SSH Access Attempt', severity: 'critical', description: 'Multiple failed SSH login attempts from IP 203.45.67.89 on prod-db-03', timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: '2', title: 'SSL Certificate Expiring', severity: 'high', description: 'Certificate for auth.3boxestech.com expires in 5 days', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', title: 'Unusual Login Pattern', severity: 'medium', description: '5 failed login attempts for user jsmith from unknown location', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: '4', title: 'Outdated Firewall Rules', severity: 'low', description: '3 new firewall rules awaiting review and deployment', timestamp: new Date(Date.now() - 14400000).toISOString() },
  ];

  const policies: Policy[] = [
    { id: '1', name: 'Password Policy', icon: <FiKey />, enabled: true, description: 'Min 12 chars, uppercase, lowercase, number, symbol. 90-day rotation.' },
    { id: '2', name: 'Two-Factor Auth', icon: <FiLock />, enabled: true, description: 'Mandatory 2FA for all admin and privileged accounts.' },
    { id: '3', name: 'Data Encryption', icon: <FiDatabase />, enabled: true, description: 'AES-256 encryption at rest, TLS 1.3 in transit.' },
    { id: '4', name: 'Access Control', icon: <FiEye />, enabled: false, description: 'RBAC with quarterly access reviews (pending activation).' },
  ];

  const compliance: Compliance[] = [
    { name: 'GDPR', status: 'compliant', score: 95 },
    { name: 'SOC 2', status: 'partial', score: 72 },
    { name: 'ISO 27001', status: 'compliant', score: 88 },
    { name: 'HIPAA', status: 'non-compliant', score: 45 },
  ];

  const timeline: TimelineEvent[] = [
    { id: '1', title: 'Vulnerability Scan Completed', type: 'scan', description: 'Full infrastructure scan completed — 0 critical vulnerabilities found', timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: '2', title: 'Malware Quarantined', type: 'alert', description: 'Malware signature detected on WKST-0142 — quarantine initiated', timestamp: new Date(Date.now() - 5400000).toISOString() },
    { id: '3', title: 'Security Patch Deployed', type: 'fix', description: 'Critical CVE-2024-1234 patched on all production servers', timestamp: new Date(Date.now() - 28800000).toISOString() },
    { id: '4', title: 'Firewall Rules Updated', type: 'update', description: 'Added 3 new inbound rules per security review', timestamp: new Date(Date.now() - 43200000).toISOString() },
    { id: '5', title: 'Penetration Test Completed', type: 'scan', description: 'Annual pen test completed — 2 medium findings to remediate', timestamp: new Date(Date.now() - 172800000).toISOString() },
  ];

  return { securityScore, threats, policies, compliance, timeline };
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-50', stroke: '#10B981' };
  if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-50', stroke: '#F59E0B' };
  return { text: 'text-red-600', bg: 'bg-red-50', stroke: '#EF4444' };
}

export default function SecurityCenterPage() {
  useAuthStore();
  const [data, setData] = useState<ReturnType<typeof getDemoData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingPolicy, setTogglingPolicy] = useState<string | null>(null);

  const fetchSecurityData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assets?type=security', { headers: getAuthHeaders() });
      if (res.ok) {
        const d = await res.json();
        if (d && d.securityScore) { setData(d); setLoading(false); return; }
      }
    } catch { /* no data available */ }
    // No demo data fallback - show empty state instead
    setData(null);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => fetchSecurityData()); }, [fetchSecurityData]);

  function togglePolicy(id: string) {
    if (!data) return;
    setTogglingPolicy(id);
    setData(prev => prev ? {
      ...prev,
      policies: prev.policies.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p),
    } : prev);
    const policy = data.policies.find(p => p.id === id);
    toast.success(`${policy?.name} ${policy?.enabled ? 'disabled' : 'enabled'}`);
    setTogglingPolicy(null);
  }

  if (loading || !data) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="thb-card p-6 animate-pulse"><div className="h-20 bg-slate-200 rounded" /></div>)}</div>
      </div>
    );
  }

  const { securityScore, threats, policies, compliance, timeline } = data;
  const scoreCfg = getScoreColor(securityScore);
  const pieData = compliance.map(c => ({ name: c.name, value: c.score }));

  const EVENT_ICON: Record<string, React.ReactNode> = {
    alert: <FiAlertTriangle className="w-4 h-4 text-red-500" />,
    fix: <FiCheckCircle className="w-4 h-4 text-emerald-500" />,
    update: <FiTrendingUp className="w-4 h-4 text-green-500" />,
    scan: <FiShield className="w-4 h-4 text-teal-500" />,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-thb-text-primary">Security Center</h1>
        <p className="text-sm text-thb-text-secondary mt-1">Monitor threats, policies, and compliance status</p>
      </div>

      {/* Security Score + Compliance Pie */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Gauge */}
        <div className="thb-card p-6 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 mb-3">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#E2E8F0" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={scoreCfg.stroke} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(securityScore / 100) * 326.7} 326.7`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${scoreCfg.text}`}>{securityScore}</span>
              <span className="text-xs text-thb-text-muted">/ 100</span>
            </div>
          </div>
          <h3 className="font-semibold text-thb-text-primary">Security Score</h3>
          <p className="text-xs text-thb-text-muted mt-1">{securityScore >= 80 ? 'Good posture' : securityScore >= 60 ? 'Needs improvement' : 'Critical issues'}</p>
        </div>

        {/* Compliance Pie */}
        <div className="thb-card p-6">
          <h3 className="font-semibold text-thb-text-primary mb-3">Compliance Status</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val: number) => `${val}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance Details */}
        <div className="thb-card p-6">
          <h3 className="font-semibold text-thb-text-primary mb-3">Compliance Details</h3>
          <div className="space-y-3">
            {compliance.map(c => {
              const cc = COMPLIANCE_CFG[c.status];
              return (
                <div key={c.name} className="flex items-center justify-between">
                  <span className="text-sm text-thb-text-secondary">{c.name}</span>
                  <span className={`thb-badge ${cc.bg} ${cc.text}`}>{c.status === 'compliant' ? 'Compliant' : c.status === 'partial' ? 'Partial' : 'Non-Compliant'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Threats */}
      <div className="thb-card p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FiAlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-thb-text-primary">Active Threats & Alerts</h3>
          <span className="thb-badge bg-red-100 text-red-700 ml-auto">{threats.length}</span>
        </div>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {threats.map(t => {
            const sc = SEVERITY_CFG[t.severity];
            return (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                <span className="mt-0.5">{sc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-thb-text-primary">{t.title}</h4>
                    <span className={`thb-badge ${sc.bg} ${sc.text}`}>{t.severity}</span>
                  </div>
                  <p className="text-xs text-thb-text-secondary mt-1">{t.description}</p>
                </div>
                <span className="text-xs text-thb-text-muted whitespace-nowrap">{formatTimeAgo(t.timestamp)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Policies */}
        <div className="thb-card p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiLock className="w-5 h-5 text-thb-primary" />
            <h3 className="font-semibold text-thb-text-primary">Security Policies</h3>
          </div>
          <div className="space-y-3">
            {policies.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${p.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{p.icon}</div>
                  <div>
                    <h4 className="text-sm font-medium text-thb-text-primary">{p.name}</h4>
                    <p className="text-xs text-thb-text-muted">{p.description}</p>
                  </div>
                </div>
                <button onClick={() => togglePolicy(p.id)} disabled={togglingPolicy === p.id} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${p.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="thb-card p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiClock className="w-5 h-5 text-thb-primary" />
            <h3 className="font-semibold text-thb-text-primary">Recent Events</h3>
          </div>
          <div className="relative pl-6 space-y-4 max-h-80 overflow-y-auto">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-thb-border" />
            {timeline.map(e => (
              <div key={e.id} className="relative">
                <div className="absolute -left-[18px] top-0.5 p-1 rounded-full bg-white">{EVENT_ICON[e.type]}</div>
                <div>
                  <h4 className="text-sm font-medium text-thb-text-primary">{e.title}</h4>
                  <p className="text-xs text-thb-text-secondary mt-0.5">{e.description}</p>
                  <span className="text-xs text-thb-text-muted">{formatTimeAgo(e.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
