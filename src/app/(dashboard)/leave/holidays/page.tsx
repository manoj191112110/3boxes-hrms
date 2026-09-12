'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiCalendar, FiChevronDown, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Holiday {
  date: string;
  day: string;
  name: string;
  type: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDayName(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long' });
}

export default function HolidaysPage() {
  useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const params = new URLSearchParams({ year: selectedYear });
      const r = await fetch(`/api/holidays?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error('Failed to load holidays');
      const d = await r.json();
      const list = d.holidays || [];
      const mapped = list.map((h: Record<string, unknown>) => ({
        date: String(h.date || ''),
        day: h.day ? String(h.day) : getDayName(String(h.date || '')),
        name: String(h.name || ''),
        type: String(h.type || 'Public'),
      }));
      setHolidays(mapped);
    } catch {
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, scopeQuery, selectedTenantId]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const publicCount = holidays.filter(h => h.type === 'Public').length;
  const restrictedCount = holidays.filter(h => h.type === 'Restricted').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiCalendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Holiday Calendar</h1>
            <p className="text-sm text-thb-text-secondary">Company holidays for the year {selectedYear}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Year Selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-white border border-thb-border rounded-lg px-4 py-2 pr-8 text-sm font-medium text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted pointer-events-none" />
          </div>
          <button onClick={fetchHolidays} className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 rounded-lg text-sm transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-thb-text-secondary">Public Holiday ({publicCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-thb-text-secondary">Restricted Holiday ({restrictedCount})</span>
        </div>
      </div>

      {/* Holiday Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Day</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Holiday</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : holidays.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-500">
                  <FiCalendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No holidays configured for {selectedYear}.
                </td></tr>
              ) : holidays.map((h, idx) => (
                <tr key={idx} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{formatDate(h.date)}</td>
                  <td className="px-5 py-3 text-sm text-thb-text-secondary">{h.day}</td>
                  <td className="px-5 py-3 text-sm text-thb-text-primary">{h.name}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${h.type === 'Public' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${h.type === 'Public' ? 'bg-green-500' : 'bg-amber-500'}`} />
                      {h.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {holidays.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-thb-border">
            <p className="text-xs text-thb-text-muted">Total: {holidays.length} holidays — {publicCount} Public, {restrictedCount} Restricted</p>
          </div>
        )}
      </div>
    </div>
  );
}
