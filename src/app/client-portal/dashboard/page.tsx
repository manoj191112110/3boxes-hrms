'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClientPortalDashboard() {
  const [data, setData] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem('clientPortalToken');
    if (!token) { window.location.href = '/client-portal/login'; return; }
    (async () => {
      const [d, a] = await Promise.all([
        fetch('/api/client-portal/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/client-portal/approvals', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (d.status === 401) { window.location.href = '/client-portal/login'; return; }
      setData(await d.json()); setApprovals((await a.json()).approvals || []);
    })();
  }, []);
  async function approve(id: string, status: string) {
    const token = localStorage.getItem('clientPortalToken');
    await fetch('/api/client-portal/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ approvalId: id, status }) });
    const a = await fetch('/api/client-portal/approvals', { headers: { Authorization: `Bearer ${token}` } });
    setApprovals((await a.json()).approvals || []);
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Client Portal Dashboard</h1>
          <button onClick={() => { localStorage.removeItem('clientPortalToken'); window.location.href = '/client-portal/login'; }} className="text-sm text-red-600">Logout</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Active Projects</div><div className="text-2xl font-bold">{data.projects?.length || 0}</div></div>
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Pending Approvals</div><div className="text-2xl font-bold text-yellow-600">{data.pendingApprovals || 0}</div></div>
          <div className="bg-white rounded-lg p-4 shadow"><div className="text-xs text-gray-500">Total Invoices</div><div className="text-2xl font-bold">{data.invoices?.length || 0}</div></div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Timesheet Approvals</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Project</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-center">Action</th></tr></thead>
            <tbody>
              {approvals.map((a: any) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-2">{a.timesheet?.employee ? `${a.timesheet.employee.firstName} ${a.timesheet.employee.lastName}` : '-'}</td>
                  <td className="px-3 py-2">{a.timesheet?.project?.name || '-'}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded ${a.status === 'approved' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span></td>
                  <td className="px-3 py-2 text-center">
                    {a.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => approve(a.id, 'approved')} className="text-xs px-2 py-1 bg-green-600 text-white rounded">✓</button>
                        <button onClick={() => approve(a.id, 'rejected')} className="text-xs px-2 py-1 bg-red-600 text-white rounded">✗</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {approvals.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No pending timesheet approvals</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Your Invoices</h3>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Due</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
            <tbody>
              {data.invoices?.map((i: any) => (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{i.invoiceNumber}</td>
                  <td className="px-3 py-2 text-right">{i.currency} {i.totalAmount?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '-'}</td>
                  <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">{i.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
