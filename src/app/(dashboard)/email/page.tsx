'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import {
  FiInbox,
  FiStar,
  FiSend,
  FiFileText,
  FiArchive,
  FiTrash2,
  FiSearch,
  FiEdit3,
  FiPaperclip,
  FiChevronDown,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiMoreVertical,
  FiX,
  FiMail,
} from 'react-icons/fi';
import { sanitizeSearch } from '@/lib/validators';

// ─── Types ───────────────────────────────────────────────────────

type FolderId = 'inbox' | 'starred' | 'sent' | 'drafts' | 'archive' | 'trash';

interface EmailAttachment {
  name: string;
  size: string;
  type: string;
}

interface Email {
  id: string;
  folder: FolderId[];
  from: { name: string; email: string; avatar: string };
  to: { name: string; email: string }[];
  cc?: { name: string; email: string }[];
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  attachments?: EmailAttachment[];
  label?: string;
  labelColor?: string;
}

interface Folder {
  id: FolderId;
  name: string;
  icon: React.ReactNode;
  count?: number;
}

interface Label {
  name: string;
  color: string;
  count: number;
}

// ─── API Types ────────────────────────────────────────────────────

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  attachments?: any[];
  labels?: string[];
  senderId?: string;
  sender?: { id: string; firstName: string; lastName: string; avatar?: string | null };
  threadId?: string;
  repliedToId?: string;
  priority: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Avatar Color Helper ─────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-orange-500',
  'bg-sky-500', 'bg-lime-600', 'bg-violet-500', 'bg-indigo-500',
];

const getAvatarClass = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ─── Label Color Map ─────────────────────────────────────────────

const LABEL_COLOR_MAP: Record<string, string> = {
  'HR Updates': 'bg-green-100 text-green-700',
  'Payroll': 'bg-emerald-100 text-emerald-700',
  'Leave': 'bg-amber-100 text-amber-700',
  'Projects': 'bg-teal-100 text-teal-700',
};

const getLabelColor = (label?: string) => (label && LABEL_COLOR_MAP[label]) || 'bg-slate-100 text-slate-700';

const folders: Folder[] = [
  { id: 'inbox', name: 'Inbox', icon: <FiInbox className="w-4 h-4" /> },
  { id: 'starred', name: 'Starred', icon: <FiStar className="w-4 h-4" /> },
  { id: 'sent', name: 'Sent', icon: <FiSend className="w-4 h-4" /> },
  { id: 'drafts', name: 'Drafts', icon: <FiFileText className="w-4 h-4" /> },
  { id: 'archive', name: 'Archive', icon: <FiArchive className="w-4 h-4" /> },
  { id: 'trash', name: 'Trash', icon: <FiTrash2 className="w-4 h-4" /> },
];

const labels: Label[] = [
  { name: 'HR Updates', color: 'bg-green-400', count: 0 },
  { name: 'Payroll', color: 'bg-emerald-400', count: 0 },
  { name: 'Leave', color: 'bg-amber-400', count: 0 },
  { name: 'Projects', color: 'bg-teal-400', count: 0 },
];

// ─── API → UI Mapper ─────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function mapApiEmail(msg: EmailMessage): Email {
  const fromName = msg.fromName || msg.sender
    ? `${msg.sender?.firstName || ''} ${msg.sender?.lastName || ''}`.trim() || msg.fromAddress
    : msg.fromAddress;
  const label = msg.labels?.[0];
  return {
    id: msg.id,
    folder: [msg.folder as FolderId],
    from: { name: fromName, email: msg.fromAddress, avatar: getInitials(fromName) },
    to: (msg.toAddresses || []).map((a) => ({ name: a, email: a })),
    cc: (msg.ccAddresses || []).map((a) => ({ name: a, email: a })),
    subject: msg.subject,
    preview: msg.body?.slice(0, 120) || '',
    body: msg.body || '',
    date: formatDate(msg.createdAt),
    time: formatTime(msg.createdAt),
    unread: !msg.isRead,
    starred: msg.isStarred,
    hasAttachment: msg.hasAttachments,
    attachments: msg.attachments?.map((a: any) => ({
      name: a.name || a.filename || 'Attachment',
      size: a.size ? `${Math.round(a.size / 1024)} KB` : '—',
      type: a.type || a.mimetype?.split('/').pop() || 'file',
    })),
    label,
    labelColor: getLabelColor(label),
  };
}

// ─── Helper ──────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FiFileText className="w-4 h-4 text-red-500" />;
    case 'docx':
      return <FiFileText className="w-4 h-4 text-green-500" />;
    case 'zip':
      return <FiFileText className="w-4 h-4 text-amber-500" />;
    case 'pptx':
      return <FiFileText className="w-4 h-4 text-orange-500" />;
    case 'video':
      return <FiFileText className="w-4 h-4 text-teal-500" />;
    default:
      return <FiFileText className="w-4 h-4 text-slate-500" />;
  }
};

// ─── Component ───────────────────────────────────────────────────

export default function EmailPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore((s) => s.effectiveCompanyId);
  const scopeQuery = useCompanyContextStore((s) => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore((s) => s.selectedTenantId);

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEmails, setTotalEmails] = useState(0);
  const [sending, setSending] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderId>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredFilter, setStarredFilter] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  // Compose form state
  const [composeTo, setComposeTo] = useState('');
  const [composeCC, setComposeCC] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // ─── Fetch Emails ──────────────────────────────
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const folder = selectedFolder === 'starred' ? 'inbox' : selectedFolder;
      const params = new URLSearchParams({ folder, page: '1', limit: '50' });
      if (searchQuery) params.set('search', searchQuery);
      const r = await fetch(`/api/email?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load emails');
      const mapped = (d.emails || []).map(mapApiEmail);
      // For starred folder, filter client-side
      if (selectedFolder === 'starred') {
        setEmails(mapped.filter((e: Email) => e.starred));
      } else {
        setEmails(mapped);
      }
      setTotalEmails(d.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, searchQuery, effectiveCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const filteredEmails = useMemo(() => {
    let result = emails;

    if (activeLabel) {
      result = result.filter((e) => e.label === activeLabel);
    }

    return result;
  }, [emails, activeLabel]);

  const selectedEmail = useMemo(
    () => emails.find((e) => e.id === selectedEmailId) || null,
    [emails, selectedEmailId]
  );

  const folderCounts = useMemo(() => {
    const counts: Record<FolderId, number> = {
      inbox: emails.filter((e) => e.folder.includes('inbox') && e.unread).length,
      starred: emails.filter((e) => e.starred).length,
      sent: emails.filter((e) => e.folder.includes('sent')).length,
      drafts: emails.filter((e) => e.folder.includes('drafts')).length,
      archive: emails.filter((e) => e.folder.includes('archive')).length,
      trash: emails.filter((e) => e.folder.includes('trash')).length,
    };
    return counts;
  }, [emails]);

  const toggleSelectAll = useCallback(() => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map((e) => e.id)));
    }
  }, [filteredEmails, selectedEmails]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleStar = useCallback(async (id: string) => {
    const email = emails.find((e) => e.id === id);
    if (!email) return;
    // Optimistic update
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, starred: !e.starred } : e));
    try {
      const r = await fetch('/api/email', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, isStarred: !email.starred }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed'); }
    } catch (e: unknown) {
      // Revert on error
      setEmails((prev) => prev.map((em) => em.id === id ? { ...em, starred: email.starred } : em));
      toast.error(e instanceof Error ? e.message : 'Failed to update star');
    }
  }, [emails]);

  const handleSend = useCallback(async () => {
    if (!composeTo.trim() || !composeSubject.trim()) {
      toast.error('Recipient and subject are required');
      return;
    }
    setSending(true);
    try {
      const cid = effectiveCompanyId();
      const r = await fetch('/api/email', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subject: composeSubject,
          body: composeBody,
          toAddresses: composeTo.split(',').map((s) => s.trim()).filter(Boolean),
          ccAddresses: composeCC ? composeCC.split(',').map((s) => s.trim()).filter(Boolean) : [],
          folder: 'sent',
          hasAttachments: false,
          attachments: [],
          labels: [],
          priority: 'normal',
          ...(cid ? { companyId: cid } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      toast.success('Email sent');
      setShowCompose(false);
      setComposeTo('');
      setComposeCC('');
      setComposeSubject('');
      setComposeBody('');
      fetchEmails();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [composeTo, composeCC, composeSubject, composeBody, effectiveCompanyId, fetchEmails, scopeQuery, selectedTenantId]);

  const markAsRead = useCallback(async (id: string) => {
    const email = emails.find((e) => e.id === id);
    if (!email || !email.unread) return;
    setEmails((prev) => prev.map((e) => e.id === id ? { ...e, unread: false } : e));
    try {
      await fetch('/api/email', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, isRead: true }),
      });
    } catch {
      // silently revert
      setEmails((prev) => prev.map((e) => e.id === id ? { ...e, unread: true } : e));
    }
  }, [emails]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/email?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Email moved to trash');
      setSelectedEmailId(null);
      fetchEmails();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete email');
    }
  }, [fetchEmails]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Email Inbox</h1>
          <p className="text-sm text-thb-text-secondary mt-0.5">
            Manage your HR communications and notifications
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
        >
          <FiEdit3 className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-0 thb-card overflow-hidden min-h-0">
        {/* ─── Left Sidebar ─── */}
        <div className="w-64 shrink-0 border-r border-thb-border bg-thb-card-bg flex flex-col">
          {/* Folders */}
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="space-y-0.5">
              {folders.map((folder) => {
                const isActive = selectedFolder === folder.id && !activeLabel;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setActiveLabel(null);
                      setSelectedEmailId(null);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-green-50 text-green-700'
                        : 'text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary'
                    }`}
                  >
                    <span className={isActive ? 'text-green-500' : 'text-thb-text-muted'}>
                      {folder.icon}
                    </span>
                    <span className="flex-1 text-left">{folder.name}</span>
                    {folderCounts[folder.id] > 0 && (
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-green-100 text-green-600'
                            : 'bg-slate-100 text-thb-text-muted'
                        }`}
                      >
                        {folderCounts[folder.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="border-t border-thb-border my-4" />

            {/* Labels */}
            <div>
              <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider px-3 mb-2">
                Labels
              </h3>
              <div className="space-y-0.5">
                {labels.map((label) => {
                  const isActive = activeLabel === label.name;
                  return (
                    <button
                      key={label.name}
                      onClick={() => {
                        setActiveLabel(isActive ? null : label.name);
                        setSelectedEmailId(null);
                        if (!isActive) setSelectedFolder('inbox');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-slate-50 text-thb-text-primary font-medium'
                          : 'text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${label.color}`}
                      />
                      <span className="flex-1 text-left">{label.name}</span>
                      <span className="text-xs text-thb-text-muted font-medium">
                        {emails.filter((e) => e.label === label.name).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-thb-border my-4" />

            {/* Quick Stats */}
            <div className="px-3">
              <h3 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-thb-text-secondary">Unread</span>
                  <span className="text-xs font-semibold text-green-600">
                    {emails.filter((e) => e.unread && e.folder.includes('inbox')).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-thb-text-secondary">Starred</span>
                  <span className="text-xs font-semibold text-amber-600">
                    {emails.filter((e) => e.starred).length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-thb-text-secondary">With Attachments</span>
                  <span className="text-xs font-semibold text-emerald-600">
                    {emails.filter((e) => e.hasAttachment && e.folder.includes('inbox')).length}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{
                      width: `${Math.round(
                        (emails.filter((e) => e.unread && e.folder.includes('inbox')).length /
                          Math.max(emails.filter((e) => e.folder.includes('inbox')).length, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-thb-text-muted">
                  {Math.round(
                    (emails.filter((e) => !e.unread && e.folder.includes('inbox')).length /
                      Math.max(emails.filter((e) => e.folder.includes('inbox')).length, 1)) *
                      100
                  )}
                  % inbox cleared
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Email List ─── */}
        <div
          className={`flex flex-col border-r border-thb-border bg-white ${
            selectedEmail ? 'w-96 shrink-0' : 'flex-1'
          }`}
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-thb-border">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeSearch(e.target.value))}
                placeholder="Search emails..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-thb-border bg-slate-50 text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-thb-text-muted hover:text-thb-text-primary"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filteredEmails.length > 0 && selectedEmails.size === filteredEmails.length}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-green-500 focus:ring-green-500/20"
                />
              </label>
              {selectedEmails.size > 0 && (
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-thb-text-muted font-medium">
                    {selectedEmails.size} selected
                  </span>
                  <button className="p-1.5 rounded hover:bg-slate-100 text-thb-text-muted hover:text-thb-text-primary transition-colors">
                    <FiArchive className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-slate-100 text-thb-text-muted hover:text-red-500 transition-colors">
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex-1" />
              <span className="text-xs text-thb-text-muted">
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Email Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-thb-text-muted font-medium">Loading emails...</p>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <FiInbox className="w-12 h-12 text-thb-text-muted mb-3" />
                <p className="text-sm text-thb-text-muted font-medium">No emails found</p>
                <p className="text-xs text-thb-text-muted mt-1">
                  {searchQuery ? 'Try a different search term' : 'This folder is empty'}
                </p>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmailId === email.id;
                const isChecked = selectedEmails.has(email.id);
                return (
                  <div
                    key={email.id}
                    onClick={() => { setSelectedEmailId(email.id); markAsRead(email.id); }}
                    className={`flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-slate-50 transition-colors group ${
                      isSelected
                        ? 'bg-green-50/70 border-l-2 border-l-green-500'
                        : email.unread
                        ? 'bg-green-50/30 border-l-2 border-l-green-400 hover:bg-slate-50'
                        : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className="pt-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(email.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-green-500 focus:ring-green-500/20"
                      />
                    </div>

                    {/* Star */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(email.id);
                      }}
                      className="pt-0.5 shrink-0 transition-colors"
                    >
                      <FiStar
                        className={`w-4 h-4 ${
                          email.starred
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>

                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full ${getAvatarClass(
                        email.from.name
                      )} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                    >
                      {getInitials(email.from.name)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            email.unread
                              ? 'font-semibold text-thb-text-primary'
                              : 'font-medium text-thb-text-secondary'
                          }`}
                        >
                          {email.from.name}
                        </span>
                        {email.label && (
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${email.labelColor}`}
                          >
                            {email.label}
                          </span>
                        )}
                        {email.hasAttachment && (
                          <FiPaperclip className="w-3.5 h-3.5 text-thb-text-muted shrink-0" />
                        )}
                      </div>
                      <p
                        className={`text-sm truncate mt-0.5 ${
                          email.unread
                            ? 'font-semibold text-thb-text-primary'
                            : 'text-thb-text-secondary'
                        }`}
                      >
                        {email.subject}
                      </p>
                      <p className="text-xs text-thb-text-muted truncate mt-0.5">
                        {email.preview}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="shrink-0 text-right pt-0.5">
                      <span
                        className={`text-[11px] ${
                          email.unread
                            ? 'font-semibold text-green-500'
                            : 'text-thb-text-muted'
                        }`}
                      >
                        {email.date}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Email Detail Panel ─── */}
        {selectedEmail ? (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Detail Header */}
            <div className="p-4 border-b border-thb-border">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-full ${getAvatarClass(
                    selectedEmail.from.name
                  )} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                >
                  {getInitials(selectedEmail.from.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-thb-text-primary">
                      {selectedEmail.from.name}
                    </h2>
                    <span className="text-xs text-thb-text-muted">
                      &lt;{selectedEmail.from.email}&gt;
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-thb-text-muted mt-0.5">
                    <span>To:</span>
                    {selectedEmail.to.map((t, i) => (
                      <span key={i}>
                        {t.name}
                        {i < selectedEmail.to.length - 1 ? ',' : ''}
                      </span>
                    ))}
                    {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                      <>
                        <span className="ml-1">CC:</span>
                        {selectedEmail.cc.map((c, i) => (
                          <span key={i}>
                            {c.name}
                            {i < (selectedEmail.cc?.length ?? 0) - 1 ? ',' : ''}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-thb-text-muted">
                    {selectedEmail.date} · {selectedEmail.time}
                  </p>
                  {selectedEmail.label && (
                    <span
                      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${selectedEmail.labelColor}`}
                    >
                      {selectedEmail.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Subject */}
              <h1 className="text-lg font-bold text-thb-text-primary mt-3">
                {selectedEmail.subject}
              </h1>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary bg-slate-50 hover:bg-slate-100 border border-thb-border transition-colors">
                  <FiCornerUpLeft className="w-3.5 h-3.5" />
                  Reply
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary bg-slate-50 hover:bg-slate-100 border border-thb-border transition-colors">
                  <FiCornerUpRight className="w-3.5 h-3.5" />
                  Forward
                </button>
                <button className="p-1.5 rounded-lg text-thb-text-muted hover:bg-slate-100 hover:text-thb-text-primary transition-colors">
                  <FiArchive className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(selectedEmail.id)}
                  className="p-1.5 rounded-lg text-thb-text-muted hover:bg-slate-100 hover:text-red-500 transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    toggleStar(selectedEmail.id);
                  }}
                  className="p-1.5 rounded-lg transition-colors"
                >
                  <FiStar
                    className={`w-4 h-4 ${
                      selectedEmail.starred
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-thb-text-muted hover:text-amber-300'
                    }`}
                  />
                </button>
                <div className="flex-1" />
                <button className="p-1.5 rounded-lg text-thb-text-muted hover:bg-slate-100 hover:text-thb-text-primary transition-colors">
                  <FiMoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="prose prose-sm max-w-none text-thb-text-secondary">
                {selectedEmail.body.split('\n').map((line, i) => {
                  if (line.startsWith('•') || line.startsWith('-')) {
                    return (
                      <div key={i} className="flex gap-2 ml-2">
                        <span className="text-thb-text-muted shrink-0">•</span>
                        <span>{line.replace(/^[•-]\s*/, '')}</span>
                      </div>
                    );
                  }
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  if (line.match(/^\d+\./)) {
                    return (
                      <div key={i} className="flex gap-2 ml-2">
                        <span className="text-green-500 font-medium shrink-0">
                          {line.match(/^\d+/)?.[0]}.
                        </span>
                        <span>{line.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                    );
                  }
                  return <p key={i} className="mb-1 leading-relaxed">{line}</p>;
                })}
              </div>

              {/* Attachments */}
              {selectedEmail.hasAttachment && selectedEmail.attachments && (
                <div className="mt-6 pt-4 border-t border-thb-border">
                  <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FiPaperclip className="w-3.5 h-3.5" />
                    Attachments ({selectedEmail.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedEmail.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-thb-border bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                      >
                        {getFileIcon(att.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-thb-text-primary truncate group-hover:text-green-600 transition-colors">
                            {att.name}
                          </p>
                          <p className="text-[11px] text-thb-text-muted">{att.size}</p>
                        </div>
                        <button className="p-1.5 rounded-lg text-thb-text-muted hover:bg-white hover:text-green-500 transition-colors">
                          <FiChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Reply */}
            <div className="p-4 border-t border-thb-border bg-slate-50/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                  ME
                </div>
                <div className="flex-1">
                  <textarea
                    placeholder="Write a quick reply..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-thb-border bg-white text-thb-text-primary placeholder:text-thb-text-muted focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none transition-all"
                    rows={2}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
                    >
                      Send Reply
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary bg-white border border-thb-border hover:bg-slate-50 transition-colors">
                      Save Draft
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Detail State */
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FiMail className="w-8 h-8 text-thb-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-thb-text-primary mb-1">
                Select an email
              </h3>
              <p className="text-sm text-thb-text-muted max-w-xs">
                Choose an email from the list to view its contents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Compose Modal ─── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 animate-fade-in"
            onClick={() => setShowCompose(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-thb-border animate-slide-in-up flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-thb-border rounded-t-xl" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
              <h3 className="text-sm font-semibold text-white">New Message</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-slate-100">
                <div className="flex items-center px-4 py-2 gap-2">
                  <span className="text-xs font-medium text-thb-text-muted w-8">To</span>
                  <input
                    type="text"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="recipient@3boxes.com"
                    className="flex-1 text-sm text-thb-text-primary placeholder:text-thb-text-muted bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div className="border-b border-slate-100">
                <div className="flex items-center px-4 py-2 gap-2">
                  <span className="text-xs font-medium text-thb-text-muted w-8">CC</span>
                  <input
                    type="text"
                    value={composeCC}
                    onChange={(e) => setComposeCC(e.target.value)}
                    placeholder="cc@3boxes.com (optional)"
                    className="flex-1 text-sm text-thb-text-primary placeholder:text-thb-text-muted bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <div className="border-b border-thb-border">
                <div className="flex items-center px-4 py-2.5 gap-2">
                  <span className="text-xs font-medium text-thb-text-muted w-14">Subject</span>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 text-sm font-medium text-thb-text-primary placeholder:text-thb-text-muted bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden">
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message here..."
                  className="w-full h-full px-4 py-3 text-sm text-thb-text-secondary placeholder:text-thb-text-muted bg-transparent focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-thb-border bg-slate-50/50 rounded-b-xl">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg text-thb-text-muted hover:bg-slate-100 hover:text-thb-text-primary transition-colors">
                  <FiPaperclip className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowCompose(false);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-thb-text-secondary bg-white border border-thb-border hover:bg-slate-50 transition-colors"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
                >
                  <span className="flex items-center gap-2">
                    {sending ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSend className="w-3.5 h-3.5" />}
                    {sending ? 'Sending...' : 'Send'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
