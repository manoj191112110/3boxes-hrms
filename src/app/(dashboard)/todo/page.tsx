'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiCheckSquare,
  FiPlus,
  FiCheck,
  FiClock,
  FiAlertTriangle,
  FiList,
  FiMoreVertical,
  FiEdit2,
  FiTrash2,
  FiFlag,
  FiCalendar,
  FiUser,
  FiSearch,
  FiX,
  FiFilter,
  FiChevronDown,
  FiArrowUp,
  FiArrowRight,
  FiArrowDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ──────────── Types ──────────── */
type Priority = 'High' | 'Medium' | 'Low';
type Status = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
type Category = 'HR' | 'Payroll' | 'Recruitment' | 'Admin' | 'Compliance' | 'Training' | 'Benefits' | 'Operations';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  status: Status;
  dueDate: string;
  assignedTo: { name: string; avatar: string; initials: string; id?: string };
  createdAt: string;
}

interface NewTask {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  dueDate: string;
  assignedTo: string;
  assignedToId?: string;
}

/* ──────────── API Types ──────────── */
interface ApiTodoTask {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category?: string;
  dueDate?: string;
  assignedToId?: string;
  assignee?: { id: string; firstName: string; lastName: string; avatar?: string | null };
  createdById: string;
  creator?: { id: string; firstName: string; lastName: string; avatar?: string | null };
  companyId?: string;
  completedAt?: string;
  subtasks?: { title: string; completed: boolean }[];
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  status?: string;
}

function mapApiTask(t: ApiTodoTask): Task {
  const a = t.assignee;
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    priority: (t.priority as Priority) || 'Medium',
    category: (t.category as Category) || 'HR',
    status: (t.status as Status) || 'Pending',
    dueDate: t.dueDate || '',
    assignedTo: a
      ? { name: `${a.firstName} ${a.lastName}`, avatar: a.avatar || '', initials: `${a.firstName[0] || ''}${a.lastName[0] || ''}`, id: a.id }
      : { name: 'Unassigned', avatar: '', initials: '?' },
    createdAt: t.createdAt?.split('T')[0] || '',
  };
}



/* ──────────── Helpers ──────────── */
const PRIORITY_CONFIG: Record<Priority, { bg: string; text: string; icon: typeof FiArrowUp; iconColor: string }> = {
  High: { bg: 'bg-red-50', text: 'text-red-700', icon: FiArrowUp, iconColor: 'text-red-500' },
  Medium: { bg: 'bg-amber-50', text: 'text-amber-700', icon: FiArrowRight, iconColor: 'text-amber-500' },
  Low: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: FiArrowDown, iconColor: 'text-emerald-500' },
};

const STATUS_CONFIG: Record<Status, { bg: string; text: string; dot: string }> = {
  Pending: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  'In Progress': { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  Completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Overdue: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  HR: { bg: 'bg-teal-50', text: 'text-teal-700' },
  Payroll: { bg: 'bg-sky-50', text: 'text-sky-700' },
  Recruitment: { bg: 'bg-orange-50', text: 'text-orange-700' },
  Admin: { bg: 'bg-slate-100', text: 'text-slate-700' },
  Compliance: { bg: 'bg-rose-50', text: 'text-rose-700' },
  Training: { bg: 'bg-teal-50', text: 'text-teal-700' },
  Benefits: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  Operations: { bg: 'bg-lime-50', text: 'text-lime-700' },
};

const AVATAR_GRADIENTS = [
  'from-teal-500 to-teal-600',
  'from-sky-500 to-cyan-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-green-600',
  'from-fuchsia-500 to-teal-600',
  'from-lime-500 to-green-600',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr: string, status: Status): boolean {
  if (status === 'Completed') return false;
  const due = new Date(dateStr + 'T23:59:59');
  return due < new Date();
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ──────────── Filter Tabs ──────────── */
type FilterTab = 'All' | Status;

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'All' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Overdue', value: 'Overdue' },
];

const ALL_CATEGORIES: Category[] = ['HR', 'Payroll', 'Recruitment', 'Admin', 'Compliance', 'Training', 'Benefits', 'Operations'];
const ALL_PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

/* ──────────── Sub-Components (outside render) ──────────── */

function StatCard({ icon: Icon, label, value, color, iconBg }: {
  icon: typeof FiList; label: string; value: number; color: string; iconBg: string;
}) {
  return (
    <div className="thb-card p-4 sm:p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl sm:text-3xl font-bold text-thb-text-primary leading-none">{value}</p>
        <p className="text-xs sm:text-sm text-thb-text-secondary mt-1">{label}</p>
      </div>
    </div>
  );
}

function TaskRow({ task, onToggleComplete, onDelete, onChangePriority, openActionMenu, onToggleActionMenu, onEditTask }: {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangePriority: (id: string, priority: Priority) => void;
  openActionMenu: string | null;
  onToggleActionMenu: (id: string | null) => void;
  onEditTask: (task: Task) => void;
}) {
  const overdue = task.status !== 'Completed' && isOverdue(task.dueDate, task.status);
  const days = daysUntil(task.dueDate);
  const effectiveStatus: Status = overdue ? 'Overdue' : task.status;
  const statusConf = STATUS_CONFIG[effectiveStatus];
  const priorityConf = PRIORITY_CONFIG[task.priority];
  const catConf = CATEGORY_COLORS[task.category] || { bg: 'bg-slate-100', text: 'text-slate-700' };
  const PriorityIcon = priorityConf.icon;
  const assigneeIdx = Math.abs(task.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const avatarGrad = AVATAR_GRADIENTS[assigneeIdx % AVATAR_GRADIENTS.length];
  const isOpen = openActionMenu === task.id;

  return (
    <div className={`thb-card p-4 transition-all duration-200 hover:shadow-md ${task.status === 'Completed' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Checkbox */}
        <button
          onClick={() => onToggleComplete(task.id)}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
            task.status === 'Completed'
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
          aria-label={task.status === 'Completed' ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {task.status === 'Completed' && <FiCheck className="w-3 h-3 text-white" />}
        </button>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className={`text-sm font-semibold leading-snug ${task.status === 'Completed' ? 'line-through text-thb-text-muted' : 'text-thb-text-primary'}`}>
                {task.title}
              </h3>
              <p className={`text-xs mt-1 line-clamp-1 ${task.status === 'Completed' ? 'text-thb-text-muted' : 'text-thb-text-secondary'}`}>
                {task.description}
              </p>
            </div>

            {/* Action Menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => onToggleActionMenu(isOpen ? null : task.id)}
                className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                aria-label="Task actions"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>
              {isOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => onToggleActionMenu(null)} />
                  <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-xl shadow-xl border border-thb-border py-1.5 animate-slide-in-down">
                    <button
                      onClick={() => { onToggleActionMenu(null); onEditTask(task); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary transition-colors"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" /> Edit Task
                    </button>
                    <button
                      onClick={() => onChangePriority(task.id, 'High')}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FiFlag className="w-3.5 h-3.5" /> High Priority
                    </button>
                    <button
                      onClick={() => onChangePriority(task.id, 'Medium')}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <FiFlag className="w-3.5 h-3.5" /> Medium Priority
                    </button>
                    <button
                      onClick={() => onChangePriority(task.id, 'Low')}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <FiFlag className="w-3.5 h-3.5" /> Low Priority
                    </button>
                    <div className="border-t border-thb-border my-1" />
                    <button
                      onClick={() => onDelete(task.id)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" /> Delete Task
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tags Row */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {/* Priority Badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${priorityConf.bg} ${priorityConf.text}`}>
              <PriorityIcon className={`w-3 h-3 ${priorityConf.iconColor}`} />
              {task.priority}
            </span>

            {/* Category Tag */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${catConf.bg} ${catConf.text}`}>
              {task.category}
            </span>

            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusConf.bg} ${statusConf.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
              {effectiveStatus}
            </span>

            {/* Due Date */}
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-red-600' : 'text-thb-text-secondary'}`}>
              <FiCalendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
              {overdue && (
                <span className="text-red-500 font-bold">
                  ({Math.abs(days)}d overdue)
                </span>
              )}
              {!overdue && task.status !== 'Completed' && days >= 0 && days <= 3 && (
                <span className="text-amber-500 font-semibold">
                  ({days === 0 ? 'Due today' : `${days}d left`})
                </span>
              )}
            </span>
          </div>

          {/* Assigned To */}
          <div className="flex items-center gap-2 mt-2.5">
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
              {task.assignedTo.initials}
            </div>
            <span className="text-xs text-thb-text-secondary">{task.assignedTo.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ Main Component ══════════════ */
export default function TodoPage() {
  const { user } = useAuthStore();
  const { effectiveCompanyId, scopeQuery, selectedTenantId } = useCompanyContextStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<NewTask>({
    title: '',
    description: '',
    priority: 'Medium',
    category: 'HR',
    dueDate: '',
    assignedTo: '',
    assignedToId: '',
  });

  /* ── Fetch Tasks from API ── */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'All') params.set('status', activeTab);
      if (priorityFilter !== 'All') params.set('priority', priorityFilter);
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      const sq = scopeQuery();
      const query = params.toString() ? `?${params.toString()}${sq ? `&${sq}` : ''}` : (sq ? `?${sq}` : '');
      const res = await fetch(`/api/todo${query}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks');
      const mapped = (data.tasks || []).map(mapApiTask);
      setTasks(mapped);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [activeTab, priorityFilter, categoryFilter, effectiveCompanyId, scopeQuery, selectedTenantId]);

  /* ── Fetch Employees for Assignee Dropdown ── */
  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/employees?limit=50${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEmployees(data.employees || []);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  }, [effectiveCompanyId, scopeQuery, selectedTenantId]);

  /* ── Initial fetch ── */
  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  /* ── Derived Stats ── */
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const overdue = tasks.filter(t => t.status === 'Overdue' || (t.status !== 'Completed' && isOverdue(t.dueDate, t.status))).length;
    return { total, inProgress, completed, overdue };
  }, [tasks]);

  /* ── Filtered Tasks ── */
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (activeTab !== 'All' && task.status !== activeTab) return false;
      if (priorityFilter !== 'All' && task.priority !== priorityFilter) return false;
      if (categoryFilter !== 'All' && task.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          task.title.toLowerCase().includes(q) ||
          task.description.toLowerCase().includes(q) ||
          task.category.toLowerCase().includes(q) ||
          task.assignedTo.name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, activeTab, priorityFilter, categoryFilter, searchQuery]);

  /* ── Handlers ── */
  const handleToggleComplete = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus: Status = task.status === 'Completed' ? 'Pending' : 'Completed';
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch('/api/todo', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update task');
      }
      toast.success(newStatus === 'Completed' ? 'Task marked as completed' : 'Task marked as pending', { duration: 2000, icon: newStatus === 'Completed' ? '✅' : '🔄' });
    } catch (e: unknown) {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: task.status } : t));
      toast.error(e instanceof Error ? e.message : 'Failed to update task');
    }
  }, [tasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    setOpenActionMenu(null);
    try {
      const res = await fetch(`/api/todo?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete task');
      }
      toast.success('Task deleted', { duration: 2000, icon: '🗑️' });
    } catch (e: unknown) {
      setTasks(prevTasks);
      toast.error(e instanceof Error ? e.message : 'Failed to delete task');
    }
  }, [tasks]);

  const handleChangePriority = useCallback(async (id: string, priority: Priority) => {
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    setOpenActionMenu(null);
    try {
      const res = await fetch('/api/todo', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, priority }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update priority');
      }
      toast.success(`Priority changed to ${priority}`, { duration: 2000, icon: '🚩' });
    } catch (e: unknown) {
      setTasks(prevTasks);
      toast.error(e instanceof Error ? e.message : 'Failed to update priority');
    }
  }, [tasks]);

  const handleToggleActionMenu = useCallback((id: string | null) => {
    setOpenActionMenu(id);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      assignedTo: task.assignedTo.name,
      assignedToId: task.assignedTo.id,
    });
    setShowAddModal(true);
  }, []);

  const handleAddTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      toast.error('Task title is required', { duration: 2500 });
      return;
    }
    if (!newTask.dueDate) {
      toast.error('Due date is required', { duration: 2500 });
      return;
    }

    const cid = effectiveCompanyId();
    const body: Record<string, unknown> = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      priority: newTask.priority,
      category: newTask.category,
      dueDate: newTask.dueDate,
      assignedToId: newTask.assignedToId || undefined,
      companyId: cid || undefined,
    };

    try {
      if (editingTaskId) {
        // PATCH existing task
        const res = await fetch('/api/todo', {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ id: editingTaskId, ...body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update task');
        toast.success('Task updated successfully', { duration: 2000, icon: '✅' });
      } else {
        // POST new task
        const res = await fetch('/api/todo', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create task');
        toast.success('Task added successfully', { duration: 2000, icon: '✅' });
      }
      // Refresh tasks from API
      fetchTasks();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save task');
    }

    setShowAddModal(false);
    setEditingTaskId(null);
    setNewTask({ title: '', description: '', priority: 'Medium', category: 'HR', dueDate: '', assignedTo: '', assignedToId: '' });
  }, [newTask, editingTaskId, effectiveCompanyId, fetchTasks, scopeQuery, selectedTenantId]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ──── Header ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <FiCheckSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-thb-text-primary">To Do</h1>
            <p className="text-sm text-thb-text-secondary">Manage and track your HR tasks and activities</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-200 transition-all duration-200 active:scale-[0.98]"
        >
          <FiPlus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* ──── Stats Row ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={FiList} label="Total Tasks" value={stats.total} color="text-slate-600" iconBg="bg-slate-100" />
        <StatCard icon={FiClock} label="In Progress" value={stats.inProgress} color="text-green-600" iconBg="bg-green-50" />
        <StatCard icon={FiCheck} label="Completed" value={stats.completed} color="text-emerald-600" iconBg="bg-emerald-50" />
        <StatCard icon={FiAlertTriangle} label="Overdue" value={stats.overdue} color="text-red-600" iconBg="bg-red-50" />
      </div>

      {/* ──── Filter Bar ──── */}
      <div className="thb-card p-4">
        {/* Tabs Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto flex-shrink-0">
            {FILTER_TABS.map(tab => {
              const count = tab.value === 'All' ? tasks.length : tasks.filter(t => t.status === tab.value).length;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === tab.value
                      ? 'bg-white text-thb-text-primary shadow-sm'
                      : 'text-thb-text-secondary hover:text-thb-text-primary'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-thb-text-muted hover:text-thb-text-primary">
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-thb-border">
          <span className="text-xs font-medium text-thb-text-muted flex items-center gap-1">
            <FiFilter className="w-3 h-3" /> Filters:
          </span>

          {/* Priority Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); setShowCategoryDropdown(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                priorityFilter !== 'All'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-thb-border text-thb-text-secondary hover:bg-slate-50'
              }`}
            >
              <FiFlag className="w-3 h-3" />
              {priorityFilter === 'All' ? 'Priority' : priorityFilter}
              <FiChevronDown className="w-3 h-3" />
            </button>
            {showPriorityDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPriorityDropdown(false)} />
                <div className="absolute left-0 top-9 z-20 w-40 bg-white rounded-xl shadow-xl border border-thb-border py-1.5 animate-slide-in-down">
                  <button
                    onClick={() => { setPriorityFilter('All'); setShowPriorityDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${priorityFilter === 'All' ? 'text-emerald-600 bg-emerald-50' : 'text-thb-text-secondary'}`}
                  >
                    All Priorities
                  </button>
                  {ALL_PRIORITIES.map(p => {
                    const conf = PRIORITY_CONFIG[p];
                    const PI = conf.icon;
                    return (
                      <button
                        key={p}
                        onClick={() => { setPriorityFilter(p); setShowPriorityDropdown(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${priorityFilter === p ? `${conf.bg} ${conf.text}` : 'text-thb-text-secondary'}`}
                      >
                        <PI className={`w-3 h-3 ${conf.iconColor}`} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Category Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowPriorityDropdown(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                categoryFilter !== 'All'
                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                  : 'border-thb-border text-thb-text-secondary hover:bg-slate-50'
              }`}
            >
              <FiList className="w-3 h-3" />
              {categoryFilter === 'All' ? 'Category' : categoryFilter}
              <FiChevronDown className="w-3 h-3" />
            </button>
            {showCategoryDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCategoryDropdown(false)} />
                <div className="absolute left-0 top-9 z-20 w-44 bg-white rounded-xl shadow-xl border border-thb-border py-1.5 animate-slide-in-down max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setCategoryFilter('All'); setShowCategoryDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${categoryFilter === 'All' ? 'text-emerald-600 bg-emerald-50' : 'text-thb-text-secondary'}`}
                  >
                    All Categories
                  </button>
                  {ALL_CATEGORIES.map(c => {
                    const conf = CATEGORY_COLORS[c] || { bg: 'bg-slate-100', text: 'text-slate-700' };
                    return (
                      <button
                        key={c}
                        onClick={() => { setCategoryFilter(c); setShowCategoryDropdown(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${categoryFilter === c ? `${conf.bg} ${conf.text}` : 'text-thb-text-secondary'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Clear Filters */}
          {(priorityFilter !== 'All' || categoryFilter !== 'All' || searchQuery) && (
            <button
              onClick={() => { setPriorityFilter('All'); setCategoryFilter('All'); setSearchQuery(''); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <FiX className="w-3 h-3" /> Clear
            </button>
          )}

          <div className="flex-1" />
          <span className="text-xs text-thb-text-muted">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ──── Task List ──── */}
      {loading ? (
        <div className="thb-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <FiList className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-semibold text-thb-text-primary mb-1">Loading tasks...</h3>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FiCheckSquare className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-semibold text-thb-text-primary mb-1">No tasks found</h3>
          <p className="text-xs text-thb-text-secondary">
            {searchQuery || priorityFilter !== 'All' || categoryFilter !== 'All' || activeTab !== 'All'
              ? 'Try adjusting your filters or search query'
              : 'Click "Add Task" to create your first task'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onChangePriority={handleChangePriority}
              openActionMenu={openActionMenu}
              onToggleActionMenu={handleToggleActionMenu}
              onEditTask={handleEditTask}
            />
          ))}
        </div>
      )}

      {/* ──── Add Task Modal ──── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingTaskId(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-in-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-thb-border px-6 py-4 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <FiPlus className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-thb-text-primary">{editingTaskId ? 'Edit Task' : 'Add New Task'}</h2>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setEditingTaskId(null); }}
                  className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Review leave applications"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the task details..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                />
              </div>

              {/* Priority & Category Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                    Priority
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1">
                    {ALL_PRIORITIES.map(p => {
                      const conf = PRIORITY_CONFIG[p];
                      const PI = conf.icon;
                      return (
                        <button
                          key={p}
                          onClick={() => setNewTask(prev => ({ ...prev, priority: p }))}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            newTask.priority === p
                              ? `${conf.bg} ${conf.text} shadow-sm`
                              : 'text-thb-text-muted hover:text-thb-text-secondary'
                          }`}
                        >
                          <PI className={`w-3 h-3 ${newTask.priority === p ? conf.iconColor : ''}`} />
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value as Category }))}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all appearance-none cursor-pointer"
                  >
                    {ALL_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date & Assign To Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted pointer-events-none" />
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-thb-text-primary mb-1.5">
                    Assign To
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted pointer-events-none" />
                    <select
                      value={newTask.assignedTo}
                      onChange={(e) => {
                        const emp = employees.find(em => `${em.firstName} ${em.lastName}` === e.target.value);
                        setNewTask(prev => ({ ...prev, assignedTo: e.target.value, assignedToId: emp?.id || '' }));
                      }}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select person</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={`${emp.firstName} ${emp.lastName}`}>{emp.firstName} {emp.lastName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-thb-border px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); setEditingTaskId(null); }}
                className="px-4 py-2.5 text-sm font-medium text-thb-text-secondary rounded-xl border border-thb-border hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-200 transition-all duration-200 active:scale-[0.98]"
              >
                {editingTaskId ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
