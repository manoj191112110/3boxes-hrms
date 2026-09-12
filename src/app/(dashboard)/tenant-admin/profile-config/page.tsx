'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiSettings, FiPlus, FiTrash2, FiEdit3, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CustomField {
  id: string;
  scope: string;
  countryCode: string | null;
  companyId: string | null;
  label: string;
  key: string;
  fieldType: string;
  options: string | null;
  isRequired: boolean;
  isSystemLocked: boolean;
  isVisibleToManager: boolean;
  isVisibleToPeer: boolean;
  displayOrder: number;
}

export default function ProfileConfigPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newField, setNewField] = useState({
    scope: 'global',
    countryCode: '',
    companyId: '',
    label: '',
    key: '',
    fieldType: 'text',
    options: '',
    isRequired: false,
    isVisibleToManager: false,
    isVisibleToPeer: false,
    displayOrder: 0,
  });

  const fetchFields = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employees/custom-fields', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const handleCreate = async () => {
    if (!newField.label || !newField.key || !newField.fieldType) {
      toast.error('Label, key, and field type are required');
      return;
    }
    if (newField.scope === 'country' && !newField.countryCode) {
      toast.error('Country code is required for country scope');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        scope: newField.scope,
        label: newField.label,
        key: newField.key,
        fieldType: newField.fieldType,
        isRequired: newField.isRequired,
        isVisibleToManager: newField.isVisibleToManager,
        isVisibleToPeer: newField.isVisibleToPeer,
        displayOrder: newField.displayOrder,
      };
      if (newField.scope === 'country') body.countryCode = newField.countryCode;
      if (newField.scope === 'company') body.companyId = newField.companyId;
      if (newField.fieldType === 'select' || newField.fieldType === 'multiselect') {
        body.options = newField.options.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const res = await fetch('/api/employees/custom-fields', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Custom field created');
        setShowNewModal(false);
        setNewField({
          scope: 'global', countryCode: '', companyId: '', label: '', key: '',
          fieldType: 'text', options: '', isRequired: false, isVisibleToManager: false,
          isVisibleToPeer: false, displayOrder: 0,
        });
        fetchFields();
      } else {
        toast.error('Failed to create field');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiSettings className="w-6 h-6 text-teal-500" />
            Profile Configuration
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Create custom fields for employee profiles — global, country-specific (e.g. Blood Type for Japan), or company-specific (e.g. IRP5 for South Africa)
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
        >
          <FiPlus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      <div className="thb-card overflow-hidden">
        <div className="p-3 border-b border-thb-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-thb-text-primary">Custom Fields ({fields.length})</h2>
          <button onClick={fetchFields} className="inline-flex items-center gap-1 text-xs text-thb-text-secondary hover:bg-slate-100 px-2 py-1 rounded">
            <FiRefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-thb-text-muted">Loading...</div>
        ) : fields.length === 0 ? (
          <div className="p-8 text-center text-sm text-thb-text-muted">
            No custom fields configured. Add one to extend employee profiles.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-thb-text-muted uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Scope</th>
                <th className="px-4 py-2 font-medium">Required</th>
                <th className="px-4 py-2 font-medium">Visibility</th>
                <th className="px-4 py-2 font-medium">Locked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-thb-border">
              {fields.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{f.label}</td>
                  <td className="px-4 py-3 text-xs font-mono text-thb-text-secondary">{f.key}</td>
                  <td className="px-4 py-3 text-xs text-thb-text-secondary capitalize">{f.fieldType}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {f.scope}
                      {f.countryCode && ` · ${f.countryCode}`}
                      {f.companyId && ` · ${f.companyId.substring(0, 8)}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{f.isRequired ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-xs text-thb-text-muted">
                    {f.isVisibleToManager ? 'Manager · ' : ''}{f.isVisibleToPeer ? 'Peer' : ''}
                    {!f.isVisibleToManager && !f.isVisibleToPeer ? 'HR only' : ''}
                  </td>
                  <td className="px-4 py-3 text-xs">{f.isSystemLocked ? '🔒' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="thb-card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-thb-text-primary mb-4">Add Custom Field</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Label <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  placeholder="e.g. Blood Type"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Key <span className="text-red-500 font-bold">*</span></label>
                <input
                  type="text"
                  value={newField.key}
                  onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                  placeholder="e.g. blood_type"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Type <span className="text-red-500 font-bold">*</span></label>
                  <select
                    value={newField.fieldType}
                    onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select (single)</option>
                    <option value="multiselect">Multi-select</option>
                    <option value="boolean">Boolean</option>
                    <option value="file">File</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Scope <span className="text-red-500 font-bold">*</span></label>
                  <select
                    value={newField.scope}
                    onChange={(e) => setNewField({ ...newField, scope: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  >
                    <option value="global">Global (all employees)</option>
                    <option value="country">Country-specific</option>
                    <option value="company">Sub-company-specific</option>
                  </select>
                </div>
              </div>
              {newField.scope === 'country' && (
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Country Code (ISO 3166-1 alpha-2)</label>
                  <input
                    type="text"
                    value={newField.countryCode}
                    onChange={(e) => setNewField({ ...newField, countryCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. JP, ZA, AE"
                    maxLength={2}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  />
                </div>
              )}
              {newField.scope === 'company' && (
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Sub-Company ID</label>
                  <input
                    type="text"
                    value={newField.companyId}
                    onChange={(e) => setNewField({ ...newField, companyId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  />
                </div>
              )}
              {(newField.fieldType === 'select' || newField.fieldType === 'multiselect') && (
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Options (comma-separated)</label>
                  <input
                    type="text"
                    value={newField.options}
                    onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                    placeholder="A, B, O, AB"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newField.isRequired}
                    onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newField.isVisibleToManager}
                    onChange={(e) => setNewField({ ...newField, isVisibleToManager: e.target.checked })}
                    className="rounded"
                  />
                  Manager
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newField.isVisibleToPeer}
                    onChange={(e) => setNewField({ ...newField, isVisibleToPeer: e.target.checked })}
                    className="rounded"
                  />
                  Peer
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 text-sm text-thb-text-secondary hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
