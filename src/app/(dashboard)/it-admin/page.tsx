'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiMonitor, FiShield, FiHeadphones, FiActivity,
  FiRefreshCw, FiHardDrive, FiAlertTriangle, FiCheckCircle,
  FiServer, FiWifi, FiLock, FiDatabase, FiClock,
  FiArrowUp, FiArrowDown, FiChevronRight,
  FiPlus, FiTrendingUp, FiX, FiFileText,
} from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';

/* ================================================================
   IT Admin Dashboard Hub – 3Boxes HRMS
   SmartHR-style IT admin overview with tab navigation
   ================================================================ */

// GOLDEN RULE: No dummy data on LIVE site. All getDemo* functions return
// empty arrays on LIVE so the dashboard shows empty states instead of fake data.
function showDemoData(): boolean {
  return isClientDemoMode();
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const COLORS = {
  blue: '#3B82F6',
  rose: '#F43F5E',
  amber: '#F59E0B',
  emerald: '#10B981',
  violet: '#8B5CF6',
  cyan: '#06B6D4',
  slate: '#64748B',
  orange: '#F97316',
};

const PIE_COLORS = [COLORS.emerald, COLORS.rose, COLORS.amber, COLORS.slate];

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  MEDIUM:   { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  LOW:      { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
};

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'bg-red-100', text: 'text-red-700' },
  High:     { bg: 'bg-orange-100', text: 'text-orange-700' },
  Medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  Low:      { bg: 'bg-green-100', text: 'text-green-700' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  Online:       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Offline:      { bg: 'bg-red-100', text: 'text-red-700' },
  Maintenance:  { bg: 'bg-amber-100', text: 'text-amber-700' },
  Retired:      { bg: 'bg-slate-100', text: 'text-slate-600' },
  Open:         { bg: 'bg-green-100', text: 'text-green-700' },
  'In Progress': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Resolved:     { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Closed:       { bg: 'bg-slate-100', text: 'text-slate-600' },
  Active:       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Licensed:     { bg: 'bg-green-100', text: 'text-green-700' },
  Expired:      { bg: 'bg-red-100', text: 'text-red-700' },
  'Expiring Soon': { bg: 'bg-amber-100', text: 'text-amber-700' },
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ---------- types ---------- */

interface ITStat {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: number;
  trendLabel?: string;
}

interface SystemHealthPoint {
  hour: string;
  cpu: number;
  memory: number;
  disk: number;
}

interface TicketCategoryPoint {
  category: string;
  count: number;
}

interface DeviceDistPoint {
  name: string;
  value: number;
}

interface SecurityAlert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  timestamp: string;
}

interface ActiveTicket {
  id: string;
  ticketNo: string;
  subject: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  assignedTo: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  created: string;
}

interface DeviceItem {
  id: string;
  name: string;
  type: string;
  os: string;
  user: string;
  status: string;
  lastSeen: string;
  ip: string;
}

interface SoftwareItem {
  id: string;
  name: string;
  version: string;
  totalLicenses: number;
  usedLicenses: number;
  expiry: string;
  status: string;
}

interface NetworkStat {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface RecentActivity {
  id: string;
  description: string;
  timestamp: string;
  type: 'device' | 'ticket' | 'security' | 'update';
  icon: React.ReactNode;
}

/* ---------- demo data generators ---------- */

function getDemoStats(): ITStat[] {
  if (!showDemoData()) return [];
  return [
    { label: 'Active Devices', value: 1247, sub: '148 new this month', icon: <FiMonitor className="w-5 h-5" />, color: COLORS.blue, bgColor: 'bg-green-50', trend: 12.4, trendLabel: 'vs last month' },
    { label: 'Security Alerts', value: 23, sub: '4 critical pending', icon: <FiShield className="w-5 h-5" />, color: COLORS.rose, bgColor: 'bg-rose-50', trend: -8.2, trendLabel: 'vs last week' },
    { label: 'Open Tickets', value: 67, sub: '12 escalated', icon: <FiHeadphones className="w-5 h-5" />, color: COLORS.amber, bgColor: 'bg-amber-50', trend: 5.7, trendLabel: 'vs last week' },
    { label: 'System Uptime', value: '99.97%', sub: 'Last 30 days', icon: <FiActivity className="w-5 h-5" />, color: COLORS.emerald, bgColor: 'bg-emerald-50', trend: 0.02, trendLabel: 'improvement' },
    { label: 'Pending Updates', value: 34, sub: '8 high priority', icon: <FiRefreshCw className="w-5 h-5" />, color: COLORS.violet, bgColor: 'bg-teal-50', trend: -15.3, trendLabel: 'vs last week' },
    { label: 'Storage Used', value: '73.2%', sub: '4.4 TB of 6 TB', icon: <FiHardDrive className="w-5 h-5" />, color: COLORS.cyan, bgColor: 'bg-cyan-50', trend: 3.1, trendLabel: 'growth rate' },
  ];
}

function getDemoSystemHealth(): SystemHealthPoint[] {
  if (!showDemoData()) return [];
  const hours = [];
  for (let i = 23; i >= 0; i--) {
    const h = new Date();
    h.setHours(h.getHours() - i);
    const label = h.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    hours.push({
      hour: label,
      cpu: Math.min(95, 35 + Math.random() * 40),
      memory: Math.min(90, 55 + Math.random() * 20),
      disk: Math.min(85, 60 + Math.random() * 10),
    });
  }
  return hours;
}

function getDemoTicketsByCategory(): TicketCategoryPoint[] {
  if (!showDemoData()) return [];
  return [
    { category: 'Network', count: 18 },
    { category: 'Hardware', count: 14 },
    { category: 'Software', count: 22 },
    { category: 'Access', count: 9 },
    { category: 'Email', count: 7 },
    { category: 'Other', count: 5 },
  ];
}

function getDemoDeviceDist(): DeviceDistPoint[] {
  if (!showDemoData()) return [];
  return [
    { name: 'Online', value: 980 },
    { name: 'Offline', value: 145 },
    { name: 'Maintenance', value: 87 },
    { name: 'Retired', value: 35 },
  ];
}

function getDemoSecurityAlerts(): SecurityAlert[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', severity: 'CRITICAL', description: 'Unauthorized access attempt detected on DB server prod-db-03 from IP 203.45.67.89', timestamp: new Date(Date.now() - 900000).toISOString() },
    { id: '2', severity: 'HIGH', description: 'SSL certificate expiring in 5 days for auth.3boxestech.com', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', severity: 'MEDIUM', description: 'Unusual login pattern detected for user jsmith — 5 failed attempts', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: '4', severity: 'LOW', description: 'Firewall rule update pending — 3 new rules awaiting review', timestamp: new Date(Date.now() - 14400000).toISOString() },
    { id: '5', severity: 'HIGH', description: 'Malware signature detected on endpoint WKST-0142 — quarantine initiated', timestamp: new Date(Date.now() - 21600000).toISOString() },
  ];
}

function getDemoActiveTickets(): ActiveTicket[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', ticketNo: 'TKT-1024', subject: 'VPN connection dropping intermittently for remote team', priority: 'Critical', assignedTo: 'Raj K.', status: 'In Progress', created: '2h ago' },
    { id: '2', ticketNo: 'TKT-1025', subject: 'Email server latency affecting all users in BLR office', priority: 'High', assignedTo: 'Anita S.', status: 'Open', created: '4h ago' },
    { id: '3', ticketNo: 'TKT-1026', subject: 'New hire laptop provisioning — Dev team (3 devices)', priority: 'Medium', assignedTo: 'Vikram P.', status: 'In Progress', created: '6h ago' },
    { id: '4', ticketNo: 'TKT-1027', subject: 'SAP access request for Finance department new joiner', priority: 'Low', assignedTo: 'Meera D.', status: 'Open', created: '1d ago' },
    { id: '5', ticketNo: 'TKT-1028', subject: 'Printer queue stuck on Floor 3 — HP LaserJet Pro', priority: 'Medium', assignedTo: 'Suresh M.', status: 'Open', created: '1d ago' },
  ];
}

function getDemoDeviceList(): DeviceItem[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', name: 'WKST-001', type: 'Desktop', os: 'Windows 11 Pro', user: 'Arun Kumar', status: 'Online', lastSeen: '2 min ago', ip: '192.168.1.101' },
    { id: '2', name: 'LPT-045', type: 'Laptop', os: 'macOS Sonoma', user: 'Priya Sharma', status: 'Online', lastSeen: '5 min ago', ip: '192.168.1.142' },
    { id: '3', name: 'SRV-DB01', type: 'Server', os: 'Ubuntu 22.04 LTS', user: 'IT Admin', status: 'Online', lastSeen: '1 min ago', ip: '10.0.0.5' },
    { id: '4', name: 'MOB-023', type: 'Mobile', os: 'iOS 17', user: 'Rahul Verma', status: 'Offline', lastSeen: '2h ago', ip: '192.168.2.50' },
    { id: '5', name: 'PRT-F3-01', type: 'Printer', os: 'Embedded', user: 'Floor 3', status: 'Maintenance', lastSeen: '30 min ago', ip: '192.168.1.200' },
    { id: '6', name: 'WKST-0142', type: 'Desktop', os: 'Windows 10 Pro', user: 'Sneha Iyer', status: 'Offline', lastSeen: '4h ago', ip: '192.168.1.115' },
  ];
}

function getDemoSoftwareList(): SoftwareItem[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', name: 'Microsoft 365 Business', version: 'Latest', totalLicenses: 500, usedLicenses: 467, expiry: '2026-03-15', status: 'Licensed' },
    { id: '2', name: 'Adobe Creative Cloud', version: '2024', totalLicenses: 50, usedLicenses: 48, expiry: '2025-12-31', status: 'Expiring Soon' },
    { id: '3', name: 'Slack Business+', version: 'Latest', totalLicenses: 300, usedLicenses: 289, expiry: '2026-06-30', status: 'Licensed' },
    { id: '4', name: 'JetBrains All Products', version: '2024.2', totalLicenses: 80, usedLicenses: 72, expiry: '2025-09-15', status: 'Expiring Soon' },
    { id: '5', name: 'Norton Antivirus', version: '22.24', totalLicenses: 600, usedLicenses: 580, expiry: '2026-01-01', status: 'Licensed' },
    { id: '6', name: 'AutoCAD 2024', version: '2024.1', totalLicenses: 20, usedLicenses: 20, expiry: '2025-06-30', status: 'Expired' },
  ];
}

function getDemoNetworkStats(): NetworkStat[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', label: 'Bandwidth', value: '847 Mbps', icon: <FiWifi className="w-5 h-5" />, color: COLORS.blue, bgColor: 'bg-green-50' },
    { id: '2', label: 'Active Connections', value: '1,284', icon: <FiServer className="w-5 h-5" />, color: COLORS.emerald, bgColor: 'bg-emerald-50' },
    { id: '3', label: 'VPN Users Online', value: '47', icon: <FiLock className="w-5 h-5" />, color: COLORS.violet, bgColor: 'bg-teal-50' },
    { id: '4', label: 'Avg Latency', value: '12ms', icon: <FiActivity className="w-5 h-5" />, color: COLORS.amber, bgColor: 'bg-amber-50' },
  ];
}

function getDemoRecentActivities(): RecentActivity[] {
  if (!showDemoData()) return [];
  return [
    { id: '1', description: 'New device WKST-0150 registered for Deepak M.', timestamp: new Date(Date.now() - 1200000).toISOString(), type: 'device', icon: <FiMonitor className="w-4 h-4" /> },
    { id: '2', description: 'Security scan completed — 2 vulnerabilities found', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'security', icon: <FiShield className="w-4 h-4" /> },
    { id: '3', description: 'Ticket TKT-1024 escalated to Critical priority', timestamp: new Date(Date.now() - 5400000).toISOString(), type: 'ticket', icon: <FiHeadphones className="w-4 h-4" /> },
    { id: '4', description: 'Windows security patches deployed to 340 devices', timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'update', icon: <FiRefreshCw className="w-4 h-4" /> },
    { id: '5', description: 'Device LPT-032 retired — transferred to Suraj T.', timestamp: new Date(Date.now() - 10800000).toISOString(), type: 'device', icon: <FiMonitor className="w-4 h-4" /> },
    { id: '6', description: 'Firewall rules updated — blocked 12 suspicious IPs', timestamp: new Date(Date.now() - 14400000).toISOString(), type: 'security', icon: <FiShield className="w-4 h-4" /> },
  ];
}

/* ---------- custom chart tooltips ---------- */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 px-4 py-3">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{entry.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 px-4 py-3">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-100 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.fill }} />
        <span className="text-sm font-medium text-slate-700">{item.name}</span>
      </div>
      <p className="text-lg font-bold text-slate-800 mt-1">{item.value} devices</p>
    </div>
  );
}

/* ---------- skeleton components ---------- */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200/70 animate-pulse rounded-lg ${className}`} />;
}

function StatSkeleton() {
  return (
    <div className="thb-card p-5 rounded-2xl border border-slate-100">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-16" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-xl" />
      </div>
      <SkeletonBlock className="h-3 w-32 mt-3" />
    </div>
  );
}

/* ---------- tab types ---------- */

type TabKey = 'dashboard' | 'devices' | 'security' | 'tickets' | 'software' | 'network';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  route?: string;
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <FiActivity className="w-4 h-4" /> },
  { key: 'devices', label: 'Devices', icon: <FiMonitor className="w-4 h-4" />, route: '/it-admin/devices' },
  { key: 'security', label: 'Security', icon: <FiShield className="w-4 h-4" />, route: '/it-admin/security' },
  { key: 'tickets', label: 'Tickets', icon: <FiHeadphones className="w-4 h-4" />, route: '/it-admin/tickets' },
  { key: 'software', label: 'Software', icon: <FiDatabase className="w-4 h-4" />, route: '/it-admin/software' },
  { key: 'network', label: 'Network', icon: <FiWifi className="w-4 h-4" />, route: '/it-admin/network' },
];

/* ---------- main component ---------- */

export default function ITAdminHubPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);

  const [stats] = useState<ITStat[]>(getDemoStats());
  const [systemHealth] = useState<SystemHealthPoint[]>(getDemoSystemHealth());
  const [ticketsByCategory] = useState<TicketCategoryPoint[]>(getDemoTicketsByCategory());
  const [deviceDist] = useState<DeviceDistPoint[]>(getDemoDeviceDist());
  const [securityAlerts] = useState<SecurityAlert[]>(getDemoSecurityAlerts());
  const [activeTickets] = useState<ActiveTicket[]>(getDemoActiveTickets());
  const [deviceList] = useState<DeviceItem[]>(getDemoDeviceList());
  const [softwareList] = useState<SoftwareItem[]>(getDemoSoftwareList());
  const [networkStats] = useState<NetworkStat[]>(getDemoNetworkStats());
  const [recentActivities] = useState<RecentActivity[]>(getDemoRecentActivities());

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleTabClick = (tab: TabDef) => {
    if (tab.key === 'dashboard') {
      setActiveTab('dashboard');
    } else if (tab.route) {
      router.push(tab.route);
    }
  };

  /* ---- Quick Action handlers ---- */
  const handleQuickAction = (action: string) => {
    const routes: Record<string, string> = {
      'New Ticket': '/it-admin/tickets',
      'Add Device': '/it-admin/devices',
      'Run Scan': '/it-admin/security',
      'System Update': '/it-admin/software',
    };
    const route = routes[action];
    if (route) router.push(route);
    toast.success(`Navigating to ${action}...`);
  };

  const quickActions = [
    { label: 'New Ticket', icon: <FiPlus className="w-5 h-5" />, color: COLORS.blue, bgColor: 'bg-green-50' },
    { label: 'Add Device', icon: <FiMonitor className="w-5 h-5" />, color: COLORS.emerald, bgColor: 'bg-emerald-50' },
    { label: 'Run Scan', icon: <FiShield className="w-5 h-5" />, color: COLORS.rose, bgColor: 'bg-rose-50' },
    { label: 'System Update', icon: <FiRefreshCw className="w-5 h-5" />, color: COLORS.violet, bgColor: 'bg-teal-50' },
  ];

  /* ---- Render helpers ---- */

  function renderStatCard(stat: ITStat) {
    return (
      <div key={stat.label} className="thb-card thb-card-hover p-5 rounded-2xl border border-slate-100">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bgColor}`} style={{ color: stat.color }}>
            {stat.icon}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {stat.trend !== undefined && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${stat.trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stat.trend >= 0 ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />}
              {Math.abs(stat.trend)}%
            </span>
          )}
          <span className="text-xs text-slate-500">{stat.sub}</span>
        </div>
      </div>
    );
  }

  /* ================ DASHBOARD TAB ================ */

  function renderDashboardTab() {
    return (
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map(renderStatCard)}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Health */}
          <div className="lg:col-span-2 thb-card p-6 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">System Health — Last 24 Hours</h3>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.blue }} /> CPU</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.violet }} /> Memory</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.amber }} /> Disk</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={systemHealth} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="cpu" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.1} strokeWidth={2} name="CPU" />
                <Area type="monotone" dataKey="memory" stroke={COLORS.violet} fill={COLORS.violet} fillOpacity={0.1} strokeWidth={2} name="Memory" />
                <Area type="monotone" dataKey="disk" stroke={COLORS.amber} fill={COLORS.amber} fillOpacity={0.1} strokeWidth={2} name="Disk" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Device Status Pie */}
          <div className="thb-card p-6 rounded-2xl border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Device Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deviceDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {deviceDist.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {deviceDist.map((d, idx) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-semibold text-slate-800 ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Distribution */}
          <div className="thb-card p-6 rounded-2xl border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Ticket Distribution by Category</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ticketsByCategory} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="count" fill={COLORS.blue} radius={[6, 6, 0, 0]} name="Tickets" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Security Alerts */}
          <div className="thb-card p-6 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Security Alerts</h3>
              <button
                onClick={() => router.push('/it-admin/security')}
                className="text-xs text-thb-primary hover:text-thb-primary-dark font-medium flex items-center gap-1"
              >
                View All <FiChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
              {securityAlerts.map((alert) => {
                const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.LOW;
                return (
                  <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`thb-badge ${cfg.bg} ${cfg.text}`}>{alert.severity}</span>
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Uptime & Quick Actions */}
          <div className="space-y-6">
            {/* Uptime Gauge */}
            <div className="thb-card p-6 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">System Uptime</h3>
              <div className="flex items-center justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke={COLORS.emerald} strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${0.9997 * 314} 314`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-800">99.97%</span>
                    <span className="text-[10px] text-slate-500">30-day uptime</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="thb-card p-6 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => handleQuickAction(qa.label)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${qa.bgColor} hover:shadow-md transition-all duration-200`}
                    style={{ color: qa.color }}
                  >
                    {qa.icon}
                    <span className="text-[10px] font-medium">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities & Active Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="thb-card p-6 rounded-2xl border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Activities</h3>
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {recentActivities.map((act) => {
                const typeColors: Record<string, string> = {
                  device: 'text-green-500 bg-green-50',
                  ticket: 'text-amber-500 bg-amber-50',
                  security: 'text-rose-500 bg-rose-50',
                  update: 'text-teal-500 bg-teal-50',
                };
                const colorClass = typeColors[act.type] || 'text-slate-500 bg-slate-50';
                return (
                  <div key={act.id} className="flex items-start gap-3 p-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      {act.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700">{act.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatTimeAgo(act.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Tickets */}
          <div className="thb-card p-6 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Active Tickets</h3>
              <button
                onClick={() => router.push('/it-admin/tickets')}
                className="text-xs text-thb-primary hover:text-thb-primary-dark font-medium flex items-center gap-1"
              >
                View All <FiChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="pb-2 text-left font-medium">Ticket</th>
                    <th className="pb-2 text-left font-medium">Subject</th>
                    <th className="pb-2 text-left font-medium">Priority</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTickets.map((t) => {
                    const pCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.Low;
                    const sCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.Open;
                    return (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 font-medium text-slate-700">{t.ticketNo}</td>
                        <td className="py-2 text-slate-600 max-w-[200px] truncate">{t.subject}</td>
                        <td className="py-2"><span className={`thb-badge ${pCfg.bg} ${pCfg.text}`}>{t.priority}</span></td>
                        <td className="py-2"><span className={`thb-badge ${sCfg.bg} ${sCfg.text}`}>{t.status}</span></td>
                        <td className="py-2 text-slate-500">{t.assignedTo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================ DEVICES TAB (summary) ================ */

  function renderDevicesTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Device Inventory</h3>
          <button
            onClick={() => router.push('/it-admin/devices')}
            className="px-4 py-2 bg-thb-primary text-white rounded-xl text-xs font-medium hover:bg-thb-primary-dark transition-colors flex items-center gap-2"
          >
            <FiMonitor className="w-4 h-4" /> View Full Inventory
          </button>
        </div>
        <div className="thb-card rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr className="text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Device Name</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">OS</th>
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last Seen</th>
                  <th className="px-4 py-3 text-left font-medium">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {deviceList.map((d) => {
                  const sCfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.Online;
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{d.name}</td>
                      <td className="px-4 py-3 text-slate-600">{d.type}</td>
                      <td className="px-4 py-3 text-slate-600">{d.os}</td>
                      <td className="px-4 py-3 text-slate-600">{d.user}</td>
                      <td className="px-4 py-3"><span className={`thb-badge ${sCfg.bg} ${sCfg.text}`}>{d.status}</span></td>
                      <td className="px-4 py-3 text-slate-500">{d.lastSeen}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{d.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ================ SECURITY TAB (summary) ================ */

  function renderSecurityTab() {
    const secStats = [
      { label: 'Active Threats', value: '4', icon: <FiAlertTriangle className="w-5 h-5" />, color: COLORS.rose, bgColor: 'bg-rose-50' },
      { label: 'Firewall Status', value: 'Active', icon: <FiShield className="w-5 h-5" />, color: COLORS.emerald, bgColor: 'bg-emerald-50' },
      { label: 'Antivirus Coverage', value: '98.7%', icon: <FiCheckCircle className="w-5 h-5" />, color: COLORS.blue, bgColor: 'bg-green-50' },
      { label: 'Last Scan', value: '2h ago', icon: <FiClock className="w-5 h-5" />, color: COLORS.violet, bgColor: 'bg-teal-50' },
    ];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {secStats.map((s) => (
            <div key={s.label} className="thb-card p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bgColor}`} style={{ color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Security Alerts</h3>
          <button
            onClick={() => router.push('/it-admin/security')}
            className="px-4 py-2 bg-thb-primary text-white rounded-xl text-xs font-medium hover:bg-thb-primary-dark transition-colors flex items-center gap-2"
          >
            <FiShield className="w-4 h-4" /> Full Security Dashboard
          </button>
        </div>
        <div className="thb-card p-6 rounded-2xl border border-slate-100">
          <div className="space-y-3">
            {securityAlerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.LOW;
              return (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`thb-badge ${cfg.bg} ${cfg.text}`}>{alert.severity}</span>
                      <span className="text-[10px] text-slate-400">{formatTimeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ================ TICKETS TAB (summary) ================ */

  function renderTicketsTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">IT Support Tickets</h3>
          <button
            onClick={() => router.push('/it-admin/tickets')}
            className="px-4 py-2 bg-thb-primary text-white rounded-xl text-xs font-medium hover:bg-thb-primary-dark transition-colors flex items-center gap-2"
          >
            <FiHeadphones className="w-4 h-4" /> Full Ticket System
          </button>
        </div>
        <div className="thb-card rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr className="text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Assignee</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {activeTickets.map((t) => {
                  const pCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.Low;
                  const sCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.Open;
                  return (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{t.ticketNo}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate">{t.subject}</td>
                      <td className="px-4 py-3"><span className={`thb-badge ${pCfg.bg} ${pCfg.text}`}>{t.priority}</span></td>
                      <td className="px-4 py-3"><span className={`thb-badge ${sCfg.bg} ${sCfg.text}`}>{t.status}</span></td>
                      <td className="px-4 py-3 text-slate-500">{t.assignedTo}</td>
                      <td className="px-4 py-3 text-slate-500">{t.created}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ================ SOFTWARE TAB (summary) ================ */

  function renderSoftwareTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Software & Licenses</h3>
          <button
            onClick={() => router.push('/it-admin/software')}
            className="px-4 py-2 bg-thb-primary text-white rounded-xl text-xs font-medium hover:bg-thb-primary-dark transition-colors flex items-center gap-2"
          >
            <FiDatabase className="w-4 h-4" /> Full License Management
          </button>
        </div>
        <div className="thb-card rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr className="text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Software</th>
                  <th className="px-4 py-3 text-left font-medium">Version</th>
                  <th className="px-4 py-3 text-left font-medium">Licenses</th>
                  <th className="px-4 py-3 text-left font-medium">Assigned</th>
                  <th className="px-4 py-3 text-left font-medium">Expiry</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {softwareList.map((s) => {
                  const sCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.Licensed;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.version}</td>
                      <td className="px-4 py-3 text-slate-600">{s.totalLicenses}</td>
                      <td className="px-4 py-3 text-slate-600">{s.usedLicenses}/{s.totalLicenses}</td>
                      <td className="px-4 py-3 text-slate-500">{s.expiry}</td>
                      <td className="px-4 py-3"><span className={`thb-badge ${sCfg.bg} ${sCfg.text}`}>{s.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  /* ================ NETWORK TAB (summary) ================ */

  function renderNetworkTab() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {networkStats.map((s) => (
            <div key={s.id} className="thb-card p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bgColor}`} style={{ color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-bold text-slate-800">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Network Overview</h3>
          <button
            onClick={() => router.push('/it-admin/network')}
            className="px-4 py-2 bg-thb-primary text-white rounded-xl text-xs font-medium hover:bg-thb-primary-dark transition-colors flex items-center gap-2"
          >
            <FiWifi className="w-4 h-4" /> Full Network Dashboard
          </button>
        </div>
        <div className="thb-card p-6 rounded-2xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700">Network Devices</h4>
              {[
                { name: 'Core Switch (L3)', status: 'Active', ip: '10.0.0.1' },
                { name: 'Firewall (Palo Alto)', status: 'Active', ip: '10.0.0.2' },
                { name: 'Access Point - Floor 1', status: 'Active', ip: '10.0.0.10' },
                { name: 'VPN Gateway', status: 'Active', ip: '10.0.0.3' },
              ].map((nd) => (
                <div key={nd.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{nd.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{nd.ip}</p>
                  </div>
                  <span className="thb-badge thb-badge-success">{nd.status}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700">VPN Connections</h4>
              {[
                { user: 'Arun Kumar', duration: '4h 32m', bandwidth: '24 Mbps' },
                { user: 'Priya Sharma', duration: '6h 15m', bandwidth: '18 Mbps' },
                { user: 'Rahul Verma', duration: '2h 08m', bandwidth: '12 Mbps' },
                { user: 'Sneha Iyer', duration: '5h 44m', bandwidth: '22 Mbps' },
              ].map((vpn) => (
                <div key={vpn.user} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{vpn.user}</p>
                    <p className="text-[10px] text-slate-400">{vpn.duration} • {vpn.bandwidth}</p>
                  </div>
                  <span className="thb-badge thb-badge-success">Connected</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700">Bandwidth Usage (Top)</h4>
              {[
                { dept: 'Engineering', usage: '312 Mbps', pct: 37 },
                { dept: 'QA Team', usage: '148 Mbps', pct: 17 },
                { dept: 'Design', usage: '124 Mbps', pct: 15 },
                { dept: 'Operations', usage: '98 Mbps', pct: 12 },
              ].map((bw) => (
                <div key={bw.dept} className="p-2 rounded-lg bg-slate-50/80">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-slate-700">{bw.dept}</p>
                    <span className="text-[10px] text-slate-500">{bw.usage}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full">
                    <div className="h-1.5 bg-thb-primary rounded-full" style={{ width: `${bw.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================ MAIN RENDER ================ */

  if (loading) {
    return (
      <div className="min-h-screen bg-thb-background p-4 md:p-6">
        <div className="h-32 rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-thb-background">
      {/* Hero Gradient */}
      <div className="bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 px-4 md:px-6 pt-6 pb-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <FiServer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-white">IT Admin</h1>
                  <p className="text-white/80 text-xs">3Boxes HRMS — Infrastructure & Security Management</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { toast.success('Refreshing data...'); }}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-xs font-medium hover:bg-white/30 transition-colors flex items-center gap-1.5"
              >
                <FiRefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-6">
        <div className="max-w-[1400px] mx-auto">
          <nav className="flex gap-1 overflow-x-auto py-2 -mb-px" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-red-50 text-red-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        {activeTab === 'dashboard' && renderDashboardTab()}
        {activeTab === 'devices' && renderDevicesTab()}
        {activeTab === 'security' && renderSecurityTab()}
        {activeTab === 'tickets' && renderTicketsTab()}
        {activeTab === 'software' && renderSoftwareTab()}
        {activeTab === 'network' && renderNetworkTab()}
      </div>
    </div>
  );
}
