'use client';

// REQ-AI-PAY-01 / 02 / 03 — AI Payroll Insights Dashboard
// Single page combining all three AI payroll features.

import { useEffect, useState, useCallback } from 'react';
import {
  FiAlertTriangle, FiRefreshCw, FiActivity, FiEye, FiCheck,
  FiX, FiExternalLink, FiClock, FiUserX, FiBell,
  FiShield, FiSearch,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Anomaly {
  id: string; payrollRunId: string | null; employeeId: string | null;
  anomalyType: string; severity: string; metricName: string | null;
  observedValue: number | null; baselineValue: number | null;
  deviationPct: number | null; detectionMethod: string; description: string;
  status: string; resolutionNotes: string | null; detectedAt: string;
  employee?: { employeeId: string; firstName: string; lastName: string; email: string };
}

interface ComplianceAlert {
  id: string; countryCode: string; authorityName: string; changeType: string;
  title: string; description: string; sourceUrl: string | null; sourceName: string | null;
  effectiveDate: string; announcedDate: string; impactLevel: string;
  affectedComponents: string | null; status: string; notes: string | null;
}

interface GhostFlag {
  id: string; employeeId: string; payrollPeriod: string;
  timesheetHours: number; adLoginCount: number; emailSentCount: number;
  hasProjectAllocation: boolean; lastActiveDate: string | null;
  riskScore: number; riskFactors: string | null; status: string;
  resolutionNotes: string | null; detectedAt: string;
  employee?: { employeeId: string; firstName: string; lastName: string; email: string; department?: { name: string } };
}

type TabKey = 'anomalies' | 'compliance' | 'ghosts';

export default function PayrollAIInsightsPage() {
  const [tab, setTab] = useState<TabKey>('anomalies');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [anomalySummary, setAnomalySummary] = useState<{ total: number; open: number; critical: number; high: number } | null>(null);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [alertSummary, setAlertSummary] = useState<{ total: number; critical: number; high: number } | null>(null);
  const [ghosts, setGhosts] = useState<GhostFlag[]>([]);
  const [ghostSummary, setGhostSummary] = useState<{ total: number; open: number; confirmedFraud: number; avgRiskScore: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanRunId, setScanRunId] = useState('');
  const [filter, setFilter] = useState('');

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/payroll/ai/anomalies', window.location.origin);
      if (scanRunId) url.searchParams.set('payrollRunId', scanRunId);
      if (filter) url.searchParams.set('status', filter);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch anomalies');
      const json = await res.json();
      setAnomalies(json.data || []);
      if (json.summary) setAnomalySummary({ total: json.summary.total, open: json.summary.open, critical: json.summary.critical, high: json.summary.high });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [scanRunId, filter]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/payroll/ai/compliance-alerts', window.location.origin);
      url.searchParams.set('seed', 'true');
      if (filter) url.searchParams.set('status', filter);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const json = await res.json();
      setAlerts(json.data || []);
      if (json.summary) {
        setAlertSummary({ total: json.summary.total, critical: json.summary.byImpact.critical, high: json.summary.byImpact.high });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  const fetchGhosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/payroll/ai/ghost-employees', window.location.origin);
      if (scanRunId) url.searchParams.set('payrollRunId', scanRunId);
      if (filter) url.searchParams.set('status', filter);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch ghost flags');
      const json = await res.json();
      setGhosts(json.data || []);
      if (json.summary) {
        setGhostSummary({
          total: json.summary.total, open: json.summary.open,
          confirmedFraud: json.summary.confirmedFraud,
          avgRiskScore: Math.round(json.summary.avgRiskScore || 0),
        });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [scanRunId, filter]);

  useEffect(() => {
    if (tab === 'anomalies') fetchAnomalies();
    else if (tab === 'compliance') fetchAlerts();
    else if (tab === 'ghosts') fetchGhosts();
  }, [tab, fetchAnomalies, fetchAlerts, fetchGhosts]);

  const runScan = async () => {
    if (!scanRunId) { toast.error('Enter a payroll run ID to scan'); return; }
    setScanning(true);
    try {
      let res: Response;
      if (tab === 'anomalies') {
        res = await fetch(`/api/payroll/ai/anomalies?scan=true&payrollRunId=${scanRunId}`, { headers: getAuthHeaders() });
      } else if (tab === 'ghosts') {
        res = await fetch(`/api/payroll/ai/ghost-employees?scan=true&payrollRunId=${scanRunId}`, { headers: getAuthHeaders() });
      } else {
        toast('Compliance alerts are populated via the scraper / POST endpoint — no scan needed', { icon: 'ℹ️' });
        setScanning(false); return;
      }
      if (!res.ok) throw new Error('Scan failed');
      const json = await res.json();
      const sr = json.scanResults;
      if (sr) toast.success(`Scan complete — scanned ${sr.scanned} employees, detected ${sr.detected} new flags`);
      if (tab === 'anomalies') fetchAnomalies(); else fetchGhosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally { setScanning(false); }
  };

  const updateAnomaly = async (id: string, status: string, notes?: string) => {
    try {
      const res = await fetch('/api/payroll/ai/anomalies', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ id, status, resolutionNotes: notes || '' }) });
      if (!res.ok) throw new Error('Update failed');
      toast.success(`Anomaly marked as ${status}`);
      fetchAnomalies();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
  };

  const updateAlert = async (id: string, status: string, notes?: string) => {
    try {
      const res = await fetch('/api/payroll/ai/compliance-alerts', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ id, status, notes: notes || '' }) });
      if (!res.ok) throw new Error('Update failed');
      toast.success(`Alert marked as ${status}`);
      fetchAlerts();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
  };

  const updateGhost = async (id: string, status: string, notes?: string) => {
    try {
      const res = await fetch('/api/payroll/ai/ghost-employees', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ id, status, resolutionNotes: notes || '' }) });
      if (!res.ok) throw new Error('Update failed');
      toast.success(`Flag marked as ${status}`);
      fetchGhosts();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
  };

  const severityColor = (s: string) => ({
    CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-green-100 text-green-700 border-green-200',
  } as Record<string, string>)[s] || 'bg-slate-100 text-slate-700 border-slate-200';

  const statusColor = (s: string) => ({
    OPEN: 'bg-red-100 text-red-700',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
    INVESTIGATING: 'bg-green-100 text-green-700',
    RESOLVED: 'bg-emerald-100 text-emerald-700',
    FALSE_POSITIVE: 'bg-slate-100 text-slate-700',
    NEW: 'bg-green-100 text-green-700',
    IN_REVIEW: 'bg-amber-100 text-amber-700',
    APPLIED: 'bg-emerald-100 text-emerald-700',
    IGNORED: 'bg-slate-100 text-slate-700',
    CONFIRMED_FRAUD: 'bg-red-100 text-red-700',
    CONFIRMED_BENCH: 'bg-amber-100 text-amber-700',
  } as Record<string, string>)[s] || 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiActivity className="w-6 h-6 text-teal-500" />
            AI Payroll Insights
          </h1>
          <p className="text-thb-text-secondary mt-1">Anomaly detection · Compliance change tracking · Ghost employee detection</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" value={scanRunId} onChange={(e) => setScanRunId(e.target.value)} placeholder="Payroll Run ID (for scan)" className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary placeholder:text-slate-400 w-64" />
          <button onClick={runScan} disabled={scanning} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm transition-colors disabled:opacity-50">
            <FiRefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning…' : 'Run AI Scan'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className={`thb-card p-4 border-l-4 ${tab === 'anomalies' ? 'border-teal-500' : 'border-transparent'}`}>
          <button onClick={() => setTab('anomalies')} className="w-full text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiAlertTriangle className="w-5 h-5 text-teal-500" /></div>
              <div>
                <p className="text-xs font-medium text-thb-text-secondary">Anomalies</p>
                <p className="text-xl font-bold text-thb-text-primary">{anomalySummary?.total ?? 0}</p>
                <p className="text-xs text-red-600">{anomalySummary?.open ?? 0} open · {anomalySummary?.critical ?? 0} critical</p>
              </div>
            </div>
          </button>
        </div>
        <div className={`thb-card p-4 border-l-4 ${tab === 'compliance' ? 'border-amber-500' : 'border-transparent'}`}>
          <button onClick={() => setTab('compliance')} className="w-full text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FiBell className="w-5 h-5 text-amber-500" /></div>
              <div>
                <p className="text-xs font-medium text-thb-text-secondary">Compliance Alerts</p>
                <p className="text-xl font-bold text-thb-text-primary">{alertSummary?.total ?? 0}</p>
                <p className="text-xs text-red-600">{alertSummary?.critical ?? 0} critical · {alertSummary?.high ?? 0} high</p>
              </div>
            </div>
          </button>
        </div>
        <div className={`thb-card p-4 border-l-4 ${tab === 'ghosts' ? 'border-red-500' : 'border-transparent'}`}>
          <button onClick={() => setTab('ghosts')} className="w-full text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><FiUserX className="w-5 h-5 text-red-500" /></div>
              <div>
                <p className="text-xs font-medium text-thb-text-secondary">Ghost Employees</p>
                <p className="text-xl font-bold text-thb-text-primary">{ghostSummary?.total ?? 0}</p>
                <p className="text-xs text-red-600">{ghostSummary?.confirmedFraud ?? 0} confirmed · avg risk {ghostSummary?.avgRiskScore ?? 0}</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by status (OPEN, RESOLVED, etc.)" className="pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary w-72" />
        </div>
        <button onClick={() => { if (tab === 'anomalies') fetchAnomalies(); else if (tab === 'compliance') fetchAlerts(); else fetchGhosts(); }} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="thb-card p-12 text-center text-thb-text-secondary">Loading…</div>
      ) : tab === 'anomalies' ? (
        anomalies.length === 0 ? (
          <EmptyState icon={<FiAlertTriangle className="w-8 h-8" />} text="No anomalies detected. Run an AI scan to populate this list." />
        ) : (
          <div className="space-y-3">
            {anomalies.map((a) => (
              <div key={a.id} className="thb-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${severityColor(a.severity)}`}>{a.severity}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">{a.anomalyType.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusColor(a.status)}`}>{a.status}</span>
                      {a.employee && <span className="text-xs text-thb-text-secondary">{a.employee.firstName} {a.employee.lastName} ({a.employee.employeeId})</span>}
                    </div>
                    <p className="text-sm text-thb-text-primary font-medium">{a.description}</p>
                    {a.deviationPct !== null && (
                      <p className="text-xs text-thb-text-secondary mt-1">Observed: {a.observedValue?.toFixed(2)} vs. baseline: {a.baselineValue?.toFixed(2)} ({a.deviationPct > 0 ? '+' : ''}{a.deviationPct.toFixed(0)}%)</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">Detected {new Date(a.detectedAt).toLocaleString()} via {a.detectionMethod}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {a.status === 'OPEN' && (
                      <>
                        <button onClick={() => updateAnomaly(a.id, 'ACKNOWLEDGED')} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Acknowledge"><FiEye className="w-4 h-4" /></button>
                        <button onClick={() => updateAnomaly(a.id, 'RESOLVED')} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Mark resolved"><FiCheck className="w-4 h-4" /></button>
                        <button onClick={() => updateAnomaly(a.id, 'FALSE_POSITIVE')} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="False positive"><FiX className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'compliance' ? (
        alerts.length === 0 ? (
          <EmptyState icon={<FiBell className="w-8 h-8" />} text="No compliance alerts. Click 'Run AI Scan' to seed demo data, or POST new alerts via the API." />
        ) : (
          <div className="space-y-3">
            {alerts.map((c) => (
              <div key={c.id} className="thb-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${severityColor(c.impactLevel)}`}>{c.impactLevel}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">{c.changeType.replace(/_/g, ' ')}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">{c.countryCode}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusColor(c.status)}`}>{c.status}</span>
                      <span className="text-xs text-thb-text-secondary">{c.authorityName}</span>
                    </div>
                    <p className="text-sm font-semibold text-thb-text-primary">{c.title}</p>
                    <p className="text-xs text-thb-text-secondary mt-1 leading-relaxed">{c.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><FiClock className="w-3 h-3" /> Effective: {new Date(c.effectiveDate).toLocaleDateString()}</span>
                      {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 hover:underline"><FiExternalLink className="w-3 h-3" /> Source</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.status === 'NEW' && <button onClick={() => updateAlert(c.id, 'ACKNOWLEDGED')} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Acknowledge"><FiEye className="w-4 h-4" /></button>}
                    {(c.status === 'ACKNOWLEDGED' || c.status === 'IN_REVIEW') && <button onClick={() => updateAlert(c.id, 'APPLIED')} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Mark applied"><FiCheck className="w-4 h-4" /></button>}
                    {c.status !== 'IGNORED' && <button onClick={() => updateAlert(c.id, 'IGNORED')} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Ignore"><FiX className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'ghosts' ? (
        ghosts.length === 0 ? (
          <EmptyState icon={<FiUserX className="w-8 h-8" />} text="No ghost employee candidates. Run an AI scan with a payroll run ID to populate." />
        ) : (
          <div className="space-y-3">
            {ghosts.map((g) => (
              <div key={g.id} className="thb-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${g.riskScore >= 70 ? 'bg-red-100 text-red-700' : g.riskScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>Risk: {g.riskScore.toFixed(0)}/100</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusColor(g.status)}`}>{g.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-thb-text-secondary">Period: {g.payrollPeriod}</span>
                      {g.employee && <span className="text-xs text-thb-text-secondary">{g.employee.firstName} {g.employee.lastName} ({g.employee.employeeId}){g.employee.department?.name && ` · ${g.employee.department.name}`}</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                      <div><span className="text-slate-500">Timesheet:</span> <span className="font-semibold text-thb-text-primary">{g.timesheetHours.toFixed(1)} hrs</span></div>
                      <div><span className="text-slate-500">AD Logins:</span> <span className="font-semibold text-thb-text-primary">{g.adLoginCount}</span></div>
                      <div><span className="text-slate-500">Project:</span> <span className={`font-semibold ${g.hasProjectAllocation ? 'text-emerald-600' : 'text-red-600'}`}>{g.hasProjectAllocation ? 'Allocated' : 'None'}</span></div>
                      <div><span className="text-slate-500">Last active:</span> <span className="font-semibold text-thb-text-primary">{g.lastActiveDate ? new Date(g.lastActiveDate).toLocaleDateString() : 'Never'}</span></div>
                    </div>
                    {g.riskFactors && <div className="mt-2 text-xs text-slate-500">Risk factors: {JSON.parse(g.riskFactors).join(', ')}</div>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {g.status === 'OPEN' && (
                      <>
                        <button onClick={() => updateGhost(g.id, 'INVESTIGATING')} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Start investigating"><FiSearch className="w-4 h-4" /></button>
                        <button onClick={() => updateGhost(g.id, 'CONFIRMED_FRAUD')} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Confirm fraud"><FiAlertTriangle className="w-4 h-4" /></button>
                        <button onClick={() => updateGhost(g.id, 'CONFIRMED_BENCH')} className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Bench resource (legit)"><FiCheck className="w-4 h-4" /></button>
                        <button onClick={() => updateGhost(g.id, 'FALSE_POSITIVE')} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="False positive"><FiX className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      <div className="thb-card p-4 bg-slate-50/50">
        <div className="flex items-start gap-3">
          <FiShield className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-thb-text-primary mb-1">AI Payroll Compliance Matrix</p>
            <ul className="text-xs text-thb-text-secondary space-y-1">
              <li>• <strong>REQ-AI-PAY-01</strong>: Statistical + rule-based detection of net-pay spikes, OT spikes, gross drops, zero-tax anomalies, duplicate bank accounts, and minimum-wage breaches.</li>
              <li>• <strong>REQ-AI-PAY-02</strong>: Surfaces upcoming statutory changes (tax slabs, social security rates, wage caps, filing formats) scraped from tax authority sources.</li>
              <li>• <strong>REQ-AI-PAY-03</strong>: Cross-references active payroll with Timesheet + AD login activity to detect ghost employees receiving pay with zero activity.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="thb-card p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-3">{icon}</div>
      <p className="text-sm text-thb-text-secondary">{text}</p>
    </div>
  );
}
