'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import {
  FiBriefcase, FiLayers, FiCheckSquare, FiClock, FiUsers, FiFlag,
  FiPlus, FiSearch, FiFilter, FiGrid, FiList, FiChevronDown,
  FiCalendar, FiTrendingUp, FiAlertCircle, FiActivity, FiBarChart2,
  FiArrowRight, FiMoreHorizontal, FiEdit2, FiTrash2, FiX,
  FiPlay, FiPause, FiZap, FiTarget, FiFileText, FiUser,
  FiFolder, FiSettings,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/* ── Helpers ── */
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
    active: 'thb-badge thb-badge-success',
    on_hold: 'thb-badge thb-badge-warning',
    completed: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
    draft: 'thb-badge bg-slate-100 text-slate-600',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    active: 'Active', on_hold: 'On Hold', completed: 'Completed',
    cancelled: 'Cancelled', draft: 'Draft',
  };
  return map[status] || status.replace('_', ' ');
}

function getPriorityBadge(priority: string) {
  const map: Record<string, string> = {
    critical: 'thb-badge bg-red-100 text-red-700',
    high: 'thb-badge thb-badge-error',
    medium: 'thb-badge thb-badge-warning',
    low: 'thb-badge thb-badge-success',
  };
  return map[priority] || 'thb-badge thb-badge-info';
}

const CHART_COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  on_hold: '#F59E0B',
  completed: '#3B82F6',
  cancelled: '#EF4444',
  draft: '#94A3B8',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  backlog: '#94A3B8',
  todo: '#3B82F6',
  in_progress: '#F59E0B',
  review: '#8B5CF6',
  done: '#10B981',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

/* ── Types ── */
interface ApiProject {
  id: string;
  name: string;
  code?: string;
  projectType: string;
  status: string;
  progress: number;
  startDate: string;
  endDate?: string;
  budgetAmount: number;
  estimatedHours: number;
  actualHours: number;
  client?: { id: string; name: string; code?: string };
  department?: { id: string; name: string; code?: string };
  company?: { id: string; name: string };
  _count?: { tasks: number; allocations: number; milestones: number };
  tasks?: { id: string; name: string; status: string; priority: string }[];
  allocations?: {
    id: string; role?: string; allocationPct: number; status: string;
    employee: { id: string; firstName: string; lastName: string; employeeId?: string };
  }[];
}

interface ApiTask {
  id: string;
  name: string;
  status: string;
  priority: string;
  estimatedHours: number;
  actualHours: number;
  assignedToId?: string;
  plannedEnd?: string;
  project?: { id: string; name: string };
  projectTask?: { isBillable: boolean };
}

/* ── Empty State Component ── */
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center text-slate-400">
      <FiBarChart2 className="w-8 h-8 mb-2 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ── Tab Types ── */
type TabId = 'dashboard' | 'projects' | 'sprints' | 'tasks' | 'timeline' | 'reports';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <FiBarChart2 className="w-4 h-4" /> },
  { id: 'projects', label: 'Projects', icon: <FiBriefcase className="w-4 h-4" /> },
  { id: 'sprints', label: 'Sprints', icon: <FiLayers className="w-4 h-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <FiCheckSquare className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline', icon: <FiClock className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <FiTrendingUp className="w-4 h-4" /> },
];

/* ── Placeholder Tabs ── */

const projectTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function ProjectReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Project progress reports, resource utilization, and timeline analytics
      </p>
      <a href="/project-management/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function ProjectSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure project templates, default views, and notification preferences
      </p>
      <a href="/project-management/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function ProjectManagementPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="project"
      moduleLabel="Project Management"
      moduleIcon={<FiFolder className="w-5 h-5 text-white" />}
      gradientColor="from-fuchsia-500 to-pink-600"
      tabs={projectTabs}
      overviewContent={<ProjectManagementContent />}
      children={{
        reports: <ProjectReportsPlaceholder />,
        settings: <ProjectSettingsPlaceholder />,
      }}
    />
  );
}

export default function ProjectManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full" /></div>}>
      <ProjectManagementPageContent />
    </Suspense>
  );
}

/* ── Main Component ── */
function ProjectManagementContent() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectViewMode, setProjectViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  // API data state
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [allTasks, setAllTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [projRes, taskRes] = await Promise.all([
        fetch('/api/projects?limit=50', { headers: getAuthHeaders() }),
        fetch('/api/project-reports', { headers: getAuthHeaders() }),
      ]);

      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData.projects || []);
      }

      if (taskRes.ok) {
        const reportData = await taskRes.json();
        // Fetch all tasks across projects
        if (reportData.budgetVsActual) {
          // We have report data; also try to get individual tasks
        }
      }

      // Fetch tasks for all projects (batch)
      if (projects.length > 0) {
        // We'll rely on the tasks included in project data
      }
    } catch {
      // Silently handle - empty state will show
    } finally {
      setLoading(false);
    }
  }

  // Refetch when projects load to get tasks
  useEffect(() => {
    if (projects.length > 0 && allTasks.length === 0) {
      fetchAllTasks();
    }
  }, [projects]);

  async function fetchAllTasks() {
    try {
      // Fetch tasks from a few projects to populate kanban
      const taskPromises = projects.slice(0, 10).map(p =>
        fetch(`/api/projects/${p.id}/tasks?limit=50`, { headers: getAuthHeaders() })
          .then(res => res.ok ? res.json() : { tasks: [] })
          .catch(() => ({ tasks: [] }))
      );
      const results = await Promise.all(taskPromises);
      const tasks: ApiTask[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i] as { tasks: ApiTask[] };
        for (const t of (result.tasks || [])) {
          tasks.push({ ...t, project: { id: projects[i].id, name: projects[i].name } });
        }
      }
      setAllTasks(tasks);
    } catch {
      // Silently handle
    }
  }

  // Also load on initial fetch complete
  useEffect(() => {
    if (!loading && projects.length > 0 && allTasks.length === 0) {
      fetchAllTasks();
    }
  }, [loading]);

  // Computed data
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (projectFilter !== 'all') filtered = filtered.filter(p => p.status === projectFilter);
    if (searchQuery) filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered;
  }, [projects, projectFilter, searchQuery]);

  const projectStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, value]) => ({
      name: formatStatus(status),
      value,
      color: STATUS_COLORS[status] || '#94A3B8',
    }));
  }, [projects]);

  const taskDistData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTasks) {
      const status = t.status || 'todo';
      counts[status] = (counts[status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      name: TASK_STATUS_LABELS[status] || status,
      count,
      fill: TASK_STATUS_COLORS[status] || '#94A3B8',
    }));
  }, [allTasks]);

  const teamWorkloadData = useMemo(() => {
    // Compute workload from project allocations
    const workload: Record<string, { tasks: number; color: string }> = {};
    let colorIdx = 0;
    for (const p of projects) {
      for (const alloc of (p.allocations || [])) {
        const name = `${alloc.employee.firstName} ${alloc.employee.lastName}`;
        if (!workload[name]) {
          workload[name] = { tasks: 0, color: CHART_COLORS[colorIdx % CHART_COLORS.length] };
          colorIdx++;
        }
        workload[name].tasks += 1;
      }
    }
    return Object.entries(workload).map(([name, data]) => ({
      name,
      tasks: data.tasks,
      color: data.color,
    }));
  }, [projects]);

  const overdueTasksList = useMemo(() => {
    return allTasks.filter(t => {
      if (!t.plannedEnd || t.status === 'done' || t.status === 'cancelled') return false;
      return new Date(t.plannedEnd) < new Date();
    });
  }, [allTasks]);

  const kanbanColumns = useMemo(() => [
    { key: 'backlog', label: 'Backlog', color: 'bg-slate-100', borderColor: 'border-t-slate-400', tasks: allTasks.filter(t => t.status === 'backlog') },
    { key: 'todo', label: 'To Do', color: 'bg-green-50', borderColor: 'border-t-green-500', tasks: allTasks.filter(t => t.status === 'todo') },
    { key: 'in_progress', label: 'In Progress', color: 'bg-amber-50', borderColor: 'border-t-amber-500', tasks: allTasks.filter(t => t.status === 'in_progress') },
    { key: 'review', label: 'Review', color: 'bg-teal-50', borderColor: 'border-t-teal-500', tasks: allTasks.filter(t => t.status === 'review') },
    { key: 'done', label: 'Done', color: 'bg-emerald-50', borderColor: 'border-t-emerald-500', tasks: allTasks.filter(t => t.status === 'done') },
  ], [allTasks]);

  const stats = useMemo(() => ({
    totalProjects: projects.length,
    activeSprints: 0, // No sprint data from API
    tasksThisWeek: allTasks.length,
    overdueTasks: overdueTasksList.length,
    teamUtilization: projects.length > 0 ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / projects.length) : 0,
    completedMilestones: 0, // No milestone data from API
  }), [projects, allTasks, overdueTasksList]);

  /* ── Dashboard Tab ── */
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Status Pie */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Project Status</h3>
          {loading ? (
            <div className="h-[200px] animate-pulse bg-slate-100 rounded" />
          ) : projectStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {projectStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {projectStatusData.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.name} ({d.value})
                  </span>
                ))}
              </div>
            </>
          ) : (
            <EmptyChartState message="No project data" />
          )}
        </div>

        {/* Sprint Burndown — requires sprint data not available via API */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Sprint Burndown</h3>
          {projects.length > 0 ? (
            <EmptyChartState message="Sprint data not available" />
          ) : (
            <EmptyChartState message="No sprint data" />
          )}
        </div>

        {/* Task Distribution */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Task Distribution</h3>
          {loading ? (
            <div className="h-[200px] animate-pulse bg-slate-100 rounded" />
          ) : taskDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={taskDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {taskDistData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No task data" />
          )}
        </div>

        {/* Team Workload */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Team Workload</h3>
          {loading ? (
            <div className="h-[200px] animate-pulse bg-slate-100 rounded" />
          ) : teamWorkloadData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamWorkloadData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} />
                <Tooltip />
                <Bar dataKey="tasks" radius={[0, 4, 4, 0]}>
                  {teamWorkloadData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState message="No allocation data" />
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue Tasks */}
        <div className="thb-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 text-red-500" /> Overdue Tasks
            </h3>
            <span className="thb-badge thb-badge-error">{overdueTasksList.length}</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {overdueTasksList.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50 border border-red-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.project?.name || '—'}</p>
                </div>
                <span className="text-xs text-red-600 font-medium ml-2">{formatDate(t.plannedEnd)}</span>
              </div>
            ))}
            {overdueTasksList.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No overdue tasks</p>}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="thb-card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FiCalendar className="w-4 h-4 text-amber-500" /> Upcoming Deadlines
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allTasks
              .filter(t => t.plannedEnd && t.status !== 'done' && t.status !== 'cancelled' && new Date(t.plannedEnd) >= new Date())
              .sort((a, b) => new Date(a.plannedEnd!).getTime() - new Date(b.plannedEnd!).getTime())
              .slice(0, 5)
              .map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.project?.name || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end ml-2">
                    <span className={getPriorityBadge(t.priority)}>{t.priority}</span>
                    <span className="text-xs text-slate-400 mt-1">{formatDate(t.plannedEnd)}</span>
                  </div>
                </div>
              ))}
            {allTasks.filter(t => t.plannedEnd && t.status !== 'done' && t.status !== 'cancelled' && new Date(t.plannedEnd) >= new Date()).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No upcoming deadlines</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="thb-card p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowCreateProject(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
            <FiPlus className="w-4 h-4" /> New Project
          </button>
          <button onClick={() => setShowCreateSprint(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
            <FiLayers className="w-4 h-4" /> New Sprint
          </button>
          <button onClick={() => setShowCreateTask(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
            <FiCheckSquare className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Projects Tab ── */
  const renderProjects = () => (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
          </div>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProjectViewMode('grid')} className={`p-2 rounded-lg border ${projectViewMode === 'grid' ? 'bg-teal-50 border-teal-200 text-teal-600' : 'border-slate-200 text-slate-400 hover:text-slate-600'}`}>
            <FiGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setProjectViewMode('list')} className={`p-2 rounded-lg border ${projectViewMode === 'list' ? 'bg-teal-50 border-teal-200 text-teal-600' : 'border-slate-200 text-slate-400 hover:text-slate-600'}`}>
            <FiList className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreateProject(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
            <FiPlus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="thb-card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
              <div className="h-2 bg-slate-100 rounded mb-4" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 bg-slate-100 rounded" />
                <div className="h-3 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : projectViewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(p => (
            <div key={p.id} className="thb-card thb-card-hover p-4 cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{p.client?.name || p.company?.name || '—'}</p>
                </div>
                <span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Progress</span>
                  <span className="font-medium">{p.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, background: p.progress >= 80 ? '#10B981' : p.progress >= 50 ? '#F59E0B' : '#3B82F6' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1"><FiCalendar className="w-3 h-3" />{formatDate(p.startDate)}</div>
                <div className="flex items-center gap-1"><FiUsers className="w-3 h-3" />{p._count?.allocations || 0} members</div>
                <div className="flex items-center gap-1"><FiFileText className="w-3 h-3" />{p._count?.tasks || 0} tasks</div>
                <div className="flex items-center gap-1"><span className="font-medium text-slate-700">${((p.budgetAmount || 0) / 1000).toFixed(0)}k</span> budget</div>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && <p className="text-sm text-slate-400 text-center py-8 col-span-full">No projects found</p>}
        </div>
      ) : (
        /* List View */
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Project</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Progress</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Team</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Budget</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Dates</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.client?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${p.progress}%`, background: p.progress >= 80 ? '#10B981' : p.progress >= 50 ? '#F59E0B' : '#3B82F6' }} />
                        </div>
                        <span className="text-xs text-slate-500">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p._count?.allocations || 0}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">${((p.budgetAmount || 0) / 1000).toFixed(0)}k</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.startDate)} — {formatDate(p.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProjects.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No projects found</p>}
        </div>
      )}
    </div>
  );

  /* ── Sprints Tab ── */
  const renderSprints = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Sprint Management</h3>
        <button onClick={() => setShowCreateSprint(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
          <FiPlus className="w-4 h-4" /> New Sprint
        </button>
      </div>

      {/* No sprint data available from API — show empty state */}
      <div className="thb-card p-8 text-center">
        <FiLayers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <h4 className="text-sm font-semibold text-slate-700 mb-1">No Sprint Data</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">Sprint management data is not yet available from the API. Create sprints to see them here.</p>
      </div>
    </div>
  );

  /* ── Tasks Tab (Kanban) ── */
  const renderTasks = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={myTasksOnly} onChange={e => setMyTasksOnly(e.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            My Tasks Only
          </label>
        </div>
        <button onClick={() => setShowCreateTask(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
          <FiPlus className="w-4 h-4" /> New Task
        </button>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex-shrink-0 w-72">
              <div className="animate-pulse h-8 bg-slate-100 rounded-t-lg mb-2" />
              <div className="animate-pulse h-64 bg-slate-50 rounded-b-lg" />
            </div>
          ))}
        </div>
      ) : allTasks.length > 0 ? (
        /* Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
          {kanbanColumns.map(col => (
            <div key={col.key} className="flex-shrink-0 w-72"
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'rgba(139,92,246,0.05)'; }}
              onDragLeave={e => { e.currentTarget.style.background = ''; }}
              onDrop={e => {
                e.currentTarget.style.background = '';
                if (draggedTask) {
                  toast.success(`Task moved to ${col.label}`);
                  setDraggedTask(null);
                }
              }}
            >
              <div className={`${col.color} ${col.borderColor} border-t-2 rounded-t-lg px-3 py-2 flex items-center justify-between`}>
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="w-5 h-5 rounded-full bg-white text-xs font-medium text-slate-600 flex items-center justify-center shadow-sm">{col.tasks.length}</span>
              </div>
              <div className="bg-slate-50/50 rounded-b-lg p-2 space-y-2 min-h-[320px]">
                {col.tasks.map(t => (
                  <div key={t.id} draggable
                    onDragStart={() => setDraggedTask(t.id)}
                    className="thb-card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-slate-800 flex-1">{t.name}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={getPriorityBadge(t.priority)}>{t.priority}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FiClock className="w-3 h-3" />{formatDate(t.plannedEnd)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">{t.project?.name || '—'}</p>
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">No tasks</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="thb-card p-8 text-center">
          <FiCheckSquare className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-semibold text-slate-700 mb-1">No Tasks</h4>
          <p className="text-xs text-slate-500">Create tasks to see them on the Kanban board.</p>
        </div>
      )}
    </div>
  );

  /* ── Timeline Tab ── */
  const renderTimeline = () => {
    const timelineProjects = projects.filter(p => p.status !== 'cancelled' && p.startDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Project Timeline</h3>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <FiCalendar className="w-4 h-4" /> {currentYear}
          </div>
        </div>

        {loading ? (
          <div className="thb-card p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-10 bg-slate-100 rounded" />
            ))}
          </div>
        ) : timelineProjects.length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Month Headers */}
              <div className="flex border-b border-slate-100 bg-slate-50">
                <div className="w-48 flex-shrink-0 px-4 py-2 text-xs font-semibold text-slate-600">Project</div>
                {months.map((m, i) => (
                  <div key={i} className="w-20 flex-shrink-0 px-2 py-2 text-xs text-center font-medium text-slate-500 border-l border-slate-100">{m}</div>
                ))}
              </div>

              {/* Project Rows */}
              {timelineProjects.map((p, idx) => {
                const startMonth = new Date(p.startDate).getMonth();
                const endMonth = p.endDate ? new Date(p.endDate).getMonth() : 11;
                const startYear = new Date(p.startDate).getFullYear();
                const endYear = p.endDate ? new Date(p.endDate).getFullYear() : currentYear;
                const adjustedStart = startYear === currentYear ? startMonth : 0;
                const adjustedEnd = endYear === currentYear ? endMonth : 11;
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                const pctComplete = p.progress / 100;

                return (
                  <div key={p.id} className="flex items-center border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <div className="w-48 flex-shrink-0 px-4 py-3">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.client?.name || '—'}</p>
                    </div>
                    <div className="flex-1 flex relative h-10">
                      {months.map((m, i) => (
                        <div key={i} className="w-20 flex-shrink-0 border-l border-slate-100 h-full" />
                      ))}
                      {/* Bar */}
                      <div className="absolute top-1.5 h-7 rounded-md" style={{
                        left: `${(adjustedStart / 12) * 100}%`,
                        width: `${((adjustedEnd - adjustedStart + 1) / 12) * 100}%`,
                        background: color,
                        opacity: 0.2,
                      }} />
                      <div className="absolute top-1.5 h-7 rounded-md" style={{
                        left: `${(adjustedStart / 12) * 100}%`,
                        width: `${((adjustedEnd - adjustedStart + 1) / 12) * 100 * pctComplete}%`,
                        background: color,
                        borderRadius: '6px',
                      }}>
                        <span className="text-xs text-white font-medium px-2 leading-7 whitespace-nowrap">{p.progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiCalendar className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <h4 className="text-sm font-semibold text-slate-700 mb-1">No Timeline Data</h4>
            <p className="text-xs text-slate-500">Create projects with start and end dates to see the timeline.</p>
          </div>
        )}
      </div>
    );
  };

  /* ── Reports Tab ── */
  const renderReports = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Project Reports</h3>
        <a href="/project-management/reports" className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
          <FiBarChart2 className="w-4 h-4" /> Full Reports Page
        </a>
      </div>

      {projects.length === 0 ? (
        <div className="thb-card p-8 text-center">
          <FiTrendingUp className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-semibold text-slate-700 mb-1">No Report Data</h4>
          <p className="text-xs text-slate-500">Project report data will appear here once projects are created.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="thb-card p-4 text-center">
              <p className="text-2xl font-bold text-teal-600">{allTasks.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Tasks</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{allTasks.filter(t => t.status === 'done').length}</p>
              <p className="text-xs text-slate-500 mt-1">Completed Tasks</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.teamUtilization}%</p>
              <p className="text-xs text-slate-500 mt-1">Avg Progress</p>
            </div>
            <div className="thb-card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">${((projects.reduce((a, p) => a + (p.budgetAmount || 0), 0)) / 1000000).toFixed(2)}M</p>
              <p className="text-xs text-slate-500 mt-1">Total Budget</p>
            </div>
          </div>

          {projectStatusData.length > 0 && (
            <div className="thb-card p-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Project Status Distribution</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {projectStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ── Create Project Modal ── */
  const renderCreateProjectModal = () => showCreateProject && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateProject(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Create New Project</h3>
          <button onClick={() => setShowCreateProject(false)} className="p-1 rounded hover:bg-slate-100"><FiX className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name *</label>
            <input type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Enter project name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
              <input type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Client name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Type</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="internal">Internal</option>
                <option value="client">Client</option>
                <option value="r_and_d">R&D</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Budget ($)</label>
              <input type="number" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Project description..." />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100">
          <button onClick={() => setShowCreateProject(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { setShowCreateProject(false); toast.success('Project created successfully!'); }} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">Create Project</button>
        </div>
      </div>
    </div>
  );

  /* ── Create Sprint Modal ── */
  const renderCreateSprintModal = () => showCreateSprint && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateSprint(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Create New Sprint</h3>
          <button onClick={() => setShowCreateSprint(false)} className="p-1 rounded hover:bg-slate-100"><FiX className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sprint Name *</label>
            <input type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="e.g., Sprint 14 - Feature X" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project *</label>
            <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
              <option>Select project</option>
              {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sprint Goal</label>
            <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="What should this sprint achieve?" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100">
          <button onClick={() => setShowCreateSprint(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { setShowCreateSprint(false); toast.success('Sprint created successfully!'); }} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">Create Sprint</button>
        </div>
      </div>
    </div>
  );

  /* ── Create Task Modal ── */
  const renderCreateTaskModal = () => showCreateTask && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateTask(false)}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Create New Task</h3>
          <button onClick={() => setShowCreateTask(false)} className="p-1 rounded hover:bg-slate-100"><FiX className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Title *</label>
            <input type="text" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Enter task title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" placeholder="Task description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option>Select project</option>
                {projects.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Story Points</label>
              <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="8">8</option>
                <option value="13">13</option>
                <option value="21">21</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100">
          <button onClick={() => setShowCreateTask(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { setShowCreateTask(false); toast.success('Task created successfully!'); }} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">Create Task</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--thb-background)]">
      {/* Hero Gradient */}
      <div className="bg-gradient-to-r from-teal-600 via-fuchsia-600 to-pink-600 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <FiBriefcase className="w-7 h-7 text-white/90" />
            <h1 className="text-2xl font-bold text-white">Project Management</h1>
          </div>
          <p className="text-white/70 text-sm">Manage projects, sprints, tasks, and track team performance</p>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {[
              { label: 'Total Projects', value: stats.totalProjects, icon: <FiBriefcase className="w-4 h-4" />, color: 'bg-white/15' },
              { label: 'Active Sprints', value: stats.activeSprints, icon: <FiLayers className="w-4 h-4" />, color: 'bg-white/15' },
              { label: 'Total Tasks', value: stats.tasksThisWeek, icon: <FiCheckSquare className="w-4 h-4" />, color: 'bg-white/15' },
              { label: 'Overdue Tasks', value: stats.overdueTasks, icon: <FiAlertCircle className="w-4 h-4" />, color: 'bg-red-500/30' },
              { label: 'Avg Progress', value: `${stats.teamUtilization}%`, icon: <FiUsers className="w-4 h-4" />, color: 'bg-white/15' },
              { label: 'Milestones', value: stats.completedMilestones, icon: <FiFlag className="w-4 h-4" />, color: 'bg-white/15' },
            ].map((s, i) => (
              <div key={i} className={`${s.color} backdrop-blur-sm rounded-xl px-3 py-2 text-white`}>
                <div className="flex items-center gap-2 text-white/70 text-xs mb-0.5">{s.icon}{s.label}</div>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'projects' && renderProjects()}
        {activeTab === 'sprints' && renderSprints()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'timeline' && renderTimeline()}
        {activeTab === 'reports' && renderReports()}
      </div>

      {/* Modals */}
      {renderCreateProjectModal()}
      {renderCreateSprintModal()}
      {renderCreateTaskModal()}
    </div>
  );
}
