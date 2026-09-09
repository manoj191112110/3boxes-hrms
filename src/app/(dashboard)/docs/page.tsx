'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { canManageDocs } from '@/lib/roleAccess';
import {
  FiBookOpen, FiSearch, FiFileText, FiCode, FiGitBranch, FiShield,
  FiZap, FiClipboard, FiPlay, FiLock, FiUnlock, FiEye, FiChevronRight,
  FiPlus, FiEdit3, FiTrash2, FiX, FiUsers, FiUser,
  FiArrowLeft, FiHash, FiLayers,
  FiGrid,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';

// Types
interface DocCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  articleCount: number;
}

interface DocArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  docType: string;
  moduleKey: string | null;
  tags: string | null;
  version: string;
  status: string;
  viewCount: number;
  sortOrder: number;
  category: { name: string; slug: string; icon: string; color: string };
  isRestricted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocAccessRule {
  id: string;
  articleId: string;
  role: string | null;
  userId: string | null;
  accessType: string;
  grantedBy: string | null;
  createdAt: string;
}

interface ArticleDetail extends DocArticle {
  content: string;
  accessRules: DocAccessRule[];
}

// Doc type config
const docTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  technical: { label: 'Technical', color: 'bg-green-100 text-green-700', icon: <FiCode className="w-3.5 h-3.5" /> },
  functional: { label: 'Functional', color: 'bg-green-100 text-green-700', icon: <FiFileText className="w-3.5 h-3.5" /> },
  workflow: { label: 'Workflow', color: 'bg-emerald-100 text-emerald-700', icon: <FiGitBranch className="w-3.5 h-3.5" /> },
  security: { label: 'Security', color: 'bg-red-100 text-red-700', icon: <FiShield className="w-3.5 h-3.5" /> },
  ai: { label: 'AI', color: 'bg-teal-100 text-teal-700', icon: <FiZap className="w-3.5 h-3.5" /> },
  sop: { label: 'SOP', color: 'bg-amber-100 text-amber-700', icon: <FiClipboard className="w-3.5 h-3.5" /> },
  training: { label: 'Training', color: 'bg-teal-100 text-teal-700', icon: <FiPlay className="w-3.5 h-3.5" /> },
};

const moduleKeys = [
  { value: 'platform', label: 'Platform' },
  { value: 'employees', label: 'Employees' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'leave', label: 'Leave' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'performance', label: 'Performance' },
  { value: 'training', label: 'Training' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'assets', label: 'Assets' },
  { value: 'projects', label: 'Projects' },
  { value: 'security', label: 'Security' },
  { value: 'auth', label: 'Auth' },
  { value: 'ai-interview', label: 'AI Interview' },
  { value: 'ai-assistant', label: 'AI Assistant' },
  { value: 'ai-admin', label: 'AI Admin' },
  { value: 'separation', label: 'Separation' },
  { value: 'helpdesk', label: 'Helpdesk' },
];

const roles = ['super_admin', 'tenant_admin', 'manager', 'employee'];

// Simple Markdown renderer
function renderMarkdown(markdown: string): string {
  let html = markdown
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-thb-text-primary mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-thb-text-primary mt-8 mb-3 pb-2 border-b border-thb-border">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-thb-text-primary mt-4 mb-4">$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-thb-text-primary">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-start gap-2 ml-4 my-1"><span class="text-green-500 mt-0.5">✓</span><span class="line-through text-thb-text-muted">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-start gap-2 ml-4 my-1"><span class="text-slate-400 mt-0.5">○</span><span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<div class="flex items-start gap-2 ml-4 my-1"><span class="text-slate-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></span><span>$1</span></div>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<div class="ml-4 my-1 pl-2">$1</div>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => c.trim().match(/^[-:]+$/))) return '';
      const isHeader = false;
      const cellHtml = cells.map(c => `<td class="px-3 py-2 text-sm text-thb-text-secondary border-b border-thb-border">${c.trim()}</td>`).join('');
      return `<tr class="${isHeader ? 'bg-slate-50' : ''}">${cellHtml}</tr>`;
    })
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="my-3 text-thb-text-secondary leading-relaxed">')
    // Line breaks
    .replace(/\n/g, '<br/>');

  // Wrap table rows
  if (html.includes('<tr')) {
    html = html.replace(/(<tr[\s\S]*?<\/tr>)+/g, (match) =>
      `<table class="w-full border-collapse my-4 rounded-lg overflow-hidden border border-thb-border"><thead class="bg-slate-50"></thead><tbody>${match}</tbody></table>`
    );
  }

  return `<div class="prose-3boxes"><p class="my-3 text-thb-text-secondary leading-relaxed">${html}</p></div>`;
}

// Category icon mapper
function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ReactNode> = {
    FiCode: <FiCode className="w-5 h-5" />,
    FiFileText: <FiFileText className="w-5 h-5" />,
    FiGitBranch: <FiGitBranch className="w-5 h-5" />,
    FiShield: <FiShield className="w-5 h-5" />,
    FiZap: <FiZap className="w-5 h-5" />,
    FiClipboard: <FiClipboard className="w-5 h-5" />,
    FiPlay: <FiPlay className="w-5 h-5" />,
    FiBookOpen: <FiBookOpen className="w-5 h-5" />,
  };
  return icons[iconName] || <FiBookOpen className="w-5 h-5" />;
}

function getCategoryColorClass(color: string) {
  const colors: Record<string, string> = {
    blue: 'bg-green-50 text-green-600 border-green-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    indigo: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-teal-50 text-teal-600 border-teal-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
  };
  return colors[color] || 'bg-slate-50 text-slate-600 border-slate-200';
}

/* ── Placeholder Tabs ── */

const knowledgeTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
];

function DocsPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="knowledge"
      moduleLabel="Knowledge Base"
      moduleIcon={<FiBookOpen className="w-5 h-5 text-white" />}
      gradientColor="from-green-500 to-cyan-600"
      tabs={knowledgeTabs}
      overviewContent={<DocsContent />}
      children={{}}
    />
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>}>
      <DocsPageContent />
    </Suspense>
  );
}

/* ── Docs Content ── */
function DocsContent() {
  const { user, token } = useAuthStore();
  const canEditDocs = canManageDocs(user?.role || 'employee');

  // State
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [articles, setArticles] = useState<DocArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [accessRules, setAccessRules] = useState<DocAccessRule[]>([]);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);

  // Article editor form state
  const [articleForm, setArticleForm] = useState({
    title: '',
    categoryId: '',
    docType: 'functional',
    moduleKey: '',
    summary: '',
    content: '',
    tags: '',
    status: 'published',
    version: '1.0',
    slug: '',
  });

  // Category editor form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'FiBookOpen',
    color: 'blue',
  });

  // Access panel state
  const [newAccessRole, setNewAccessRole] = useState('');
  const [newAccessType, setNewAccessType] = useState('read');

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/docs/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {
      toast.error('Failed to fetch categories');
    }
  }, [token]);

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedDocType) params.set('docType', selectedDocType);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/docs/articles?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch {
      toast.error('Failed to fetch articles');
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedCategory, selectedDocType, searchQuery]);

  // Fetch access rules for an article
  const fetchAccessRules = useCallback(async (articleId: string) => {
    if (!token || !canEditDocs) return;
    try {
      const res = await fetch(`/api/docs/access?articleId=${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccessRules(data);
      }
    } catch {
      toast.error('Failed to fetch access rules');
    }
  }, [token, canEditDocs]);

  // Load article detail
  const loadArticle = useCallback(async (articleId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/docs/articles/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to load article');
      }
    } catch {
      toast.error('Failed to load article');
    }
  }, [token]);

  // Auto-initialize docs hub if categories are empty
  const autoInitialize = useCallback(async () => {
    if (!token) return;
    setIsInitializing(true);
    setInitAttempted(true);
    try {
      const res = await fetch('/api/docs/init', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.initialized && (data.articlesCreated > 0 || data.totalArticles > 0)) {
          toast.success(`Documentation Hub initialized: ${data.categories} categories, ${data.totalArticles || data.articlesCreated} articles`);
        }
      }
    } catch {
      // Silently fail - user can try manual seed later
    } finally {
      setIsInitializing(false);
    }
  }, [token]);

  // Fetch categories on mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchCategories();
  }, [fetchCategories]);

  // Auto-initialize when categories come back empty
  useEffect(() => {
    if (!isLoading && categories.length === 0 && token && !initAttempted) {
      autoInitialize().then(() => {
        fetchCategories();
        fetchArticles();
      });
    }
  }, [categories.length, isLoading, token, initAttempted, autoInitialize, fetchCategories, fetchArticles]);

  // Fetch articles when filters change
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchArticles();
  }, [fetchArticles]);

  // Filtered articles by doc type (client-side for instant feedback)
  const displayArticles = useMemo(() => {
    if (!selectedDocType) return articles;
    return articles.filter(a => a.docType === selectedDocType);
  }, [articles, selectedDocType]);

  // Handlers
  const handleSaveCategory = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/docs/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(categoryForm),
      });
      if (res.ok) {
        toast.success('Category created successfully');
        setShowCategoryEditor(false);
        setCategoryForm({ name: '', slug: '', description: '', icon: 'FiBookOpen', color: 'blue' });
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create category');
      }
    } catch {
      toast.error('Failed to create category');
    }
  };

  const handleSaveArticle = async () => {
    if (!token) return;
    const isEditing = !!editingArticle;
    const url = isEditing ? `/api/docs/articles/${editingArticle.id}` : '/api/docs/articles';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(articleForm),
      });
      if (res.ok) {
        toast.success(isEditing ? 'Article updated successfully' : 'Article created successfully');
        setShowArticleEditor(false);
        setEditingArticle(null);
        setArticleForm({ title: '', categoryId: '', docType: 'functional', moduleKey: '', summary: '', content: '', tags: '', status: 'published', version: '1.0', slug: '' });
        fetchArticles();
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save article');
      }
    } catch {
      toast.error('Failed to save article');
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/docs/articles/${articleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Article deleted');
        setSelectedArticle(null);
        fetchArticles();
        fetchCategories();
      } else {
        toast.error('Failed to delete article');
      }
    } catch {
      toast.error('Failed to delete article');
    }
  };

  const handleSeedData = async () => {
    if (!token) return;
    try {
      toast.loading('Seeding documentation data...');
      const res = await fetch('/api/docs/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.dismiss();
      if (res.ok) {
        const data = await res.json();
        toast.success(`Seeded: ${data.categories} categories, ${data.articlesCreated} articles, ${data.accessRulesCreated} access rules`);
        fetchCategories();
        fetchArticles();
      } else {
        toast.error('Failed to seed data');
      }
    } catch {
      toast.dismiss();
      toast.error('Failed to seed data');
    }
  };

  const handleAddAccessRule = async () => {
    if (!token || !selectedArticle || !newAccessRole) return;
    try {
      const res = await fetch('/api/docs/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          articleId: selectedArticle.id,
          role: newAccessRole,
          accessType: newAccessType,
        }),
      });
      if (res.ok) {
        toast.success('Access rule added');
        setNewAccessRole('');
        fetchAccessRules(selectedArticle.id);
        loadArticle(selectedArticle.id);
      } else {
        toast.error('Failed to add access rule');
      }
    } catch {
      toast.error('Failed to add access rule');
    }
  };

  const handleDeleteAccessRule = async (ruleId: string) => {
    if (!token || !selectedArticle) return;
    try {
      const res = await fetch(`/api/docs/access?id=${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Access rule removed');
        fetchAccessRules(selectedArticle.id);
        loadArticle(selectedArticle.id);
      } else {
        toast.error('Failed to remove access rule');
      }
    } catch {
      toast.error('Failed to remove access rule');
    }
  };

  const handleMakePublic = async () => {
    if (!token || !selectedArticle) return;
    try {
      const res = await fetch(`/api/docs/access?articleId=${selectedArticle.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Article is now public');
        fetchAccessRules(selectedArticle.id);
        loadArticle(selectedArticle.id);
      }
    } catch {
      toast.error('Failed to make article public');
    }
  };

  const handleMakeRestricted = async () => {
    if (!token || !selectedArticle) return;
    // Add rules for hr_admin and above
    const rulesToAdd = ['tenant_admin', 'super_admin'];
    for (const role of rulesToAdd) {
      try {
        await fetch('/api/docs/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ articleId: selectedArticle.id, role, accessType: 'read' }),
        });
      } catch { /* continue */ }
    }
    toast.success('Article restricted to HR Admin+');
    fetchAccessRules(selectedArticle.id);
    loadArticle(selectedArticle.id);
  };

  const openEditor = (article?: ArticleDetail) => {
    if (article) {
      setEditingArticle(article);
      setArticleForm({
        title: article.title,
        categoryId: article.category?.slug || '',
        docType: article.docType,
        moduleKey: article.moduleKey || '',
        summary: article.summary || '',
        content: article.content,
        tags: article.tags || '',
        status: article.status,
        version: article.version,
        slug: article.slug,
      });
    } else {
      setEditingArticle(null);
      setArticleForm({ title: '', categoryId: '', docType: 'functional', moduleKey: '', summary: '', content: '', tags: '', status: 'published', version: '1.0', slug: '' });
    }
    setShowArticleEditor(true);
  };

  const openAccessPanel = (article: ArticleDetail) => {
    setSelectedArticle(article);
    setShowAccessPanel(true);
    fetchAccessRules(article.id);
  };

  // Slug generation
  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const breadcrumb = selectedArticle
    ? [
        { label: 'Docs', onClick: () => setSelectedArticle(null) },
        { label: selectedArticle.category?.name || '', onClick: () => { setSelectedArticle(null); setSelectedCategory(selectedArticle.category?.slug || null); } },
        { label: selectedArticle.title, onClick: () => {} },
      ]
    : selectedCategory
    ? [
        { label: 'Docs', onClick: () => setSelectedCategory(null) },
        { label: categories.find(c => c.slug === selectedCategory)?.name || '', onClick: () => {} },
      ]
    : [{ label: 'Documentation Hub', onClick: () => {} }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="thb-card p-6 bg-gradient-to-r from-teal-500 to-teal-600 border-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <FiBookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Documentation Hub</h1>
              <p className="text-teal-100 mt-0.5 text-sm">Knowledge base, SOPs, training & technical docs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditDocs && (
              <>
                <button
                  onClick={async () => { await autoInitialize(); fetchCategories(); fetchArticles(); }}
                  className="px-3 py-2 rounded-lg bg-white/15 text-white text-sm font-medium hover:bg-white/25 transition-colors backdrop-blur-sm border border-white/20"
                >
                  {isInitializing ? 'Initializing...' : 'Seed Data'}
                </button>
                <button
                  onClick={() => setShowCategoryEditor(true)}
                  className="px-3 py-2 rounded-lg bg-white/15 text-white text-sm font-medium hover:bg-white/25 transition-colors backdrop-blur-sm border border-white/20 flex items-center gap-1.5"
                >
                  <FiPlus className="w-4 h-4" /> Category
                </button>
                <button
                  onClick={() => openEditor()}
                  className="px-3 py-2 rounded-lg bg-white text-teal-600 text-sm font-bold hover:bg-white/90 transition-colors shadow-lg flex items-center gap-1.5"
                >
                  <FiPlus className="w-4 h-4" /> Article
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <FiChevronRight className="w-3.5 h-3.5 text-thb-text-muted" />}
            {i < breadcrumb.length - 1 ? (
              <button onClick={item.onClick} className="text-thb-text-secondary hover:text-teal-600 transition-colors">
                {item.label}
              </button>
            ) : (
              <span className="text-thb-text-primary font-medium">{item.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className="w-64 flex-shrink-0 hidden lg:block">
          <div className="thb-card p-4 space-y-4 sticky top-6">
            {/* Search */}
            <div className="relative">
              <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted" />
              <input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-thb-text-muted mb-2">Categories</h3>
              <div className="space-y-0.5 max-h-72 overflow-y-auto">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedCategory
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-thb-text-secondary hover:bg-slate-50'
                  }`}
                >
                  <FiLayers className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">All Categories</span>
                  <span className="text-xs text-thb-text-muted">{articles.length}</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.slug
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-thb-text-secondary hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center border flex-shrink-0 ${getCategoryColorClass(cat.color)}`}>
                      {getCategoryIcon(cat.icon)}
                    </span>
                    <span className="flex-1 text-left truncate">{cat.name}</span>
                    <span className="text-xs text-thb-text-muted">{cat.articleCount}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Doc Type Filter */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-thb-text-muted mb-2">Document Type</h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedDocType(null)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    !selectedDocType
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {Object.entries(docTypeConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedDocType(selectedDocType === key ? null : key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      selectedDocType === key
                        ? config.color
                        : 'bg-slate-100 text-thb-text-secondary hover:bg-slate-200'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Area */}
        <div className="flex-1 min-w-0">
          {/* Mobile search + filters */}
          <div className="lg:hidden mb-4 space-y-3">
            <div className="relative">
              <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-thb-text-muted" />
              <input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  !selectedCategory ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-thb-text-secondary'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedCategory === cat.slug ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-thb-text-secondary'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Editor (inline) */}
          {showCategoryEditor && (
            <div className="thb-card p-6 mb-6 border-teal-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-thb-text-primary">New Category</h3>
                <button onClick={() => setShowCategoryEditor(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-thb-text-muted">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Name *</label>
                  <input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value, slug: generateSlug(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g., API Documentation"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Slug *</label>
                  <input
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g., api-documentation"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Description</label>
                  <input
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Brief description of this category"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Color</label>
                  <select
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {['blue', 'green', 'indigo', 'red', 'purple', 'amber', 'teal'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Icon</label>
                  <select
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {['FiBookOpen', 'FiCode', 'FiFileText', 'FiGitBranch', 'FiShield', 'FiZap', 'FiClipboard', 'FiPlay'].map(i => (
                      <option key={i} value={i}>{i.replace('Fi', '')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowCategoryEditor(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  disabled={!categoryForm.name || !categoryForm.slug}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Category
                </button>
              </div>
            </div>
          )}

          {/* Article Editor (inline) */}
          {showArticleEditor && (
            <div className="thb-card p-6 mb-6 border-teal-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-thb-text-primary">{editingArticle ? 'Edit Article' : 'New Article'}</h3>
                <button onClick={() => { setShowArticleEditor(false); setEditingArticle(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-thb-text-muted">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Title *</label>
                  <input
                    value={articleForm.title}
                    onChange={(e) => setArticleForm(f => ({ ...f, title: e.target.value, slug: editingArticle ? f.slug : generateSlug(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Article title"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Slug *</label>
                  <input
                    value={articleForm.slug}
                    onChange={(e) => setArticleForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="url-friendly-slug"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Category *</label>
                  <select
                    value={articleForm.categoryId}
                    onChange={(e) => setArticleForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Doc Type</label>
                  <select
                    value={articleForm.docType}
                    onChange={(e) => setArticleForm(f => ({ ...f, docType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {Object.entries(docTypeConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Module</label>
                  <select
                    value={articleForm.moduleKey}
                    onChange={(e) => setArticleForm(f => ({ ...f, moduleKey: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">None</option>
                    {moduleKeys.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Summary</label>
                  <textarea
                    value={articleForm.summary}
                    onChange={(e) => setArticleForm(f => ({ ...f, summary: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
                    placeholder="Brief summary of the article"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Content (Markdown) *</label>
                  <textarea
                    value={articleForm.content}
                    onChange={(e) => setArticleForm(f => ({ ...f, content: e.target.value }))}
                    rows={12}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-y"
                    placeholder="# Title&#10;&#10;Write your content in Markdown..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Tags (comma-separated)</label>
                  <input
                    value={articleForm.tags}
                    onChange={(e) => setArticleForm(f => ({ ...f, tags: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g., payroll, setup, guide"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Status</label>
                    <select
                      value={articleForm.status}
                      onChange={(e) => setArticleForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-thb-text-secondary mb-1 block">Version</label>
                    <input
                      value={articleForm.version}
                      onChange={(e) => setArticleForm(f => ({ ...f, version: e.target.value }))}
                      className="w-24 px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="1.0"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowArticleEditor(false); setEditingArticle(null); }} className="px-4 py-2 rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  onClick={handleSaveArticle}
                  disabled={!articleForm.title || !articleForm.slug || !articleForm.categoryId || !articleForm.content}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingArticle ? 'Update Article' : 'Create Article'}
                </button>
              </div>
            </div>
          )}

          {/* Access Panel (inline) */}
          {showAccessPanel && selectedArticle && (
            <div className="thb-card p-6 mb-6 border-teal-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-thb-text-primary flex items-center gap-2">
                  <FiLock className="w-5 h-5 text-teal-600" /> Manage Access — {selectedArticle.title}
                </h3>
                <button onClick={() => setShowAccessPanel(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-thb-text-muted">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Current Rules */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-thb-text-primary mb-2">Current Access Rules</h4>
                {accessRules.length === 0 ? (
                  <div className="text-sm text-thb-text-muted py-3 text-center bg-green-50 rounded-lg border border-green-200">
                    <FiUnlock className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    This article is <strong>public</strong> — visible to all roles
                  </div>
                ) : (
                  <div className="border border-thb-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-thb-text-secondary">Type</th>
                          <th className="text-left px-3 py-2 font-medium text-thb-text-secondary">Target</th>
                          <th className="text-left px-3 py-2 font-medium text-thb-text-secondary">Access</th>
                          <th className="text-right px-3 py-2 font-medium text-thb-text-secondary">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessRules.map(rule => (
                          <tr key={rule.id} className="border-t border-thb-border">
                            <td className="px-3 py-2">
                              {rule.role ? (
                                <span className="flex items-center gap-1.5"><FiUsers className="w-3.5 h-3.5 text-thb-text-muted" /> Role</span>
                              ) : (
                                <span className="flex items-center gap-1.5"><FiUser className="w-3.5 h-3.5 text-thb-text-muted" /> User</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className="thb-badge capitalize">{(rule.role || rule.userId || '').replace('_', ' ')}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`thb-badge ${rule.accessType === 'manage' ? 'thb-badge-info' : rule.accessType === 'edit' ? 'thb-badge-warning' : 'thb-badge-success'}`}>
                                {rule.accessType}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleDeleteAccessRule(rule.id)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                                title="Remove rule"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mb-6">
                <button onClick={handleMakePublic} className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 border border-green-200 flex items-center gap-1.5">
                  <FiUnlock className="w-4 h-4" /> Make Public
                </button>
                <button onClick={handleMakeRestricted} className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5">
                  <FiLock className="w-4 h-4" /> Restrict to HR Admin+
                </button>
              </div>

              {/* Add Role Access */}
              <div>
                <h4 className="text-sm font-semibold text-thb-text-primary mb-2">Add Role Access</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={newAccessRole}
                    onChange={(e) => setNewAccessRole(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Select role...</option>
                    {roles.map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                  <select
                    value={newAccessType}
                    onChange={(e) => setNewAccessType(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="read">Read</option>
                    <option value="edit">Edit</option>
                    <option value="manage">Manage</option>
                  </select>
                  <button
                    onClick={handleAddAccessRule}
                    disabled={!newAccessRole}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <FiPlus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Article Detail View */}
          {selectedArticle && !showAccessPanel ? (
            <div className="thb-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setSelectedArticle(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-thb-text-muted">
                      <FiArrowLeft className="w-4 h-4" />
                    </button>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 ${docTypeConfig[selectedArticle.docType]?.color || 'bg-slate-100 text-slate-700'}`}>
                      {docTypeConfig[selectedArticle.docType]?.icon}
                      {docTypeConfig[selectedArticle.docType]?.label || selectedArticle.docType}
                    </span>
                    {selectedArticle.isRestricted ? (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                        <FiLock className="w-3 h-3" /> Restricted
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                        <FiUnlock className="w-3 h-3" /> Public
                      </span>
                    )}
                    {selectedArticle.status === 'draft' && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700">Draft</span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-thb-text-primary">{selectedArticle.title}</h1>
                  <div className="flex items-center gap-3 mt-2 text-xs text-thb-text-muted">
                    <span className="flex items-center gap-1"><FiEye className="w-3.5 h-3.5" /> {selectedArticle.viewCount} views</span>
                    <span>v{selectedArticle.version}</span>
                    <span>{new Date(selectedArticle.updatedAt).toLocaleDateString()}</span>
                    {selectedArticle.moduleKey && (
                      <span className="flex items-center gap-1"><FiHash className="w-3.5 h-3.5" /> {selectedArticle.moduleKey}</span>
                    )}
                  </div>
                </div>
                {canEditDocs && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openAccessPanel(selectedArticle)}
                      className="p-2 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"
                      title="Manage Access"
                    >
                      <FiLock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditor(selectedArticle)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-thb-text-muted transition-colors"
                      title="Edit Article"
                    >
                      <FiEdit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(selectedArticle.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      title="Delete Article"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedArticle.tags && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedArticle.tags.split(',').map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-thb-text-secondary text-xs">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div
                className="docs-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArticle.content || '') }}
              />
            </div>
          ) : !showArticleEditor && !showCategoryEditor && !showAccessPanel ? (
            /* Article List View */
            <>
              {isLoading || isInitializing ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="thb-card p-5 animate-pulse">
                      <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
                      <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                      <div className="h-4 bg-slate-100 rounded w-2/3" />
                    </div>
                  ))}
                  {isInitializing && (
                    <div className="thb-card p-6 text-center border-teal-200">
                      <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-thb-text-secondary font-medium">Initializing Documentation Hub...</p>
                      <p className="text-xs text-thb-text-muted mt-1">Creating tables and seeding sample documentation</p>
                    </div>
                  )}
                </div>
              ) : displayArticles.length === 0 ? (
                <div className="thb-card p-12 text-center">
                  <FiBookOpen className="w-12 h-12 text-thb-text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-thb-text-primary mb-1">No articles found</h3>
                  <p className="text-thb-text-muted text-sm mb-4">
                    {searchQuery ? 'Try adjusting your search query' : 'No documentation articles match your current filters'}
                  </p>
                  {canEditDocs && (
                    <button
                      onClick={async () => { await autoInitialize(); fetchCategories(); fetchArticles(); }}
                      className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
                    >
                      Initialize Documentation Hub
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayArticles.map(article => {
                    const dtConfig = docTypeConfig[article.docType] || { label: article.docType, color: 'bg-slate-100 text-slate-700', icon: null };
                    return (
                      <button
                        key={article.id}
                        onClick={() => loadArticle(article.id)}
                        className="thb-card thb-card-hover p-5 text-left group cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 ${dtConfig.color}`}>
                              {dtConfig.icon} {dtConfig.label}
                            </span>
                            {article.isRestricted ? (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-600 flex items-center gap-1">
                                <FiLock className="w-3 h-3" /> Restricted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-600 flex items-center gap-1">
                                <FiUnlock className="w-3 h-3" /> Public
                              </span>
                            )}
                            {article.moduleKey && (
                              <span className="px-2 py-0.5 rounded-md text-xs bg-slate-50 text-thb-text-muted flex items-center gap-1">
                                <FiHash className="w-3 h-3" /> {article.moduleKey}
                              </span>
                            )}
                          </div>
                          {canEditDocs && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => loadArticle(article.id).then(() => {
                                  if (selectedArticle) openAccessPanel(selectedArticle);
                                })}
                                className="p-1.5 rounded hover:bg-teal-50 text-teal-500"
                                title="Manage Access"
                              >
                                <FiLock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-thb-text-primary group-hover:text-teal-600 transition-colors mb-1.5 line-clamp-2">
                          {article.title}
                        </h3>
                        {article.summary && (
                          <p className="text-xs text-thb-text-muted line-clamp-2 mb-3">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-thb-text-muted">
                          <span className="flex items-center gap-1">
                            <FiEye className="w-3.5 h-3.5" /> {article.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${getCategoryColorClass(article.category?.color || 'blue').split(' ')[0]}`} />
                            {article.category?.name}
                          </span>
                        </div>
                        {/* Tags */}
                        {article.tags && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {article.tags.split(',').slice(0, 3).map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-50 text-thb-text-muted text-[10px]">
                                {tag.trim()}
                              </span>
                            ))}
                            {article.tags.split(',').length > 3 && (
                              <span className="text-[10px] text-thb-text-muted">+{article.tags.split(',').length - 3} more</span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
