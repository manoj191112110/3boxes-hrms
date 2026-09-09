'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiLock, FiPlus, FiRefreshCw, FiCheck, FiX, FiZap,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface SSOProvider {
  id: string;
  name: string;
  providerType: string;
  clientId: string | null;
  issuer: string | null;
  metadataUrl: string | null;
  redirectUri: string | null;
  jitProvisioningEnabled: boolean;
  jitDefaultRole: string;
  jitDefaultStatus: string;
  isDefault: boolean;
  isActive: boolean;
  logoUrl: string | null;
}

export default function SSOProvidersPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    providerType: 'azuread',
    clientId: '',
    clientSecret: '',
    issuer: '',
    metadataUrl: '',
    redirectUri: '',
    jitProvisioningEnabled: true,
    jitDefaultRole: 'employee',
    jitDefaultStatus: 'pending_onboarding',
    isDefault: false,
  });

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collaboration/sso-providers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCreate = async () => {
    if (!newProvider.name || !newProvider.providerType) {
      toast.error('Name and provider type are required');
      return;
    }
    try {
      const res = await fetch('/api/collaboration/sso-providers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newProvider),
      });
      if (res.ok) {
        toast.success('SSO provider added');
        setShowNewModal(false);
        setNewProvider({
          name: '', providerType: 'azuread', clientId: '', clientSecret: '',
          issuer: '', metadataUrl: '', redirectUri: '',
          jitProvisioningEnabled: true, jitDefaultRole: 'employee',
          jitDefaultStatus: 'pending_onboarding', isDefault: false,
        });
        fetchProviders();
      } else {
        toast.error('Failed to add provider');
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
            <FiLock className="w-6 h-6 text-green-500" />
            SSO Providers
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Configure Federated Login (REQ-SOC-03) and Just-In-Time Provisioning (REQ-SOC-04) via Azure AD, Google Workspace, Okta, etc.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <FiPlus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-sm text-thb-text-muted">Loading...</div>
        ) : providers.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-sm text-thb-text-muted">
            No SSO providers configured. Add one to enable federated login.
          </div>
        ) : (
          providers.map((p) => (
            <div key={p.id} className="thb-card p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                    {p.name}
                    {p.isDefault && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-700 border border-green-200">Default</span>
                    )}
                  </h3>
                  <p className="text-xs text-thb-text-muted capitalize">{p.providerType}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${p.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-1 text-xs text-thb-text-secondary">
                {p.clientId && <p><strong>Client ID:</strong> {p.clientId.substring(0, 16)}...</p>}
                {p.issuer && <p><strong>Issuer:</strong> {p.issuer}</p>}
                {p.redirectUri && <p><strong>Redirect URI:</strong> {p.redirectUri}</p>}
              </div>
              {p.jitProvisioningEnabled && (
                <div className="mt-2 p-2 rounded bg-teal-50 border border-teal-100 text-[10px] text-teal-700 flex items-center gap-1">
                  <FiZap className="w-3 h-3" />
                  JIT Provisioning: new users auto-created as &quot;{p.jitDefaultStatus}&quot; with role &quot;{p.jitDefaultRole}&quot;
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="thb-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-thb-text-primary mb-4">Add SSO Provider</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Display Name *</label>
                <input
                  type="text"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  placeholder="e.g. Corporate Azure AD"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Provider Type *</label>
                <select
                  value={newProvider.providerType}
                  onChange={(e) => setNewProvider({ ...newProvider, providerType: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                >
                  <option value="azuread">Microsoft Azure AD</option>
                  <option value="google">Google Workspace</option>
                  <option value="okta">Okta</option>
                  <option value="saml">Generic SAML</option>
                  <option value="oidc">Generic OIDC</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Client ID</label>
                  <input
                    type="text"
                    value={newProvider.clientId}
                    onChange={(e) => setNewProvider({ ...newProvider, clientId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary">Client Secret</label>
                  <input
                    type="password"
                    value={newProvider.clientSecret}
                    onChange={(e) => setNewProvider({ ...newProvider, clientSecret: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Issuer URL (OIDC) or Entity ID (SAML)</label>
                <input
                  type="text"
                  value={newProvider.issuer}
                  onChange={(e) => setNewProvider({ ...newProvider, issuer: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Metadata URL (SAML) or Discovery URL (OIDC)</label>
                <input
                  type="url"
                  value={newProvider.metadataUrl}
                  onChange={(e) => setNewProvider({ ...newProvider, metadataUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Redirect URI</label>
                <input
                  type="url"
                  value={newProvider.redirectUri}
                  onChange={(e) => setNewProvider({ ...newProvider, redirectUri: e.target.value })}
                  placeholder="https://hrms.example.com/api/auth/sso/callback"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-thb-text-secondary">
                <input
                  type="checkbox"
                  checked={newProvider.jitProvisioningEnabled}
                  onChange={(e) => setNewProvider({ ...newProvider, jitProvisioningEnabled: e.target.checked })}
                  className="rounded"
                />
                Enable JIT Provisioning (auto-create new users from Azure AD)
              </label>
              {newProvider.jitProvisioningEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-thb-text-secondary">JIT Default Role</label>
                    <select
                      value={newProvider.jitDefaultRole}
                      onChange={(e) => setNewProvider({ ...newProvider, jitDefaultRole: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr_admin">HR Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-thb-text-secondary">JIT Default Status</label>
                    <select
                      value={newProvider.jitDefaultStatus}
                      onChange={(e) => setNewProvider({ ...newProvider, jitDefaultStatus: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-thb-border text-sm"
                    >
                      <option value="pending_onboarding">Pending Onboarding</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-thb-text-secondary">
                <input
                  type="checkbox"
                  checked={newProvider.isDefault}
                  onChange={(e) => setNewProvider({ ...newProvider, isDefault: e.target.checked })}
                  className="rounded"
                />
                Set as default provider (shown on login page)
              </label>
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
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
