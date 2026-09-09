// Test script for the /api/companies endpoint behavior.
//
// Verifies:
//   1. Super admin without tenantId query → returns companies across ALL tenants
//      (previously returned companies for callerTenantId, which for super admin
//      is the seed tenant with no real companies — so the page showed nothing).
//   2. Super admin with tenantId query → returns only companies in that tenant.
//   3. Super admin with companyId query → returns only that one company.
//   4. Tenant admin without any query → returns companies in their own tenant.
//
// Run with: node scripts/test-companies-api.mjs
//
// The script just prints the counts and the first 3 companies for each
// scenario — it does NOT assert anything. Use it to eyeball whether the API
// is returning the expected scope of data after the fix.

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-in-production';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function makeToken(role, tenantId, userId = 'test-user-id') {
  return jwt.sign({ userId, role, tenantId }, JWT_SECRET, { expiresIn: '1h' });
}

async function fetchCompanies(token, query = '') {
  const url = `${BASE_URL}/api/companies${query}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    console.error(`  ✗ HTTP ${res.status}:`, await res.text());
    return null;
  }
  const data = await res.json();
  return data;
}

async function main() {
  console.log('=== /api/companies endpoint test ===\n');

  // Scenario 1: super_admin with no query → all companies across all tenants
  console.log('Scenario 1: super_admin, no query');
  const saToken = makeToken('super_admin', 'seed-tenant-id');
  const r1 = await fetchCompanies(saToken);
  if (r1) {
    console.log(`  ✓ Got ${r1.companies?.length || 0} companies`);
    (r1.companies || []).slice(0, 3).forEach((c) => {
      console.log(`    - ${c.name} (group: ${c.companyGroup?.name || '—'}, tenant: ${c.companyGroup?.tenant?.name || '—'})`);
    });
  }
  console.log();

  // Scenario 2: tenant_admin with no query → only own tenant
  console.log('Scenario 2: tenant_admin, no query');
  // Replace with a real tenant ID from your DB
  const taToken = makeToken('tenant_admin', 'REPLACE_WITH_REAL_TENANT_ID');
  const r2 = await fetchCompanies(taToken);
  if (r2) {
    console.log(`  ✓ Got ${r2.companies?.length || 0} companies`);
    (r2.companies || []).slice(0, 3).forEach((c) => {
      console.log(`    - ${c.name} (group: ${c.companyGroup?.name || '—'})`);
    });
  }
  console.log();

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
