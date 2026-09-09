'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import {
  FiUsers,
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiSmile,
  FiPaperclip,
  FiImage,
  FiHash,
  FiTrendingUp,
  FiAward,
  FiCalendar,
  FiGift,
  FiUserPlus,
  FiClock,
  FiMapPin,
  FiSend,
  FiZap,
  FiFlag,
  FiPlus,
  FiX,
  FiSpeaker,
  FiCoffee,
  FiBriefcase,
  FiLoader,
} from 'react-icons/fi';

/* ── Auth headers helper ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface Author {
  name: string;
  role: string;
  initials: string;
  gradient: string;
}

interface Comment {
  id: string;
  author: Author;
  text: string;
  time: string;
  likes: number;
}

interface Post {
  id: string;
  author: Author;
  time: string;
  content: string;
  imageGradient?: string;
  imageLabel?: string;
  tags?: string[];
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
  isPinned?: boolean;
  type: 'announcement' | 'achievement' | 'birthday' | 'welcome' | 'policy' | 'event' | 'general';
  commentList?: Comment[];
}

interface TrendingTopic {
  id: string;
  title: string;
  posts: number;
}

interface Hashtag {
  id: string;
  tag: string;
  count: number;
}

interface ActiveMember {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  posts: number;
}

interface Announcement {
  id: string;
  title: string;
  time: string;
  type: 'urgent' | 'info' | 'policy';
}

interface BirthdayPerson {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  date: string;
  department: string;
}

interface AnniversaryPerson {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  years: number;
  role: string;
}

interface NewJoiner {
  id: string;
  name: string;
  initials: string;
  gradient: string;
  role: string;
  department: string;
  joinDate: string;
}

/* ── API SocialPost shape ── */
interface SocialPost {
  id: string;
  content: string;
  postType: string;
  authorId: string;
  author: { id: string; firstName: string; lastName: string; avatar: string; designation?: { name: string } };
  companyId?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  attachments?: any[];
  hashtags?: string[];
  isPinned: boolean;
  isActive: boolean;
  comments: SocialComment[];
  createdAt: string;
  updatedAt: string;
}

interface SocialComment {
  id: string;
  content: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; avatar: string; designation?: { name: string } };
  likesCount: number;
  createdAt: string;
}

/* ── Helper: Gradient from name (deterministic) ── */
const GRADIENTS = [
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-green-500 to-cyan-600',
  'from-teal-500 to-teal-600',
  'from-fuchsia-500 to-pink-600',
  'from-sky-500 to-green-600',
  'from-slate-600 to-gray-700',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-green-600',
  'from-lime-500 to-green-600',
  'from-amber-400 to-yellow-500',
  'from-teal-400 to-cyan-500',
  'from-orange-400 to-red-500',
  'from-rose-400 to-pink-500',
  'from-fuchsia-600 to-pink-700',
  'from-green-600 to-emerald-700',
  'from-emerald-600 to-teal-700',
  'from-green-500 to-emerald-600',
  'from-cyan-500 via-green-500 to-emerald-600',
];

function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function initialsForName(firstName: string, lastName: string): string {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '??';
}

/* ── Helper: Time ago utility ── */
function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 60000) return 'Just now';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  return `${diffWk}w ago`;
}

/* ── Map API SocialPost → UI Post ── */
function mapApiPostToPost(sp: SocialPost): Post {
  const authorName = `${sp.author?.firstName || ''} ${sp.author?.lastName || ''}`.trim() || 'Unknown';
  const authorRole = sp.author?.designation?.name || 'Employee';
  const authorInitials = initialsForName(sp.author?.firstName || '', sp.author?.lastName || '');
  const authorGradient = gradientForName(authorName);

  const postType = (['announcement', 'achievement', 'birthday', 'welcome', 'policy', 'event', 'general'].includes(sp.postType)
    ? sp.postType
    : 'general') as Post['type'];

  return {
    id: sp.id,
    author: { name: authorName, role: authorRole, initials: authorInitials, gradient: authorGradient },
    time: formatTimeAgo(sp.createdAt),
    content: sp.content,
    tags: sp.hashtags && sp.hashtags.length > 0 ? sp.hashtags : undefined,
    likes: sp.likesCount || 0,
    comments: sp.commentsCount || 0,
    shares: sp.sharesCount || 0,
    isLiked: false,
    isPinned: sp.isPinned,
    type: postType,
    commentList: (sp.comments || []).map((c: SocialComment) => {
      const cName = c.author ? `${c.author.firstName || ''} ${c.author.lastName || ''}`.trim() : 'Unknown';
      const cRole = c.author?.designation?.name || '';
      return {
        id: c.id,
        author: { name: cName, role: cRole, initials: initialsForName(c.author?.firstName || '', c.author?.lastName || ''), gradient: gradientForName(cName) },
        text: c.content,
        time: formatTimeAgo(c.createdAt),
        likes: c.likesCount || 0,
      };
    }),
  };
}

/* ── Sub-Components ── */

function AvatarCircle({ initials, gradient, size = 'md' }: { initials: string; gradient: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
  };
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-sm shrink-0`}>
      {initials}
    </div>
  );
}

function PostTypeBadge({ type }: { type: Post['type'] }) {
  const config: Record<Post['type'], { label: string; icon: React.ReactNode; className: string }> = {
    announcement: { label: 'Announcement', icon: <FiSpeaker className="w-3 h-3" />, className: 'bg-green-50 text-green-700 border-green-200' },
    achievement: { label: 'Achievement', icon: <FiAward className="w-3 h-3" />, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    birthday: { label: 'Birthday', icon: <FiGift className="w-3 h-3" />, className: 'bg-pink-50 text-pink-700 border-pink-200' },
    welcome: { label: 'Welcome', icon: <FiUserPlus className="w-3 h-3" />, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    policy: { label: 'Policy', icon: <FiFlag className="w-3 h-3" />, className: 'bg-slate-50 text-slate-700 border-slate-200' },
    event: { label: 'Event', icon: <FiCalendar className="w-3 h-3" />, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    general: { label: 'General', icon: <FiCoffee className="w-3 h-3" />, className: 'bg-gray-50 text-gray-700 border-gray-200' },
  };
  const c = config[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}

/* ── Main Page Component ── */
export default function SocialFeedPage() {
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyContextStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  /* ── Fetch posts from API ── */
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/social-feed?type=general&limit=50', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch posts');
      const data = await res.json();
      const apiPosts: SocialPost[] = data.posts || [];
      setPosts(apiPosts.filter((p: SocialPost) => p.isActive !== false).map(mapApiPostToPost));
    } catch (err) {
      console.error('fetchPosts error:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  /* ── Compute sidebar data from posts ── */
  const { computedTrending, computedHashtags, computedActiveMembers, computedAnnouncements, computedBirthdays, computedAnniversaries, computedNewJoiners } = useMemo(() => {
    // Hashtags from all posts
    const tagMap = new Map<string, number>();
    posts.forEach(p => (p.tags || []).forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
    const computedHashtags: Hashtag[] = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count], i) => ({ id: `ht-${i}`, tag, count }));

    // Trending topics from hashtags
    const computedTrending: TrendingTopic[] = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, posts], i) => ({ id: `tt-${i}`, title: title.startsWith('#') ? title.slice(1).replace(/([A-Z])/g, ' $1').trim() : title, posts }));

    // Active members - count posts per author
    const authorMap = new Map<string, { name: string; initials: string; gradient: string; count: number }>();
    posts.forEach(p => {
      const existing = authorMap.get(p.author.name);
      if (existing) existing.count++;
      else authorMap.set(p.author.name, { name: p.author.name, initials: p.author.initials, gradient: p.author.gradient, count: 1 });
    });
    const computedActiveMembers: ActiveMember[] = Array.from(authorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((m, i) => ({ id: `am-${i}`, name: m.name, initials: m.initials, gradient: m.gradient, posts: m.count }));

    // Announcements from posts
    const computedAnnouncements: Announcement[] = posts
      .filter(p => p.type === 'announcement' || p.type === 'policy')
      .slice(0, 4)
      .map((p, i) => ({
        id: p.id,
        title: p.content.length > 60 ? p.content.slice(0, 60) + '...' : p.content,
        time: p.time,
        type: p.type === 'policy' ? 'policy' as const : 'info' as const,
      }));

    // Birthdays from posts
    const computedBirthdays: BirthdayPerson[] = posts
      .filter(p => p.type === 'birthday')
      .slice(0, 3)
      .map((p, i) => ({
        id: p.id,
        name: p.author.name,
        initials: p.author.initials,
        gradient: p.author.gradient,
        date: p.time,
        department: p.author.role,
      }));

    // Anniversaries from achievement posts
    const computedAnniversaries: AnniversaryPerson[] = posts
      .filter(p => p.type === 'achievement' && (p.content.toLowerCase().includes('year') || p.content.toLowerCase().includes('anniversar')))
      .slice(0, 3)
      .map((p, i) => ({
        id: p.id,
        name: p.author.name,
        initials: p.author.initials,
        gradient: p.author.gradient,
        years: parseInt(p.content.match(/(\d+)\s+year/i)?.[1] || '1', 10),
        role: p.author.role,
      }));

    // New joiners from welcome posts
    const computedNewJoiners: NewJoiner[] = posts
      .filter(p => p.type === 'welcome')
      .slice(0, 3)
      .map((p, i) => ({
        id: p.id,
        name: p.author.name,
        initials: p.author.initials,
        gradient: p.author.gradient,
        role: p.author.role,
        department: p.author.role,
        joinDate: 'Recently',
      }));

    return { computedTrending, computedHashtags, computedActiveMembers, computedAnnouncements, computedBirthdays, computedAnniversaries, computedNewJoiners };
  }, [posts]);

  const toggleLike = useCallback(async (postId: string) => {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
        : p
    ));
    try {
      await fetch('/api/social-feed', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: postId, action: 'like' }),
      });
    } catch (err) {
      console.error('toggleLike error:', err);
      // Revert on failure
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      ));
    }
  }, []);

  const toggleComments = useCallback((postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const handleAddComment = useCallback(async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    const currentUser = user;
    const authorName = currentUser?.name || 'You';
    const authorInitials = initialsForName(currentUser?.employee?.firstName || '', currentUser?.employee?.lastName || '');
    const authorGradient = gradientForName(authorName);

    // Optimistic: add comment locally
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? {
            ...p,
            comments: p.comments + 1,
            commentList: [...(p.commentList || []), {
              id: `c-new-${Date.now()}`,
              author: { name: authorName, role: currentUser?.employee?.designation || 'Employee', initials: authorInitials, gradient: authorGradient },
              text,
              time: 'Just now',
              likes: 0,
            }],
          }
        : p
    ));
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));

    try {
      await fetch('/api/social-feed', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: postId, action: 'comment', commentContent: text }),
      });
    } catch (err) {
      console.error('handleAddComment error:', err);
    }
  }, [commentInputs, user]);

  const handleCreatePost = useCallback(async () => {
    if (!composerText.trim()) return;
    const currentUser = user;
    const authorName = currentUser?.name || 'You';
    const authorInitials = initialsForName(currentUser?.employee?.firstName || '', currentUser?.employee?.lastName || '');
    const authorGradient = gradientForName(authorName);

    const newPost: Post = {
      id: `new-${Date.now()}`,
      author: { name: authorName, role: currentUser?.employee?.designation || 'Employee', initials: authorInitials, gradient: authorGradient },
      time: 'Just now',
      content: composerText.trim(),
      likes: 0,
      comments: 0,
      shares: 0,
      type: 'general',
      commentList: [],
    };
    // Optimistic: add to top
    setPosts(prev => [newPost, ...prev]);
    setComposerText('');
    setShowCreatePostModal(false);

    try {
      const res = await fetch('/api/social-feed', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: newPost.content,
          postType: 'general',
          companyId: selectedCompanyId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Replace optimistic post with real one from API
        if (data.post) {
          setPosts(prev => prev.map(p => p.id === newPost.id ? mapApiPostToPost(data.post) : p));
        }
      }
    } catch (err) {
      console.error('handleCreatePost error:', err);
    }
  }, [composerText, user, selectedCompanyId]);

  const handleDeletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await fetch(`/api/social-feed?id=${postId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error('handleDeletePost error:', err);
    }
  }, []);

  // Current user info for avatar display
  const currentUserInitials = user ? initialsForName(user.employee?.firstName || '', user.employee?.lastName || '') : 'YO';
  const currentUserGradient = user ? gradientForName(user.name || 'You') : 'from-green-500 to-teal-600';

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <FiUsers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-thb-text-primary">Social Feed</h1>
            <p className="text-sm text-thb-text-secondary">Stay connected with your team and company updates</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreatePostModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <FiPlus className="w-4 h-4" /> Create Post
        </button>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr_288px] gap-6">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="space-y-5 hidden lg:block">
          {/* Trending Topics */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiTrendingUp className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Trending Topics</h3>
            </div>
            <div className="space-y-3">
              {computedTrending.length > 0 ? computedTrending.map((topic, idx) => (
                <div key={topic.id} className="flex items-start gap-3 group cursor-pointer">
                  <span className="text-xs font-bold text-thb-text-muted w-5 shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-thb-text-primary font-medium group-hover:text-green-600 transition-colors truncate">{topic.title}</p>
                    <p className="text-[11px] text-thb-text-muted">{topic.posts} posts</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No trending topics yet</p>
              )}
            </div>
          </div>

          {/* Popular Hashtags */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiHash className="w-4 h-4 text-teal-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Popular Hashtags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {computedHashtags.length > 0 ? computedHashtags.map(ht => (
                <span
                  key={ht.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-green-50 text-xs font-medium text-thb-text-secondary hover:text-green-600 border border-transparent hover:border-green-200 transition-all cursor-pointer"
                >
                  <FiHash className="w-2.5 h-2.5" />
                  {ht.tag.startsWith('#') ? ht.tag.slice(1) : ht.tag}
                  <span className="text-thb-text-muted ml-0.5">({ht.count})</span>
                </span>
              )) : (
                <p className="text-xs text-thb-text-muted">No hashtags yet</p>
              )}
            </div>
          </div>

          {/* Active Members */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiZap className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Active Members</h3>
            </div>
            <div className="space-y-3">
              {computedActiveMembers.length > 0 ? computedActiveMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3 group cursor-pointer">
                  <AvatarCircle initials={member.initials} gradient={member.gradient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-thb-text-primary font-medium group-hover:text-green-600 transition-colors truncate">{member.name}</p>
                    <p className="text-[11px] text-thb-text-muted">{member.posts} posts this week</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No active members yet</p>
              )}
            </div>
          </div>
        </aside>

        {/* ── MAIN FEED ── */}
        <div className="space-y-5 min-w-0">
          {/* Post Composer */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-start gap-3">
              <AvatarCircle initials={currentUserInitials} gradient={currentUserGradient} size="md" />
              <div className="flex-1 min-w-0">
                <textarea
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  placeholder="Share something with your team..."
                  className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-thb-border bg-slate-50/50 text-sm text-thb-text-primary placeholder:text-thb-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-300 transition-all"
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg text-thb-text-muted hover:text-green-600 hover:bg-green-50 transition-all" title="Add image">
                      <FiImage className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg text-thb-text-muted hover:text-teal-600 hover:bg-teal-50 transition-all" title="Add emoji">
                      <FiSmile className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg text-thb-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Attach file">
                      <FiPaperclip className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={!composerText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <FiSend className="w-3.5 h-3.5" /> Post
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Feed Posts */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <FiLoader className="w-8 h-8 text-green-500 animate-spin" />
                <span className="ml-3 text-sm text-thb-text-muted">Loading feed...</span>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FiUsers className="w-12 h-12 text-thb-text-muted mb-3" />
                <p className="text-sm font-medium text-thb-text-primary">No posts yet</p>
                <p className="text-xs text-thb-text-muted mt-1">Be the first to share something with your team!</p>
              </div>
            ) : posts.map(post => (
              <article
                key={post.id}
                className={`bg-thb-card-bg rounded-xl border border-thb-border overflow-hidden transition-shadow hover:shadow-md ${post.isPinned ? 'ring-1 ring-green-200' : ''}`}
              >
                {/* Pinned Indicator */}
                {post.isPinned && (
                  <div className="bg-green-50 px-4 py-1.5 flex items-center gap-2 border-b border-green-100">
                    <FiMapPin className="w-3 h-3 text-green-500" />
                    <span className="text-[11px] font-semibold text-green-600">Pinned Post</span>
                  </div>
                )}

                {/* Post Header */}
                <div className="p-4 pb-0">
                  <div className="flex items-start gap-3">
                    <AvatarCircle initials={post.author.initials} gradient={post.author.gradient} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-thb-text-primary">{post.author.name}</span>
                        <PostTypeBadge type={post.type} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-thb-text-muted">{post.author.role}</span>
                        <span className="text-thb-text-muted">·</span>
                        <span className="text-xs text-thb-text-muted flex items-center gap-1">
                          <FiClock className="w-3 h-3" /> {post.time}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 pt-3">
                  <p className="text-sm text-thb-text-primary leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {/* Image / Gradient Card */}
                  {post.imageGradient && (
                    <div className={`mt-3 rounded-xl bg-gradient-to-br ${post.imageGradient} p-6 min-h-[120px] flex items-center justify-center`}>
                      <p className="text-white font-bold text-center text-base sm:text-lg drop-shadow-md">{post.imageLabel}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {post.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-green-50 text-[11px] font-medium text-green-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="px-4 py-3 mt-2 border-t border-thb-border">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        post.isLiked
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'text-thb-text-secondary hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      <FiHeart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-red-500' : ''}`} />
                      {post.likes > 0 && <span>{post.likes}</span>}
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-green-50 hover:text-green-600 transition-all"
                    >
                      <FiMessageCircle className="w-3.5 h-3.5" />
                      {post.comments > 0 && <span>{post.comments}</span>}
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                      <FiShare2 className="w-3.5 h-3.5" />
                      {post.shares > 0 && <span>{post.shares}</span>}
                    </button>
                  </div>
                </div>

                {/* Comments Section */}
                {expandedComments.has(post.id) && (
                  <div className="border-t border-thb-border bg-slate-50/50">
                    {/* Existing Comments */}
                    {post.commentList && post.commentList.length > 0 && (
                      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                        {post.commentList.map(comment => (
                          <div key={comment.id} className="flex items-start gap-2.5">
                            <AvatarCircle initials={comment.author.initials} gradient={comment.author.gradient} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-thb-text-primary">{comment.author.name}</span>
                                  <span className="text-[10px] text-thb-text-muted">{comment.time}</span>
                                </div>
                                <p className="text-xs text-thb-text-primary mt-0.5 leading-relaxed">{comment.text}</p>
                              </div>
                              <button className="inline-flex items-center gap-1 mt-1 ml-1 text-[10px] text-thb-text-muted hover:text-red-500 transition-colors">
                                <FiHeart className="w-2.5 h-2.5" /> {comment.likes > 0 ? comment.likes : 'Like'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment Input */}
                    <div className="p-4 pt-0">
                      <div className="flex items-center gap-2.5">
                        <AvatarCircle initials={currentUserInitials} gradient={currentUserGradient} size="sm" />
                        <div className="flex-1 flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-green-500/20 focus-within:border-green-300 transition-all">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                            placeholder="Write a comment..."
                            className="flex-1 text-xs text-thb-text-primary placeholder:text-thb-text-muted bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="p-1 rounded text-thb-text-muted hover:text-green-600 transition-colors"
                          >
                            <FiSend className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="space-y-5 hidden lg:block">
          {/* Company Announcements */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiMapPin className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Company Announcements</h3>
            </div>
            <div className="space-y-3">
              {computedAnnouncements.length > 0 ? computedAnnouncements.map(ann => (
                <div key={ann.id} className="flex items-start gap-3 group cursor-pointer">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    ann.type === 'urgent' ? 'bg-red-500' : ann.type === 'policy' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-thb-text-primary font-medium group-hover:text-green-600 transition-colors leading-snug">{ann.title}</p>
                    <p className="text-[11px] text-thb-text-muted mt-0.5">{ann.time}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No announcements</p>
              )}
            </div>
          </div>

          {/* Upcoming Birthdays */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiGift className="w-4 h-4 text-pink-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Upcoming Birthdays</h3>
            </div>
            <div className="space-y-3">
              {computedBirthdays.length > 0 ? computedBirthdays.map(person => (
                <div key={person.id} className="flex items-center gap-3">
                  <AvatarCircle initials={person.initials} gradient={person.gradient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-thb-text-primary font-medium truncate">{person.name}</p>
                    <p className="text-[11px] text-thb-text-muted">{person.department} · {person.date}</p>
                  </div>
                  <span className="text-lg">🎂</span>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No upcoming birthdays</p>
              )}
            </div>
          </div>

          {/* Work Anniversaries */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiAward className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Work Anniversaries</h3>
            </div>
            <div className="space-y-3">
              {computedAnniversaries.length > 0 ? computedAnniversaries.map(person => (
                <div key={person.id} className="flex items-center gap-3">
                  <AvatarCircle initials={person.initials} gradient={person.gradient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-thb-text-primary font-medium truncate">{person.name}</p>
                    <p className="text-[11px] text-thb-text-muted">{person.role}</p>
                  </div>
                  <div className="text-center shrink-0">
                    <span className="block text-sm font-bold text-amber-600">{person.years}</span>
                    <span className="text-[9px] text-thb-text-muted">years</span>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No anniversaries</p>
              )}
            </div>
          </div>

          {/* New Joiners */}
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiUserPlus className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">New Joiners</h3>
            </div>
            <div className="space-y-3">
              {computedNewJoiners.length > 0 ? computedNewJoiners.map(person => (
                <div key={person.id} className="flex items-center gap-3">
                  <div className="relative">
                    <AvatarCircle initials={person.initials} gradient={person.gradient} size="sm" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-thb-text-primary font-medium truncate">{person.name}</p>
                    <p className="text-[11px] text-thb-text-muted">{person.role} · {person.department}</p>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">{person.joinDate}</span>
                </div>
              )) : (
                <p className="text-xs text-thb-text-muted">No new joiners</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Mobile Sidebars (stacked below feed) ── */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Mobile Trending & Hashtags */}
        <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="w-4 h-4 text-green-500" />
            <h3 className="font-semibold text-sm text-thb-text-primary">Trending Topics</h3>
          </div>
          <div className="space-y-2.5">
            {computedTrending.slice(0, 3).map((topic, idx) => (
              <div key={topic.id} className="flex items-start gap-2">
                <span className="text-xs font-bold text-thb-text-muted w-4 shrink-0">{idx + 1}</span>
                <p className="text-sm text-thb-text-primary font-medium">{topic.title}</p>
              </div>
            ))}
            {computedTrending.length === 0 && <p className="text-xs text-thb-text-muted">No trending topics</p>}
          </div>
          <div className="flex items-center gap-2 mt-4 mb-3">
            <FiHash className="w-4 h-4 text-teal-500" />
            <h3 className="font-semibold text-sm text-thb-text-primary">Popular Hashtags</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {computedHashtags.slice(0, 5).map(ht => (
              <span key={ht.id} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-50 text-[11px] font-medium text-thb-text-secondary">
                {ht.tag}
              </span>
            ))}
            {computedHashtags.length === 0 && <p className="text-xs text-thb-text-muted">No hashtags</p>}
          </div>
        </div>

        {/* Mobile Announcements & Events */}
        <div className="space-y-5">
          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiMapPin className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">Announcements</h3>
            </div>
            <div className="space-y-2.5">
              {computedAnnouncements.slice(0, 3).map(ann => (
                <div key={ann.id} className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ann.type === 'urgent' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="text-sm text-thb-text-primary font-medium">{ann.title}</p>
                    <p className="text-[11px] text-thb-text-muted">{ann.time}</p>
                  </div>
                </div>
              ))}
              {computedAnnouncements.length === 0 && <p className="text-xs text-thb-text-muted">No announcements</p>}
            </div>
          </div>

          <div className="bg-thb-card-bg rounded-xl border border-thb-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiUserPlus className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-sm text-thb-text-primary">New Joiners</h3>
            </div>
            <div className="space-y-2.5">
              {computedNewJoiners.map(person => (
                <div key={person.id} className="flex items-center gap-2.5">
                  <AvatarCircle initials={person.initials} gradient={person.gradient} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm text-thb-text-primary font-medium truncate">{person.name}</p>
                    <p className="text-[11px] text-thb-text-muted">{person.role}</p>
                  </div>
                </div>
              ))}
              {computedNewJoiners.length === 0 && <p className="text-xs text-thb-text-muted">No new joiners</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create Post Modal ── */}
      {showCreatePostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreatePostModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-thb-border animate-[slideInRight_0.2s_ease-out]">
            <div className="flex items-center justify-between p-5 border-b border-thb-border">
              <h3 className="font-bold text-thb-text-primary">Create Post</h3>
              <button
                onClick={() => setShowCreatePostModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-thb-text-muted transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <AvatarCircle initials={currentUserInitials} gradient={currentUserGradient} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-thb-text-primary">
                    {user?.name || 'You'}
                  </p>
                  <p className="text-xs text-thb-text-muted">{user?.employee?.designation || 'Employee'}</p>
                </div>
              </div>
              <textarea
                value={composerText}
                onChange={e => setComposerText(e.target.value)}
                placeholder="What's on your mind? Share updates, ideas, or kudos..."
                className="w-full min-h-[150px] mt-4 px-4 py-3 rounded-xl border border-thb-border bg-slate-50/50 text-sm text-thb-text-primary placeholder:text-thb-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-300 transition-all"
                autoFocus
              />
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-thb-border">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-green-50 hover:text-green-600 transition-all">
                  <FiImage className="w-3.5 h-3.5" /> Photo
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-teal-50 hover:text-teal-600 transition-all">
                  <FiSmile className="w-3.5 h-3.5" /> Emoji
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-emerald-50 hover:text-emerald-600 transition-all">
                  <FiPaperclip className="w-3.5 h-3.5" /> File
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-orange-50 hover:text-orange-600 transition-all">
                  <FiBriefcase className="w-3.5 h-3.5" /> Tag
                </button>
              </div>
            </div>
            <div className="p-5 pt-0">
              <button
                onClick={handleCreatePost}
                disabled={!composerText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <FiSend className="w-4 h-4" /> Publish Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
