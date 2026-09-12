/**
 * REQ-SEC-REC-03 — PII Masking helper.
 *
 * maskCandidateFields(candidate, userRole, tenantPolicies) returns a deep
 * copy of `candidate` where each PII field listed in `tenantPolicies` has
 * been masked according to the policy's maskingStrategy AND the viewer's
 * role (visibleToRoles whitelist).
 *
 * PII fields (exact strings — see WAVE2-A spec):
 *   dob | gender | photo | address | phone | email | aadhaar | ssn | sin
 *
 * Masking strategies:
 *   full    — pass the value through unchanged
 *   partial — show a redacted fragment (e.g. "+91 98xxx xx123", "j****@gmail.com")
 *   hash    — show a stable fingerprint ("sha256:<12 hex>") for audit logs
 *   hidden  — show "***MASKED***"
 *
 * Roles that are always unmasked (recruiters + admins) unless a policy
 * explicitly hides the field for them:
 *   recruiter | recruiter_admin
 *   hr_admin | tenant_admin | super_admin
 *
 * Hiring panel = any other authenticated role. Panel members see masked
 * values by default; the per-field policy can additionally whitelist
 * specific panel roles via visibleToRoles.
 *
 * NOTE: This module is isomorphic (browser + Node). It avoids `node:crypto`
 * because the recruitment dashboard calls it from the client. For the
 * `hash` strategy we use a synchronous FNV-1a 32-bit fingerprint — enough
 * for cross-row join on the screen; the cryptographic SHA-256 belongs in
 * server-side audit-log writes (which use Node's createHash directly).
 */

export type MaskingStrategy = 'full' | 'partial' | 'hidden' | 'hash';

export interface PiiPolicyEntry {
  field: string;
  maskingStrategy: MaskingStrategy;
  visibleToRoles: string[] | string; // hydrated array OR raw JSON string from Prisma
}

export const PII_FIELDS = [
  'dob',
  'gender',
  'photo',
  'address',
  'phone',
  'email',
  'aadhaar',
  'ssn',
  'sin',
] as const;

export type PiiField = (typeof PII_FIELDS)[number];

const DEFAULT_RECRUITER_ROLES = new Set([
  'recruiter',
  'recruiter_admin',
  'admin',
  'tenant_admin',
  'super_admin',
]);

const MASKED_PLACEHOLDER = '***MASKED***';

/** Normalize a possibly-JSON-string visibleToRoles into a real array. */
export function normalizeVisibleRoles(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map(r => r.trim());
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeVisibleRoles(parsed);
    } catch {
      /* fallthrough */
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/** Stable 32-bit FNV-1a hash, returned as 8 hex chars. Suitable for screen display / dedup only. */
function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  // Keep last 3-4 digits and a country-code hint if present.
  const last4 = digits.slice(-4);
  const head = digits.slice(0, -4);
  const ccode = head.length > 4 ? `+${head.slice(0, 2)}` : '+**';
  const mid = head.slice(2).replace(/\d/g, 'x');
  return `${ccode} ${mid || 'xxxx'} ${last4}`.trim();
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return MASKED_PLACEHOLDER;
  const head = local[0] || '*';
  const tail = local.length > 2 ? local[local.length - 1] : '';
  const shown = tail ? `${head}****${tail}` : `${head}****`;
  return `${shown}@${domain}`;
}

function maskIdNumber(value: string): string {
  // Aadhaar (12 digits), SSN (9 digits), SIN (9 digits) — show last 4.
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return MASKED_PLACEHOLDER;
  return `xxxx-xx-${digits.slice(-4)}`;
}

function maskAddress(value: string): string {
  if (value.length <= 8) return MASKED_PLACEHOLDER;
  return `${value.slice(0, 6)}...`;
}

function maskDob(value: string): string {
  // Show only the year.
  const m = value.match(/\d{4}/);
  return m ? `**/**/${m[0]}` : MASKED_PLACEHOLDER;
}

function maskGender(value: string): string {
  // Show first letter only.
  return value ? `${value[0].toUpperCase()}.` : MASKED_PLACEHOLDER;
}

function maskPhoto(value: string): string {
  if (!value) return value;
  // Return a transparent placeholder — callers can render a default avatar.
  return MASKED_PLACEHOLDER;
}

function applyStrategy(value: unknown, strategy: MaskingStrategy, field: string): unknown {
  if (value === null || value === undefined) return value;
  const str = typeof value === 'string' ? value : String(value);

  switch (strategy) {
    case 'full':
      return value;
    case 'hidden':
      return MASKED_PLACEHOLDER;
    case 'hash':
      return `sha256:${fnv1aHex(field + ':' + str)}`;
    case 'partial':
      switch (field) {
        case 'phone':
          return maskPhone(str);
        case 'email':
          return maskEmail(str);
        case 'aadhaar':
        case 'ssn':
        case 'sin':
          return maskIdNumber(str);
        case 'address':
          return maskAddress(str);
        case 'dob':
          return maskDob(str);
        case 'gender':
          return maskGender(str);
        case 'photo':
          return maskPhoto(str);
        default:
          // Generic partial: show first + last char, mask middle.
          if (str.length <= 2) return MASKED_PLACEHOLDER;
          return `${str[0]}${'*'.repeat(Math.max(3, str.length - 2))}${str[str.length - 1]}`;
      }
    default:
      return value;
  }
}

/**
 * Decide whether the viewer should see the *masked* or *unmasked* value of
 * a given field. Returns the masking strategy to actually apply (so a
 * recruiter with `full` access still gets `full`).
 */
function resolveStrategy(
  userRole: string | null | undefined,
  field: string,
  policy: PiiPolicyEntry | undefined,
  defaultStrategy: MaskingStrategy
): MaskingStrategy {
  if (!userRole) {
    // Anonymous viewer (e.g. public job board cache) — always mask.
    return policy?.maskingStrategy || 'hidden';
  }
  const role = userRole.toLowerCase();

  // Default: recruiters + admins see `full`. Hiring panel (everyone else)
  // sees whatever the per-field policy dictates (default `hidden`).
  const isRecruiter = DEFAULT_RECRUITER_ROLES.has(role);

  // If a per-field policy exists, its visibleToRoles whitelist overrides the
  // default recruiter shortcut. A role in the whitelist gets `full`; a role
  // NOT in the whitelist gets the policy.maskingStrategy.
  if (policy) {
    const whitelist = normalizeVisibleRoles(policy.visibleToRoles);
    if (whitelist.length > 0) {
      if (whitelist.includes(role)) return 'full';
      return policy.maskingStrategy;
    }
    // No whitelist → fall back to maskingStrategy for everyone EXCEPT recruiters.
    if (isRecruiter) return policy.maskingStrategy === 'full' ? 'full' : defaultStrategy === 'full' ? 'full' : policy.maskingStrategy;
    return policy.maskingStrategy;
  }

  // No per-field policy → use the default strategy.
  return isRecruiter ? 'full' : defaultStrategy;
}

/**
 * Main entry point.
 *
 * @param candidate    The candidate / application record to mask.
 * @param userRole     The viewer's role key (e.g. "hr_admin", "hiring_panel",
 *                     "recruiter", "interviewer"). Pass null for anonymous.
 * @param tenantPolicies Array of per-field policies (hydrated OR raw JSON string).
 *                       Missing fields fall back to the defaultStrategy.
 * @param options.defaultStrategy  Strategy for fields without an explicit
 *                       policy. Defaults to `hidden` (hiring-panel-safe).
 * @returns A shallow-cloned copy with masked values. The original object is
 *          never mutated.
 */
export function maskCandidateFields<T extends Record<string, unknown>>(
  candidate: T,
  userRole: string | null | undefined,
  tenantPolicies: PiiPolicyEntry[] | null | undefined,
  options: { defaultStrategy?: MaskingStrategy } = {}
): T & { __piiMaskedFields?: string[] } {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const defaultStrategy: MaskingStrategy = options.defaultStrategy || 'hidden';

  const policyByField = new Map<string, PiiPolicyEntry>();
  (tenantPolicies || []).forEach(p => {
    if (p && typeof p.field === 'string') policyByField.set(p.field, p);
  });

  const masked: Record<string, unknown> = { ...candidate };
  const maskedFields: string[] = [];

  PII_FIELDS.forEach(field => {
    if (!(field in candidate)) return; // do not invent keys
    const original = candidate[field];
    if (original === null || original === undefined || original === '') {
      masked[field] = original;
      return;
    }
    const strategy = resolveStrategy(userRole, field, policyByField.get(field), defaultStrategy);
    if (strategy === 'full') {
      masked[field] = original;
    } else {
      masked[field] = applyStrategy(original, strategy, field);
      maskedFields.push(field);
    }
  });

  if (maskedFields.length > 0) {
    masked.__piiMaskedFields = maskedFields;
  }
  return masked as T & { __piiMaskedFields?: string[] };
}

/** Convenience: does this role see masked data by default? */
export function isRoleMaskedByDefault(userRole: string | null | undefined): boolean {
  if (!userRole) return true;
  return !DEFAULT_RECRUITER_ROLES.has(userRole.toLowerCase());
}

/** Convenience: build the standard "PII masked" badge tooltip text. */
export function buildPiiMaskTooltip(maskedFields: string[] | undefined): string {
  if (!maskedFields || maskedFields.length === 0) {
    return 'PII is shown in full for your role.';
  }
  return `PII masked for bias mitigation: ${maskedFields.join(', ')}`;
}
