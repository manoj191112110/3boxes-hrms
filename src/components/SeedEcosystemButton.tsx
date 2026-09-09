'use client';
import { useState } from 'react';
import { isClientLiveMode } from '@/lib/site-mode';

interface Props {
  /** Which module to seed. 'all' seeds everything. */
  module?: 'clients' | 'vendors' | 'marketplace' | 'wellness' | 'collaboration' | 'all';
  /** Button label override. */
  label?: string;
  /** Compact variant for tighter UIs. */
  compact?: boolean;
}

/**
 * Admin-only "Seed Demo Data" button.
 * Calls POST /api/admin/seed-ecosystem-data with the chosen module.
 * Idempotent — safe to click multiple times.
 *
 * ⚠️ LIVE MODE: This button is COMPLETELY HIDDEN on the production
 * platform (3boxeshrms.com and tenant subdomains). Seeding is only
 * available on the demo site (nexus-hrms-mu.vercel.app).
 */
export default function SeedEcosystemButton({ module = 'all', label, compact = false }: Props) {
  // ─── LIVE MODE GUARD ───
  // Hide the seed button entirely on the live production platform.
  // No dummy data should ever be seeded into production databases.
  if (isClientLiveMode()) {
    return null;
  }

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // authStore persists the JWT under `tb_token` (not `token`).
      // Reading the bare `token` key returned null and made the API reply
      // "No token provided" — fixed 2026-06-22.
      const token = localStorage.getItem('tb_token');
      const r = await fetch('/api/admin/seed-ecosystem-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ module }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error || `Seed failed (HTTP ${r.status})`);
      } else {
        setResult(json);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? 'inline-flex flex-col' : 'flex flex-col gap-2'}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors ${
          compact ? 'px-3 py-1.5' : 'px-4 py-2'
        } ${
          loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
        }`}
        title="Idempotent — safe to click multiple times"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
            Seeding…
          </>
        ) : (
          <>🌱 {label || 'Seed Demo Data'}</>
        )}
      </button>
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-md">
          {error}
        </div>
      )}
      {result && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 max-w-md">
          ✅ Seeded successfully:
          {Object.entries(result.results || {}).map(([k, v]: [string, any]) => (
            <div key={k} className="mt-0.5">
              <span className="font-semibold capitalize">{k}</span>: {v.created} created, {v.skipped} skipped
              {v.note && <span className="text-gray-500"> — {v.note}</span>}
            </div>
          ))}
          {result.seededFor && (
            <div className="mt-1 text-gray-500">
              Anchor company: <b>{result.seededFor.company}</b> · {result.seededFor.employeesAvailable} employees available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
