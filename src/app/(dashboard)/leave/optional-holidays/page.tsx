'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiCalendar, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface OptionalHoliday {
  id: string;
  name: string;
  date: string;
  country: string | null;
  description: string | null;
  optionalQuota: number;
}

interface Election {
  id: string;
  holidayId: string;
  holiday: OptionalHoliday;
}

export default function OptionalHolidaysPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const [data, setData] = useState<{
    optionalHolidays: OptionalHoliday[];
    elections: Election[];
    quota: number;
    used: number;
    remaining: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/holiday-elections${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      // Defensive: ensure all expected fields exist (older API versions may omit them)
      setData({
        optionalHolidays: d.optionalHolidays ?? [],
        elections: d.elections ?? [],
        quota: d.quota ?? 0,
        used: d.used ?? 0,
        remaining: d.remaining ?? 0,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleElect = async (holidayId: string) => {
    try {
      const r = await fetch(`/api/holiday-elections?holidayId=${holidayId}`, { method: 'POST', headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success('Holiday elected');
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleWithdraw = async (electionId: string) => {
    try {
      const r = await fetch(`/api/holiday-elections/${electionId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) throw new Error('Failed');
      toast.success('Election withdrawn');
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiCalendar className="w-6 h-6 text-teal-500" />
            Optional / Festival Holidays
          </h1>
          <p className="text-sm text-slate-500 mt-1">Choose which optional holidays you want to take this year (within your quota)</p>
        </div>
        <button onClick={fetchData} className="3boxes-btn-secondary flex items-center gap-2">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ModuleTips moduleKey="leave-optional-holidays">
        <p><strong>REQ-CFG-05:</strong> Some holidays are optional — your employer publishes a list (e.g. 5 festival days) and you can elect a subset (e.g. choose 2). Your quota is shown below. Once you reach the quota, you cannot elect more holidays — withdraw one first if you want to change your selection.</p>
      </ModuleTips>

      {loading || !data ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-xs uppercase tracking-wider text-slate-500">Your Quota</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">{data.quota}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-xs uppercase tracking-wider text-slate-500">Used</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{data.used}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-xs uppercase tracking-wider text-slate-500">Remaining</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{data.remaining}</p>
            </div>
          </div>

          {data.optionalHolidays.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <FiCalendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No optional holidays published for this year.</p>
              <p className="text-xs text-slate-400 mt-1">Ask HR to configure optional holidays in Settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.optionalHolidays.map(h => {
                const elected = data.elections.find(e => e.holidayId === h.id);
                const canElect = !elected && data.remaining > 0;
                return (
                  <div key={h.id} className={`thb-card p-5 ${elected ? 'border-teal-300 bg-teal-50/30' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{h.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{fmtDate(h.date)}</p>
                        {h.country && <p className="text-[10px] text-slate-400 mt-1">📍 {h.country}</p>}
                      </div>
                      {elected && <span className="text-[10px] font-medium text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">Elected</span>}
                    </div>
                    {h.description && <p className="text-xs text-slate-600 mt-3 leading-relaxed">{h.description}</p>}
                    <div className="mt-4">
                      {elected ? (
                        <button onClick={() => handleWithdraw(elected.id)} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                          <FiX className="w-3 h-3" /> Withdraw
                        </button>
                      ) : canElect ? (
                        <button onClick={() => handleElect(h.id)} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1">
                          <FiCheck className="w-3 h-3" /> Elect this holiday
                        </button>
                      ) : (
                        <p className="text-xs text-slate-400">Quota full — withdraw another to elect this</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
