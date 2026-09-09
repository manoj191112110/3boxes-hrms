'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiUsers,
  FiBriefcase,
  FiMail,
  FiSearch,
  FiRefreshCw,
  FiChevronDown,
  FiChevronRight,
  FiAlertCircle,
  FiLayers,
  FiGitBranch,
  FiUserCheck,
  FiBookmark,
  FiPlus,
  FiGrid,
  FiList,
  FiUserPlus,
  FiUserX,
  FiClock,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  branchId?: string | null;
  status?: string;
  department?: { id: string; name: string } | null;
  designation?: { id: string; title: string } | null;
  branch?: { id: string; name: string } | null;
  user?: { id: string; email: string; role: string; avatar?: string | null } | null;
  dateOfJoining?: string | null;
}

interface OrgNode {
  id: string;
  employee: Employee;
  children: OrgNode[];
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const SENIOR_TITLE_RE = /\b(ceo|cto|coo|cfo|founder|co-founder|managing director|md)\b/i;
const MANAGER_TITLE_RE = /\b(manager|director|head|vp|vice president|chief|lead|principal|sr\.? senior)\b/i;

function seniorityScore(emp: Employee): number {
  const role = (emp.user?.role || '').toLowerCase();
  const title = (emp.designation?.title || '').toLowerCase();
  if (role === 'super_admin' || SENIOR_TITLE_RE.test(title)) return 100;
  if (role === 'tenant_admin') return 95;
  if (role === 'hr_admin') return 90;
  if (MANAGER_TITLE_RE.test(title)) {
    if (/director|vp|vice president|chief/.test(title)) return 80;
    if (/manager/.test(title)) return 70;
    if (/lead|principal/.test(title)) return 60;
    return 50;
  }
  if (role === 'manager') return 55;
  if (role === 'recruiter') return 30;
  return 10;
}

function buildOrgTree(employees: Employee[]): OrgNode[] {
  if (employees.length === 0) return [];
  const sorted = [...employees].sort((a, b) => seniorityScore(b) - seniorityScore(a));
  const topExecs = sorted.filter((e) => seniorityScore(e) >= 90);
  const roots: Employee[] = topExecs.length > 0 ? topExecs : [sorted[0]];
  const rootIds = new Set(roots.map((r) => r.id));
  const remaining = sorted.filter((e) => !rootIds.has(e.id));
  const byDepartment = new Map<string, Employee[]>();
  for (const emp of remaining) {
    const deptId = emp.departmentId || 'no-dept';
    if (!byDepartment.has(deptId)) byDepartment.set(deptId, []);
    byDepartment.get(deptId)!.push(emp);
  }
  const deptHeads: { head: Employee; members: Employee[] }[] = [];
  for (const [, members] of byDepartment) {
    const sortedMembers = [...members].sort((a, b) => seniorityScore(b) - seniorityScore(a));
    const headCandidate = sortedMembers[0];
    if (headCandidate) {
      deptHeads.push({ head: headCandidate, members: sortedMembers.slice(1) });
    }
  }
  const buildNode = (emp: Employee, children: OrgNode[] = []): OrgNode => ({
    id: emp.id,
    employee: emp,
    children,
  });
  const rootNodes: OrgNode[] = roots.map((r) => buildNode(r));
  deptHeads.forEach((dh, idx) => {
    const parentNode = rootNodes[idx % rootNodes.length];
    const memberNodes = dh.members.map((m) => buildNode(m));
    parentNode.children.push(buildNode(dh.head, memberNodes));
  });
  return rootNodes;
}

function highlightMatch(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200 text-amber-900 rounded px-0.5">{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}

function countReportingLines(nodes: OrgNode[]): number {
  let count = 0;
  const walk = (ns: OrgNode[]) => {
    for (const n of ns) { count += n.children.length; walk(n.children); }
  };
  walk(nodes);
  return count;
}

function countLevels(nodes: OrgNode[]): number {
  if (nodes.length === 0) return 0;
  let maxDepth = 0;
  const walk = (ns: OrgNode[], depth: number) => {
    if (depth > maxDepth) maxDepth = depth;
    for (const n of ns) { walk(n.children, depth + 1); }
  };
  walk(nodes, 1);
  return maxDepth;
}

function countDirectReports(nodes: OrgNode[]): number {
  let count = 0;
  for (const n of nodes) { count += n.children.length; }
  return count;
}

const DEPT_GRADIENTS = [
  'from-green-500 to-emerald-500',
  'from-emerald-500 to-teal-500',
  'from-teal-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-green-500',
  'from-red-500 to-pink-500',
  'from-lime-500 to-green-500',
  'from-fuchsia-500 to-teal-500',
  'from-yellow-500 to-orange-500',
];

function getDeptColor(deptName: string): string {
  let hash = 0;
  for (let i = 0; i < deptName.length; i++) hash = deptName.charCodeAt(i) + ((hash << 5) - hash);
  return DEPT_GRADIENTS[Math.abs(hash) % DEPT_GRADIENTS.length];
}

function getAvatarGradient(name: string): string {
  const colors = [
    'from-green-500 to-cyan-500',
    'from-teal-500 to-teal-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-emerald-500 to-green-500',
    'from-teal-500 to-green-500',
    'from-red-500 to-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ── Module Tips ────────────────────────────────────────────────────────── */

const orgChartTips = [
  { title: 'Navigate the Hierarchy', description: 'Click the chevron arrows on any node to expand or collapse its direct reports. Use "Expand All" to see the full tree.' },
  { title: 'Search Employees', description: 'Use the search bar to find employees by name or email. Matching nodes will be highlighted in the chart.' },
  { title: 'Department Color Coding', description: 'Each department is assigned a unique gradient color. Check the sidebar legend to identify departments at a glance.' },
  { title: 'Derived Hierarchy', description: 'The org chart is automatically built from employee roles and designation titles — no manual setup required.' },
];

const orgChartWorkflowSteps = [
  { step: 1, title: 'Add Employees', description: 'Create employee records with designation and department info', route: '/employees' },
  { step: 2, title: 'Assign Roles', description: 'Set proper user roles (admin, manager) for hierarchy positioning' },
  { step: 3, title: 'Review Chart', description: 'View the auto-generated organization chart on this page' },
  { step: 4, title: 'Filter & Search', description: 'Use search and department filters to navigate the org structure' },
];

/* ── Recursive tree node ────────────────────────────────────────────────── */

interface TreeNodeProps {
  node: OrgNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TreeNode({ node, depth, collapsed, onToggle, search, selectedId, onSelect }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const emp = node.employee;
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const matchesSearch = !!search && (
    fullName.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  );
  const deptName = emp.department?.name || 'Unassigned';
  const deptColor = getDeptColor(deptName);
  const title = emp.designation?.title || 'Employee';
  const isSelected = selectedId === node.id;

  return (
    <div className="flex flex-col items-center">
      {depth > 0 && <div className="w-px h-6 bg-slate-200" aria-hidden="true" />}
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`text-left w-60 bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-all duration-200 ${
          matchesSearch ? 'border-amber-400 ring-2 ring-amber-200' :
          isSelected ? 'border-teal-400 ring-2 ring-teal-200' :
          'border-slate-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(fullName)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {highlightMatch(fullName, search)}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{title}</p>
          </div>
          {hasChildren && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onToggle(node.id); } }}
              className="flex-shrink-0 -mr-1 p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? <FiChevronRight className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-white bg-gradient-to-r ${deptColor}`}>
            <FiBriefcase className="w-2.5 h-2.5" />
            {deptName}
          </span>
          {emp.status && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
              emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
              emp.status === 'on_leave' ? 'bg-amber-50 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {emp.status === 'active' ? 'Active' : emp.status === 'on_leave' ? 'On Leave' : emp.status}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 min-w-0">
          <FiMail className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{emp.email}</span>
        </div>
        {hasChildren && isCollapsed && (
          <div className="mt-2 text-[10px] text-center text-teal-600 font-medium bg-teal-50 rounded-md py-1">
            {node.children.length} hidden report{node.children.length === 1 ? '' : 's'}
          </div>
        )}
      </button>
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-slate-200" aria-hidden="true" />
          <div className="flex flex-col sm:flex-row sm:items-start justify-center gap-0 sm:gap-2">
            {node.children.map((child, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === node.children.length - 1;
              const isOnly = node.children.length === 1;
              return (
                <div key={child.id} className="relative flex flex-col items-center px-0 sm:px-2 pt-0 sm:pt-6">
                  {!isOnly && (
                    <div
                      className="hidden sm:block absolute top-0 bg-slate-200"
                      style={{ left: isFirst ? '50%' : 0, right: isLast ? '50%' : 0, height: '1px', width: 'auto' }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="hidden sm:block w-px h-6 bg-slate-200" aria-hidden="true" />
                  <div className="sm:hidden w-px h-6 bg-slate-200" aria-hidden="true" />
                  <TreeNode node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} search={search} selectedId={selectedId} onSelect={onSelect} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────────── */

export default function OrgChartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/employees?limit=1000', { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load employees');
      const list: Employee[] = data.employees || data || [];
      setEmployees(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load organization chart';
      setError(msg);
      toast.error(msg);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
    if (!token && !user) { router.push('/login'); }
  }, [router, user]);

  const tree = useMemo(() => buildOrgTree(employees), [employees]);

  const filteredTree = useMemo(() => {
    if (!deptFilter) return tree;
    const filter = (nodes: OrgNode[]): OrgNode[] => {
      return nodes.reduce<OrgNode[]>((acc, node) => {
        const deptName = node.employee.department?.name || 'Unassigned';
        const matches = deptName === deptFilter;
        const filteredChildren = filter(node.children);
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filter(tree);
  }, [tree, deptFilter]);

  const departments = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of employees) {
      if (e.department?.id && e.department?.name) {
        seen.set(e.department.id, e.department.name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [employees]);

  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees) {
      const deptId = e.department?.id || 'no-dept';
      counts.set(deptId, (counts.get(deptId) || 0) + 1);
    }
    return departments.map((d) => ({ ...d, count: counts.get(d.id) || 0 }));
  }, [employees, departments]);

  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    const all = new Set<string>();
    const walk = (nodes: OrgNode[]) => {
      for (const n of nodes) { if (n.children.length > 0) { all.add(n.id); walk(n.children); } }
    };
    walk(tree);
    setCollapsed(all);
  }, [tree]);

  const stats = useMemo(() => {
    const total = employees.length;
    const deptCount = departments.length;
    const levels = countLevels(tree);
    const reportingLines = countReportingLines(tree);
    const directReports = countDirectReports(tree);
    const vacantDepts = deptCounts.filter((d) => d.count <= 1).length;
    const managerCount = employees.filter((e) => seniorityScore(e) >= 50 && seniorityScore(e) < 90).length;
    return { total, deptCount, levels, reportingLines, directReports, vacantDepts, managerCount, rootCount: tree.length };
  }, [employees, departments, tree, deptCounts]);

  const selectedEmployee = useMemo(() => {
    if (!selectedId) return null;
    const findEmp = (nodes: OrgNode[]): Employee | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n.employee;
        const found = findEmp(n.children);
        if (found) return found;
      }
      return null;
    };
    return findEmp(tree);
  }, [selectedId, tree]);

  const selectedReports = useMemo(() => {
    if (!selectedId) return [];
    const findNode = (nodes: OrgNode[]): OrgNode | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(tree);
    return node ? node.children.map((c) => c.employee) : [];
  }, [selectedId, tree]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ── Breadcrumb ── */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="mb-3 sm:mb-0">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Org Chart</h2>
            <nav className="flex items-center gap-1.5 text-sm text-slate-500">
              <button onClick={() => router.push('/')} className="hover:text-green-600 transition-colors">Home</button>
              <span>/</span>
              <span className="text-slate-400">Employees</span>
              <span>/</span>
              <span className="text-slate-700 font-medium">Org Chart</span>
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchEmployees}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/employees/add')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors"
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-white">
              <FiUsers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Employees</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white">
              <FiBriefcase className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Departments</p>
              <p className="text-2xl font-bold text-slate-900">{stats.deptCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center text-white">
              <FiLayers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Levels</p>
              <p className="text-2xl font-bold text-slate-900">{stats.levels}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white">
              <FiGitBranch className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Reporting Lines</p>
              <p className="text-2xl font-bold text-slate-900">{stats.reportingLines}</p>
            </div>
          </div>
        </div>

        {/* ── Search + Toolbar ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDeptFilter(null)}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                  !deptFilter ? 'bg-green-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {departments.slice(0, 5).map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setDeptFilter(deptFilter === dept.name ? null : dept.name)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                    deptFilter === dept.name ? 'bg-green-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${getDeptColor(dept.name)}`} />
                  {dept.name}
                </button>
              ))}
              {departments.length > 5 && (
                <button type="button" className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                  +{departments.length - 5} more
                </button>
              )}
              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
              <button type="button" onClick={expandAll} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Expand all
              </button>
              <button type="button" onClick={collapseAll} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                Collapse all
              </button>
            </div>
          </div>
        </div>

        {/* ── Error State ── */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FiAlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Org Chart Error</h2>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={fetchEmployees} className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium text-sm">Try Again</button>
              <button onClick={() => router.push('/employees')} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium text-sm">Go to Employees</button>
            </div>
          </div>
        )}

        {/* ── Two Column Layout ── */}
        {!error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Chart */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FiGitBranch className="w-4 h-4 text-teal-500" />
                    Organization Tree
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {deptFilter ? `Filtered by ${deptFilter}` : 'Complete reporting hierarchy'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700">
                  {filteredTree.reduce((sum, root) => {
                    const count = (ns: OrgNode[]): number => ns.reduce((s, n) => s + 1 + count(n.children), 0);
                    return sum + count([root]);
                  }, 0)} employees
                </span>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <FiRefreshCw className="w-6 h-6 text-green-500 animate-spin" />
                    <p className="text-sm text-slate-500">Loading org chart...</p>
                  </div>
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16">
                  <FiUsers className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-1">No employees found</h3>
                  <p className="text-sm text-slate-500 text-center max-w-sm mb-4">
                    {deptFilter
                      ? `No employees match the "${deptFilter}" department filter. Try selecting a different department.`
                      : 'There are no employees to display in the organization chart. Add employees first to see the reporting hierarchy.'}
                  </p>
                  {!deptFilter && (
                    <button onClick={() => router.push('/employees/add')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                      <FiPlus className="w-4 h-4" /> Add Employees
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 overflow-x-auto">
                  <div className="min-w-max flex flex-col items-center gap-0 pb-4">
                    {filteredTree.map((root, idx) => (
                      <div key={root.id} className={idx > 0 ? 'mt-12' : ''}>
                        <TreeNode
                          node={root}
                          depth={0}
                          collapsed={collapsed}
                          onToggle={handleToggle}
                          search={search}
                          selectedId={selectedId}
                          onSelect={handleSelect}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-400">
                    <FiAlertCircle className="w-3 h-3" />
                    <span>Hierarchy is derived from role and designation. Click the chevron on any node to collapse or expand its reports.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <div className="space-y-4">
              {/* Department Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                  <FiBriefcase className="w-3.5 h-3.5 text-teal-600" />
                  Department Breakdown
                </h4>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {deptCounts.sort((a, b) => b.count - a.count).map((dept) => {
                    const percentage = stats.total > 0 ? Math.round((dept.count / stats.total) * 100) : 0;
                    const color = getDeptColor(dept.name);
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setDeptFilter(deptFilter === dept.name ? null : dept.name)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors text-left ${
                          deptFilter === dept.name ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {dept.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{dept.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">{dept.count}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {deptCounts.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No departments found</p>}
                </div>
              </div>

              {/* Selected Employee Detail */}
              {selectedEmployee && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <FiUsers className="w-3.5 h-3.5 text-green-600" />
                    Employee Details
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(`${selectedEmployee.firstName} ${selectedEmployee.lastName}`)} flex items-center justify-center text-white text-lg font-bold`}>
                        {selectedEmployee.firstName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {selectedEmployee.firstName} {selectedEmployee.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {selectedEmployee.designation?.title || 'Employee'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 text-xs">
                        <FiMail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600 truncate">{selectedEmployee.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <FiBriefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600">{selectedEmployee.department?.name || 'Unassigned'}</span>
                      </div>
                      {selectedEmployee.branch?.name && (
                        <div className="flex items-center gap-2 text-xs">
                          <FiLayers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-600">{selectedEmployee.branch.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        selectedEmployee.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedEmployee.status || 'Unknown'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-700">
                        {selectedEmployee.designation?.title || 'Employee'}
                      </span>
                    </div>
                    {selectedReports.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                          Direct Reports ({selectedReports.length})
                        </p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {selectedReports.map((r) => {
                            const rFullName = `${r.firstName} ${r.lastName}`.trim();
                            const rDeptColor = getDeptColor(r.department?.name || '');
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleSelect(r.id)}
                                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                              >
                                <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${rDeptColor} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                                  {rFullName.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-slate-800 truncate">{rFullName}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{r.designation?.title || 'Employee'}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Department Legend */}
              {!loading && departments.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                    <FiBookmark className="w-3.5 h-3.5 text-emerald-600" />
                    Department Legend
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setDeptFilter(deptFilter === dept.name ? null : dept.name)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          deptFilter === dept.name
                            ? 'bg-teal-100 text-teal-700 ring-1 ring-teal-200'
                            : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${getDeptColor(dept.name)}`} />
                        {dept.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Module Tips */}
              <ModuleTips
                moduleKey="org-chart"
                title="Org Chart Tips"
                tips={orgChartTips}
                userRole={user?.role}
              />

              {/* Module Workflow */}
              <ModuleWorkflow
                moduleKey="org-chart"
                title="How to Use Org Chart"
                subtitle="Set up and navigate your organization structure"
                steps={orgChartWorkflowSteps}
                accentColor="violet"
                userRole={user?.role}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
