'use client';

import { useState } from 'react';
import {
  FiFileText, FiPlus, FiSearch, FiFilter, FiEye, FiEdit2, FiTrash2, FiX, FiDollarSign,
  FiCalendar, FiDownload, FiUser, FiCheck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const demoInvoices: Array<{ id: string; client: string; amount: number; date: string; dueDate: string; status: string; items: number }> = [];

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    Draft: 'thb-badge thb-badge-info',
    Sent: 'thb-badge thb-badge-warning',
    Paid: 'thb-badge thb-badge-success',
    Overdue: 'thb-badge thb-badge-error',
    Cancelled: 'bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-medium',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

export default function AccountsInvoicesPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = demoInvoices.filter(inv => {
    const matchSearch = inv.client.toLowerCase().includes(searchTerm.toLowerCase()) || inv.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Invoices (Accounts Receivable)</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Manage customer invoices and payments</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
          <FiPlus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoiced', value: '₹19.75L', color: 'text-green-600' },
          { label: 'Paid', value: '₹6.3L', color: 'text-emerald-600' },
          { label: 'Pending', value: '₹6.3L', color: 'text-amber-600' },
          { label: 'Overdue', value: '₹6.2L', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="thb-card p-4">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-thb-text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
          <option value="all">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      <div className="thb-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Invoice #</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Client</th>
              <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Amount</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Due Date</th>
              <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Status</th>
              <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3 px-4 font-mono text-green-600 font-medium">{inv.id}</td>
                <td className="py-3 px-4 text-thb-text-primary">{inv.client}</td>
                <td className="py-3 px-4 text-right font-medium">₹{inv.amount.toLocaleString()}</td>
                <td className="py-3 px-4 text-thb-text-secondary">{inv.date}</td>
                <td className="py-3 px-4 text-thb-text-secondary">{inv.dueDate}</td>
                <td className="py-3 px-4 text-center"><span className={getStatusBadge(inv.status)}>{inv.status}</span></td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50"><FiEye className="w-3.5 h-3.5" /></button>
                    {inv.status !== 'Paid' && <button onClick={() => toast.success('Payment recorded')} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"><FiDollarSign className="w-3.5 h-3.5" /></button>}
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50"><FiEdit2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-thb-text-primary">Create Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><FiX className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Client</label><input type="text" placeholder="Client name" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Amount</label><input type="number" placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Due Date</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
              </div>
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Description</label><textarea rows={2} placeholder="Invoice description" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setShowCreateModal(false); toast.success('Invoice created'); }} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">Create Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
