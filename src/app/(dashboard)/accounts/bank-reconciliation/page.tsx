'use client';

import { useState } from 'react';
import { FiRefreshCw, FiCheck, FiX, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

const bankLines = [
  { id: '1', date: '2026-06-28', description: 'Client Payment - ABC Corp', amount: 75000, type: 'credit', matched: true },
  { id: '2', date: '2026-06-28', description: 'Salary Disbursement', amount: 450000, type: 'debit', matched: true },
  { id: '3', date: '2026-06-27', description: 'NEFT Transfer In', amount: 25000, type: 'credit', matched: false },
  { id: '4', date: '2026-06-27', description: 'Office Rent Payment', amount: 85000, type: 'debit', matched: true },
  { id: '5', date: '2026-06-26', description: ' Petty Cash Withdrawal', amount: 5000, type: 'debit', matched: false },
  { id: '6', date: '2026-06-25', description: 'Vendor Payment - IT Services', amount: 45000, type: 'debit', matched: true },
  { id: '7', date: '2026-06-24', description: 'Interest Credit', amount: 1200, type: 'credit', matched: false },
  { id: '8', date: '2026-06-23', description: 'Tax Payment - TDS', amount: 32000, type: 'debit', matched: true },
];

const bookEntries = [
  { id: '1', date: '2026-06-28', description: 'ABC Corp Payment Received', amount: 75000, type: 'credit', matched: true },
  { id: '2', date: '2026-06-28', description: 'Payroll - June 2026', amount: 450000, type: 'debit', matched: true },
  { id: '3', date: '2026-06-27', description: 'Rent - July 2026', amount: 85000, type: 'debit', matched: true },
  { id: '4', date: '2026-06-26', description: 'IT Vendor Payment', amount: 45000, type: 'debit', matched: true },
  { id: '5', date: '2026-06-23', description: 'TDS Payment', amount: 32000, type: 'debit', matched: true },
];

export default function BankReconciliationPage() {
  const { user } = useAuthStore();
  const [selectedBank, setSelectedBank] = useState('HDFC Current Account');
  const [searchTerm, setSearchTerm] = useState('');

  const matchedCount = bankLines.filter(l => l.matched).length;
  const unmatchedCount = bankLines.filter(l => !l.matched).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Bank Reconciliation</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Match bank statement lines with your book entries</p>
        </div>
        <button onClick={() => toast.success('Reconciliation saved')} className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium">
          <FiCheck className="w-4 h-4" /> Save Reconciliation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="thb-card p-4">
          <p className="text-lg font-bold text-emerald-600">{matchedCount}</p>
          <p className="text-xs text-thb-text-secondary">Matched</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-lg font-bold text-amber-600">{unmatchedCount}</p>
          <p className="text-xs text-thb-text-secondary">Unmatched</p>
        </div>
        <div className="thb-card p-4">
          <p className="text-lg font-bold text-green-600">{bankLines.length}</p>
          <p className="text-xs text-thb-text-secondary">Total Lines</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
          <option>HDFC Current Account</option>
          <option>ICICI Salary Account</option>
          <option>SBI Business Account</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search transactions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="thb-card p-5">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Bank Statement Lines</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Date</th>
                <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Description</th>
                <th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Amount</th>
                <th className="text-center py-2 px-2 font-semibold text-thb-text-secondary">Status</th>
                <th className="text-center py-2 px-2 font-semibold text-thb-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody>
              {bankLines.filter(l => !searchTerm || l.description.toLowerCase().includes(searchTerm.toLowerCase())).map(line => (
                <tr key={line.id} className={`border-b border-slate-50 ${line.matched ? 'bg-emerald-50/50' : 'bg-amber-50/50'}`}>
                  <td className="py-2 px-2 text-thb-text-muted">{line.date}</td>
                  <td className="py-2 px-2 text-thb-text-primary">{line.description}</td>
                  <td className={`py-2 px-2 text-right font-medium ${line.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>{line.type === 'credit' ? '+' : '-'}₹{line.amount.toLocaleString()}</td>
                  <td className="py-2 px-2 text-center"><span className={line.matched ? 'thb-badge thb-badge-success' : 'thb-badge thb-badge-warning'}>{line.matched ? 'Matched' : 'Unmatched'}</span></td>
                  <td className="py-2 px-2 text-center">{!line.matched && <button onClick={() => toast.success('Line matched')} className="p-1 rounded text-green-600 hover:bg-green-50"><FiCheck className="w-3 h-3" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="thb-card p-5">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Book Entries</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Date</th>
                <th className="text-left py-2 px-2 font-semibold text-thb-text-secondary">Description</th>
                <th className="text-right py-2 px-2 font-semibold text-thb-text-secondary">Amount</th>
                <th className="text-center py-2 px-2 font-semibold text-thb-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookEntries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-50 bg-emerald-50/50">
                  <td className="py-2 px-2 text-thb-text-muted">{entry.date}</td>
                  <td className="py-2 px-2 text-thb-text-primary">{entry.description}</td>
                  <td className={`py-2 px-2 text-right font-medium ${entry.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>{entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString()}</td>
                  <td className="py-2 px-2 text-center"><span className="thb-badge thb-badge-success">Matched</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
