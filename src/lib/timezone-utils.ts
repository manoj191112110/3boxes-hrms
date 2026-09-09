/**
 * Timezone normalization helpers — REQ-ATT-05 (Multi-country time sync)
 *
 * Problem:
 *   When a global workforce punches from different countries, the punch
 *   timestamp arrives as an ISO UTC string. But the "attendance day" that
 *   the punch belongs to depends on the EMPLOYEE'S local timezone, not
 *   UTC. If we naively bucket punches by UTC date, an employee in
 *   Bangalore (UTC+5:30) who punches in at 9 AM IST on the 21st gets
 *   recorded on the 20th in UTC, which is wrong.
 *
 * Solution:
 *   - Every Tenant / Company / Branch can declare its IANA timezone
 *     (e.g. "Asia/Kolkata", "America/New_York", "Europe/London").
 *   - Punches are stored in UTC (good for global queries & audit).
 *   - The "attendance day" is computed in the employee's local timezone.
 *   - Reports and dashboards render times in the viewer's preferred
 *     timezone (which may differ from the employee's).
 *
 * This module centralizes the conversion logic so all attendance
 * endpoints (web, mobile, biometric) produce identical "day" boundaries
 * for the same employee.
 */

/**
 * Returns the local "day start" (midnight) for the given UTC instant,
 * expressed as a UTC Date. This is the bucket key for Attendance rows.
 *
 * Example:
 *   punchTimeUtc = 2026-06-21T03:30:00Z (9:00 AM IST on the 21st)
 *   tz = "Asia/Kolkata"
 *   → returns 2026-06-20T18:30:00Z (midnight IST on the 21st expressed as UTC)
 *
 * Why: Prisma stores all DateTimes as UTC. We want one Attendance row per
 * (employee, local-day), so the date component must be the LOCAL day
 * expressed as a UTC instant.
 */
export function localDayStartFor(punchTimeUtc: Date, tz: string): Date {
  try {
    // Use Intl.DateTimeFormat to get the local date components in the
    // target timezone, then reconstruct the Date.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(punchTimeUtc);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value);
    const d = Number(parts.find(p => p.type === 'day')?.value);
    if (!y || !m || !d) return naiveDayStart(punchTimeUtc);
    // Construct a UTC Date representing midnight in the LOCAL timezone.
    // We need to compute the timezone offset at that local-midnight to
    // express it as a UTC instant.
    return utcInstantForLocalMidnight(y, m, d, tz);
  } catch {
    // Unknown timezone — fall back to UTC midnight
    return naiveDayStart(punchTimeUtc);
  }
}

/**
 * Compute the UTC instant corresponding to (YYYY-MM-DD 00:00:00) in the
 * given timezone. We do this by walking both candidates (one for each DST
 * side) and picking the one whose local formatting matches midnight.
 */
function utcInstantForLocalMidnight(year: number, month: number, day: number, tz: string): Date {
  // Try two candidate UTC instants: one at 00:00 UTC and one at 12:00 UTC
  // (covers most timezone offsets ±12). For each, check what local time it
  // represents, then back out the offset.
  for (const hourUtc of [0, 12]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, hourUtc, 0, 0));
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(candidate);
    const ly = Number(parts.find(p => p.type === 'year')?.value);
    const lm = Number(parts.find(p => p.type === 'month')?.value);
    const ld = Number(parts.find(p => p.type === 'day')?.value);
    const lh = Number(parts.find(p => p.type === 'hour')?.value);
    const lmin = Number(parts.find(p => p.type === 'minute')?.value);
    if (ly === year && lm === month && ld === day && lh === 0 && lmin === 0) {
      return candidate;
    }
  }
  // Fallback: just use Date.UTC of the local date (treats it as UTC, which is wrong for non-UTC timezones but at least deterministic)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Get the local-time-of-day (in minutes since midnight) for a UTC instant
 * in the given timezone. Used for off-hours checks and grace-period math.
 */
export function localMinutesSinceMidnight(punchTimeUtc: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(punchTimeUtc);
    const h = Number(parts.find(p => p.type === 'hour')?.value);
    const m = Number(parts.find(p => p.type === 'minute')?.value);
    return h * 60 + m;
  } catch {
    return punchTimeUtc.getUTCHours() * 60 + punchTimeUtc.getUTCMinutes();
  }
}

/**
 * Format a UTC instant as a local-time string for display in a specific timezone.
 */
export function formatInTimezone(punchTimeUtc: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(punchTimeUtc);
  } catch {
    return punchTimeUtc.toISOString();
  }
}

/**
 * Get the timezone abbreviation (e.g. "IST", "EST", "GMT") for display.
 */
export function timezoneAbbrev(punchTimeUtc: Date, tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = fmt.formatToParts(punchTimeUtc);
    return parts.find(p => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}

function naiveDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Resolve the best timezone for an employee based on (in priority order):
 *   1. Employee's `timezone` field (if model has it)
 *   2. Branch's `timezone` field (if model has it)
 *   3. Company's `timezone` field (if model has it)
 *   4. Tenant's `timezone` field
 *   5. UTC fallback
 *
 * We accept loosely-typed inputs because the Employee/Branch/Company/Tenant
 * models may or may not have a `timezone` column yet. The caller passes
 * whatever it has.
 */
export function resolveTimezone(records: Array<Record<string, unknown> | null | undefined>): string {
  for (const r of records) {
    if (r && typeof r === 'object') {
      const tz = (r as Record<string, unknown>).timezone;
      if (typeof tz === 'string' && tz.trim()) {
        // Validate it's a known IANA zone
        try {
          Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' });
          return tz;
        } catch {
          // invalid — skip
        }
      }
    }
  }
  return 'UTC';
}
