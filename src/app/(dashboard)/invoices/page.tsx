'use client';

import { useState, useMemo } from 'react';
import {
  FiFileText, FiPlus, FiDownload, FiSearch, FiEye, FiEdit2,
  FiSend, FiTrash2, FiX, FiCheck,
  FiDollarSign, FiClock, FiAlertCircle, FiFilter, FiCopy,
  FiArrowLeft, FiPrinter, FiMoreVertical, FiChevronRight,
} from 'react-icons/fi';
import { formatCurrency } from '@/lib/currency';
import { sanitizeSearch } from '@/lib/validators';

/* ── Helpers ── */
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 thb-badge',
    sent: 'thb-badge thb-badge-info',
    paid: 'thb-badge thb-badge-success',
    overdue: 'thb-badge thb-badge-error',
    partial: 'thb-badge thb-badge-warning',
    issued: 'thb-badge thb-badge-info',
    cancelled: 'bg-slate-200 text-slate-500 thb-badge',
    disputed: 'thb-badge thb-badge-error',
  };
  return map[status] || 'bg-slate-100 text-slate-600 thb-badge';
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ── Types ── */
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

interface SampleInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAvatar: string;
  projectName: string;
  status: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
  payments: PaymentRecord[];
}

/* ── Sample Data removed — data comes from API only ── */
const sampleInvoices: SampleInvoice[] = [];

const STATUS_TABS = [
  { key: '', label: 'All', count: 24 },
  { key: 'draft', label: 'Draft', count: 3 },
  { key: 'sent', label: 'Sent', count: 6 },
  { key: 'paid', label: 'Paid', count: 10 },
  { key: 'overdue', label: 'Overdue', count: 3 },
];

const AVATAR_COLORS: Record<string, string> = {
  AC: 'bg-green-100 text-green-700',
  TS: 'bg-teal-100 text-teal-700',
  GF: 'bg-amber-100 text-amber-700',
  MW: 'bg-pink-100 text-pink-700',
  HP: 'bg-emerald-100 text-emerald-700',
  RM: 'bg-orange-100 text-orange-700',
  DS: 'bg-cyan-100 text-cyan-700',
  EL: 'bg-rose-100 text-rose-700',
  GE: 'bg-green-100 text-green-700',
  FS: 'bg-emerald-100 text-emerald-700',
  LT: 'bg-teal-100 text-teal-700',
  CN: 'bg-teal-100 text-teal-700',
};

const CLIENT_NAMES = [...new Set(sampleInvoices.map(i => i.clientName))];

/* ── Component ── */
export default function InvoicesPage() {
  // State
  const [invoices, setInvoices] = useState<SampleInvoice[]>(sampleInvoices);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SampleInvoice | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Create invoice form
  const [createForm, setCreateForm] = useState({
    clientName: '',
    projectName: '',
    currency: 'USD',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    taxRate: 10,
    notes: '',
  });
  const [createItems, setCreateItems] = useState([
    { description: '', quantity: 1, rate: 0 },
  ]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) &&
            !inv.clientName.toLowerCase().includes(q) &&
            !inv.projectName.toLowerCase().includes(q)) return false;
      }
      if (clientFilter && inv.clientName !== clientFilter) return false;
      if (dateFrom && new Date(inv.issueDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(inv.issueDate) > new Date(dateTo)) return false;
      return true;
    });
  }, [invoices, statusFilter, searchQuery, clientFilter, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const all = invoices;
    return {
      total: all.length,
      paid: all.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0),
      pending: all.filter(i => ['sent', 'partial'].includes(i.status)).reduce((s, i) => s + i.totalAmount - i.payments.reduce((ps, p) => ps + p.amount, 0), 0),
      overdue: all.filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalAmount - i.payments.reduce((ps, p) => ps + p.amount, 0), 0),
    };
  }, [invoices]);

  // Tab counts (dynamic)
  const tabCounts = useMemo(() => ({
    '': invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
  }), [invoices]);

  // Handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    setActionMenuOpen(null);
  };

  const handleDelete = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setActionMenuOpen(null);
  };

  const handleDuplicate = (inv: SampleInvoice) => {
    const newInv: SampleInvoice = {
      ...inv,
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      payments: [],
    };
    setInvoices(prev => [newInv, ...prev]);
    setActionMenuOpen(null);
  };

  const handleCreateSubmit = () => {
    if (!createForm.clientName || createItems.every(it => !it.description)) return;
    const subtotal = createItems.reduce((s, it) => s + it.quantity * it.rate, 0);
    const taxAmount = subtotal * (createForm.taxRate / 100);
    const totalAmount = subtotal + taxAmount;
    const newInv: SampleInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      clientName: createForm.clientName,
      clientEmail: '',
      clientAvatar: createForm.clientName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      projectName: createForm.projectName,
      status: 'draft',
      currency: createForm.currency,
      subtotal,
      taxRate: createForm.taxRate,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      issueDate: createForm.issueDate,
      dueDate: createForm.dueDate || '',
      items: createItems.map((it, idx) => ({
        id: `new-li-${idx}`,
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
        amount: it.quantity * it.rate,
      })),
      notes: createForm.notes,
      payments: [],
    };
    setInvoices(prev => [newInv, ...prev]);
    setShowCreateModal(false);
    setCreateForm({ clientName: '', projectName: '', currency: 'USD', issueDate: new Date().toISOString().split('T')[0], dueDate: '', taxRate: 10, notes: '' });
    setCreateItems([{ description: '', quantity: 1, rate: 0 }]);
  };

  const createSubtotal = createItems.reduce((s, it) => s + it.quantity * it.rate, 0);
  const createTax = createSubtotal * (createForm.taxRate / 100);
  const createTotal = createSubtotal + createTax;

  // Invoice detail view
  if (selectedInvoice) {
    const inv = selectedInvoice;
    const paidAmount = inv.payments.reduce((s, p) => s + p.amount, 0);
    const balanceDue = inv.totalAmount - paidAmount;

    return (
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Back button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedInvoice(null)}
            className="flex items-center gap-2 text-thb-text-secondary hover:text-thb-text-primary transition-colors text-sm font-medium"
          >
            <FiArrowLeft className="w-4 h-4" /> Back to Invoices
          </button>
          <FiChevronRight className="w-4 h-4 text-thb-text-muted" />
          <span className="text-sm font-semibold text-thb-text-primary">{inv.invoiceNumber}</span>
        </div>

        {/* Invoice Header */}
        <div className="thb-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <FiFileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-thb-text-primary">{inv.invoiceNumber}</h1>
                <p className="text-thb-text-secondary mt-0.5">{inv.projectName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={getStatusBadge(inv.status)}>{formatStatus(inv.status)}</span>
                  <span className="text-xs text-thb-text-muted">{inv.currency}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {inv.status === 'draft' && (
                <>
                  <button onClick={() => { handleStatusChange(inv.id, 'sent'); setSelectedInvoice({ ...inv, status: 'sent' }); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                    <FiSend className="w-3.5 h-3.5" /> Send
                  </button>
                  <button onClick={() => { handleStatusChange(inv.id, 'paid'); setSelectedInvoice({ ...inv, status: 'paid' }); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                    <FiCheck className="w-3.5 h-3.5" /> Mark Paid
                  </button>
                </>
              )}
              {inv.status === 'sent' && (
                <button onClick={() => { handleStatusChange(inv.id, 'paid'); setSelectedInvoice({ ...inv, status: 'paid' }); }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                  <FiCheck className="w-3.5 h-3.5" /> Mark Paid
                </button>
              )}
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
                <FiPrinter className="w-3.5 h-3.5" /> Print
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors">
                <FiDownload className="w-3.5 h-3.5" /> Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client & Dates */}
            <div className="thb-card p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted mb-3">Bill To</h3>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${AVATAR_COLORS[inv.clientAvatar] || 'bg-slate-100 text-slate-600'}`}>
                      {inv.clientAvatar}
                    </div>
                    <div>
                      <p className="font-semibold text-thb-text-primary">{inv.clientName}</p>
                      <p className="text-sm text-thb-text-secondary">{inv.clientEmail}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted mb-3">Invoice Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-thb-text-secondary">Issue Date</span>
                      <span className="font-medium text-thb-text-primary">{formatDate(inv.issueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-thb-text-secondary">Due Date</span>
                      <span className={`font-medium ${inv.status === 'overdue' ? 'text-red-600' : 'text-thb-text-primary'}`}>{formatDate(inv.dueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-thb-text-secondary">Project</span>
                      <span className="font-medium text-thb-text-primary">{inv.projectName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="thb-card overflow-hidden">
              <div className="px-6 py-4 border-b border-thb-border">
                <h3 className="text-sm font-semibold text-thb-text-primary">Line Items</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Description</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Rate</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thb-border">
                    {inv.items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-thb-text-primary">{item.description}</td>
                        <td className="px-4 py-3.5 text-right text-thb-text-secondary">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right text-thb-text-secondary">{formatCurrency(item.rate, inv.currency)}</td>
                        <td className="px-6 py-3.5 text-right font-medium text-thb-text-primary">{formatCurrency(item.amount, inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Totals */}
              <div className="px-6 py-4 bg-slate-50/50 border-t border-thb-border">
                <div className="max-w-xs ml-auto space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-thb-text-secondary">Subtotal</span>
                    <span className="text-thb-text-primary">{formatCurrency(inv.subtotal, inv.currency)}</span>
                  </div>
                  {inv.discountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-thb-text-secondary">Discount</span>
                      <span className="text-emerald-600">-{formatCurrency(inv.discountAmount, inv.currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-thb-text-secondary">Tax ({inv.taxRate}%)</span>
                    <span className="text-thb-text-primary">{formatCurrency(inv.taxAmount, inv.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-thb-border">
                    <span className="text-thb-text-primary">Total</span>
                    <span className="text-thb-text-primary">{formatCurrency(inv.totalAmount, inv.currency)}</span>
                  </div>
                  {inv.payments.length > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm pt-1">
                        <span className="text-emerald-600">Paid</span>
                        <span className="text-emerald-600">-{formatCurrency(paidAmount, inv.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-thb-border">
                        <span className={balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}>Balance Due</span>
                        <span className={balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}>{formatCurrency(balanceDue, inv.currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {inv.notes && (
              <div className="thb-card p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted mb-2">Notes</h3>
                <p className="text-sm text-thb-text-secondary leading-relaxed">{inv.notes}</p>
              </div>
            )}
          </div>

          {/* Right: Payment History & Summary */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-thb-text-secondary">Invoice Total</span>
                  <span className="text-sm font-bold text-thb-text-primary">{formatCurrency(inv.totalAmount, inv.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-thb-text-secondary">Amount Paid</span>
                  <span className="text-sm font-semibold text-emerald-600">{formatCurrency(paidAmount, inv.currency)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${inv.status === 'paid' ? 'bg-emerald-500' : inv.status === 'overdue' ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (paidAmount / inv.totalAmount) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-thb-border">
                  <span className="text-sm font-semibold">Balance Due</span>
                  <span className={`text-sm font-bold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrency(balanceDue, inv.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="thb-card p-6">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Payment History</h3>
              {inv.payments.length === 0 ? (
                <div className="text-center py-6">
                  <FiDollarSign className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No payments recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inv.payments.map(p => (
                    <div key={p.id} className="flex items-start gap-3 pb-3 border-b border-thb-border last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-thb-text-primary">{formatCurrency(p.amount, inv.currency)}</p>
                          <span className="text-xs text-thb-text-muted">{formatDate(p.date)}</span>
                        </div>
                        <p className="text-xs text-thb-text-secondary mt-0.5">{p.method} · {p.reference}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="p-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <FiFileText className="w-5 h-5 text-green-600" />
            </div>
            Invoices
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1.5 ml-11.5">
            Create, send, and track client invoices. Manage billing cycles and payment collections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors">
            <FiDownload className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-thb-primary text-white hover:bg-thb-primary-dark shadow-sm transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="thb-card p-5 thb-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted">Total Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <FiFileText className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-thb-text-primary">{stats.total}</p>
          <p className="text-xs text-thb-text-muted mt-1">All time</p>
        </div>
        <div className="thb-card p-5 thb-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted">Paid</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiDollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.paid, 'USD')}</p>
          <p className="text-xs text-thb-text-muted mt-1">{invoices.filter(i => i.status === 'paid').length} invoices</p>
        </div>
        <div className="thb-card p-5 thb-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pending, 'USD')}</p>
          <p className="text-xs text-thb-text-muted mt-1">{invoices.filter(i => ['sent', 'partial'].includes(i.status)).length} invoices</p>
        </div>
        <div className="thb-card p-5 thb-card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-thb-text-muted">Overdue</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <FiAlertCircle className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue, 'USD')}</p>
          <p className="text-xs text-thb-text-muted mt-1">{invoices.filter(i => i.status === 'overdue').length} invoices</p>
        </div>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="thb-card">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-thb-border px-4 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'border-thb-primary text-thb-primary'
                  : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                statusFilter === tab.key ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-thb-text-muted'
              }`}>
                {tabCounts[tab.key as keyof typeof tabCounts] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by invoice #, client, or project..."
              value={searchQuery}
              onChange={e => setSearchQuery(sanitizeSearch(e.target.value))}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary transition-colors bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
              showFilters ? 'border-thb-primary bg-green-50 text-thb-primary' : 'border-thb-border text-thb-text-secondary hover:bg-slate-50'
            }`}
          >
            <FiFilter className="w-4 h-4" /> Filters
            {(clientFilter || dateFrom || dateTo) && (
              <span className="w-2 h-2 rounded-full bg-thb-primary" />
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="px-4 pb-4 pt-1 border-t border-thb-border bg-slate-50/50 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Client</label>
                <select
                  value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                >
                  <option value="">All Clients</option>
                  {CLIENT_NAMES.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                />
              </div>
            </div>
            {(clientFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setClientFilter(''); setDateFrom(''); setDateTo(''); }}
                className="mt-3 text-xs font-medium text-thb-primary hover:text-thb-primary-dark transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Invoices Table ─── */}
      <div className="thb-card overflow-hidden">
        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 flex items-center justify-between animate-fade-in">
            <span className="text-sm font-medium text-green-700">
              {selectedIds.size} invoice{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white text-green-700 border border-green-200 hover:bg-green-50 transition-colors">
                <FiSend className="w-3.5 h-3.5" /> Send Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <FiX className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-thb-border">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-thb-primary focus:ring-thb-primary/20 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Invoice Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-thb-border">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <FiFileText className="w-6 h-6 text-thb-text-muted" />
                      </div>
                      <p className="text-thb-text-secondary font-medium">No invoices found</p>
                      <p className="text-xs text-thb-text-muted">Try adjusting your filters or create a new invoice</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-thb-primary text-white hover:bg-thb-primary-dark transition-colors"
                      >
                        <FiPlus className="w-4 h-4" /> Create Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.map(inv => {
                const paidAmount = inv.payments.reduce((s, p) => s + p.amount, 0);
                const isPartial = paidAmount > 0 && paidAmount < inv.totalAmount;
                const displayStatus = inv.status === 'partial' || isPartial ? 'partial' : inv.status;
                return (
                  <tr key={inv.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(inv.id) ? 'bg-green-50/30' : ''}`}>
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        className="w-4 h-4 rounded border-slate-300 text-thb-primary focus:ring-thb-primary/20 cursor-pointer"
                      />
                    </td>
                    {/* Invoice # */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="font-medium text-thb-primary hover:text-thb-primary-dark transition-colors hover:underline"
                      >
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[inv.clientAvatar] || 'bg-slate-100 text-slate-600'}`}>
                          {inv.clientAvatar}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-thb-text-primary truncate">{inv.clientName}</p>
                          <p className="text-xs text-thb-text-muted truncate">{inv.projectName}</p>
                        </div>
                      </div>
                    </td>
                    {/* Invoice Date */}
                    <td className="px-4 py-3.5 text-thb-text-secondary">{formatDate(inv.issueDate)}</td>
                    {/* Due Date */}
                    <td className="px-4 py-3.5">
                      <span className={inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-thb-text-secondary'}>
                        {formatDate(inv.dueDate)}
                      </span>
                    </td>
                    {/* Amount */}
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-thb-text-primary">{formatCurrency(inv.totalAmount, inv.currency)}</p>
                      {paidAmount > 0 && paidAmount < inv.totalAmount && (
                        <p className="text-xs text-emerald-600 mt-0.5">{formatCurrency(paidAmount, inv.currency)} paid</p>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={getStatusBadge(displayStatus)}>{formatStatus(displayStatus)}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 text-thb-text-muted hover:text-thb-primary hover:bg-green-50 rounded-md transition-colors"
                          title="View"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 text-thb-text-muted hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'sent')}
                            className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Send"
                          >
                            <FiSend className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-md transition-colors"
                          title="Download"
                        >
                          <FiDownload className="w-4 h-4" />
                        </button>
                        {/* More Actions Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === inv.id ? null : inv.id)}
                            className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-md transition-colors"
                            title="More actions"
                          >
                            <FiMoreVertical className="w-4 h-4" />
                          </button>
                          {actionMenuOpen === inv.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-thb-border py-1 z-50 animate-fade-in">
                              <button
                                onClick={() => handleDuplicate(inv)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors"
                              >
                                <FiCopy className="w-3.5 h-3.5" /> Duplicate
                              </button>
                              {inv.status !== 'paid' && (
                                <button
                                  onClick={() => handleStatusChange(inv.id, 'paid')}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <FiCheck className="w-3.5 h-3.5" /> Mark as Paid
                                </button>
                              )}
                              {inv.status === 'draft' && (
                                <button
                                  onClick={() => handleDelete(inv.id)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {filteredInvoices.length > 0 && (
          <div className="px-4 py-3 border-t border-thb-border bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-thb-text-muted">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-thb-text-muted mr-2">
                Total: <strong className="text-thb-text-primary">{formatCurrency(filteredInvoices.reduce((s, i) => s + i.totalAmount, 0), 'USD')}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Invoice Modal ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-in-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-thb-border sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiPlus className="w-5 h-5 text-thb-primary" /> Create New Invoice
                </h2>
                <p className="text-xs text-thb-text-muted mt-0.5">Fill in the details to create a draft invoice</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-thb-text-muted hover:text-thb-text-primary transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Client & Project */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.clientName}
                    onChange={e => setCreateForm({ ...createForm, clientName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                  >
                    <option value="">Select client...</option>
                    {CLIENT_NAMES.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__new__">+ New Client</option>
                  </select>
                  {createForm.clientName === '__new__' && (
                    <input
                      type="text"
                      placeholder="Enter new client name"
                      onChange={e => setCreateForm({ ...createForm, clientName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white mt-2"
                      autoFocus
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Project</label>
                  <input
                    type="text"
                    placeholder="Project name"
                    value={createForm.projectName}
                    onChange={e => setCreateForm({ ...createForm, projectName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                  />
                </div>
              </div>

              {/* Dates & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Issue Date</label>
                  <input
                    type="date"
                    value={createForm.issueDate}
                    onChange={e => setCreateForm({ ...createForm, issueDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Currency</label>
                  <select
                    value={createForm.currency}
                    onChange={e => setCreateForm({ ...createForm, currency: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-thb-text-primary">Line Items</h3>
                  <button
                    onClick={() => setCreateItems([...createItems, { description: '', quantity: 1, rate: 0 }])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-thb-primary hover:text-thb-primary-dark transition-colors"
                  >
                    <FiPlus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-2">
                    <div className="col-span-5 text-xs font-medium text-thb-text-muted">Description</div>
                    <div className="col-span-2 text-xs font-medium text-thb-text-muted">Qty</div>
                    <div className="col-span-2 text-xs font-medium text-thb-text-muted">Rate</div>
                    <div className="col-span-2 text-xs font-medium text-thb-text-muted text-right">Amount</div>
                    <div className="col-span-1" />
                  </div>
                  {createItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="Item description"
                          value={item.description}
                          onChange={e => {
                            const next = [...createItems];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setCreateItems(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => {
                            const next = [...createItems];
                            next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                            setCreateItems(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={e => {
                            const next = [...createItems];
                            next[idx] = { ...next[idx], rate: Number(e.target.value) || 0 };
                            setCreateItems(next);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                        />
                      </div>
                      <div className="col-span-2 text-right text-sm font-medium text-thb-text-primary">
                        {formatCurrency(item.quantity * item.rate, createForm.currency)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {createItems.length > 1 && (
                          <button
                            onClick={() => setCreateItems(createItems.filter((_, i) => i !== idx))}
                            className="p-1 text-thb-text-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-thb-border">
                  <div className="max-w-sm ml-auto space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-thb-text-secondary">Subtotal</span>
                      <span className="text-thb-text-primary font-medium">{formatCurrency(createSubtotal, createForm.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-thb-text-secondary">Tax</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={createForm.taxRate}
                          onChange={e => setCreateForm({ ...createForm, taxRate: Number(e.target.value) || 0 })}
                          className="w-16 px-2 py-1 rounded border border-thb-border text-xs text-center focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white"
                        />
                        <span className="text-xs text-thb-text-muted">%</span>
                      </div>
                      <span className="text-thb-text-primary font-medium">{formatCurrency(createTax, createForm.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-thb-border">
                      <span>Total</span>
                      <span>{formatCurrency(createTotal, createForm.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1.5">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes or payment instructions..."
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-thb-primary/20 focus:border-thb-primary bg-white resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-thb-border bg-slate-50/50 sticky bottom-0 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-thb-border text-thb-text-secondary hover:bg-white hover:text-thb-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!createForm.clientName}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-thb-primary text-white hover:bg-thb-primary-dark shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiFileText className="w-4 h-4" /> Create Draft Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-away for action menus */}
      {actionMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setActionMenuOpen(null)} />
      )}
    </div>
  );
}
