'use client';

// REQ-7.2 — Cross-Border Mobility / Secondment Management
// --------------------------------------------------------
// Tracks employees seconded to a host country while keeping their home
// country social security active (e.g. via a Certificate of Coverage /
// A1 certificate / Totalization Agreement).

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlus, FiX, FiRefreshCw, FiGlobe, FiEdit2, FiCheck,
  FiInfo, FiMap,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Secondment {
  id: string;
  employeeId: string;
  homeCompanyId: string;
  hostCompanyId: string;
  homeCountry: string;
  hostCountry: string;
  startDate: string;
  endDate: string | null;
  certificateRef: string | null;
  taxResidencyStatus: string;
  ssCoverageCountry: string;
  homePayPct: number;
  hostPayPct: number;
  homeCurrency: string;
  hostCurrency: string;
  status: string;
  notes: string | null;
  employee?: { employeeId: string; firstName: string; lastName: string; email: string; department?: { name: string } };
}

interface Company {
  id: string; name: string; country: string | null; currency: string;
}

export default function SecondmentPage() {
  const [secondments, setSecondments] = useState<Secondment[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; completed: number; cancelled: number } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ALL'>('ACTIVE');

  // Form state
  const [form, setForm] = useState({
    employeeId: '',
    homeCompanyId: '',
    hostCompanyId: '',
    homeCountry: '',
    hostCountry: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    certificateRef: '',
    taxResidencyStatus: 'HOME',
    ssCoverageCountry: 'HOME',
    homePayPct: 100,
    hostPayPct: 0,
    homeCurrency: 'INR',
    hostCurrency: 'INR',
    notes: '',
  });

  const fetchSecondments = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/payroll/secondments', window.location.origin);
      if (filter !== 'ALL') url.searchParams.set('status', filter);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch secondments');
      const json = await res.json();
      setSecondments(json.data || []);
      if (json.summary) setSummary({ total: json.summary.total, active: json.summary.active, completed: json.summary.completed, cancelled: json.summary.cancelled });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.data || json || []);
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }, []);

  useEffect(() => { fetchSecondments(); fetchCompanies(); }, [fetchSecondments, fetchCompanies]);

  const handleCreate = async () => {
    if (!form.employeeId || !form.homeCompanyId || !form.hostCompanyId) {
      toast.error('Employee, home company, and host company are required');
      return;
    }
    if (form.homeCompanyId === form.hostCompanyId) {
      toast.error('Home and host companies must differ');
      return;
    }
    if (Math.abs(form.homePayPct + form.hostPayPct - 100) > 0.5) {
      toast.error('Home % + Host % must equal 100');
      return;
    }
    try {
      const res = await fetch('/api/payroll/secondments', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ ...form, endDate: form.endDate || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');
      toast.success('Secondment created');
      setShowForm(false);
      fetchSecondments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleAction = async (id: string, action: 'complete' | 'cancel', notes?: string) => {
    try {
      const res = await fetch('/api/payroll/secondments', {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ id, action, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      toast.success(`Secondment ${action}d`);
      fetchSecondments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const statusColor = (s: string) => ({
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  } as Record<string, string>)[s] || 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiGlobe className="w-6 h-6 text-cyan-500" />
            Cross-Border Secondment
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage employees seconded across countries with split pay & SS coverage</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary">
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </select>
          <button onClick={fetchSecondments} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 font-medium text-sm shadow-sm">
            <FiPlus className="w-4 h-4" /> New Secondment
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="thb-card p-3 bg-slate-50"><p className="text-xs font-medium text-slate-600">Total</p><p className="text-2xl font-bold text-thb-text-primary">{summary.total}</p></div>
          <div className="thb-card p-3 bg-emerald-50"><p className="text-xs font-medium text-emerald-700">Active</p><p className="text-2xl font-bold text-emerald-700">{summary.active}</p></div>
          <div className="thb-card p-3 bg-green-50"><p className="text-xs font-medium text-green-700">Completed</p><p className="text-2xl font-bold text-green-700">{summary.completed}</p></div>
          <div className="thb-card p-3 bg-red-50"><p className="text-xs font-medium text-red-700">Cancelled</p><p className="text-2xl font-bold text-red-700">{summary.cancelled}</p></div>
        </div>
      )}

      {/* Info banner */}
      <div className="thb-card p-4 border-l-4 border-cyan-500 bg-cyan-50/30">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-cyan-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-thb-text-primary">Cross-Border Tax & Social Security</p>
            <p className="text-xs text-thb-text-secondary mt-1">
              When an employee works in a host country, the payroll engine uses these records to apply the correct statutory components. The Certificate of Coverage (CoC) / A1 certificate keeps home-country social security active when a totalization agreement exists. The split pay percentages (home vs. host) drive which payroll processes each portion.
            </p>
          </div>
        </div>
      </div>

      {/* Secondment list */}
      {loading ? (
        <div className="thb-card p-12 text-center text-thb-text-secondary">Loading…</div>
      ) : secondments.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-3"><FiMap className="w-8 h-8" /></div>
          <p className="text-sm text-thb-text-secondary">No {filter !== 'ALL' ? filter.toLowerCase() : ''} secondments.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {secondments.map((s) => (
            <div key={s.id} className="thb-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusColor(s.status)}`}>{s.status}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-100 text-cyan-700">{s.homeCountry} → {s.hostCountry}</span>
                    {s.certificateRef && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-100 text-teal-700">CoC: {s.certificateRef}</span>}
                    {s.employee && (
                      <span className="text-xs text-thb-text-secondary">{s.employee.firstName} {s.employee.lastName} ({s.employee.employeeId}){s.employee.department?.name && ` · ${s.employee.department.name}`}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-500">Start:</span> <span className="font-semibold">{new Date(s.startDate).toLocaleDateString()}</span></div>
                    <div><span className="text-slate-500">End:</span> <span className="font-semibold">{s.endDate ? new Date(s.endDate).toLocaleDateString() : 'Open-ended'}</span></div>
                    <div><span className="text-slate-500">Tax Residency:</span> <span className="font-semibold">{s.taxResidencyStatus}</span></div>
                    <div><span className="text-slate-500">SS Coverage:</span> <span className="font-semibold">{s.ssCoverageCountry}</span></div>
                    <div><span className="text-slate-500">Home Pay:</span> <span className="font-semibold">{s.homePayPct}% ({s.homeCurrency})</span></div>
                    <div><span className="text-slate-500">Host Pay:</span> <span className="font-semibold">{s.hostPayPct}% ({s.hostCurrency})</span></div>
                  </div>
                  {s.notes && <p className="text-xs text-slate-500 mt-2 italic">{s.notes}</p>}
                </div>
                {s.status === 'ACTIVE' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleAction(s.id, 'complete')} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" title="Mark completed"><FiCheck className="w-4 h-4" /></button>
                    <button onClick={() => handleAction(s.id, 'cancel', 'Cancelled by user')} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Cancel"><FiX className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-thb-text-primary">New Cross-Border Secondment</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Employee ID *">
                <input type="text" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" placeholder="Employee ID" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Home Company *">
                  <select value={form.homeCompanyId} onChange={(e) => { const c = companies.find(co => co.id === e.target.value); setForm({ ...form, homeCompanyId: e.target.value, homeCountry: c?.country || '', homeCurrency: c?.currency || 'INR' }); }} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg">
                    <option value="">Select…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
                  </select>
                </Field>
                <Field label="Host Company *">
                  <select value={form.hostCompanyId} onChange={(e) => { const c = companies.find(co => co.id === e.target.value); setForm({ ...form, hostCompanyId: e.target.value, hostCountry: c?.country || '', hostCurrency: c?.currency || 'INR' }); }} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg">
                    <option value="">Select…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Home Country"><input type="text" value={form.homeCountry} onChange={(e) => setForm({ ...form, homeCountry: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" placeholder="US" /></Field>
                <Field label="Host Country"><input type="text" value={form.hostCountry} onChange={(e) => setForm({ ...form, hostCountry: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" placeholder="GB" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date *"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" /></Field>
                <Field label="End Date (optional)"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tax Residency Status">
                  <select value={form.taxResidencyStatus} onChange={(e) => setForm({ ...form, taxResidencyStatus: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg">
                    <option value="HOME">Home</option>
                    <option value="HOST">Host</option>
                    <option value="SPLIT_YEAR">Split Year</option>
                    <option value="TRC_PENDING">TRC Pending</option>
                  </select>
                </Field>
                <Field label="SS Coverage Country">
                  <select value={form.ssCoverageCountry} onChange={(e) => setForm({ ...form, ssCoverageCountry: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg">
                    <option value="HOME">Home (CoC / A1 issued)</option>
                    <option value="HOST">Host</option>
                    <option value="NONE">None</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Home Pay %"><input type="number" min="0" max="100" value={form.homePayPct} onChange={(e) => setForm({ ...form, homePayPct: parseFloat(e.target.value) || 0, hostPayPct: 100 - (parseFloat(e.target.value) || 0) })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" /></Field>
                <Field label="Host Pay %"><input type="number" min="0" max="100" value={form.hostPayPct} onChange={(e) => setForm({ ...form, hostPayPct: parseFloat(e.target.value) || 0, homePayPct: 100 - (parseFloat(e.target.value) || 0) })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" /></Field>
              </div>
              <Field label="Certificate of Coverage Reference"><input type="text" value={form.certificateRef} onChange={(e) => setForm({ ...form, certificateRef: e.target.value })} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" placeholder="CoC / A1 certificate number" /></Field>
              <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg" placeholder="Optional notes" /></Field>
            </div>
            <div className="px-5 py-3 border-t border-thb-border flex items-center justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600">Create Secondment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-thb-text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}
