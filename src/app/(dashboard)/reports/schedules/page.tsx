'use client';
import { useEffect, useState } from 'react';

export default function ScheduledReportsPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    reportType: 'payroll',
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    hour: 9,
    minute: 0,
    timezone: 'Asia/Kolkata',
    outputFormat: 'pdf',
    recipients: '[]',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/reports/schedules', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setSchedules(data.schedules || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const token = localStorage.getItem('tb_token');
      // Parse recipients: textarea content as JSON array, or split by comma
      let recipientsJson: any[] = [];
      try {
        recipientsJson = JSON.parse(form.recipients);
      } catch {
        recipientsJson = form.recipients.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ type: 'email', value: email }));
      }
      const r = await fetch('/api/reports/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          reportType: form.reportType,
          frequency: form.frequency,
          dayOfWeek: form.frequency === 'weekly' ? Number(form.dayOfWeek) : undefined,
          dayOfMonth: form.frequency === 'monthly' ? Number(form.dayOfMonth) : undefined,
          hour: Number(form.hour),
          minute: Number(form.minute),
          timezone: form.timezone,
          outputFormat: form.outputFormat,
          recipientsJson: recipientsJson,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        alert(err.error || 'Failed to create schedule');
        return;
      }
      setShowForm(false);
      setForm({ ...form, name: '', recipients: '[]' });
      load();
    } catch (e) {
      console.error(e);
    }
  }

  function freqLabel(s: any) {
    if (s.frequency === 'daily') return `Daily @ ${s.hour}:${String(s.minute).padStart(2, '0')}`;
    if (s.frequency === 'weekly') return `Weekly ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek || 0]} @ ${s.hour}:${String(s.minute).padStart(2, '0')}`;
    if (s.frequency === 'monthly') return `Monthly day ${s.dayOfMonth} @ ${s.hour}:${String(s.minute).padStart(2, '0')}`;
    if (s.frequency === 'bi_weekly') return `Bi-weekly @ ${s.hour}:${String(s.minute).padStart(2, '0')}`;
    return s.frequency;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Reports</h1>
          <p className="text-sm text-gray-600 mt-1">Automated report distribution via email / Collaboration Hub (REQ-ENG-08)</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
          {showForm ? 'Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Name
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-2 py-1" />
            </label>
            <label className="text-sm">
              Report Type
              <select value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })} className="w-full border rounded px-2 py-1">
                <option value="payroll">Payroll</option>
                <option value="attendance">Attendance</option>
                <option value="utilization">Project Utilization</option>
                <option value="recruitment">Recruitment</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-sm">
              Frequency
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full border rounded px-2 py-1">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="bi_weekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {form.frequency === 'weekly' && (
              <label className="text-sm">
                Day of Week
                <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })} className="w-full border rounded px-2 py-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
            )}
            {form.frequency === 'monthly' && (
              <label className="text-sm">
                Day of Month
                <input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })} className="w-full border rounded px-2 py-1" />
              </label>
            )}
            <label className="text-sm">
              Hour (0-23)
              <input type="number" min={0} max={23} value={form.hour} onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })} className="w-full border rounded px-2 py-1" />
            </label>
            <label className="text-sm">
              Minute
              <input type="number" min={0} max={59} value={form.minute} onChange={(e) => setForm({ ...form, minute: Number(e.target.value) })} className="w-full border rounded px-2 py-1" />
            </label>
          </div>
          <label className="text-sm block">
            Recipients (JSON array of {`{type, value}`} or comma-separated emails)
            <textarea
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              placeholder='[{"type":"email","value":"hr@company.com"},{"type":"email","value":"ceo@company.com"}]'
              className="w-full border rounded px-2 py-1 font-mono text-xs"
              rows={3}
            />
          </label>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Create Schedule</button>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Report</th>
              <th className="px-3 py-2 text-left">Schedule</th>
              <th className="px-3 py-2 text-left">TZ</th>
              <th className="px-3 py-2 text-left">Format</th>
              <th className="px-3 py-2 text-left">Recipients</th>
              <th className="px-3 py-2 text-left">Last Run</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-6 text-gray-500">Loading…</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-gray-500">No scheduled reports yet. Click "New Schedule" to create one.</td></tr>
            ) : schedules.map((s) => {
              const recipients = Array.isArray(s.recipientsJson) ? s.recipientsJson : [];
              return (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 capitalize">{s.reportType.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2 text-xs">{freqLabel(s)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.timezone}</td>
                  <td className="px-3 py-2 text-xs uppercase">{s.outputFormat}</td>
                  <td className="px-3 py-2 text-xs">
                    {recipients.map((r: any, i: number) => (
                      <div key={i}>{r.type === 'email' ? '📧' : '💬'} {r.value}</div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.isActive ? 'Active' : 'Paused'}
                    </span>
                    {s.lastRunStatus === 'failed' && (
                      <div className="text-xs text-red-600 mt-1" title={s.lastRunError || ''}>⚠ Failed</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-700">
        ℹ️ A Vercel Cron job runs every 15 minutes to dispatch due reports. Recipients receive reports via email or Collaboration Hub notifications based on the {`{type, value}`} entries.
      </div>
    </div>
  );
}
