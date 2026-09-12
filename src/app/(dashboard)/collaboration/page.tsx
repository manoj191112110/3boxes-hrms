'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiMessageCircle, FiVideo, FiCalendar, FiMail, FiCheckSquare,
  FiEdit3, FiUsers, FiFolder, FiLayers, FiFileText, FiDollarSign,
  FiShield, FiLock, FiCpu, FiArrowRight, FiActivity, FiClock,
  FiZap, FiSearch, FiSend, FiPhone, FiStar, FiBookmark,
  FiGrid,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';

interface ModuleTile {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  description: string;
  gradientBg: string;
  iconColor: string;
  ringColor: string;
  badges?: string[];
}

const COMMUNICATION_APPS: ModuleTile[] = [
  {
    title: 'Chat',
    icon: FiMessageCircle,
    route: '/collaboration/chat',
    description: '1:1 and group messaging with threading, AI translation, and inline HR actions',
    gradientBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-500/20',
    badges: ['E2EE for 1:1', 'AI Translate', 'DLP-protected'],
  },
  {
    title: 'Calls',
    icon: FiVideo,
    route: '/collaboration/calls',
    description: 'Native WebRTC audio/video calls with AI transcription and external meeting deep-links',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    badges: ['WebRTC E2EE', 'AI Transcription', 'Meeting links'],
  },
  {
    title: 'Email',
    icon: FiMail,
    route: '/email',
    description: 'Integrated email client with folders, labels, starred messages, and compose functionality',
    gradientBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-500',
    ringColor: 'ring-cyan-500/20',
    badges: ['Inbox', 'Starred', 'Compose'],
  },
];

const PRODUCTIVITY_APPS: ModuleTile[] = [
  {
    title: 'Calendar',
    icon: FiCalendar,
    route: '/calendar',
    description: 'Month/week/day views with meetings, leave, holidays, birthdays, and training events',
    gradientBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-500/20',
    badges: ['Multi-view', 'HR Events', 'Reminders'],
  },
  {
    title: 'To Do',
    icon: FiCheckSquare,
    route: '/todo',
    description: 'Task management with priorities, categories, due dates, and assignment tracking',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    badges: ['Priorities', 'Categories', 'Assignments'],
  },
  {
    title: 'Notes',
    icon: FiEdit3,
    route: '/notes',
    description: 'Rich note-taking with categories, pinning, color coding, and grid/list views',
    gradientBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
    ringColor: 'ring-orange-500/20',
    badges: ['HR Notes', 'Meeting Notes', 'Pinned'],
  },
  {
    title: 'Kanban Board',
    icon: FiLayers,
    route: '/kanban',
    description: 'Visual task boards with drag-friendly columns, priorities, and team collaboration',
    gradientBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-500/20',
    badges: ['Backlog', 'In Progress', 'Done'],
  },
];

const SHARING_APPS: ModuleTile[] = [
  {
    title: 'Social Feed',
    icon: FiUsers,
    route: '/social-feed',
    description: 'Company social feed with posts, reactions, comments, announcements, and milestones',
    gradientBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    ringColor: 'ring-pink-500/20',
    badges: ['Announcements', 'Kudos', 'Polls'],
  },
  {
    title: 'File Manager',
    icon: FiFolder,
    route: '/file-manager',
    description: 'Personal, project, and company drives with versioning, sharing, and DLP scanning',
    gradientBg: 'bg-teal-500/10',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-500/20',
    badges: ['Versioned', 'Shared Drives', 'DLP Scan'],
  },
];

const FINANCE_APPS: ModuleTile[] = [
  {
    title: 'Invoices',
    icon: FiDollarSign,
    route: '/invoices',
    description: 'Create, send, and track invoices with payment records, PDF preview, and status management',
    gradientBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    ringColor: 'ring-rose-500/20',
    badges: ['Create', 'Send', 'Track'],
  },
];

const ALL_APPS = [...COMMUNICATION_APPS, ...PRODUCTIVITY_APPS, ...SHARING_APPS, ...FINANCE_APPS];

/* ── Placeholder Tabs ── */

const collaborationTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
];

function CollaborationPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="collaboration"
      moduleLabel="Collaboration"
      moduleIcon={<FiMessageCircle className="w-5 h-5 text-white" />}
      gradientColor="from-teal-500 to-emerald-600"
      tabs={collaborationTabs}
      overviewContent={<CollaborationContent />}
      children={{}}
    />
  );
}

export default function CollaborationHubPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>}>
      <CollaborationPageContent />
    </Suspense>
  );
}

/* ── Collaboration Content ── */
function CollaborationContent() {
  const router = useRouter();
  // Silently trigger collaboration demo-data seed on first load so the
  // Vercel deployment shows chat rooms / files / call recordings.
  useAutoSeedDemo('collaboration');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
          <FiUsers className="w-6 h-6 text-teal-500" />
          Collaboration Hub
        </h1>
        <p className="text-thb-text-secondary mt-1">
          Unified workspace for communication, productivity, sharing, and finance — all integrated into your 3Boxes HRMS workflow with AI-powered features, enterprise security, and granular governance.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Communication', count: '3', icon: FiPhone, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Productivity', count: '4', icon: FiZap, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Sharing', count: '2', icon: FiUsers, color: 'text-pink-500', bg: 'bg-pink-50' },
          { label: 'Finance', count: '1', icon: FiDollarSign, color: 'text-rose-500', bg: 'bg-rose-50' },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className="thb-card p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <StatIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-thb-text-primary">{stat.count}</p>
                <p className="text-[11px] text-thb-text-muted">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Communication Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiPhone className="w-4 h-4 text-green-500" />
          <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">Communication</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMMUNICATION_APPS.map((tile) => (
            <AppCard key={tile.route} tile={tile} onClick={() => router.push(tile.route)} />
          ))}
        </div>
      </section>

      {/* Productivity Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiZap className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">Productivity</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCTIVITY_APPS.map((tile) => (
            <AppCard key={tile.route} tile={tile} onClick={() => router.push(tile.route)} />
          ))}
        </div>
      </section>

      {/* Sharing Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiUsers className="w-4 h-4 text-pink-500" />
          <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">Sharing & Content</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SHARING_APPS.map((tile) => (
            <AppCard key={tile.route} tile={tile} onClick={() => router.push(tile.route)} />
          ))}
        </div>
      </section>

      {/* Finance Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiDollarSign className="w-4 h-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">Finance</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FINANCE_APPS.map((tile) => (
            <AppCard key={tile.route} tile={tile} onClick={() => router.push(tile.route)} />
          ))}
        </div>
      </section>

      {/* Architecture highlights */}
      <div className="thb-card p-6">
        <h2 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider mb-4">
          Architecture & Compliance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <FiShield className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-thb-text-primary">Data Isolation</h3>
            </div>
            <p className="text-xs text-thb-text-secondary leading-relaxed">
              A Sub-Company in Group A can never see the chats, files, or profiles of a Sub-Company in Group B, even if both share the same Parent Company. Tenant Admins see only aggregated analytics, not private communications, unless a legal eDiscovery hold is placed.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <FiLock className="w-4 h-4 text-teal-500" />
              <h3 className="text-sm font-semibold text-thb-text-primary">End-to-End Encryption</h3>
            </div>
            <p className="text-xs text-thb-text-secondary leading-relaxed">
              All 1:1 native WebRTC voice/video calls and direct chats are E2EE. The HRMS platform, Super Admins, and Tenant Admins cannot listen in or read these specific 1:1 interactions.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <FiCpu className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold text-thb-text-primary">AI-Powered Features</h3>
            </div>
            <p className="text-xs text-thb-text-secondary leading-relaxed">
              Real-time chat translation, document intelligence, chat summarization for project managers, and anonymous sentiment analysis to flag toxic teams or burnout risks.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <FiActivity className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-thb-text-primary">DLP & Watermarking</h3>
            </div>
            <p className="text-xs text-thb-text-secondary leading-relaxed">
              AI-scanning of chats and files blocks uploads containing credit card numbers or SSNs. Sensitive documents display a dynamic watermark showing the viewer&apos;s email and timestamp to prevent screen-share leaks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable App Card Component ── */
function AppCard({ tile, onClick }: { tile: ModuleTile; onClick: () => void }) {
  const IconComp = tile.icon;
  return (
    <button
      onClick={onClick}
      className="thb-card thb-card-hover p-5 text-left group transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${tile.gradientBg} flex items-center justify-center ${tile.iconColor} ring-1 ${tile.ringColor} flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
          <IconComp className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-thb-text-primary group-hover:text-green-600 transition-colors inline-flex items-center gap-2">
              {tile.title}
            </h3>
            <FiArrowRight className="w-4 h-4 text-thb-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
          </div>
          <p className="text-xs text-thb-text-muted mt-1 leading-relaxed">
            {tile.description}
          </p>
          {tile.badges && (
            <div className="flex flex-wrap gap-1 mt-3">
              {tile.badges.map((badge) => (
                <span key={badge} className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
