'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiCpu,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiKey,
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiShield,
  FiUserCheck,
  FiCopy,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Auth helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface BiometricDevice {
  id: string;
  name: string;
  serialNumber: string;
  vendor: string;
  model: string | null;
  firmwareVersion: string | null;
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  geofenceId: string | null;
  geofence?: { id: string; name: string } | null;
  ipAddress: string | null;
  lastHeartbeatAt: string | null;
  encryptionKeyId: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { enrollments: number; punches: number };
}

interface BiometricEnrollment {
  id: string;
  employeeId: string;
  deviceId: string;
  templateHash: string;
  modality: string;
  qualityScore: number | null;
  isActive: boolean;
  enrolledAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeId: string; email: string };
  device: { id: string; name: string; serialNumber: string; vendor: string };
}

interface BiometricPunch {
  id: string;
  deviceId: string;
  employeeId: string | null;
  punchType: string;
  punchTime: string;
  spoofingRisk: number;
  buddyPunchRisk: number;
  flagged: boolean;
  flagReasons: string[] | null;
  attendanceId: string | null;
  createdAt: string;
  device: { id: string; name: string; serialNumber: string; vendor: string; branch?: { name: string } | null };
  employee: { id: string; firstName: string; lastName: string; employeeId: string; email: string } | null;
}

interface AiThresholds {
  id: string;
  spoofingRiskThreshold: number;
  buddyPunchRiskThreshold: number;
  impossibleTravelKm: number;
  impossibleTravelMinutes: number;
  offHoursStartMinutes: number;
  offHoursEndMinutes: number;
}

interface Branch { id: string; name: string }
interface Geofence { id: string; name: string }
interface Employee { id: string; employeeId: string; firstName: string; lastName: string; email: string }

/* ── Tips & Workflow ── */
const biometricTips = [
  { title: 'Token Rotation', description: 'Rotate the device API token immediately if you suspect it has been leaked. The old token stops working the moment you rotate.' },
  { title: 'Never Store Raw Templates', description: 'The system stores only SHA-256 hashes of encrypted biometric templates. Even a database leak cannot reconstruct fingerprints.' },
  { title: 'TLS 1.3 Only', description: 'Devices must push over HTTPS with TLS 1.3. The webhook rejects plain HTTP connections.' },
  { title: 'AI Flagging is Non-Blocking', description: 'Flagged punches still create an Attendance record (for audit) but are marked "flagged" for manager review.' },
  { title: 'Heartbeat Health', description: 'Devices should send a heartbeat every 1–5 minutes. Devices with no heartbeat in 15+ minutes are shown as offline.' },
];

const biometricWorkflowSteps = [
  { step: 1, title: 'Register Device', description: 'Add a new biometric terminal with vendor + serial number. Save the returned API token to the device config.' },
  { step: 2, title: 'Enroll Employees', description: 'For each employee, capture their fingerprint/face on each device. The hashed template is stored for audit + dedup.' },
  { step: 3, title: 'Configure AI Thresholds', description: 'Set spoofing/buddy-punch risk thresholds and impossible-travel distance/time.' },
  { step: 4, title: 'Devices Push Punches', description: 'Every check-in/out the device captures is POSTed to /api/attendance/biometric/punch with the device token.' },
  { step: 5, title: 'Review Flagged Punches', description: 'Flagged punches appear in the Punches tab. Manager reviews and either approves or rejects.' },
  { step: 6, title: 'Audit Trail', description: 'Every punch — flagged or clean — is written to the Attendance Audit Log for compliance (REQ-SEC-ATT-04).' },
];

/* ── Component ── */
export default function BiometricPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [tab, setTab] = useState<'devices' | 'enrollments' | 'punches' | 'thresholds'>('devices');
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [enrollments, setEnrollments] = useState<BiometricEnrollment[]>([]);
  const [punches, setPunches] = useState<BiometricPunch[]>([]);
  const [thresholds, setThresholds] = useState<AiThresholds | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newToken, setNewToken] = useState<{ device: string; token: string } | null>(null);
  const [punchesSummary, setPunchesSummary] = useState<{ todayTotal: number; todayFlagged: number; last7Flagged: number } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [deviceForm, setDeviceForm] = useState({
    name: '',
    serialNumber: '',
    vendor: 'zkteco',
    model: '',
    firmwareVersion: '',
    branchId: '',
    geofenceId: '',
    encryptionKeyId: '',
  });

  const [enrollForm, setEnrollForm] = useState({
    employeeId: '',
    deviceId: '',
    templateHash: '',
    modality: 'fingerprint',
    qualityScore: '',
  });

  /* ── Fetchers ── */
  const fetchDevices = useCallback(async () => {
    try {
      const r = await fetch(`/api/attendance/biometric/devices?${scopeQuery}` , { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDevices(d.devices || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load devices');
    }
  }, []);

  const fetchEnrollments = useCallback(async () => {
    try {
      const r = await fetch(`/api/attendance/biometric/enroll?${scopeQuery}limit=200`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEnrollments(d.enrollments || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load enrollments');
    }
  }, []);

  const fetchPunches = useCallback(async () => {
    try {
      const r = await fetch(`/api/attendance/biometric/punch-log?${scopeQuery}limit=100`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPunches(d.punches || []);
      if (d.summary) setPunchesSummary(d.summary);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load punches');
    }
  }, []);

  const fetchThresholds = useCallback(async () => {
    try {
      const r = await fetch(`/api/attendance/biometric/thresholds?${scopeQuery}` , { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setThresholds(d.thresholds);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load thresholds');
    }
  }, []);

  const fetchAux = useCallback(async () => {
    try {
      const [br, gf, em] = await Promise.all([
        fetch(`/api/branches?${scopeQuery}limit=200`, { headers: getAuthHeaders() }).then((r) => r.json()).catch(() => ({ branches: [] })),
        fetch(`/api/attendance/geofence?${scopeQuery}limit=200`, { headers: getAuthHeaders() }).then((r) => r.json()).catch(() => ({ geofences: [] })),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers: getAuthHeaders() }).then((r) => r.json()).catch(() => ({ employees: [] })),
      ]);
      setBranches(br.branches || []);
      setGeofences(gf.geofences || []);
      setEmployees(em.employees || []);
    } catch { /* ignore */ }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDevices(), fetchEnrollments(), fetchPunches(), fetchThresholds(), fetchAux()]);
    setLoading(false);
  }, [fetchDevices, fetchEnrollments, fetchPunches, fetchThresholds, fetchAux]);

  useEffect(() => { queueMicrotask(() => { refreshAll(); }); }, [refreshAll]);

  /* ── Device form submit ── */
  const handleDeviceSubmit = async () => {
    if (!deviceForm.name || !deviceForm.serialNumber || !deviceForm.vendor) {
      toast.error('Name, serial number and vendor are required');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/attendance/biometric/devices?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(deviceForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Device registered — copy the API token now!');
      setNewToken({ device: d.device.name, token: d.apiToken });
      setShowDeviceForm(false);
      setDeviceForm({ name: '', serialNumber: '', vendor: 'zkteco', model: '', firmwareVersion: '', branchId: '', geofenceId: '', encryptionKeyId: '' });
      fetchDevices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Enrollment submit ── */
  const handleEnrollSubmit = async () => {
    if (!enrollForm.employeeId || !enrollForm.deviceId || !enrollForm.templateHash) {
      toast.error('Employee, device and template hash are required');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/attendance/biometric/enroll?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...enrollForm,
          qualityScore: enrollForm.qualityScore ? Number(enrollForm.qualityScore) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Enrollment saved');
      setShowEnrollForm(false);
      setEnrollForm({ employeeId: '', deviceId: '', templateHash: '', modality: 'fingerprint', qualityScore: '' });
      fetchEnrollments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to enroll');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Rotate token ── */
  const handleRotate = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Rotate API token for "${deviceName}"? The old token stops working immediately.`)) return;
    try {
      const r = await fetch(`/api/attendance/biometric/devices/${deviceId}/rotate-token?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNewToken({ device: deviceName, token: d.apiToken });
      toast.success('New token generated — copy it now!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to rotate token');
    }
  };

  /* ── Toggle active ── */
  const handleToggleActive = async (device: BiometricDevice) => {
    try {
      const r = await fetch(`/api/attendance/biometric/devices/${device.id}?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !device.isActive }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(device.isActive ? 'Device deactivated' : 'Device activated');
      fetchDevices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle');
    }
  };

  /* ── Revoke enrollment ── */
  const handleRevokeEnrollment = async (enrollment: BiometricEnrollment) => {
    if (!confirm(`Revoke biometric enrollment for ${enrollment.employee.firstName} ${enrollment.employee.lastName} on ${enrollment.device.name}?`)) return;
    try {
      const r = await fetch(`/api/attendance/biometric/enrollments/${enrollment.id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Enrollment revoked');
      fetchEnrollments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to revoke');
    }
  };

  /* ── Save thresholds ── */
  const handleSaveThresholds = async () => {
    if (!thresholds) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/attendance/biometric/thresholds?${scopeQuery}` , {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(thresholds),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success('Thresholds saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save thresholds');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Helpers ── */
  const vendorLabel: Record<string, string> = {
    zkteco: 'ZKTeco',
    mantra: 'Mantra',
    secugen: 'SecuGen',
    suprema: 'Suprema',
    custom: 'Custom',
  };

  const isOnline = (last: string | null, now: number) => {
    if (!last) return false;
    return now - new Date(last).getTime() < 15 * 60 * 1000;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied to clipboard');
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiCpu className="w-6 h-6 text-teal-500" />
            Biometric Devices
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Register biometric terminals, enroll employees, review AI-flagged punches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 text-sm"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isAdmin && tab === 'devices' && (
            <button
              onClick={() => setShowDeviceForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium shadow-sm shadow-teal-500/25"
            >
              <FiPlus className="w-4 h-4" />
              Register Device
            </button>
          )}
          {isAdmin && tab === 'enrollments' && (
            <button
              onClick={() => setShowEnrollForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium shadow-sm shadow-teal-500/25"
            >
              <FiPlus className="w-4 h-4" />
              Enroll Employee
            </button>
          )}
        </div>
      </div>

      <ModuleTips
        moduleKey="attendance_biometric"
        title="Biometric Integration Tips"
        tips={biometricTips}
        userRole={user?.role}
      />

      <ModuleWorkflow
        moduleKey="attendance_biometric"
        title="Biometric Punch Flow"
        subtitle="From device registration to AI-flagged punch review"
        steps={biometricWorkflowSteps}
        accentColor="violet"
        userRole={user?.role}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border overflow-x-auto">
        {([
          { key: 'devices', label: 'Devices', icon: FiCpu, count: devices.length },
          { key: 'enrollments', label: 'Enrollments', icon: FiUserCheck, count: enrollments.length },
          { key: 'punches', label: 'Punches', icon: FiActivity, count: punches.length },
          ...(isAdmin ? [{ key: 'thresholds' as const, label: 'AI Thresholds', icon: FiShield, count: undefined as number | undefined }] : []),
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {typeof t.count === 'number' && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${tab === t.key ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div className="space-y-4">
          {devices.length === 0 && !loading ? (
            <div className="thb-card p-12 text-center">
              <FiCpu className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No biometric devices registered</p>
              <p className="text-sm text-thb-text-muted mt-1">
                {isAdmin ? 'Click "Register Device" to add your first terminal.' : 'Ask an admin to register a device.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => {
                const online = isOnline(device.lastHeartbeatAt, nowTick);
                return (
                  <div key={device.id} className="thb-card p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-thb-text-primary">{device.name}</h3>
                          <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} title={online ? 'Online' : 'Offline'} />
                        </div>
                        <p className="text-xs text-thb-text-muted mt-0.5">
                          {vendorLabel[device.vendor] || device.vendor}
                          {device.model ? ` · ${device.model}` : ''}
                        </p>
                      </div>
                      <span className={`thb-badge ${device.isActive ? 'thb-badge-success' : 'bg-slate-100 text-slate-500'}`}>
                        {device.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Serial</span>
                        <span className="font-mono text-xs text-thb-text-primary">{device.serialNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Branch</span>
                        <span className="text-thb-text-primary">{device.branch?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Geofence</span>
                        <span className="text-thb-text-primary">{device.geofence?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Last heartbeat</span>
                        <span className="text-thb-text-primary text-xs">
                          {device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString() : 'Never'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Enrollments</span>
                        <span className="text-thb-text-primary">{device._count?.enrollments ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-thb-text-muted">Total punches</span>
                        <span className="text-thb-text-primary">{device._count?.punches ?? 0}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 pt-2 border-t border-thb-border">
                        <button
                          onClick={() => handleRotate(device.id, device.name)}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-thb-border text-thb-text-secondary hover:bg-slate-50"
                        >
                          <FiKey className="w-3 h-3" />
                          Rotate token
                        </button>
                        <button
                          onClick={() => handleToggleActive(device)}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border border-thb-border ${
                            device.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {device.isActive ? <FiXCircle className="w-3 h-3" /> : <FiCheckCircle className="w-3 h-3" />}
                          {device.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enrollments Tab */}
      {tab === 'enrollments' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Modality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Quality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Template Hash</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Enrolled</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-thb-text-muted">
                      No enrollments yet. {isAdmin && 'Click "Enroll Employee" to add the first one.'}
                    </td>
                  </tr>
                ) : (
                  enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-thb-border/50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-thb-text-primary">{e.employee.firstName} {e.employee.lastName}</div>
                        <div className="text-xs text-thb-text-muted">{e.employee.employeeId} · {e.employee.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">
                        <div>{e.device.name}</div>
                        <div className="text-xs text-thb-text-muted">{e.device.serialNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-thb-text-secondary">{e.modality}</td>
                      <td className="px-4 py-3 text-sm text-thb-text-secondary">
                        {e.qualityScore != null ? `${e.qualityScore.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-thb-text-muted">
                        {e.templateHash.substring(0, 12)}…
                      </td>
                      <td className="px-4 py-3 text-xs text-thb-text-secondary">
                        {new Date(e.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`thb-badge ${e.isActive ? 'thb-badge-success' : 'bg-slate-100 text-slate-500'}`}>
                          {e.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          {e.isActive && (
                            <button
                              onClick={() => handleRevokeEnrollment(e)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                              title="Revoke enrollment"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Punches Tab */}
      {tab === 'punches' && (
        <div className="space-y-4">
          {punchesSummary && (
            <div className="grid grid-cols-3 gap-4">
              <div className="thb-card p-4">
                <p className="text-xs font-medium text-thb-text-muted">Today&apos;s punches</p>
                <p className="text-2xl font-bold text-thb-text-primary mt-1">{punchesSummary.todayTotal}</p>
              </div>
              <div className="thb-card p-4">
                <p className="text-xs font-medium text-thb-text-muted">Today&apos;s flagged</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{punchesSummary.todayFlagged}</p>
              </div>
              <div className="thb-card p-4">
                <p className="text-xs font-medium text-thb-text-muted">Flagged (last 7 days)</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{punchesSummary.last7Flagged}</p>
              </div>
            </div>
          )}

          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Device</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Spoofing</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Buddy</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Flag reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-thb-text-muted">
                        No biometric punches ingested yet. Once devices start pushing, you&apos;ll see them here.
                      </td>
                    </tr>
                  ) : (
                    punches.map((p) => (
                      <tr key={p.id} className={`border-b border-thb-border/50 ${p.flagged ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {new Date(p.punchTime).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {p.employee ? (
                            <>
                              <div className="font-medium text-thb-text-primary">{p.employee.firstName} {p.employee.lastName}</div>
                              <div className="text-xs text-thb-text-muted">{p.employee.employeeId}</div>
                            </>
                          ) : <span className="text-thb-text-muted">Unmatched</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          <div>{p.device.name}</div>
                          <div className="text-xs text-thb-text-muted">{p.device.vendor}{p.device.branch?.name ? ` · ${p.device.branch.name}` : ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`thb-badge ${p.punchType === 'check_in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {p.punchType === 'check_in' ? 'In' : 'Out'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <RiskBadge value={p.spoofingRisk} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <RiskBadge value={p.buddyPunchRisk} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {p.flagged ? (
                            <div className="flex flex-wrap gap-1">
                              <FiAlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              {(p.flagReasons || []).map((r) => (
                                <span key={r} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">{r}</span>
                              ))}
                            </div>
                          ) : (
                            <FiCheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Thresholds Tab */}
      {tab === 'thresholds' && isAdmin && thresholds && (
        <div className="thb-card p-6 max-w-2xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-thb-text-primary">AI Risk Thresholds</h3>
            <p className="text-xs text-thb-text-muted mt-1">
              Punches with risk scores above these thresholds are flagged for review. Flagged punches still create an Attendance record (for audit) but are marked &quot;flagged&quot; until a manager reviews them.
            </p>
          </div>

          <ThresholdSlider
            label="Spoofing risk threshold"
            description="Punches with spoofingRisk > this value are flagged. Liveness-failed biometrics score high here."
            value={thresholds.spoofingRiskThreshold}
            onChange={(v) => setThresholds({ ...thresholds, spoofingRiskThreshold: v })}
          />
          <ThresholdSlider
            label="Buddy-punch risk threshold"
            description="Punches with buddyPunchRisk > this value are flagged. Impossible-travel and branch-mismatch trigger this."
            value={thresholds.buddyPunchRiskThreshold}
            onChange={(v) => setThresholds({ ...thresholds, buddyPunchRiskThreshold: v })}
          />

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-thb-border">
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Impossible-travel distance (km)</label>
              <input
                type="number"
                step="1"
                value={thresholds.impossibleTravelKm}
                onChange={(e) => setThresholds({ ...thresholds, impossibleTravelKm: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              />
              <p className="text-[10px] text-thb-text-muted mt-1">If the same employee punches from two devices &gt;X km apart within the window below, buddy risk = 1.0</p>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Impossible-travel window (min)</label>
              <input
                type="number"
                step="1"
                value={thresholds.impossibleTravelMinutes}
                onChange={(e) => setThresholds({ ...thresholds, impossibleTravelMinutes: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              />
              <p className="text-[10px] text-thb-text-muted mt-1">Time window for the impossible-travel check</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Off-hours start (min from midnight)</label>
              <input
                type="number"
                step="15"
                min="0"
                max="1440"
                value={thresholds.offHoursStartMinutes}
                onChange={(e) => setThresholds({ ...thresholds, offHoursStartMinutes: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Off-hours end (min from midnight)</label>
              <input
                type="number"
                step="15"
                min="0"
                max="1440"
                value={thresholds.offHoursEndMinutes}
                onChange={(e) => setThresholds({ ...thresholds, offHoursEndMinutes: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              />
              <p className="text-[10px] text-thb-text-muted mt-1">Set both to 0 to disable off-hours flagging</p>
            </div>
          </div>

          <button
            onClick={handleSaveThresholds}
            disabled={submitting}
            className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save thresholds'}
          </button>
        </div>
      )}

      {/* Register Device Modal */}
      {showDeviceForm && (
        <Modal title="Register Biometric Device" onClose={() => setShowDeviceForm(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" value={deviceForm.name} onChange={(v) => setDeviceForm({ ...deviceForm, name: v })} placeholder="Office-1 Main Door" />
              <Field label="Serial number *" value={deviceForm.serialNumber} onChange={(v) => setDeviceForm({ ...deviceForm, serialNumber: v })} placeholder="ZK-2024-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Vendor <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={deviceForm.vendor}
                  onChange={(e) => setDeviceForm({ ...deviceForm, vendor: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
                >
                  <option value="zkteco">ZKTeco</option>
                  <option value="mantra">Mantra</option>
                  <option value="secugen">SecuGen</option>
                  <option value="suprema">Suprema</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <Field label="Model" value={deviceForm.model} onChange={(v) => setDeviceForm({ ...deviceForm, model: v })} placeholder="SpeedFace V5L" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Firmware version" value={deviceForm.firmwareVersion} onChange={(v) => setDeviceForm({ ...deviceForm, firmwareVersion: v })} placeholder="v3.2.1" />
              <Field label="Encryption key ID" value={deviceForm.encryptionKeyId} onChange={(v) => setDeviceForm({ ...deviceForm, encryptionKeyId: v })} placeholder="aes-key-fingerprint" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Branch</label>
                <select
                  value={deviceForm.branchId}
                  onChange={(e) => setDeviceForm({ ...deviceForm, branchId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
                >
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Geofence (optional cross-check)</label>
                <select
                  value={deviceForm.geofenceId}
                  onChange={(e) => setDeviceForm({ ...deviceForm, geofenceId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
                >
                  <option value="">—</option>
                  {geofences.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs bg-teal-50 border border-teal-100 rounded p-3 text-teal-900">
              <strong>REQ-SEC-ATT-02:</strong> Device-to-server traffic MUST use TLS 1.3. The API token is shown ONCE after registration — save it to the device config immediately.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeviceForm(false)} className="px-3 py-2 text-sm rounded border border-thb-border">Cancel</button>
              <button
                onClick={handleDeviceSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? 'Registering…' : 'Register & generate token'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Enroll Employee Modal */}
      {showEnrollForm && (
        <Modal title="Enroll Employee Biometric" onClose={() => setShowEnrollForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Employee <span className="text-red-500 font-bold">*</span></label>
              <select
                value={enrollForm.employeeId}
                onChange={(e) => setEnrollForm({ ...enrollForm, employeeId: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.employeeId}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Device <span className="text-red-500 font-bold">*</span></label>
              <select
                value={enrollForm.deviceId}
                onChange={(e) => setEnrollForm({ ...enrollForm, deviceId: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
              >
                <option value="">Select device…</option>
                {devices.filter((d) => d.isActive).map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {d.serialNumber}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-thb-text-secondary">Modality <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={enrollForm.modality}
                  onChange={(e) => setEnrollForm({ ...enrollForm, modality: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
                >
                  <option value="fingerprint">Fingerprint</option>
                  <option value="face">Face</option>
                  <option value="palm">Palm</option>
                  <option value="iris">Iris</option>
                </select>
              </div>
              <Field
                label="Quality score (0-100)"
                value={enrollForm.qualityScore}
                onChange={(v) => setEnrollForm({ ...enrollForm, qualityScore: v })}
                placeholder="92"
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Template hash (SHA-256 of encrypted template) <span className="text-red-500 font-bold">*</span></label>
              <textarea
                value={enrollForm.templateHash}
                onChange={(e) => setEnrollForm({ ...enrollForm, templateHash: e.target.value })}
                rows={3}
                placeholder="e.g. a3f5... (64 hex chars)"
                className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm font-mono"
              />
              <p className="text-[10px] text-thb-text-muted mt-1">
                Hash only — never paste the raw biometric template. The device should compute the hash locally and push only the hash.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEnrollForm(false)} className="px-3 py-2 text-sm rounded border border-thb-border">Cancel</button>
              <button
                onClick={handleEnrollSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save enrollment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Token Modal */}
      {newToken && (
        <Modal title="API Token Generated" onClose={() => setNewToken(null)}>
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900 text-sm flex gap-2">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Save this token now.</strong> It will not be shown again. Configure it on the device&apos;s HTTP push settings immediately.
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">Device</label>
              <p className="text-sm font-medium text-thb-text-primary mt-0.5">{newToken.device}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-thb-text-secondary">API token (X-Biometric-Token header)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  readOnly
                  value={newToken.token}
                  className="flex-1 px-3 py-2 rounded border border-thb-border text-xs font-mono bg-slate-50"
                />
                <button
                  onClick={() => copyToClipboard(newToken.token)}
                  className="p-2 rounded border border-thb-border hover:bg-slate-50"
                  title="Copy"
                >
                  <FiCopy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs text-thb-text-muted bg-slate-50 rounded p-3">
              <strong>Webhook URL:</strong> <code className="font-mono">POST /api/attendance/biometric/punch</code><br />
              <strong>Heartbeat URL:</strong> <code className="font-mono">POST /api/attendance/biometric/heartbeat</code><br />
              <strong>Required headers:</strong> <code className="font-mono">X-Biometric-Token: &lt;token&gt;</code>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setNewToken(null)}
                className="px-4 py-2 text-sm rounded bg-teal-600 text-white hover:bg-teal-700"
              >
                I&apos;ve saved it — close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Small subcomponents ── */
function RiskBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls = value > 0.6 ? 'bg-red-100 text-red-700' : value > 0.3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{pct}%</span>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-thb-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded border border-thb-border text-sm"
      />
    </div>
  );
}

function ThresholdSlider({ label, description, value, onChange }: {
  label: string; description: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-thb-text-primary">{label}</label>
        <span className="text-sm font-bold text-teal-600">{Math.round(value * 100)}%</span>
      </div>
      <p className="text-xs text-thb-text-muted mt-0.5">{description}</p>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-teal-600"
      />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-thb-border px-5 py-3 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-sm font-semibold text-thb-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <FiX className="w-4 h-4 text-thb-text-muted" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
