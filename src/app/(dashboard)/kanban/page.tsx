'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FiLayers,
  FiPlus,
  FiChevronDown,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiLayout,
  FiCalendar,
  FiPaperclip,
  FiMessageSquare,
  FiX,
  FiSearch,
  FiMoreHorizontal,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ──────────── Types ──────────── */
type Priority = 'High' | 'Medium' | 'Low';
type KanbanColumn = string;
type Category = 'HR' | 'Payroll' | 'Recruitment' | 'Admin' | 'Compliance' | 'Training' | 'Benefits' | 'Operations' | 'Onboarding' | 'Engagement';

/* ── API Shapes ── */
interface ApiKanbanBoard {
  id: string;
  name: string;
  description?: string;
  companyId?: string;
  createdById: string;
  columns: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiKanbanCard {
  id: string;
  boardId: string;
  title: string;
  description?: string;
  column: string;
  priority: string;
  category?: string;
  assignedToId?: string;
  assignee?: { id: string; firstName: string; lastName: string; avatar?: string };
  dueDate?: string;
  subtasks?: { title: string; completed: boolean }[];
  tags?: string[];
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── UI Shapes ── */
interface KanbanCard {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  column: string;
  assignee: { name: string; initials: string; gradient: string };
  dueDate: string;
  subtasksDone: number;
  subtasksTotal: number;
  attachments: number;
  comments: number;
}

interface NewCardForm {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  dueDate: string;
  assigneeName: string;
  assigneeId: string;
  column: string;
}

/* ──────────── Constants ──────────── */
const COLUMN_STYLE_MAP: Record<string, { color: string; headerBg: string; headerText: string }> = {
  'Backlog': { color: 'border-l-slate-400', headerBg: 'bg-slate-100', headerText: 'text-slate-700' },
  'To Do': { color: 'border-l-green-500', headerBg: 'bg-green-50', headerText: 'text-green-700' },
  'In Progress': { color: 'border-l-amber-500', headerBg: 'bg-amber-50', headerText: 'text-amber-700' },
  'Done': { color: 'border-l-emerald-500', headerBg: 'bg-emerald-50', headerText: 'text-emerald-700' },
};

const PRIORITY_STYLES: Record<Priority, { border: string; dot: string; label: string }> = {
  High: { border: 'border-l-red-500', dot: 'bg-red-500', label: 'text-red-600 bg-red-50' },
  Medium: { border: 'border-l-amber-400', dot: 'bg-amber-400', label: 'text-amber-600 bg-amber-50' },
  Low: { border: 'border-l-emerald-400', dot: 'bg-emerald-400', label: 'text-emerald-600 bg-emerald-50' },
};

const CATEGORY_STYLES: Record<Category, string> = {
  HR: 'bg-teal-100 text-teal-700',
  Payroll: 'bg-emerald-100 text-emerald-700',
  Recruitment: 'bg-green-100 text-green-700',
  Admin: 'bg-slate-100 text-slate-600',
  Compliance: 'bg-red-100 text-red-700',
  Training: 'bg-amber-100 text-amber-700',
  Benefits: 'bg-pink-100 text-pink-700',
  Operations: 'bg-cyan-100 text-cyan-700',
  Onboarding: 'bg-teal-100 text-teal-700',
  Engagement: 'bg-orange-100 text-orange-700',
};

const AVATAR_GRADIENTS = [
  'from-green-500 to-emerald-600',
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-green-600',
  'from-fuchsia-500 to-teal-600',
  'from-lime-500 to-green-600',
];

/* ──────────── Auth Helper ──────────── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ──────────── API → UI Mapper ──────────── */
function mapApiCardToUiCard(apiCard: ApiKanbanCard): KanbanCard {
  const firstName = apiCard.assignee?.firstName ?? '';
  const lastName = apiCard.assignee?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Unassigned';
  const initials = firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : '??';
  const gradientIndex = apiCard.assignee ? Math.abs(apiCard.assignee.id.charCodeAt(0) + apiCard.assignee.id.charCodeAt(1)) % AVATAR_GRADIENTS.length : 0;

  const subtasksTotal = apiCard.subtasks?.length ?? 0;
  const subtasksDone = apiCard.subtasks?.filter(s => s.completed).length ?? 0;

  return {
    id: apiCard.id,
    title: apiCard.title,
    description: apiCard.description ?? '',
    priority: (['High', 'Medium', 'Low'].includes(apiCard.priority) ? apiCard.priority : 'Medium') as Priority,
    category: ((apiCard.category ?? 'HR') as Category),
    column: apiCard.column || 'Backlog',
    assignee: { name: fullName, initials, gradient: AVATAR_GRADIENTS[gradientIndex] },
    dueDate: apiCard.dueDate ?? '',
    subtasksDone,
    subtasksTotal,
    attachments: 0,
    comments: 0,
  };
}

function getColumnStyle(key: string) {
  return COLUMN_STYLE_MAP[key] ?? { color: 'border-l-slate-400', headerBg: 'bg-slate-100', headerText: 'text-slate-700' };
}

/* ──────────── Helpers ──────────── */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr: string, column: KanbanColumn): boolean {
  if (column === 'Done') return false;
  return new Date(dateStr) < new Date();
}

function getSubtaskProgress(done: number, total: number): { percent: number; color: string } {
  const percent = total > 0 ? (done / total) * 100 : 0;
  let color = 'bg-amber-400';
  if (percent === 100) color = 'bg-emerald-500';
  else if (percent >= 60) color = 'bg-green-500';
  return { percent, color };
}

/* ──────────── Component ──────────── */
export default function KanbanBoardPage() {
  const { selectedCompanyId } = useCompanyContextStore();

  const [boards, setBoards] = useState<ApiKanbanBoard[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addColumn, setAddColumn] = useState<string>('To Do');
  const [searchQuery, setSearchQuery] = useState('');
  const [newCard, setNewCard] = useState<NewCardForm>({
    title: '',
    description: '',
    priority: 'Medium',
    category: 'HR',
    dueDate: '',
    assigneeName: '',
    assigneeId: '',
    column: 'To Do',
  });

  /* ── Derived columns from selected board ── */
  const activeBoard = boards.find(b => b.id === selectedBoard);
  const COLUMNS = useMemo(() => {
    const colNames = activeBoard?.columns?.length ? activeBoard.columns : ['Backlog', 'To Do', 'In Progress', 'Done'];
    return colNames.map(name => ({
      key: name,
      ...getColumnStyle(name),
    }));
  }, [activeBoard]);

  /* ── Fetch Data ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kanban', { method: 'GET', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch kanban data');
      const data = await res.json();
      const apiBoards: ApiKanbanBoard[] = (data.boards ?? []).map((b: ApiKanbanBoard) => ({
        ...b,
        columns: typeof b.columns === 'string' ? (b.columns as string).split(',').map((s: string) => s.trim()).filter(Boolean) : b.columns,
      }));
      setBoards(apiBoards);
      if (apiBoards.length > 0 && (!selectedBoard || !apiBoards.find((b: ApiKanbanBoard) => b.id === selectedBoard))) {
        setSelectedBoard(apiBoards[0].id);
      }
      const targetBoardId = selectedBoard || (apiBoards[0]?.id ?? '');
      const apiCards: ApiKanbanCard[] = (data.cards ?? []).filter((c: ApiKanbanCard) => c.boardId === targetBoardId && c.isActive);
      setCards(apiCards.map(mapApiCardToUiCard));
    } catch {
      toast.error('Failed to load kanban data');
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees', { method: 'GET', headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.employees ?? []);
      setEmployees(list.map((e: { id: string; firstName: string; lastName: string }) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchEmployees();
  }, [fetchData, fetchEmployees]);

  /* Re-filter cards when selectedBoard changes (boards already loaded) */
  useEffect(() => {
    if (!selectedBoard || boards.length === 0) return;
    // We re-fetch to get cards for the new board
    fetchData();
  }, [selectedBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived Stats ── */
  const stats = useMemo(() => {
    const total = cards.length;
    const inProgress = cards.filter(c => c.column === 'In Progress').length;
    const completed = cards.filter(c => c.column === 'Done').length;
    const overdue = cards.filter(c => isOverdue(c.dueDate, c.column)).length;
    return { total, inProgress, completed, overdue };
  }, [cards]);

  /* ── Filtered Cards by Column ── */
  const getColumnCards = (column: string) => {
    let filtered = cards.filter(c => c.column === column);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.assignee.name.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  /* ── Add Card Handler ── */
  const handleAddCard = async () => {
    if (!newCard.title.trim()) {
      toast.error('Card title is required');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        boardId: selectedBoard,
        title: newCard.title.trim(),
        description: newCard.description.trim(),
        column: addColumn,
        priority: newCard.priority,
        category: newCard.category,
        dueDate: newCard.dueDate || new Date().toISOString().split('T')[0],
        assignedToId: newCard.assigneeId || undefined,
        order: cards.length,
      };
      const res = await fetch('/api/kanban', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to create card');
      toast.success('Card added successfully');
      setShowAddModal(false);
      setNewCard({ title: '', description: '', priority: 'Medium', category: 'HR', dueDate: '', assigneeName: '', assigneeId: '', column: 'To Do' });
      fetchData();
    } catch {
      toast.error('Failed to add card');
    }
  };

  /* ── Add Board Handler ── */
  const handleAddBoard = async (name: string) => {
    if (!name.trim()) return;
    try {
      const body = {
        action: 'createBoard',
        name: name.trim(),
        description: '',
        columns: 'Backlog,To Do,In Progress,Done',
        companyId: selectedCompanyId ?? undefined,
      };
      const res = await fetch('/api/kanban', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to create board');
      toast.success('Board created');
      fetchData();
    } catch {
      toast.error('Failed to create board');
    }
  };

  /* ── Move Card Handler ── */
  const handleMoveCard = async (cardId: string, newColumn: string) => {
    // Optimistic update
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, column: newColumn } : c));
    try {
      const res = await fetch('/api/kanban', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ id: cardId, column: newColumn }) });
      if (!res.ok) throw new Error('Failed to move card');
    } catch {
      toast.error('Failed to move card');
      fetchData(); // revert
    }
  };

  /* ── Delete Card Handler ── */
  const handleDeleteCard = async (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    try {
      const res = await fetch(`/api/kanban?id=${cardId}&type=card`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to delete card');
      toast.success('Card deleted');
    } catch {
      toast.error('Failed to delete card');
      fetchData(); // revert
    }
  };

  /* ── Open Add Modal for specific column ── */
  const openAddModal = (column: string) => {
    setAddColumn(column);
    setNewCard(prev => ({ ...prev, column }));
    setShowAddModal(true);
  };

  return (
    <div className="thb-kanban-page space-y-6">
      {/* ═══════ Header ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
            <FiLayers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Kanban Board</h1>
            <p className="text-sm text-thb-text-secondary">Visualize and manage your HR workflow</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="thb-input pl-9 pr-3 py-2 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-48"
            />
          </div>

          {/* Board Selector */}
          <div className="relative">
            <button
              onClick={() => setShowBoardDropdown(!showBoardDropdown)}
              className="thb-btn flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-thb-border bg-white text-thb-text-primary hover:bg-slate-50 transition-colors"
            >
              <FiLayout className="w-4 h-4 text-thb-text-secondary" />
              {activeBoard?.name ?? 'Select Board'}
              <FiChevronDown className="w-4 h-4 text-thb-text-muted" />
            </button>
            {showBoardDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-thb-border rounded-xl shadow-lg z-20 py-1 animate-in fade-in slide-in-from-top-1">
                {boards.map(board => (
                  <button
                    key={board.id}
                    onClick={() => { setSelectedBoard(board.id); setShowBoardDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedBoard === board.id
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-thb-text-primary hover:bg-slate-50'
                    }`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Card Button */}
          <button
            onClick={() => openAddModal('To Do')}
            className="thb-btn inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-sm transition-all"
          >
            <FiPlus className="w-4 h-4" />
            Add Card
          </button>
        </div>
      </div>

      {/* ═══════ Stats Row ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Cards', value: stats.total, icon: FiLayout, color: 'from-slate-500 to-slate-600', bg: 'bg-slate-50' },
          { label: 'In Progress', value: stats.inProgress, icon: FiClock, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
          { label: 'Completed', value: stats.completed, icon: FiCheckCircle, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
          { label: 'Overdue', value: stats.overdue, icon: FiAlertCircle, color: 'from-red-500 to-rose-500', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-thb-border`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-thb-text-secondary uppercase tracking-wider">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-thb-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ═══════ Kanban Columns ═══════ */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-thb-text-secondary">Loading board...</span>
        </div>
      ) : (
      <div className="flex gap-5 overflow-x-auto pb-4 -mx-1 px-1" style={{ minHeight: 'calc(100vh - 320px)' }}>
        {COLUMNS.map(col => {
          const columnCards = getColumnCards(col.key);
          return (
            <div
              key={col.key}
              className="thb-kanban-column flex-shrink-0 w-[320px] sm:w-[340px] flex flex-col"
            >
              {/* Column Header */}
              <div className={`${col.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <h3 className={`font-semibold text-sm ${col.headerText}`}>{col.key}</h3>
                  <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[11px] font-bold ${
                    col.key === 'Backlog' ? 'bg-slate-200 text-slate-600' :
                    col.key === 'To Do' ? 'bg-green-100 text-green-600' :
                    col.key === 'In Progress' ? 'bg-amber-100 text-amber-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {columnCards.length}
                  </span>
                </div>
                <button
                  onClick={() => openAddModal(col.key)}
                  className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                  title={`Add card to ${col.key}`}
                >
                  <FiPlus className={`w-4 h-4 ${col.headerText}`} />
                </button>
              </div>

              {/* Column Cards */}
              <div className="flex-1 bg-slate-50/80 border border-t-0 border-thb-border rounded-b-xl p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-400px)]">
                {columnCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-thb-text-muted">
                    <FiLayout className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs">No cards yet</p>
                  </div>
                ) : (
                  columnCards.map(card => {
                    const priorityStyle = PRIORITY_STYLES[card.priority];
                    const subtaskProgress = getSubtaskProgress(card.subtasksDone, card.subtasksTotal);
                    const overdue = isOverdue(card.dueDate, card.column);

                    return (
                      <div
                        key={card.id}
                        className={`thb-kanban-card bg-white rounded-lg border border-thb-border border-l-[3px] ${priorityStyle.border} p-3.5 cursor-grab hover:shadow-md hover:shadow-slate-200/80 hover:-translate-y-0.5 active:cursor-grabbing active:shadow-lg transition-all duration-200 group`}
                      >
                        {/* Card Top: Priority + More */}
                        <div className="flex items-start justify-between mb-2">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${priorityStyle.label}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                            {card.priority}
                          </span>
                          <button className="p-1 rounded-md text-thb-text-muted hover:text-thb-text-secondary hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all">
                            <FiMoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Card Title */}
                        <h4 className="text-sm font-semibold text-thb-text-primary mb-1 leading-snug">
                          {card.title}
                        </h4>

                        {/* Description */}
                        <p className="text-xs text-thb-text-secondary line-clamp-2 mb-2.5 leading-relaxed">
                          {card.description}
                        </p>

                        {/* Category Tag */}
                        <div className="mb-3">
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_STYLES[card.category]}`}>
                            {card.category}
                          </span>
                        </div>

                        {/* Subtask Progress */}
                        {card.subtasksTotal > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-medium text-thb-text-muted">Subtasks</span>
                              <span className="text-[10px] font-semibold text-thb-text-secondary">{card.subtasksDone}/{card.subtasksTotal}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${subtaskProgress.color}`}
                                style={{ width: `${subtaskProgress.percent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          {/* Assignee */}
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${card.assignee.gradient} flex items-center justify-center text-white text-[9px] font-bold shadow-sm`}>
                              {card.assignee.initials}
                            </div>
                            <span className="text-[10px] font-medium text-thb-text-secondary max-w-[80px] truncate">
                              {card.assignee.name.split(' ')[0]}
                            </span>
                          </div>

                          {/* Meta Icons */}
                          <div className="flex items-center gap-2.5">
                            {/* Due Date */}
                            <div className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-thb-text-muted'}`}>
                              <FiCalendar className="w-3 h-3" />
                              {formatDate(card.dueDate)}
                            </div>

                            {/* Attachments */}
                            {card.attachments > 0 && (
                              <div className="flex items-center gap-0.5 text-[10px] text-thb-text-muted">
                                <FiPaperclip className="w-3 h-3" />
                                {card.attachments}
                              </div>
                            )}

                            {/* Comments */}
                            {card.comments > 0 && (
                              <div className="flex items-center gap-0.5 text-[10px] text-thb-text-muted">
                                <FiMessageSquare className="w-3 h-3" />
                                {card.comments}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ═══════ Add Card Modal ═══════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-thb-border animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-thb-border">
              <div>
                <h2 className="text-lg font-bold text-thb-text-primary">Add New Card</h2>
                <p className="text-xs text-thb-text-secondary mt-0.5">Adding to <span className="font-semibold">{addColumn}</span> column</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Title *</label>
                <input
                  type="text"
                  value={newCard.title}
                  onChange={e => setNewCard(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter card title..."
                  className="thb-input w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Description</label>
                <textarea
                  value={newCard.description}
                  onChange={e => setNewCard(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this card..."
                  rows={3}
                  className="thb-input w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
                />
              </div>

              {/* Priority + Category Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Priority</label>
                  <select
                    value={newCard.priority}
                    onChange={e => setNewCard(prev => ({ ...prev, priority: e.target.value as Priority }))}
                    className="thb-select w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none cursor-pointer"
                  >
                    <option value="High">🔴 High</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={newCard.category}
                    onChange={e => setNewCard(prev => ({ ...prev, category: e.target.value as Category }))}
                    className="thb-select w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none cursor-pointer"
                  >
                    {(['HR', 'Payroll', 'Recruitment', 'Admin', 'Compliance', 'Training', 'Benefits', 'Operations', 'Onboarding', 'Engagement'] as Category[]).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date + Assignee Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={newCard.dueDate}
                    onChange={e => setNewCard(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="thb-input w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Assignee</label>
                  <select
                    value={newCard.assigneeId}
                    onChange={e => {
                      const emp = employees.find(emp => emp.id === e.target.value);
                      setNewCard(prev => ({ ...prev, assigneeId: e.target.value, assigneeName: emp ? `${emp.firstName} ${emp.lastName}` : '' }));
                    }}
                    className="thb-select w-full px-3 py-2.5 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column Selection */}
              <div>
                <label className="block text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">Column</label>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))` }}>
                  {COLUMNS.map(col => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => setAddColumn(col.key)}
                      className={`thb-col-btn px-3 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                        addColumn === col.key
                          ? `${col.headerBg} ${col.headerText} border-current`
                          : 'border-thb-border text-thb-text-secondary hover:border-thb-text-muted bg-white'
                      }`}
                    >
                      {col.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-thb-border bg-slate-50/50 rounded-b-2xl">
              <button
                onClick={() => setShowAddModal(false)}
                className="thb-btn px-4 py-2 text-sm font-medium rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCard}
                className="thb-btn px-5 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-sm transition-all"
              >
                Add Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
