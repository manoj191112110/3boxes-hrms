'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBriefcase, FiArrowRight, FiExternalLink, FiCode,
  FiTrendingUp, FiUsers, FiRadio, FiDollarSign, FiSettings,
  FiPenTool, FiHeadphones, FiGrid, FiAlertCircle, FiLayers,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Card, LoadingSpinner, EmptyState, Badge } from '@/components/nexus-ui';

interface PublicJob {
  id: string; title: string; position: string; location?: string | null; type: string;
  experience?: string | null; salary?: string | null; description: string;
  requirements?: string | null; vacancies: number; postedDate: string;
  closingDate?: string | null; applicants: number;
  department: { id: string; name: string } | null;
  company: { id: string; name: string; code: string | null; city?: string | null; country?: string | null } | null;
  tenant: { id: string; name: string; slug: string } | null;
  group: { id: string; name: string } | null;
}

interface CategoryGroup { id: string; name: string; count: number; jobs: PublicJob[]; }

const CATEGORY_ICON_KEYS: Record<string, string> = {
  engineering: 'engineering', 'software engineering': 'engineering', 'research & development': 'engineering',
  'r&d': 'engineering', rd: 'engineering', technology: 'engineering', it: 'engineering',
  'information technology': 'engineering', sales: 'sales', 'sales & marketing': 'sales',
  marketing: 'marketing', hr: 'hr', 'human resources': 'hr', 'people & culture': 'hr',
  finance: 'finance', accounting: 'finance', operations: 'operations', ops: 'operations',
  design: 'design', 'product design': 'design', support: 'support', 'customer support': 'support',
  'customer success': 'support',
};

function iconForCategory(name: string) {
  const key = name.toLowerCase().trim();
  const matched = CATEGORY_ICON_KEYS[key];
  if (matched === 'engineering') return FiCode;
  if (matched === 'sales') return FiTrendingUp;
  if (matched === 'hr') return FiUsers;
  if (matched === 'marketing') return FiRadio;
  if (matched === 'finance') return FiDollarSign;
  if (matched === 'operations') return FiSettings;
  if (matched === 'design') return FiPenTool;
  if (matched === 'support') return FiHeadphones;
  if (/eng|dev|soft|tech|code|r&d|rd|\bit\b/.test(key)) return FiCode;
  if (/sale/.test(key)) return FiTrendingUp;
  if (/hr|human|people/.test(key)) return FiUsers;
  if (/market/.test(key)) return FiRadio;
  if (/fin|acc/.test(key)) return FiDollarSign;
  if (/op/.test(key)) return FiSettings;
  if (/design/.test(key)) return FiPenTool;
  if (/support|success|help/.test(key)) return FiHeadphones;
  return FiGrid;
}

const CATEGORY_GRADIENTS = [
  'from-green-500 to-emerald-600', 'from-teal-500 to-teal-600', 'from-cyan-500 to-green-600',
  'from-fuchsia-500 to-pink-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600', 'from-emerald-500 to-teal-600',
];

export default function CategoriesPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const res = await fetch('/api/public/jobs?limit=1000', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
        if (data?.error) toast.error('Some jobs could not be loaded. Showing partial list.');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load jobs';
        if (!cancelled) { setError(msg); toast.error('Failed to load job categories. Please try again.'); }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, CategoryGroup>();
    for (const j of jobs) {
      if (!j.department) continue;
      const key = j.department.id || j.department.name;
      const name = j.department.name || 'Uncategorized';
      if (!map.has(key)) map.set(key, { id: key, name, count: 0, jobs: [] });
      const grp = map.get(key)!;
      grp.count += 1; grp.jobs.push(j);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [jobs]);

  const totalOpen = jobs.length;
  const totalCompanies = useMemo(() => new Set(jobs.map((j) => j.company?.id).filter(Boolean)).size, [jobs]);
  const totalApplicants = useMemo(() => jobs.reduce((s, j) => s + (j.applicants || 0), 0), [jobs]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* ───────────── Top Navigation ───────────── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/careers" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 flex items-center justify-center shadow-md shadow-green-500/30 group-hover:shadow-lg transition-shadow">
              <FiBriefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-base leading-tight">3 Boxes HRMS</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Career Portal</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/careers" className="hover:text-green-600 transition-colors">Home</Link>
            <Link href="/careers/categories" className="text-green-600 font-semibold">Categories</Link>
            <Link href="/careers/companies" className="hover:text-green-600 transition-colors">Companies</Link>
            <Link href="/careers/about" className="hover:text-green-600 transition-colors">About</Link>
            <Link href="/careers/contact" className="hover:text-green-600 transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login?mode=candidate" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-green-600 transition-colors">
              Sign In <FiExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link href="/careers#openings" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 transition-all shadow-md shadow-green-500/20">
              Browse Jobs <FiArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-700 via-emerald-700 to-teal-700 text-white">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-green-400/30 rounded-full blur-3xl" />
          <div className="absolute -top-40 right-0 w-[28rem] h-[28rem] bg-teal-400/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-fuchsia-400/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-12 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/30 text-xs font-semibold mb-5">
            <FiLayers className="w-3.5 h-3.5" /> Browse by Category
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
            Explore opportunities by <br />
            <span className="bg-gradient-to-r from-cyan-200 via-white to-teal-200 bg-clip-text text-transparent">job category</span>
          </h1>
          <p className="text-base sm:text-lg text-green-100 max-w-2xl mx-auto mb-8">
            Find roles that match your expertise. Pick a category below to jump straight to the openings.
          </p>
          <Link href="/careers#openings" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors shadow-lg">
            View all open positions <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ───────────── Stats strip ───────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Open Roles', value: totalOpen },
            { label: 'Hiring Companies', value: totalCompanies },
            { label: 'Total Applicants', value: totalApplicants },
          ].map((s) => (
            <Card key={s.label} className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
                <p className="text-3xl font-extrabold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">{s.value.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <FiBriefcase className="w-5 h-5 text-green-600" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────── Main content ───────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">All Job Categories</h2>
            <p className="text-sm text-slate-500 mt-1">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} with active openings.
            </p>
          </div>
          <Link href="/careers#openings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-teal-600 transition-colors">
            See all openings <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading && <LoadingSpinner message="Loading categories…" />}

        {!loading && error && (
          <EmptyState icon={<FiAlertCircle className="w-7 h-7" />} title="Couldn't load categories" description={error}
            cta={{ label: 'Go to openings', href: '/careers#openings' }} />
        )}

        {!loading && !error && categories.length === 0 && (
          <EmptyState icon={<FiGrid className="w-7 h-7" />} title="No categories yet"
            description="There are no open positions to categorize right now. Please check back soon."
            cta={{ label: 'Back to careers', href: '/careers' }} />
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat, idx) => {
              const Icon = iconForCategory(cat.name);
              const gradient = CATEGORY_GRADIENTS[idx % CATEGORY_GRADIENTS.length];
              const previewCompany = cat.jobs[0]?.company?.name;
              return (
                <Link key={cat.id} href={`/careers#openings?dept=${encodeURIComponent(cat.id)}`}
                  className="group bg-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-teal-300 transition-all p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="info">{cat.count} open{cat.count === 1 ? '' : 's'}</Badge>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{cat.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {previewCompany ? `Openings at ${previewCompany}${cat.jobs.length > 1 ? ` and ${cat.jobs.length - 1} more` : ''}.` : `${cat.count} open position${cat.count === 1 ? '' : 's'} ready for you.`}
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">View openings</span>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 group-hover:bg-teal-100 group-hover:text-teal-700 text-slate-500 transition-colors">
                      <FiArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-400">© 2025 3 Boxes HRMS · Career Portal</footer>
    </div>
  );
}
