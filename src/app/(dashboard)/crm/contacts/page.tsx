'use client';

import { useState, useEffect } from 'react';
import {
  FiUsers, FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiMail,
  FiPhone, FiBriefcase, FiCheck, FiFilter, FiEye, FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { validateEmail, validatePhone, phoneInputFilter } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  type: string;
  status: string;
  source: string;
  lastContact?: string;
  dealCount?: number;
  totalDealValue?: number;
}

const DEMO_CONTACTS: Contact[] = isClientDemoMode() ? [
  { id: 1, firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh@techvista.com', phone: '+91 98765 43210', company: 'TechVista Solutions', title: 'CTO', type: 'Customer', status: 'Active', source: 'website', lastContact: '2 hours ago', dealCount: 4, totalDealValue: 8200000 },
  { id: 2, firstName: 'Sneha', lastName: 'Iyer', email: 'sneha@datacore.com', phone: '+91 87654 32109', company: 'DataCore Inc.', title: 'VP Engineering', type: 'Lead', status: 'Active', source: 'referral', lastContact: '4 hours ago', dealCount: 2, totalDealValue: 4500000 },
  { id: 3, firstName: 'Vikram', lastName: 'Patel', email: 'vikram@greenleaf.com', phone: '+91 76543 21098', company: 'GreenLeaf Corp.', title: 'Director of IT', type: 'Customer', status: 'Active', source: 'social', lastContact: 'Yesterday', dealCount: 6, totalDealValue: 15000000 },
  { id: 4, firstName: 'Priya', lastName: 'Sharma', email: 'priya@megasoft.com', phone: '+91 65432 10987', company: 'MegaSoft Ltd.', title: 'Head of Operations', type: 'Lead', status: 'Active', source: 'website', lastContact: '2 days ago', dealCount: 1, totalDealValue: 1900000 },
  { id: 5, firstName: 'Amit', lastName: 'Desai', email: 'amit@buildright.com', phone: '+91 54321 09876', company: 'BuildRight Inc.', title: 'CEO', type: 'Partner', status: 'Active', source: 'referral', lastContact: '3 days ago', dealCount: 3, totalDealValue: 6500000 },
  { id: 6, firstName: 'Kavita', lastName: 'Nair', email: 'kavita@skyhigh.com', phone: '+91 43210 98765', company: 'SkyHigh Tech', title: 'Procurement Head', type: 'Vendor', status: 'Inactive', source: 'other', lastContact: '1 week ago', dealCount: 0, totalDealValue: 0 },
] : [];

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', company: '', title: '', type: 'Lead', status: 'Active', source: 'website' };

export default function CRMContactsPage() {
  useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useAutoSeedDemo('clients' as 'marketplace' | 'wellness' | 'collaboration' | 'clients' | 'vendors' | 'all', () => setRefreshKey(k => k + 1));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'All') params.set('status', statusFilter);
        if (sourceFilter !== 'All') params.set('source', sourceFilter);
        const res = await fetch(`/api/crm/contacts?${params.toString()}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (!cancelled) setContacts(data.contacts?.length ? data.contacts : DEMO_CONTACTS);
      } catch {
        if (!cancelled) setContacts(DEMO_CONTACTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search, statusFilter, sourceFilter, refreshKey]);

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error('First name, last name, and email are required');
      return;
    }
    { const r = validateEmail(form.email); if (!r.valid) { toast.error(r.error); return } }
    if (form.phone) { const r = validatePhone(form.phone); if (!r.valid) { toast.error(r.error); return } }
    try {
      if (editingId) {
        const res = await fetch(`/api/crm/contacts/${editingId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) throw new Error('Failed to update');
        toast.success('Contact updated successfully');
      } else {
        const res = await fetch('/api/crm/contacts', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        if (!res.ok) throw new Error('Failed to create');
        toast.success('Contact created successfully');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Failed to save contact');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Contact deleted');
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const startEdit = (c: Contact) => {
    setForm({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, company: c.company, title: c.title, type: c.type, status: c.status, source: c.source });
    setEditingId(c.id);
    setShowForm(true);
  };

  const activeCount = contacts.filter(c => c.status === 'Active').length;
  const inactiveCount = contacts.filter(c => c.status === 'Inactive').length;
  const totalDealValue = contacts.reduce((s, c) => s + (c.totalDealValue || 0), 0);

  const statusBadge = (status: string) => {
    if (status === 'Active') return 'thb-badge thb-badge-success';
    return 'thb-badge thb-badge-error';
  };

  const initials = (c: Contact) => `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase();

  const filtered = contacts.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (sourceFilter !== 'All' && c.source !== sourceFilter.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <FiUsers className="w-6 h-6" />
          <h1 className="text-2xl font-bold">CRM Contacts</h1>
        </div>
        <p className="text-white/80 text-sm">Manage your customer relationships and contact directory</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts', value: contacts.length, icon: FiUsers, color: 'text-green-500' },
          { label: 'Active', value: activeCount, icon: FiCheck, color: 'text-emerald-500' },
          { label: 'Inactive', value: inactiveCount, icon: FiX, color: 'text-red-500' },
          { label: 'Pipeline Value', value: `₹${(totalDealValue / 100000).toFixed(1)}L`, icon: FiBriefcase, color: 'text-teal-500' },
        ].map((s, i) => (
          <div key={i} className="thb-card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-xs text-thb-text-secondary">{s.label}</p>
              <p className="text-lg font-bold text-thb-text-primary">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Actions */}
      <div className="thb-card p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-2 w-full md:w-auto">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted w-4 h-4" />
              <input
                type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-2 text-sm border border-thb-border rounded-lg hover:bg-gray-50">
              <FiFilter className="w-4 h-4" /> <FiChevronDown className="w-3 h-3" />
            </button>
          </div>
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium">
            <FiPlus className="w-4 h-4" /> Add Contact
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-thb-border">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-thb-border rounded-lg bg-white">
              <option value="All">All Sources</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Social">Social</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="thb-card p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-thb-text-primary">{editingId ? 'Edit Contact' : 'Add New Contact'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="email" placeholder="Email * (e.g., name@domain.com)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="tel" placeholder="Phone (10-digit Indian mobile)" value={form.phone} onChange={e => setForm({ ...form, phone: phoneInputFilter(e.target.value) })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              <option value="Lead">Lead</option><option value="Customer">Customer</option><option value="Partner">Partner</option><option value="Vendor">Vendor</option>
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              <option value="Active">Active</option><option value="Inactive">Inactive</option>
            </select>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white">
              <option value="website">Website</option><option value="referral">Referral</option><option value="social">Social</option><option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium">Save</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-thb-border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Contact Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="thb-card p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="thb-card p-8 text-center">
          <FiUsers className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary">No contacts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {filtered.map(c => (
            <div key={c.id} className="thb-card thb-card-hover p-4 cursor-pointer" onClick={() => setViewContact(c)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials(c)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-thb-text-primary truncate">{c.firstName} {c.lastName}</h4>
                    <span className={statusBadge(c.status)}>{c.status}</span>
                  </div>
                  <p className="text-xs text-thb-text-secondary truncate">{c.title} at {c.company}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1"><FiMail className="w-3 h-3" /> {c.email}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" /> {c.phone}</span>
                    <span className="thb-badge thb-badge-purple text-[10px]">{c.source}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-thb-border" onClick={e => e.stopPropagation()}>
                <button onClick={() => startEdit(c)} className="p-1.5 rounded hover:bg-green-50 text-green-500" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setViewContact(c)} className="p-1.5 rounded hover:bg-gray-50 text-gray-500" title="View"><FiEye className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Panel */}
      {viewContact && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewContact(null)}>
          <div className="thb-card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-thb-text-primary">Contact Details</h3>
              <button onClick={() => setViewContact(null)} className="text-thb-text-muted hover:text-thb-text-primary"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
                {initials(viewContact)}
              </div>
              <div>
                <h4 className="font-semibold text-thb-text-primary">{viewContact.firstName} {viewContact.lastName}</h4>
                <p className="text-sm text-thb-text-secondary">{viewContact.title} at {viewContact.company}</p>
                <span className={statusBadge(viewContact.status)}>{viewContact.status}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-thb-text-secondary"><FiMail className="w-4 h-4" /> {viewContact.email}</div>
              <div className="flex items-center gap-2 text-thb-text-secondary"><FiPhone className="w-4 h-4" /> {viewContact.phone}</div>
              <div className="flex items-center gap-2 text-thb-text-secondary"><FiBriefcase className="w-4 h-4" /> {viewContact.company}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-thb-border">
              <div><p className="text-xs text-thb-text-muted">Source</p><p className="text-sm font-medium capitalize text-thb-text-primary">{viewContact.source}</p></div>
              <div><p className="text-xs text-thb-text-muted">Type</p><p className="text-sm font-medium text-thb-text-primary">{viewContact.type}</p></div>
              <div><p className="text-xs text-thb-text-muted">Deals</p><p className="text-sm font-medium text-thb-text-primary">{viewContact.dealCount || 0}</p></div>
              <div><p className="text-xs text-thb-text-muted">Pipeline Value</p><p className="text-sm font-medium text-thb-text-primary">₹{((viewContact.totalDealValue || 0) / 100000).toFixed(1)}L</p></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { startEdit(viewContact); setViewContact(null); }} className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>
              <button onClick={() => setViewContact(null)} className="px-4 py-2 border border-thb-border rounded-lg hover:bg-gray-50 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
