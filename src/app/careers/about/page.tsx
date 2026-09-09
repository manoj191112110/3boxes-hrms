'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiBriefcase, FiArrowRight, FiExternalLink, FiTarget,
  FiUsers, FiZap, FiShield, FiTrendingUp, FiAward,
  FiHeart, FiCheckCircle, FiLayers, FiGrid,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Card, LoadingSpinner, StatCard } from '@/components/nexus-ui';

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

const MISSION_BULLETS = [
  'Connect great talent with great companies — without the friction.',
  'Make hiring transparent, fair, and respectful for every candidate.',
  'Use technology to amplify human judgement, not replace it.',
  'Give every applicant a clear, trackable path from first click to first day.',
];

const VALUES = [
  { icon: FiHeart, label: 'Human-first' },
  { icon: FiShield, label: 'Privacy by design' },
  { icon: FiTarget, label: 'Outcome-driven' },
  { icon: FiUsers, label: 'Inclusive teams' },
];

const WHY_JOIN_FEATURES = [
  { icon: FiZap, title: 'Apply in seconds', body: 'Upload your resume once and apply to any role across our group companies with a single click.', accent: 'from-amber-500 to-orange-600' },
  { icon: FiShield, title: 'Privacy-first', body: 'Your data is encrypted at rest, consent-driven, and never shared without your explicit permission.', accent: 'from-emerald-500 to-teal-600' },
  { icon: FiTrendingUp, title: 'AI-assisted matching', body: 'Our smart matching engine surfaces roles that fit your skills, experience, and career goals.', accent: 'from-green-500 to-emerald-600' },
  { icon: FiAward, title: 'Transparent process', body: 'Track every application in real time — from screening to interview to offer — with no black boxes.', accent: 'from-teal-500 to-teal-600' },
];

export default function AboutPage() {
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
        if (data?.error) toast.error('Live stats unavailable — showing 0 values.');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load stats';
        if (!cancelled) setError(msg);
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    openRoles: jobs.length,
    companies: new Set(jobs.map((j) => j.company?.id).filter(Boolean)).size,
    applicants: jobs.reduce((s, j) => s + (j.applicants || 0), 0),
  }), [jobs]);

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
            <Link href="/careers/companies" className="hover:text-green-600 transition-colors">Companies</Link>
            <Link href="/careers/about" className="text-green-600 font-semibold">About</Link>
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
            <FiLayers className="w-3.5 h-3.5" /> About Us
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
            About 3 Boxes HRMS <br />
            <span className="bg-gradient-to-r from-cyan-200 via-white to-teal-200 bg-clip-text text-transparent">Career Portal</span>
          </h1>
          <p className="text-base sm:text-lg text-green-100 max-w-2xl mx-auto mb-8">
            A unified talent platform connecting candidates with opportunities across our group companies.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/careers#openings" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors shadow-lg">
              Browse open roles <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/careers/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 transition-colors">
              Contact us <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── Main content ───────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 space-y-16">
        {/* Our Mission */}
        <section id="mission" className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold ring-1 ring-green-200 mb-4">
              <FiTarget className="w-3.5 h-3.5" /> Our Mission
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">Reimagining how talent and opportunity meet</h2>
            <p className="text-sm text-slate-500 mt-1 mb-6">We exist to make hiring work better — for candidates and for companies.</p>
            <p className="text-base text-slate-700 leading-relaxed mb-6">
              3 Boxes HRMS is a multi-tenant human resources platform built for modern organizations.
              Our Career Portal is the public face of that platform — a single place where candidates
              can discover open roles across every company in a group, apply in seconds, and track
              their progress end-to-end.
            </p>
            <ul className="space-y-3">
              {MISSION_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <FiCheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-green-100 to-teal-100 rounded-3xl rotate-2" />
            <Card className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {VALUES.map((v) => {
                  const Icon = v.icon;
                  return (
                    <div key={v.label} className="aspect-square rounded-xl bg-gradient-to-br from-slate-50 to-green-50 border border-slate-200 p-4 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-600 to-teal-600 flex items-center justify-center mb-2">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">{v.label}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>

        {/* Why Join Us */}
        <section id="why">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold ring-1 ring-teal-200 mb-4">
              <FiZap className="w-3.5 h-3.5" /> Why Join Us
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Built for candidates, not just recruiters</h2>
            <p className="text-sm text-slate-500 mt-1">Everything you need to find your next role — without the friction.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY_JOIN_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} hover className="p-4 flex flex-col">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center shadow-md mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.body}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Stats */}
        <section id="stats">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold ring-1 ring-green-200 mb-4">
              <FiTrendingUp className="w-3.5 h-3.5" /> Live Stats
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">The portal in numbers</h2>
          </div>
          {loading ? (
            <LoadingSpinner message="Loading stats…" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Open Roles" value={stats.openRoles} accent="blue" icon={<FiBriefcase className="w-5 h-5" />} />
              <StatCard label="Hiring Companies" value={stats.companies} accent="violet" icon={<FiUsers className="w-5 h-5" />} />
              <StatCard label="Total Applicants" value={stats.applicants} accent="emerald" icon={<FiHeart className="w-5 h-5" />} />
            </div>
          )}
          {!loading && error && (
            <p className="text-center text-xs text-slate-400 mt-4">Couldn&apos;t reach the live data service — figures shown may be stale.</p>
          )}
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-emerald-700 to-teal-700 text-white">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-teal-400/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-green-400/30 rounded-full blur-3xl" />
          </div>
          <div className="px-6 sm:px-12 py-10 sm:py-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center mb-5">
              <FiGrid className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">Ready to find your next role?</h2>
            <p className="text-green-100 max-w-xl mx-auto mb-6 text-sm sm:text-base">
              Browse open positions across all our group companies. No account required to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/careers#openings" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-green-700 bg-white hover:bg-green-50 transition-colors shadow-lg">
                Browse open roles <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/careers/categories" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 transition-colors">
                Explore categories <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-400">© 2025 3 Boxes HRMS · Career Portal</footer>
    </div>
  );
}
