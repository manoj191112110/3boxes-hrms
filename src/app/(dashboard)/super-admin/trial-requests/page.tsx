'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

interface TrialRegistration {
  id: string;
  companyName: string;
  companyCode: string;
  companyEmail: string;
  companyPhone: string | null;
  companyWebsite: string | null;
  industry: string | null;
  country: string;
  currency: string;
  employeeCount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  designation: string | null;
  status: string;
  trialDays: number;
  trialStart: string | null;
  trialEnd: string | null;
  tempPassword: string | null;
  rejectionReason: string | null;
  notes: string | null;
  tenantId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
}

export default function TrialRequestsPage() {
  const { user } = useAuthStore();
  const [registrations, setRegistrations] = useState<TrialRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, [filter]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/trial/list' : `/api/trial/list?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setRegistrations(data.registrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch('/api/trial/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: id,
          trialDays: 15,
          reviewedBy: user?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Approved! Login: ${data.loginEmail} | Password: ${data.tempPassword} | URL: ${data.loginUrl}`,
        });
        fetchRegistrations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Approval failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await fetch('/api/trial/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: id,
          rejectionReason: rejectionReason[id] || 'Not specified',
          reviewedBy: user?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Registration rejected.' });
        fetchRegistrations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Rejection failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtend = async (id: string) => {
    const days = extendDays[id] || 7;
    setActionLoading(`extend-${id}`);
    setMessage(null);
    try {
      const res = await fetch('/api/trial/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: id, additionalDays: days }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Trial extended by ${days} days. New end: ${new Date(data.newTrialEnd).toLocaleDateString()}` });
        fetchRegistrations();
      } else {
        setMessage({ type: 'error', text: data.error || 'Extension failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (reg: TrialRegistration) => {
    let status = reg.status;
    if (reg.isExpired && ['approved', 'active'].includes(status)) {
      status = 'expired';
    }

    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
      suspended: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Trial Registrations</h1>
        <p className="text-gray-500 mt-1">Manage company trial requests for 3Boxes HRMS</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <pre className="whitespace-pre-wrap font-sans text-sm">{message.text}</pre>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'pending', 'approved', 'active', 'expired', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading registrations...</div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No registrations found.</div>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div key={reg.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{reg.companyName}</h3>
                    {getStatusBadge(reg)}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Code: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{reg.companyCode}</span>
                    {reg.tenantId && (
                      <span className="ml-3">Tenant: <span className="font-mono text-xs bg-green-50 px-1.5 py-0.5 rounded">{reg.tenantId.slice(0, 8)}...</span></span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Applied: {new Date(reg.createdAt).toLocaleDateString()}</p>
                  {reg.daysRemaining !== null && reg.daysRemaining > 0 && (
                    <p className="text-sm font-medium text-green-600">{reg.daysRemaining} days remaining</p>
                  )}
                  {reg.isExpired && (
                    <p className="text-sm font-medium text-red-600">Trial expired</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500">Contact:</span>
                  <p className="font-medium">{reg.contactName}</p>
                  <p className="text-gray-600 text-xs">{reg.contactEmail}</p>
                </div>
                <div>
                  <span className="text-gray-500">Company Email:</span>
                  <p className="font-medium">{reg.companyEmail}</p>
                </div>
                <div>
                  <span className="text-gray-500">Industry:</span>
                  <p className="font-medium">{reg.industry || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Employees:</span>
                  <p className="font-medium">{reg.employeeCount}</p>
                </div>
              </div>

              {/* Show credentials for approved/active */}
              {['approved', 'active'].includes(reg.status) && reg.tempPassword && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm">
                  <span className="font-semibold text-green-800">Login Credentials:</span>
                  <span className="ml-2 text-green-700">Email: {reg.contactEmail} | Password: {reg.tempPassword}</span>
                  <span className="ml-2 text-green-600">| URL: https://{reg.companyCode}.3boxeshrms.com</span>
                </div>
              )}

              {/* Rejection reason */}
              {reg.status === 'rejected' && reg.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                  Rejection reason: {reg.rejectionReason}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {reg.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(reg.id)}
                      disabled={actionLoading === reg.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {actionLoading === reg.id ? 'Approving...' : 'Approve (15 days)'}
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Rejection reason"
                        value={rejectionReason[reg.id] || ''}
                        onChange={(e) => setRejectionReason({ ...rejectionReason, [reg.id]: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => handleReject(reg.id)}
                        disabled={actionLoading === reg.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {actionLoading === reg.id ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </>
                )}

                {['approved', 'active'].includes(reg.status) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={extendDays[reg.id] || 7}
                      onChange={(e) => setExtendDays({ ...extendDays, [reg.id]: parseInt(e.target.value) || 7 })}
                      className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center"
                    />
                    <button
                      onClick={() => handleExtend(reg.id)}
                      disabled={actionLoading === `extend-${reg.id}`}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {actionLoading === `extend-${reg.id}` ? 'Extending...' : 'Extend Days'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
