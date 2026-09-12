'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBriefcase,
  FiArrowRight,
  FiExternalLink,
  FiMapPin,
  FiUsers,
  FiGrid,
  FiLayers,
  FiAlertCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Card, GradientAvatar, LoadingSpinner, EmptyState, SearchBar, Badge } from '@/components/nexus-ui';

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                                */
/* ──────────────────────────────────────────────────────────────────── */
interface PublicJob {
  id: string;
  title: string;
  position: string;
  location?: string | null;
  type: string;
  experience?: string | null;
  salary?: string | null;
  description: string;
  requirements?: string | null;
  vacancies: number;
  postedDate: string;
  closingDate?: string | null;
  applicants: number;
  department: { id: string; name: string } | null;
  company: {
    id: string;
    name: string;
    code: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  tenant: { id: string; name: string; slug: string } | null;
  group: { id: string; name: string } | null;
}

interface CompanyGroup {
  id: string;
  name: string;
  code: string | null;
  city?: string | null;
  country?: string | null;
  tenantName?: string | null;
  openPositions: number;
  totalApplicants: number;
  latestPosted?: string | null;
  departments: string[];
}

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers                                                               */
/* ──────────────────────────────────────────────────────────────────── */
function formatLocation(city?: string | null, country?: string | null) {
  const parts = [city, country].filter(Boolean).map((s) => String(s).trim());
  return parts.length ? parts.join(', ') : 'Remote / Global';
}

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ──────────────────────────────────────────────────────────────────── */
/* Page                                                                  */
/* ──────────────────────────────────────────────────────────────────── */
export default function CompaniesPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/public/jobs?limit=1000', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: PublicJob[] = Array.isArray(data?.jobs) ? data.jobs : [];
        setJobs(list);
        if (data?.error) toast.error('Some jobs could not be loaded. Showing partial list.');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load companies';
        if (!cancelled) { setError(msg); toast.error('Failed to load companies. Please try again.'); }
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const companies = useMemo<CompanyGroup[]>(() => {
    const map = new Map<string, CompanyGroup>();
    for (const j of jobs) {
      if (!j.company) continue;
      const c = j.company;
      if (!map.has(c.id)) {
        map.set(c.id, { id: c.id, name: c.name, code: c.code, city: c.city, country: c.country, tenantName: j.tenant?.name ?? null, openPositions: 0, totalApplicants: 0, latestPosted: null, departments: [] });
      }
      const grp = map.get(c.id)!;
      grp.openPositions += 1;
      grp.totalApplicants += j.applicants || 0;
      if (j.postedDate) {
        if (!grp.latestPosted || new Date(j.postedDate) > new Date(grp.latestPosted)) grp.latestPosted = j.postedDate;
      }
      if (j.department?.name && !grp.departments.includes(j.department.name)) grp.departments.push(j.department.name);
    }
    return Array.from(map.values()).sort((a, b) => b.openPositions - a.openPositions);
  }, [jobs]);

  const filtered = useMemo<CompanyGroup[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => {
      const haystack = [c.name, c.code, c.city, c.country, c.tenantName].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [companies, search]);

  const totalOpen = jobs.length;
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
            <Link href="/careers/categories" className="hover:text-green-600 transition-colors">Categories</Link>
            <Link href="/careers/companies" className="text-green-600 font-semibold">Companies</Link>
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
            <FiLayers className="w-3.5 h-3.5" /> Hiring Companies
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
            Companies Hiring
          </h1>
          <p className="text-base sm:text-lg text-green-100 max-w-2xl mx-auto mb-8">
            Discover organizations actively recruiting through the 3 Boxes HRMS Career Portal.
            Pick a company to view its open roles.
          </p>
          <Link href="/careers#openings" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors shadow-lg">
            Browse all openings <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ───────────── Stats strip ───────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Hiring Companies', value: companies.length, icon: <FiUsers className="w-5 h-5 text-teal-600" /> },
            { label: 'Open Roles', value: totalOpen, icon: <FiBriefcase className="w-5 h-5 text-green-600" /> },
            { label: 'Total Applicants', value: totalApplicants, icon: <FiUsers className="w-5 h-5 text-emerald-600" /> },
          ].map((s) => (
            <Card key={s.label} className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</p>
                <p className="text-3xl font-extrabold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">{s.value.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">{s.icon}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ───────────── Main content ───────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">All Hiring Companies</h2>
            <p className="text-sm text-slate-500 mt-1">{filtered.length} of {companies.length} companies shown.</p>
          </div>
          <div className="w-full sm:w-72">
            <SearchBar value={search} onChange={setSearch} placeholder="Search companies…" />
          </div>
        </div>

        {loading && <LoadingSpinner message="Loading companies…" />}

        {!loading && error && (
          <EmptyState icon={<FiAlertCircle className="w-7 h-7" />} title="Couldn't load companies" description={error}
            cta={{ label: 'Go to openings', href: '/careers#openings' }} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={<FiGrid className="w-7 h-7" />}
            title={companies.length === 0 ? 'No companies hiring yet' : 'No matches found'}
            description={companies.length === 0 ? 'Check back soon — new roles are posted every week.' : `Try a different search term.`}
            cta={companies.length > 0 ? { label: 'Clear search', href: '/careers/companies' } : undefined} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => {
              const location = formatLocation(c.city, c.country);
              const latest = formatRelativeTime(c.latestPosted);
              return (
                <Card key={c.id} hover className="p-4 flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <GradientAvatar name={c.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 truncate" title={c.name}>{c.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                        <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{location}</span>
                      </p>
                      {c.code && <Badge className="mt-1.5">Code: {c.code}</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-green-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-green-700 font-semibold">Open Positions</p>
                      <p className="text-lg font-extrabold text-green-700">{c.openPositions}</p>
                    </div>
                    <div className="bg-teal-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-teal-700 font-semibold">Applicants</p>
                      <p className="text-lg font-extrabold text-teal-700">{c.totalApplicants}</p>
                    </div>
                  </div>
                  {c.departments.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Departments</p>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {c.departments.slice(0, 6).map((d) => (<Badge key={d}>{d}</Badge>))}
                        {c.departments.length > 6 && <Badge>+{c.departments.length - 6} more</Badge>}
                      </div>
                    </div>
                  )}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">{latest ? `Last posted ${latest}` : 'Open roles available'}</span>
                    <Link href={`/careers#openings?company=${encodeURIComponent(c.id)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 transition-all">
                      View Openings <FiArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* ───────────── Footer ───────────── */}
      <footer className="border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-400">
        © 2025 3 Boxes HRMS · Career Portal
      </footer>
    </div>
  );
}
