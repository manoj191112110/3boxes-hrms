'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FiArrowLeft, FiPlus, FiTrash2, FiCheckCircle, FiSend, FiDollarSign,
  FiRefreshCw, FiX, FiFileText, FiAlertTriangle, FiLock, FiDownload,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/currency';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'thb-badge bg-slate-100 text-slate-600',
    issued: 'thb-badge thb-badge-info',
    sent: 'thb-badge thb-badge-info',
    partial: 'thb-badge thb-badge-warning',
    paid: 'thb-badge thb-badge-success',
    overdue: 'thb-badge thb-badge-error',
    disputed: 'thb-badge thb-badge-error',
    cancelled: 'thb-badge bg-slate-200 text-slate-500',
  };
  return map[status] || 'thb-badge bg-slate-100 text-slate-600';
}

interface LineItem {
  id: string;
  sourceType: string;
  timesheetId: string | null;
  projectId: string | null;
  employeeId: string | null;
  description: string;
  date: string | null;
  hours: number;
  quantity: number;
  unit: string;
  rate: number;
  rateSourceCurrency: string | null;
  rateSourceAmount: number | null;
  fxRate: number | null;
  amount: number;
  amountBase: number | null;
  taxable: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceType: string;
  billingType: string;
  currency: string;
  baseCurrency: string | null;
  exchangeRate: number;
  fxRateDate: string | null;
  fxSource: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  totalAmount: number;
  subtotalBase: number | null;
  totalAmountBase: number | null;
  issueDate: string;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  notes: string | null;
  internalNotes: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  issuedAt: string | null;
  client: { id: string; name: string; billingCurrency: string } | null;
  project: { id: string; name: string; currency: string; billingType: string } | null;
  company: { id: string; name: string; currency: string } | null;
  lineItems: LineItem[];
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate-from-timesheets modal
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({
    dateFrom: '',
    dateTo: '',
    projectId: '',
    employeeId: '',
    overwrite: false,
  });
  const [generating, setGenerating] = useState(false);

  // Add manual line modal
  const [showAddLine, setShowAddLine] = useState(false);
  const [lineForm, setLineForm] = useState({
    description: '',
    hours: 0,
    rate: 0,
    rateSourceCurrency: '',
    rateSourceAmount: 0,
    date: '',
    taxable: true,
    sourceType: 'manual',
  });
  const [addingLine, setAddingLine] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/invoices/${invoiceId}`, { headers: getAuthHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to load invoice');
      setInvoice(data.invoice);
    } catch (e: unknown) {
      console.error('fetchInvoice', e);
      toast.error(e instanceof Error ? e.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  // Pre-fill gen form with invoice's period dates
  useEffect(() => {
    if (invoice) {
      setGenForm(g => ({
        ...g,
        dateFrom: invoice.periodStart ? invoice.periodStart.split('T')[0] : '',
        dateTo: invoice.periodEnd ? invoice.periodEnd.split('T')[0] : '',
        projectId: invoice.project?.id || '',
      }));
      setLineForm(l => ({
        ...l,
        rateSourceCurrency: invoice.currency,
      }));
    }
  }, [invoice]);

  const handleGenerate = async () => {
    if (!genForm.dateFrom || !genForm.dateTo) {
      toast.error('Please select a date range');
      return;
    }
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        dateFrom: genForm.dateFrom,
        dateTo: genForm.dateTo,
        overwrite: genForm.overwrite,
      };
      if (genForm.projectId) body.projectId = genForm.projectId;
      if (genForm.employeeId) body.employeeId = genForm.employeeId;

      const r = await fetch(`/api/invoices/${invoiceId}/generate-from-timesheets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to generate');
      toast.success(`Generated ${data.lineItemsCreated} line item(s)`);
      if (data.warnings?.length > 0) {
        data.warnings.forEach((w: string) => toast.warning(w));
      }
      setShowGen(false);
      fetchInvoice();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddLine = async () => {
    if (!lineForm.description) {
      toast.error('Description is required');
      return;
    }
    setAddingLine(true);
    try {
      const body: Record<string, unknown> = {
        description: lineForm.description,
        hours: Number(lineForm.hours) || 0,
        rate: Number(lineForm.rate) || 0,
        taxable: lineForm.taxable,
        sourceType: lineForm.sourceType,
        date: lineForm.date || undefined,
      };
      if (lineForm.rateSourceCurrency && lineForm.rateSourceAmount) {
        body.rateSourceCurrency = lineForm.rateSourceCurrency;
        body.rateSourceAmount = Number(lineForm.rateSourceAmount);
      }

      const r = await fetch(`/api/invoices/${invoiceId}/line-items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to add line');
      toast.success('Line item added');
      setShowAddLine(false);
      setLineForm({ description: '', hours: 0, rate: 0, rateSourceCurrency: invoice?.currency || '', rateSourceAmount: 0, date: '', taxable: true, sourceType: 'manual' });
      fetchInvoice();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setAddingLine(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm('Remove this line item?')) return;
    try {
      const r = await fetch(`/api/invoices/${invoiceId}/line-items/${lineId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed to delete');
      }
      toast.success('Line item removed');
      fetchInvoice();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleStatusChange = async (newStatus: string, extra?: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to update');
      toast.success(`Invoice marked as ${newStatus}`);
      fetchInvoice();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Finalize this invoice? After this, line items and tax/discount rates cannot be changed.')) return;
    try {
      const r = await fetch(`/api/invoices/${invoiceId}/finalize`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to finalize');
      toast.success('Invoice finalized — now issued');
      fetchInvoice();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to finalize');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <FiRefreshCw className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Invoice not found.</p>
        <button onClick={() => router.push('/invoices')} className="3boxes-btn-secondary mt-4">
          ← Back to Invoices
        </button>
      </div>
    );
  }

  const isDraft = invoice.status === 'draft';
  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';
  const baseCur = invoice.baseCurrency || invoice.currency;
  const hasDifferentBase = baseCur !== invoice.currency;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/invoices')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{invoice.invoiceNumber}</h1>
              <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {invoice.invoiceType.replace(/_/g, ' ')} • {invoice.billingType.replace(/_/g, ' ')} •
              Issued {formatDate(invoice.issueDate)}
              {invoice.dueDate && ` • Due ${formatDate(invoice.dueDate)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <>
              <button onClick={() => setShowGen(true)} className="3boxes-btn-secondary flex items-center gap-2">
                <FiRefreshCw className="w-4 h-4" /> Generate from Timesheets
              </button>
              <button onClick={() => setShowAddLine(true)} className="3boxes-btn-secondary flex items-center gap-2">
                <FiPlus className="w-4 h-4" /> Add Line
              </button>
              <button onClick={handleFinalize} className="3boxes-btn-primary flex items-center gap-2">
                <FiLock className="w-4 h-4" /> Finalize
              </button>
            </>
          )}
          {['issued', 'sent', 'partial'].includes(invoice.status) && (
            <>
              <button onClick={() => handleStatusChange('sent')} className="3boxes-btn-secondary flex items-center gap-2">
                <FiSend className="w-4 h-4" /> Mark Sent
              </button>
              <button onClick={() => handleStatusChange('paid')} className="3boxes-btn-primary flex items-center gap-2">
                <FiDollarSign className="w-4 h-4" /> Mark Paid
              </button>
            </>
          )}
          {isCancelled && (
            <button
              onClick={() => router.push('/invoices')}
              className="3boxes-btn-secondary flex items-center gap-2"
            >
              <FiArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>
      </div>

      {/* Top: meta + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: meta */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 mb-2">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-500">Client</p>
              <p className="font-medium text-slate-800">{invoice.client?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Project</p>
              <p className="font-medium text-slate-800">{invoice.project?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Company</p>
              <p className="font-medium text-slate-800">{invoice.company?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Billing Period</p>
              <p className="font-medium text-slate-800">
                {invoice.periodStart ? formatDate(invoice.periodStart) : '—'} → {invoice.periodEnd ? formatDate(invoice.periodEnd) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Invoice Currency</p>
              <p className="font-medium text-slate-800">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Base Currency</p>
              <p className="font-medium text-slate-800">{baseCur}</p>
            </div>
            {hasDifferentBase && (
              <>
                <div>
                  <p className="text-xs text-slate-500">FX Rate (1 {baseCur} = ? {invoice.currency})</p>
                  <p className="font-medium text-slate-800">
                    {invoice.exchangeRate.toFixed(4)}
                    {invoice.fxSource && <span className="text-xs text-slate-500 ml-1">({invoice.fxSource})</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">FX Rate Date</p>
                  <p className="font-medium text-slate-800">{formatDate(invoice.fxRateDate)}</p>
                </div>
              </>
            )}
            {invoice.paymentRef && (
              <div>
                <p className="text-xs text-slate-500">Payment Reference</p>
                <p className="font-medium text-slate-800">{invoice.paymentRef}</p>
              </div>
            )}
            {invoice.paidAt && (
              <div>
                <p className="text-xs text-slate-500">Paid At</p>
                <p className="font-medium text-slate-800">{formatDate(invoice.paidAt)}</p>
              </div>
            )}
          </div>
          {invoice.notes && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Right: totals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Totals</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Tax ({invoice.taxRate}%)</span>
                <span className="font-medium">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
              </div>
            )}
            {invoice.discountRate > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount ({invoice.discountRate}%)</span>
                <span className="font-medium">−{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="font-bold text-teal-700 text-lg">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
            </div>
            {hasDifferentBase && invoice.totalAmountBase !== null && (
              <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                <span>In base currency</span>
                <span>{formatCurrency(invoice.totalAmountBase, baseCur)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Line Items
            <span className="ml-2 text-xs text-slate-500">({Array.isArray(invoice.lineItems) ? invoice.lineItems.length : 0})</span>
          </h2>
          {isDraft && (
            <button onClick={() => setShowAddLine(true)} className="3boxes-btn-secondary flex items-center gap-2 text-sm">
              <FiPlus className="w-4 h-4" /> Add Manual Line
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Description</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Source</th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">Date</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-700">Hours</th>
                <th className="text-right px-4 py-2 font-semibold text-slate-700">Rate</th>
                {hasDifferentBase && (
                  <th className="text-right px-4 py-2 font-semibold text-slate-700">Source Rate</th>
                )}
                <th className="text-right px-4 py-2 font-semibold text-slate-700">Amount</th>
                {isDraft && <th className="text-right px-4 py-2 font-semibold text-slate-700"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Array.isArray(invoice.lineItems) ? invoice.lineItems : []).length === 0 ? (
                <tr>
                  <td colSpan={isDraft ? (hasDifferentBase ? 8 : 7) : (hasDifferentBase ? 7 : 6)} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FiFileText className="w-8 h-8" />
                      <p>No line items yet.</p>
                      {isDraft && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setShowGen(true)} className="3boxes-btn-secondary text-sm flex items-center gap-2">
                            <FiRefreshCw className="w-4 h-4" /> Generate from Timesheets
                          </button>
                          <button onClick={() => setShowAddLine(true)} className="3boxes-btn-secondary text-sm flex items-center gap-2">
                            <FiPlus className="w-4 h-4" /> Add Manual Line
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (Array.isArray(invoice.lineItems) ? invoice.lineItems : []).map(li => (
                <tr key={li.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <p className="text-slate-800">{li.description}</p>
                    {li.taxable === false && (
                      <span className="text-xs text-slate-400">non-taxable</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="thb-badge bg-slate-100 text-slate-600 capitalize">{li.sourceType}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(li.date)}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{li.hours > 0 ? li.hours.toFixed(2) : '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(li.rate, invoice.currency)}</td>
                  {hasDifferentBase && (
                    <td className="px-4 py-2 text-right text-xs text-slate-500">
                      {li.rateSourceCurrency && li.rateSourceAmount
                        ? `${formatCurrency(li.rateSourceAmount, li.rateSourceCurrency)}${li.fxRate ? ` @ ${li.fxRate.toFixed(4)}` : ''}`
                        : '—'}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(li.amount, invoice.currency)}</td>
                  {isDraft && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteLine(li.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {(Array.isArray(invoice.lineItems) ? invoice.lineItems : []).length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={hasDifferentBase ? 5 : 4} className="px-4 py-3 text-right text-slate-600 font-medium">Subtotal</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                  {isDraft && <td></td>}
                </tr>
                {invoice.taxAmount > 0 && (
                  <tr>
                    <td colSpan={hasDifferentBase ? 5 : 4} className="px-4 py-2 text-right text-slate-600">Tax ({invoice.taxRate}%)</td>
                    <td className="px-4 py-2 text-right text-slate-800">{formatCurrency(invoice.taxAmount, invoice.currency)}</td>
                    {isDraft && <td></td>}
                  </tr>
                )}
                {invoice.discountAmount > 0 && (
                  <tr>
                    <td colSpan={hasDifferentBase ? 5 : 4} className="px-4 py-2 text-right text-emerald-600">Discount</td>
                    <td className="px-4 py-2 text-right text-emerald-600">−{formatCurrency(invoice.discountAmount, invoice.currency)}</td>
                    {isDraft && <td></td>}
                  </tr>
                )}
                <tr className="border-t border-slate-200">
                  <td colSpan={hasDifferentBase ? 5 : 4} className="px-4 py-3 text-right font-semibold text-slate-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-teal-700 text-base">{formatCurrency(invoice.totalAmount, invoice.currency)}</td>
                  {isDraft && <td></td>}
                </tr>
                {hasDifferentBase && invoice.totalAmountBase !== null && (
                  <tr>
                    <td colSpan={hasDifferentBase ? 5 : 4} className="px-4 py-2 text-right text-xs text-slate-500">In {baseCur}</td>
                    <td className="px-4 py-2 text-right text-xs text-slate-500">{formatCurrency(invoice.totalAmountBase, baseCur)}</td>
                    {isDraft && <td></td>}
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Generate-from-timesheets modal */}
      {showGen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-800">Generate from Approved Timesheets</h2>
              <button onClick={() => setShowGen(false)} className="p-1 hover:bg-slate-100 rounded">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                This will create one line item per day per employee from approved timesheets in the date range.
                The billing rate from each employee's project allocation will be converted to {invoice.currency} using the FX rate on the invoice.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date From *</label>
                  <input
                    type="date"
                    value={genForm.dateFrom}
                    onChange={e => setGenForm({ ...genForm, dateFrom: e.target.value })}
                    className="3boxes-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date To *</label>
                  <input
                    type="date"
                    value={genForm.dateTo}
                    onChange={e => setGenForm({ ...genForm, dateTo: e.target.value })}
                    className="3boxes-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Project (recommended)</label>
                <input
                  type="text"
                  value={invoice.project?.name || '(no project linked)'}
                  disabled
                  className="3boxes-input w-full bg-slate-50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Timesheets matching the project name will be used. Link a project to the invoice first to use this feature.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={genForm.overwrite}
                  onChange={e => setGenForm({ ...genForm, overwrite: e.target.checked })}
                  className="rounded"
                />
                Overwrite existing timesheet-sourced lines
              </label>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <FiAlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700">
                  The current Timesheet schema uses a free-text <code>project</code> field. Matching is done by project name. The upcoming Timesheet schema fix will add proper FK links + an <code>invoiced</code> flag.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <button onClick={() => setShowGen(false)} className="3boxes-btn-secondary">Cancel</button>
              <button onClick={handleGenerate} disabled={generating} className="3boxes-btn-primary flex items-center gap-2">
                {generating ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                Generate Lines
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add manual line modal */}
      {showAddLine && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-800">Add Manual Line Item</h2>
              <button onClick={() => setShowAddLine(false)} className="p-1 hover:bg-slate-100 rounded">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                <input
                  type="text"
                  value={lineForm.description}
                  onChange={e => setLineForm({ ...lineForm, description: e.target.value })}
                  className="3boxes-input w-full"
                  placeholder="e.g. Project management, Additional consultancy, ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={lineForm.date}
                    onChange={e => setLineForm({ ...lineForm, date: e.target.value })}
                    className="3boxes-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Source Type</label>
                  <select
                    value={lineForm.sourceType}
                    onChange={e => setLineForm({ ...lineForm, sourceType: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="manual">Manual</option>
                    <option value="milestone">Milestone</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.25"
                    value={lineForm.hours}
                    onChange={e => setLineForm({ ...lineForm, hours: Number(e.target.value) })}
                    className="3boxes-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rate (in {invoice.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lineForm.rate}
                    onChange={e => setLineForm({ ...lineForm, rate: Number(e.target.value) })}
                    className="3boxes-input w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Source Currency (optional)</label>
                  <select
                    value={lineForm.rateSourceCurrency}
                    onChange={e => setLineForm({ ...lineForm, rateSourceCurrency: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="">Same as invoice</option>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="SGD">SGD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Source Amount (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lineForm.rateSourceAmount}
                    onChange={e => setLineForm({ ...lineForm, rateSourceAmount: Number(e.target.value) })}
                    className="3boxes-input w-full"
                    placeholder="Original rate in source currency"
                    disabled={!lineForm.rateSourceCurrency || lineForm.rateSourceCurrency === invoice.currency}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={lineForm.taxable}
                  onChange={e => setLineForm({ ...lineForm, taxable: e.target.checked })}
                  className="rounded"
                />
                Taxable
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <button onClick={() => setShowAddLine(false)} className="3boxes-btn-secondary">Cancel</button>
              <button onClick={handleAddLine} disabled={addingLine} className="3boxes-btn-primary flex items-center gap-2">
                {addingLine ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                Add Line Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
