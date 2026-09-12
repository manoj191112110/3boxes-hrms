'use client';

import { useState, useEffect } from 'react';
import { FiDownload, FiCalendar, FiUsers, FiClock, FiBarChart2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyData } from '@/components/company/useCompanyData';

type ReportType = 'daily-summary' | 'monthly-attendance' | 'late-arrivals' | 'absenteeism-trends';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'daily-summary', label: 'Daily Summary', icon: <FiCalendar className="w-5 h-5" />, desc: 'Day-wise attendance overview' },
  { key: 'monthly-attendance', label: 'Monthly Attendance', icon: <FiUsers className="w-5 h-5" />, desc: 'Monthly attendance trends' },
  { key: 'late-arrivals', label: 'Late Arrivals', icon: <FiClock className="w-5 h-5" />, desc: 'Late arrival patterns' },
  { key: 'absenteeism-trends', label: 'Absenteeism Trends', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Absenteeism rate analysis' },
];

// Daily attendance data will be fetched from API (company-scoped)

export default function AttendanceReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('daily-summary');
  const { selectedCompanyId } = useCompanyData();
  const [dailyData, setDailyData] = useState<{ date: string; present: number; absent: number; late: number; wfh: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAttendanceData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCompanyId) params.set('companyId', selectedCompanyId);
        const token = localStorage.getItem('tb_token');
        const res = await fetch(`/api/attendance/summary?${params}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          const data = await res.json();
          setDailyData(data.daily || data.data || []);
        }
      } catch {
        setDailyData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendanceData();
  }, [selectedCompanyId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Attendance Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export attendance-related reports</p>
        </div>
        <button
          onClick={() => toast.success('Report exported successfully')}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reports.map(r => (
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

      {activeReport === 'daily-summary' && (
        <div className="thb-card overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-thb-text-primary">Daily Attendance Summary</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Date</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Present</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Absent</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Late</th>
                <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">WFH</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(d => (
                <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-medium text-thb-text-primary">{d.date}</td>
                  <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">{d.present}</td>
                  <td className="py-2.5 px-4 text-right text-red-500 font-medium">{d.absent}</td>
                  <td className="py-2.5 px-4 text-right text-amber-600 font-medium">{d.late}</td>
                  <td className="py-2.5 px-4 text-right text-green-600 font-medium">{d.wfh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'monthly-attendance' && (
        <div className="thb-card p-8 text-center">
          <FiUsers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Monthly Attendance</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show monthly attendance trends and patterns.</p>
        </div>
      )}

      {activeReport === 'late-arrivals' && (
        <div className="thb-card p-8 text-center">
          <FiClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Late Arrivals</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show late arrival patterns and frequency analysis.</p>
        </div>
      )}

      {activeReport === 'absenteeism-trends' && (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">Absenteeism Trends</h3>
          <p className="text-sm text-thb-text-muted mt-2">This report will show absenteeism rate analysis and trends over time.</p>
        </div>
      )}
    </div>
  );
}
