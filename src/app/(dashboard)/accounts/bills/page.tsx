'use client';

import { useState } from 'react';
import {
  FiFileText, FiPlus, FiSearch, FiX, FiDollarSign, FiCalendar, FiEye, FiEdit2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

const demoBills: Array<{ id: string; vendor: string; amount: number; date: string; dueDate: string; status: string; category: string }> = [];

function getStatusBadge(status: string) {
  const map: Record<string, string> = { Draft: 'thb-badge thb-badge-info', Pending: 'thb-badge thb-badge-warning', Paid: 'thb-badge thb-badge-success', Overdue: 'thb-badge thb-badge-error' };
  return map[status] || 'thb-badge thb-badge-info';
}

export default function AccountsBillsPage() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = demoBills.filter(b => b.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || b.id.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Bills (Accounts Payable)</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Manage vendor bills and payments</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
          <FiPlus className="w-4 h-4" /> New Bill
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bills', value: '₹3.69L', color: 'text-green-600' },
          { label: 'Paid', value: '₹0.85L', color: 'text-emerald-600' },
          { label: 'Pending', value: '₹1.44L', color: 'text-amber-600' },
          { label: 'Overdue', value: '₹0.45L', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="thb-card p-4">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-thb-text-secondary">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-xs">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search bills..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
      </div>

      <div className="thb-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Bill #</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Vendor</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Category</th>
              <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Amount</th>
              <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Due Date</th>
              <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Status</th>
              <th className="text-center py-3 px-4 font-semibold text-thb-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(bill => (
              <tr key={bill.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3 px-4 font-mono text-green-600 font-medium">{bill.id}</td>
                <td className="py-3 px-4 text-thb-text-primary">{bill.vendor}</td>
                <td className="py-3 px-4 text-thb-text-secondary">{bill.category}</td>
                <td className="py-3 px-4 text-right font-medium">₹{bill.amount.toLocaleString()}</td>
                <td className="py-3 px-4 text-thb-text-secondary">{bill.dueDate}</td>
                <td className="py-3 px-4 text-center"><span className={getStatusBadge(bill.status)}>{bill.status}</span></td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50"><FiEye className="w-3.5 h-3.5" /></button>
                    {bill.status !== 'Paid' && <button onClick={() => toast.success('Payment scheduled')} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"><FiDollarSign className="w-3.5 h-3.5" /></button>}
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
              <h3 className="text-lg font-bold text-thb-text-primary">New Bill</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><FiX className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Vendor</label><input type="text" placeholder="Vendor name" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Amount</label><input type="number" placeholder="0" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
                <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Due Date</label><input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" /></div>
              </div>
              <div><label className="block text-sm font-medium text-thb-text-secondary mb-1">Category</label><select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20"><option>IT Services</option><option>Supplies</option><option>Insurance</option><option>Marketing</option><option>Consulting</option></select></div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setShowCreateModal(false); toast.success('Bill created'); }} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">Create Bill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
