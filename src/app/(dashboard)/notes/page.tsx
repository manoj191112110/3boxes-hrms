'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import {
  FiEdit3, FiSearch, FiPlus, FiGrid, FiList, FiMapPin,
  FiClock, FiTrash2, FiSave, FiX, FiChevronDown,
  FiBookmark, FiFileText, FiUsers, FiShield, FiStar,
  FiCheck,
} from 'react-icons/fi';

// ── Types ──────────────────────────────────────────────────────────────
interface Note {
  id: string;
  title: string;
  content: string;
  category: 'hr' | 'meeting' | 'policy' | 'personal';
  color: string;
  pinned: boolean;
  lastEdited: string;
  createdAt: string;
}

// ── API Note shape ─────────────────────────────────────────────────────
interface ApiNote {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  isPinned: boolean;
  createdById: string;
  creator?: { id: string; firstName: string; lastName: string; avatar: string };
  companyId?: string;
  tags?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapApiNoteToNote(api: ApiNote): Note {
  return {
    id: api.id,
    title: api.title,
    content: api.content,
    category: (api.category as Note['category']) || 'personal',
    color: api.color || 'default',
    pinned: api.isPinned,
    lastEdited: api.updatedAt || api.createdAt,
    createdAt: api.createdAt,
  };
}

// ── Auth Headers ───────────────────────────────────────────────────────
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ── Category Config ────────────────────────────────────────────────────
const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgAccent: string; borderAccent: string }> = {
  hr: {
    label: 'HR Notes',
    icon: <FiUsers className="w-3.5 h-3.5" />,
    color: 'text-orange-700',
    bgAccent: 'bg-orange-50',
    borderAccent: 'border-l-orange-400',
  },
  meeting: {
    label: 'Meeting Notes',
    icon: <FiFileText className="w-3.5 h-3.5" />,
    color: 'text-emerald-700',
    bgAccent: 'bg-emerald-50',
    borderAccent: 'border-l-emerald-400',
  },
  policy: {
    label: 'Policy Notes',
    icon: <FiShield className="w-3.5 h-3.5" />,
    color: 'text-teal-700',
    bgAccent: 'bg-teal-50',
    borderAccent: 'border-l-teal-400',
  },
  personal: {
    label: 'Personal',
    icon: <FiStar className="w-3.5 h-3.5" />,
    color: 'text-amber-700',
    bgAccent: 'bg-amber-50',
    borderAccent: 'border-l-amber-400',
  },
};

// ── Color Options ──────────────────────────────────────────────────────
const colorOptions = [
  { value: 'default', label: 'Default', bg: 'bg-white', ring: 'ring-slate-200' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-50', ring: 'ring-rose-200' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-50', ring: 'ring-orange-200' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  { value: 'emerald', label: 'Emerald', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-50', ring: 'ring-teal-200' },
  { value: 'sky', label: 'Sky', bg: 'bg-sky-50', ring: 'ring-sky-200' },
  { value: 'violet', label: 'Violet', bg: 'bg-teal-50', ring: 'ring-teal-200' },
];

const colorCardMap: Record<string, string> = {
  default: 'bg-white',
  rose: 'bg-rose-50',
  orange: 'bg-orange-50',
  amber: 'bg-amber-50',
  emerald: 'bg-emerald-50',
  teal: 'bg-teal-50',
  sky: 'bg-sky-50',
  violet: 'bg-teal-50',
};


// ── Helpers ────────────────────────────────────────────────────────────
function formatDateRelative(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ── Main Component ─────────────────────────────────────────────────────
export default function NotesPage() {
  const { user } = useAuthStore();
  const { effectiveCompanyId, scopeQuery, selectedTenantId } = useCompanyContextStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorCategory, setEditorCategory] = useState<Note['category']>('hr');
  const [editorColor, setEditorColor] = useState('default');
  const [editorPinned, setEditorPinned] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // ── Fetch Notes from API ──────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const sq = scopeQuery();
      const res = await fetch(`/api/notes?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      const apiNotes: ApiNote[] = data.notes || data || [];
      setNotes(apiNotes.map(mapApiNoteToNote));
    } catch (err) {
      console.error('fetchNotes error:', err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ── Derived State ──────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    const filtered = notes.filter((n) => {
      const matchesSearch =
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || n.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    // Pinned first, then by lastEdited desc
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
    });
  }, [notes, searchQuery, activeCategory]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.pinned), [filteredNotes]);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) || null, [notes, selectedNoteId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notes.length };
    notes.forEach((n) => {
      counts[n.category] = (counts[n.category] || 0) + 1;
    });
    return counts;
  }, [notes]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNoteId(note.id);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorCategory(note.category);
    setEditorColor(note.color);
    setEditorPinned(note.pinned);
  }, []);

  const handleSaveNote = useCallback(async () => {
    if (!selectedNoteId) return;
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNoteId
          ? { ...n, title: editorTitle, content: editorContent, category: editorCategory, color: editorColor, pinned: editorPinned, lastEdited: new Date().toISOString() }
          : n
      )
    );
    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: selectedNoteId,
          title: editorTitle,
          content: editorContent,
          category: editorCategory,
          color: editorColor,
          isPinned: editorPinned,
        }),
      });
    } catch (err) {
      console.error('handleSaveNote error:', err);
      fetchNotes(); // revert on error
    }
  }, [selectedNoteId, editorTitle, editorContent, editorCategory, editorColor, editorPinned, fetchNotes]);

  const handleDeleteNote = useCallback(async (id: string) => {
    // Optimistic update
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
    try {
      await fetch(`/api/notes?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error('handleDeleteNote error:', err);
      fetchNotes(); // revert on error
    }
  }, [selectedNoteId, fetchNotes]);

  const handleTogglePin = useCallback(async (id: string) => {
    // Optimistic update
    const target = notes.find((n) => n.id === id);
    const newPinned = !target?.pinned;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: newPinned } : n)));
    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, isPinned: newPinned }),
      });
    } catch (err) {
      console.error('handleTogglePin error:', err);
      fetchNotes(); // revert on error
    }
  }, [notes, fetchNotes]);

  const handleAddNote = useCallback(
    async (title: string, content: string, category: Note['category'], color: string) => {
      try {
        const cid = effectiveCompanyId();
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title,
            content,
            category,
            color,
            isPinned: false,
            companyId: cid || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.note || data;
          if (created?.id) {
            setNotes((prev) => [mapApiNoteToNote(created as ApiNote), ...prev]);
          } else {
            fetchNotes(); // fallback: refetch all
          }
        } else {
          fetchNotes(); // fallback on error
        }
      } catch (err) {
        console.error('handleAddNote error:', err);
        fetchNotes();
      }
      setShowAddModal(false);
    },
    [effectiveCompanyId, fetchNotes, scopeQuery, selectedTenantId]
  );

  const handleCloseEditor = useCallback(() => {
    handleSaveNote();
    setSelectedNoteId(null);
  }, [handleSaveNote]);

  // ── Sidebar Category Items ─────────────────────────────────────────
  const sidebarCategories = [
    { key: 'all', label: 'All Notes', icon: <FiBookmark className="w-4 h-4" /> },
    { key: 'hr', label: 'HR Notes', icon: <FiUsers className="w-4 h-4" /> },
    { key: 'meeting', label: 'Meeting Notes', icon: <FiFileText className="w-4 h-4" /> },
    { key: 'policy', label: 'Policy Notes', icon: <FiShield className="w-4 h-4" /> },
    { key: 'personal', label: 'Personal', icon: <FiStar className="w-4 h-4" /> },
  ];

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-thb-background">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-sm">
                <FiEdit3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-thb-text-primary">Notes</h1>
            </div>
            <p className="text-sm text-thb-text-secondary ml-[52px]">
              Capture meeting minutes, policy updates, and important HR notes
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:from-orange-600 hover:to-rose-700 transition-all active:scale-[0.98]"
          >
            <FiPlus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="flex gap-6">
        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="thb-card p-4 sticky top-6">
            {/* Search */}
            <div className="relative mb-5">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border bg-thb-background text-sm text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-thb-text-muted hover:text-thb-text-secondary"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filters */}
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2.5 px-2">
                Categories
              </h3>
              <div className="space-y-0.5">
                {sidebarCategories.map((cat) => {
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-orange-50 text-orange-700 shadow-sm'
                          : 'text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary'
                      }`}
                    >
                      <span className={isActive ? 'text-orange-500' : 'text-thb-text-muted'}>{cat.icon}</span>
                      <span className="flex-1 text-left">{cat.label}</span>
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-thb-text-muted'
                        }`}
                      >
                        {categoryCounts[cat.key] || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2.5 px-2 flex items-center gap-1.5">
                  <FiMapPin className="w-3 h-3" />
                  Pinned
                </h3>
                <div className="space-y-1">
                  {pinnedNotes.map((note) => {
                    const catConf = categoryConfig[note.category];
                    const isSelected = selectedNoteId === note.id;
                    return (
                      <button
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-orange-50 border border-orange-200 shadow-sm'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected ? 'text-orange-700' : 'text-thb-text-primary'
                          }`}
                        >
                          {note.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${catConf.color} ${catConf.bgAccent} px-1.5 py-0.5 rounded`}>
                            {catConf.icon}
                            {catConf.label}
                          </span>
                          <span className="text-[11px] text-thb-text-muted flex items-center gap-1">
                            <FiClock className="w-2.5 h-2.5" />
                            {formatDateRelative(note.lastEdited)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Notes Grid/List ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Mobile category filter */}
              <div className="lg:hidden relative">
                <button
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                >
                  {sidebarCategories.find((c) => c.key === activeCategory)?.icon}
                  {sidebarCategories.find((c) => c.key === activeCategory)?.label}
                  <FiChevronDown className="w-3.5 h-3.5" />
                </button>
                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl border border-thb-border shadow-lg z-20 py-1 animate-slide-in-down">
                    {sidebarCategories.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => {
                          setActiveCategory(cat.key);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          activeCategory === cat.key
                            ? 'bg-orange-50 text-orange-700 font-medium'
                            : 'text-thb-text-secondary hover:bg-slate-50'
                        }`}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile search */}
              <div className="lg:hidden relative">
                <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-thb-text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-lg border border-thb-border bg-white text-sm text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-40"
                />
              </div>

              <span className="text-sm text-thb-text-muted">
                {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-white text-orange-600 shadow-sm' : 'text-thb-text-muted hover:text-thb-text-secondary'
                }`}
                title="Grid view"
              >
                <FiGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white text-orange-600 shadow-sm' : 'text-thb-text-muted hover:text-thb-text-secondary'
                }`}
                title="List view"
              >
                <FiList className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notes Display */}
          {loading ? (
            <div className="thb-card p-12 text-center">
              <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-thb-text-secondary">Loading notes…</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FiEdit3 className="w-7 h-7 text-thb-text-muted" />
              </div>
              <h3 className="text-base font-semibold text-thb-text-primary mb-1">No notes found</h3>
              <p className="text-sm text-thb-text-secondary mb-4">
                {searchQuery ? 'Try a different search term' : 'Create your first note to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-medium hover:from-orange-600 hover:to-rose-700 transition-all"
                >
                  <FiPlus className="w-4 h-4" />
                  Create Note
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── Grid View (Masonry-style) ─────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredNotes.map((note, idx) => {
                const catConf = categoryConfig[note.category];
                const cardBg = colorCardMap[note.color] || 'bg-white';
                const isSelected = selectedNoteId === note.id;
                // Masonry effect: vary card heights via content length
                const isLongContent = note.content.length > 180;
                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`thb-card thb-card-hover cursor-pointer border-l-4 ${catConf.borderAccent} ${
                      isSelected ? 'ring-2 ring-orange-400 ring-offset-1' : ''
                    } ${cardBg} ${isLongContent && idx % 3 === 0 ? 'sm:row-span-2' : ''}`}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-thb-text-primary line-clamp-2 leading-snug flex-1">
                          {note.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note.id);
                          }}
                          className={`shrink-0 p-1 rounded-md transition-colors ${
                            note.pinned
                              ? 'text-orange-500 bg-orange-50'
                              : 'text-thb-text-muted hover:text-orange-400 hover:bg-slate-50'
                          }`}
                          title={note.pinned ? 'Unpin' : 'Pin'}
                        >
                          <FiMapPin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-orange-500' : ''}`} />
                        </button>
                      </div>

                      {/* Preview */}
                      <p className="text-xs text-thb-text-secondary leading-relaxed line-clamp-4 mb-3">
                        {note.content}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${catConf.color} ${catConf.bgAccent} px-2 py-0.5 rounded-md`}
                        >
                          {catConf.icon}
                          {catConf.label}
                        </span>
                        <span className="text-[11px] text-thb-text-muted flex items-center gap-1">
                          <FiClock className="w-2.5 h-2.5" />
                          {formatDateRelative(note.lastEdited)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── List View ─────────────────────────────────────────── */
            <div className="space-y-2">
              {filteredNotes.map((note) => {
                const catConf = categoryConfig[note.category];
                const cardBg = colorCardMap[note.color] || 'bg-white';
                const isSelected = selectedNoteId === note.id;
                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`thb-card thb-card-hover cursor-pointer border-l-4 ${catConf.borderAccent} ${
                      isSelected ? 'ring-2 ring-orange-400 ring-offset-1' : ''
                    } ${cardBg}`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Pin */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(note.id);
                        }}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                          note.pinned
                            ? 'text-orange-500 bg-orange-50'
                            : 'text-thb-text-muted hover:text-orange-400 hover:bg-slate-50'
                        }`}
                        title={note.pinned ? 'Unpin' : 'Pin'}
                      >
                        <FiMapPin className={`w-4 h-4 ${note.pinned ? 'fill-orange-500' : ''}`} />
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-thb-text-primary truncate mb-0.5">
                          {note.title}
                        </h3>
                        <p className="text-xs text-thb-text-secondary truncate">{note.content}</p>
                      </div>

                      {/* Category Tag */}
                      <span
                        className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium ${catConf.color} ${catConf.bgAccent} px-2 py-0.5 rounded-md shrink-0`}
                      >
                        {catConf.icon}
                        {catConf.label}
                      </span>

                      {/* Date */}
                      <span className="text-[11px] text-thb-text-muted flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <FiClock className="w-2.5 h-2.5" />
                        {formatDateRelative(note.lastEdited)}
                      </span>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="shrink-0 p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Note Editor Panel ────────────────────────────────────── */}
        {selectedNote && (
          <div className="hidden xl:block w-96 shrink-0">
            <div className="thb-card sticky top-6 overflow-hidden">
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-thb-border bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <FiEdit3 className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-thb-text-primary">Edit Note</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePin(selectedNote.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      editorPinned ? 'text-orange-500 bg-orange-50' : 'text-thb-text-muted hover:text-orange-400 hover:bg-slate-50'
                    }`}
                    title={editorPinned ? 'Unpin' : 'Pin'}
                  >
                    <FiMapPin className={`w-4 h-4 ${editorPinned ? 'fill-orange-500' : ''}`} />
                  </button>
                  <button
                    onClick={handleCloseEditor}
                    className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                    title="Close"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editor Body */}
              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border bg-white text-sm font-medium text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                    placeholder="Note title..."
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
                    Content
                  </label>
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border bg-white text-sm text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-none leading-relaxed"
                    placeholder="Write your note..."
                  />
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((cat) => {
                      const conf = categoryConfig[cat];
                      const isActive = editorCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setEditorCategory(cat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? `${conf.bgAccent} ${conf.color} ring-1 ring-current/20 shadow-sm`
                              : 'bg-slate-50 text-thb-text-muted hover:bg-slate-100'
                          }`}
                        >
                          {conf.icon}
                          {conf.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
                    Color
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-secondary hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className={`w-4 h-4 rounded-full ${colorCardMap[editorColor] || 'bg-white'} ring-1 ring-thb-border`}
                      />
                      {colorOptions.find((c) => c.value === editorColor)?.label || 'Default'}
                      <FiChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {showColorPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-thb-border shadow-lg z-20 p-2 animate-slide-in-down">
                        <div className="grid grid-cols-4 gap-1.5">
                          {colorOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setEditorColor(opt.value);
                                setShowColorPicker(false);
                              }}
                              className={`w-8 h-8 rounded-lg ${opt.bg} ring-1 ${opt.ring} transition-all hover:scale-110 flex items-center justify-center`}
                              title={opt.label}
                            >
                              {editorColor === opt.value && (
                                <FiCheck className="w-3.5 h-3.5 text-thb-text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pin Toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <FiMapPin className={`w-4 h-4 ${editorPinned ? 'text-orange-500 fill-orange-500' : 'text-thb-text-muted'}`} />
                    <span className="text-sm font-medium text-thb-text-primary">Pin Note</span>
                  </div>
                  <button
                    onClick={() => setEditorPinned(!editorPinned)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors ${
                      editorPinned ? 'bg-orange-500' : 'bg-slate-300'
                    }`}
                    style={{ width: 40, height: 22 }}
                  >
                    <span
                      className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-transform ${
                        editorPinned ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                      style={{ width: 18, height: 18, transition: 'transform 0.2s ease' }}
                    />
                  </button>
                </div>

                {/* Metadata */}
                <div className="text-[11px] text-thb-text-muted space-y-1 pt-1">
                  <p>Created: {new Date(selectedNote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p>Last edited: {formatDateRelative(selectedNote.lastEdited)}</p>
                </div>
              </div>

              {/* Editor Footer */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-thb-border bg-slate-50/50">
                <button
                  onClick={handleSaveNote}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-medium hover:from-orange-600 hover:to-rose-700 transition-all active:scale-[0.98]"
                >
                  <FiSave className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Note Editor (Sheet-like overlay) ─────────────────── */}
      {selectedNoteId && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseEditor} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-in-up shadow-2xl">
            {/* Handle bar */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Mobile Editor Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-thb-border">
              <div className="flex items-center gap-2">
                <FiEdit3 className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-thb-text-primary">Edit Note</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleTogglePin(selectedNote!.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    editorPinned ? 'text-orange-500 bg-orange-50' : 'text-thb-text-muted hover:bg-slate-50'
                  }`}
                >
                  <FiMapPin className={`w-4 h-4 ${editorPinned ? 'fill-orange-500' : ''}`} />
                </button>
                <button
                  onClick={handleCloseEditor}
                  className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile Editor Body */}
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-white text-base font-semibold text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                placeholder="Note title..."
              />
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-white text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none leading-relaxed"
                placeholder="Write your note..."
              />

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((cat) => {
                    const conf = categoryConfig[cat];
                    const isActive = editorCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setEditorCategory(cat)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? `${conf.bgAccent} ${conf.color} ring-1 ring-current/20`
                            : 'bg-slate-50 text-thb-text-muted hover:bg-slate-100'
                        }`}
                      >
                        {conf.icon}
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditorColor(opt.value)}
                      className={`w-8 h-8 rounded-lg ${opt.bg} ring-1 ${opt.ring} transition-all hover:scale-110 flex items-center justify-center`}
                      title={opt.label}
                    >
                      {editorColor === opt.value && <FiCheck className="w-3.5 h-3.5 text-thb-text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 pb-4">
                <button
                  onClick={handleSaveNote}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-rose-700 transition-all active:scale-[0.98]"
                >
                  <FiSave className="w-4 h-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => handleDeleteNote(selectedNoteId!)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Note Modal ──────────────────────────────────────────── */}
      {showAddModal && (
        <AddNoteModal
          onAdd={handleAddNote}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ── Add Note Modal Component ───────────────────────────────────────────
function AddNoteModal({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, content: string, category: Note['category'], color: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Note['category']>('hr');
  const [color, setColor] = useState('default');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), content.trim(), category, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center">
              <FiPlus className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-thb-text-primary">New Note</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-white text-sm font-medium text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
              placeholder="Give your note a title..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) handleSubmit();
              }}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 rounded-lg border border-thb-border bg-white text-sm text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all resize-none leading-relaxed"
              placeholder="Write your note content here..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((cat) => {
                const conf = categoryConfig[cat];
                const isActive = category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? `${conf.bgAccent} ${conf.color} ring-1 ring-current/20 shadow-sm`
                        : 'bg-slate-50 text-thb-text-muted hover:bg-slate-100'
                    }`}
                  >
                    {conf.icon}
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  className={`w-8 h-8 rounded-lg ${opt.bg} ring-1 ${opt.ring} transition-all hover:scale-110 flex items-center justify-center`}
                  title={opt.label}
                >
                  {color === opt.value && <FiCheck className="w-3.5 h-3.5 text-thb-text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-thb-border bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-orange-500 disabled:hover:to-rose-600"
          >
            <FiPlus className="w-4 h-4" />
            Create Note
          </button>
        </div>
      </div>
    </div>
  );
}
