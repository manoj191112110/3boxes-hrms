'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiVideo, FiPhone, FiPlus, FiClock, FiLock,
  FiSearch, FiRefreshCw, FiX, FiUser, FiCheck,
  FiPhoneOff, FiPhoneCall, FiArrowUpRight, FiArrowDownLeft,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  department?: { name: string } | null;
  status?: string;
}

interface CallLog {
  id: string;
  callType: string;
  provider: string;
  status: string;
  isE2EE: boolean;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  meetingUrl: string | null;
  initiatorId: string;
  initiator: { id: string; firstName: string; lastName: string; avatar?: string | null };
  participants: Array<{ userId: string; joinedAt: string | null; user: { id: string; firstName: string; lastName: string; avatar?: string | null } }>;
}

export default function CallsPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);

  const [calls, setCalls] = useState<CallLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialModal, setShowDialModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Employee | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [initiating, setInitiating] = useState(false);

  // ─── Fetch Call Logs ───────────────────────────
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/collaboration/calls?limit=100', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setCalls(d.calls || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async (search = '') => {
    setLoadingContacts(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/employees?limit=50&search=${encodeURIComponent(search)}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setEmployees(d.employees || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [scopeQuery]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // ─── Initiate Call ─────────────────────────────
  const handleInitiateCall = async () => {
    if (!selectedContact) { toast.error('Select a contact'); return; }
    setInitiating(true);
    try {
      const r = await fetch('/api/collaboration/calls', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          callType,
          provider: 'native_webrtc',
          participantIds: [selectedContact.id],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`${callType === 'video' ? 'Video' : 'Audio'} call initiated with ${selectedContact.firstName} ${selectedContact.lastName}`);
      setShowDialModal(false);
      setSelectedContact(null);
      fetchCalls();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to initiate call');
    } finally {
      setInitiating(false);
    }
  };

  // ─── End Call ──────────────────────────────────
  const handleEndCall = async (callId: string) => {
    try {
      const r = await fetch('/api/collaboration/calls', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ callId, action: 'end', status: 'completed' }),
      });
      if (!r.ok) throw new Error('Failed');
      toast.success('Call ended');
      fetchCalls();
    } catch {
      toast.error('Failed to end call');
    }
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getContactName = (call: CallLog) => {
    const otherParticipant = call.participants.find(p => p.userId !== user?.id);
    if (otherParticipant) return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
    if (call.initiatorId !== user?.id) return `${call.initiator.firstName} ${call.initiator.lastName}`;
    return 'Unknown';
  };

  const isOutgoing = (call: CallLog) => call.initiatorId === user?.id;

  const filteredCalls = calls.filter(c => {
    if (!search) return true;
    return getContactName(c).toLowerCase().includes(search.toLowerCase());
  });

  // Compute stats
  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const missedCalls = calls.filter(c => c.status === 'missed').length;
  const totalDuration = calls.reduce((sum, c) => sum + (c.durationSec || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiPhone className="w-6 h-6 text-teal-500" />
            Calls
          </h1>
          <p className="text-sm text-slate-500 mt-1">WebRTC audio/video calls with E2EE and AI transcription</p>
        </div>
        <button onClick={() => { setShowDialModal(true); fetchEmployees(); }} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> New Call
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: totalCalls, icon: FiPhone, color: 'text-teal-500', bg: 'bg-teal-50' },
          { label: 'Completed', value: completedCalls, icon: FiCheck, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Missed', value: missedCalls, icon: FiPhoneOff, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Total Duration', value: formatDuration(totalDuration), icon: FiClock, color: 'text-amber-500', bg: 'bg-amber-50' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="thb-card p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                <p className="text-[11px] text-slate-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by contact name..." className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
      </div>

      {/* Call History */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Contact</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Direction</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Duration</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Provider</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Security</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400"><FiRefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading...</td></tr>
              ) : filteredCalls.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-500"><FiPhone className="w-8 h-8 mx-auto mb-2 text-slate-300" /> No calls yet</td></tr>
              ) : filteredCalls.map(call => (
                <tr key={call.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-[10px] font-bold">
                        {getContactName(call).split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-slate-700 font-medium">{getContactName(call)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 ${call.callType === 'video' ? 'text-blue-500' : 'text-teal-500'}`}>
                      {call.callType === 'video' ? <FiVideo className="w-3.5 h-3.5" /> : <FiPhone className="w-3.5 h-3.5" />}
                      {call.callType === 'video' ? 'Video' : 'Audio'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 ${isOutgoing(call) ? 'text-blue-500' : 'text-green-500'}`}>
                      {isOutgoing(call) ? <FiArrowUpRight className="w-3.5 h-3.5" /> : <FiArrowDownLeft className="w-3.5 h-3.5" />}
                      {isOutgoing(call) ? 'Outgoing' : 'Incoming'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmtDateTime(call.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{formatDuration(call.durationSec)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{call.provider === 'native_webrtc' ? 'WebRTC' : call.provider}</td>
                  <td className="px-4 py-3">
                    <span className={`thb-badge ${
                      call.status === 'completed' ? 'thb-badge-success' :
                      call.status === 'missed' ? 'thb-badge-error' :
                      call.status === 'answered' ? 'thb-badge-success' :
                      'thb-badge-warning'
                    }`}>{call.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {call.isE2EE ? (
                      <span className="inline-flex items-center gap-1 text-teal-500 text-xs"><FiLock className="w-3 h-3" /> E2EE</span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {call.status === 'initiated' || call.status === 'answered' ? (
                      <button onClick={() => handleEndCall(call.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="End Call">
                        <FiPhoneOff className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => { setShowDialModal(true); fetchEmployees(); }} className="p-1.5 text-teal-500 hover:bg-teal-50 rounded" title="Call again">
                        <FiPhoneCall className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── New Call Modal ─── */}
      {showDialModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">New Call</h3>
              <button onClick={() => setShowDialModal(false)} className="text-slate-400 hover:text-slate-700">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Call Type */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCallType('audio')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  callType === 'audio' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiPhone className="w-4 h-4" /> Audio
              </button>
              <button
                onClick={() => setCallType('video')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  callType === 'video' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FiVideo className="w-4 h-4" /> Video
              </button>
            </div>

            {/* Contact Search */}
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={contactSearch}
                onChange={e => { setContactSearch(e.target.value); if (e.target.value.length >= 2) fetchEmployees(e.target.value); }}
                placeholder="Search employees to call..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Contact List */}
            <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg">
              {loadingContacts ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading...</div>
              ) : employees.filter(e => e.id !== user?.id).map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedContact(emp)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-teal-50 transition-colors ${
                    selectedContact?.id === emp.id ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[10px] text-slate-400">{emp.department?.name || 'No Dept'} · {emp.status === 'active' ? '🟢 Online' : '⚫ Offline'}</p>
                  </div>
                </button>
              ))}
            </div>

            {selectedContact && (
              <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-center">
                <p className="text-sm text-teal-700">Calling <strong>{selectedContact.firstName} {selectedContact.lastName}</strong></p>
                <p className="text-[10px] text-teal-500 mt-0.5">{callType === 'video' ? 'Video' : 'Audio'} · WebRTC · E2EE</p>
              </div>
            )}

            <button
              onClick={handleInitiateCall}
              disabled={initiating || !selectedContact}
              className="mt-4 w-full 3boxes-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initiating ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : callType === 'video' ? <FiVideo className="w-4 h-4" /> : <FiPhone className="w-4 h-4" />}
              Start {callType === 'video' ? 'Video' : 'Audio'} Call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
