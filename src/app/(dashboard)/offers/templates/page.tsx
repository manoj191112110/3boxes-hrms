'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FiPlus, FiX, FiEdit2, FiTrash2, FiFileText, FiEye, FiCopy,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { renderOfferTemplate, wrapRenderedOffer } from '@/lib/offer-template';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface OfferTemplate {
  id: string;
  tenantId: string;
  name: string;
  country: string;
  language: string;
  body: string;
  header?: string | null;
  footer?: string | null;
  clauses?: string | null;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

const COUNTRY_OPTIONS = [
  { value: '*', label: 'All Countries (Wildcard)' },
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'DE', label: 'Germany' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ar', label: 'Arabic' },
  { value: 'de', label: 'German' },
];

const PLACEHOLDER_HINTS = [
  '{{candidateName}}',
  '{{position}}',
  '{{department}}',
  '{{salary}}',
  '{{currency}}',
  '{{ctc}}',
  '{{joiningDate}}',
  '{{probationDays}}',
  '{{reportingTo}}',
  '{{companyName}}',
  '{{todayDate}}',
];

const DEFAULT_TEMPLATE_BODY = `<h2>Offer of Employment</h2>
<p>Dear {{candidateName}},</p>
<p>We are pleased to offer you the position of <strong>{{position}}</strong> at {{companyName}}.</p>
<p><strong>Compensation:</strong> {{currency}} {{salary}} per month (CTC: {{currency}} {{ctc}} per annum).</p>
<p><strong>Joining Date:</strong> {{joiningDate}}</p>
<p><strong>Probation Period:</strong> {{probationDays}} days</p>
${'`'}${'`'}${'`'}`;

const SAMPLE_DATA = {
  candidateName: 'Aarav Sharma',
  position: 'Senior Software Engineer',
  department: 'Engineering',
  offeredSalary: 150000,
  offeredCurrency: 'INR',
  offeredCTC: 1800000,
  joiningDate: new Date(Date.now() + 14 * 86400000),
  probationPeriod: 90,
  reportingTo: 'Priya Patel (Engineering Manager)',
};

const initialForm = {
  name: '',
  country: '*',
  language: 'en',
  body: DEFAULT_TEMPLATE_BODY,
  header: '',
  footer: '',
  isActive: true,
};

export default function OfferTemplatesPage() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/offers/templates', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.templates || []);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load offer templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchTemplates());
  }, [fetchTemplates]);

  // Re-render the preview whenever the form body changes
  useEffect(() => {
    try {
      const rendered = renderOfferTemplate(form.body || '', SAMPLE_DATA as any);
      const wrapped = wrapRenderedOffer(rendered.html, {
        header: form.header,
        footer: form.footer,
        title: 'Offer Letter Preview',
      });
      setPreviewHtml(wrapped);
    } catch (err) {
      setPreviewHtml('<p style="color:#dc2626;">Preview rendering failed.</p>');
    }
  }, [form.body, form.header, form.footer]);

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (t: OfferTemplate) => {
    setForm({
      name: t.name || '',
      country: t.country || '*',
      language: t.language || 'en',
      body: t.body || '',
      header: t.header || '',
      footer: t.footer || '',
      isActive: t.isActive !== false,
    });
    setEditingId(t.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const insertPlaceholder = (ph: string) => {
    setForm((prev) => ({ ...prev, body: `${prev.body}${prev.body.endsWith('\n') ? '' : ' '}${ph}` }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.body) {
      toast.error('Name and body are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        country: form.country,
        language: form.language,
        body: form.body,
        header: form.header || null,
        footer: form.footer || null,
        isActive: form.isActive,
      };
      if (editingId) {
        const res = await fetch(`/api/offers/templates/${editingId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to update template');
        }
        toast.success('Template updated');
      } else {
        const res = await fetch('/api/offers/templates', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to create template');
        }
        toast.success('Template created');
      }
      handleCancelForm();
      fetchTemplates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/offers/templates/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Template deleted');
      setDeleteConfirmId(null);
      fetchTemplates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (t: OfferTemplate) => {
    try {
      const res = await fetch(`/api/offers/templates/${t.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Template ${!t.isActive ? 'activated' : 'deactivated'}`);
      fetchTemplates();
    } catch {
      toast.error('Failed to toggle template');
    }
  };

  const handleDuplicate = async (t: OfferTemplate) => {
    try {
      const res = await fetch('/api/offers/templates', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: `${t.name} (Copy)`,
          country: t.country,
          language: t.language,
          body: t.body,
          header: t.header,
          footer: t.footer,
          isActive: false,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Template duplicated');
      fetchTemplates();
    } catch {
      toast.error('Failed to duplicate template');
    }
  };

  const groupedByCountry = useMemo(() => {
    const map = new Map<string, OfferTemplate[]>();
    for (const t of templates) {
      const key = t.country || '*';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-green-500" />
            Offer Letter Templates
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Country-specific offer letter templates with placeholder substitution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/offers"
            className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            Back to Offers
          </Link>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
          >
            <FiPlus className="w-4 h-4" /> New Template
          </button>
        </div>
      </div>

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Template Name <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g., India Standard Offer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label>
                    <select
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Language</label>
                    <select
                      value={form.language}
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                    Body * (HTML with placeholders)
                  </label>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {PLACEHOLDER_HINTS.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => insertPlaceholder(ph)}
                        className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-700 rounded border border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
                        title={`Insert ${ph}`}
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={14}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="Enter the offer letter body..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                    Header (HTML, optional)
                  </label>
                  <textarea
                    rows={2}
                    value={form.header}
                    onChange={(e) => setForm({ ...form, header: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="<h1>Marq AI Tech Pvt Ltd</h1>"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                    Footer (HTML, optional)
                  </label>
                  <textarea
                    rows={2}
                    value={form.footer}
                    onChange={(e) => setForm({ ...form, footer: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="<p>Marq AI Tech Pvt Ltd, Mumbai, India</p>"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-thb-text-secondary">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-thb-border"
                  />
                  Active (available for selection when creating offers)
                </label>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-thb-text-secondary">Live Preview (with sample data)</label>
                  <span className="text-[10px] text-thb-text-muted font-mono">candidateName=Aarav Sharma, position=Senior SE, salary=150000 INR</span>
                </div>
                <iframe
                  title="Template Preview"
                  srcDoc={previewHtml}
                  className="w-full h-[560px] rounded-lg border border-thb-border bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates grouped by country */}
      {loading ? (
        <div className="thb-card p-12 text-center text-thb-text-muted">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No offer templates yet</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first template to standardize offer letters by country.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByCountry.map(([country, list]) => {
            const countryLabel = COUNTRY_OPTIONS.find((c) => c.value === country)?.label || country;
            return (
              <div key={country} className="thb-card overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50/70 border-b border-thb-border flex items-center gap-2">
                  <span className="text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">
                    {countryLabel}
                  </span>
                  <span className="text-[10px] text-thb-text-muted">({list.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-thb-border bg-slate-50/30">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Language</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Updated</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((t) => (
                        <tr key={t.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                          {deleteConfirmId === t.id ? (
                            <td colSpan={5} className="px-4 py-3 bg-red-50">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-red-700 font-medium">Delete &quot;{t.name}&quot;?</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                                    {deleting ? 'Deleting...' : 'Confirm'}
                                  </button>
                                  <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{t.name}</td>
                              <td className="px-4 py-3 text-sm text-thb-text-secondary uppercase">{t.language}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleToggleActive(t)}
                                  className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${t.isActive ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
                                >
                                  {t.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-xs text-thb-text-muted">
                                {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleEdit(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDuplicate(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Duplicate"><FiCopy className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
