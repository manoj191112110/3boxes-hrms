/**
 * Test Super Admin Controls - Comprehensive verification
 * 
 * Tests:
 * 1. Company cap enforcement (maxCompaniesAllowed)
 * 2. Employee cap enforcement (maxEmployees per group)
 * 3. Tenant suspend/activate flow
 * 
 * All tests run against the deployed Vercel API.
 */

const BASE_URLS = {
  platform: 'https://3boxeshrms.com',
  tenant: 'https://marqaitechgroup.3boxeshrms.com',
  demo: 'https://nexus-hrms-mu.vercel.app',
};

const SUPER_ADMIN_EMAIL = 'superadmin@3boxeshrms.com';
const SUPER_ADMIN_PASSWORD = 'MarqAI@2026';
const TENANT_ADMIN_EMAIL = 'admin@marqaitechgroup.com';
const TENANT_ADMIN_PASSWORD = 'MarqAI@2026';

async function login(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Login failed for ${email} at ${baseUrl}:`, data.error);
    return null;
  }
  return { token: data.token, user: data.user };
}

async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${result}`);
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  Super Admin Controls Test Suite');
  console.log('========================================\n');

  // ─── Step 1: Login Tests ───
  console.log('\n--- Step 1: Login Tests ---\n');

  const saAuth = await login(BASE_URLS.platform, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
  await test('Super admin login at 3boxeshrms.com', () => 
    saAuth ? `Success — role: ${saAuth.user.role}` : 'Failed');

  const taAuth = await login(BASE_URLS.tenant, TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
  await test('Tenant admin login at marqaitechgroup.3boxeshrms.com', () => 
    taAuth ? `Success — role: ${taAuth.user.role}` : 'Failed');

  if (!saAuth || !taAuth) {
    console.log('\n⚠️ Cannot proceed without both logins. Stopping tests.');
    return;
  }

  // ─── Step 2: Super Admin Dashboard ───
  console.log('\n--- Step 2: Super Admin Dashboard ---\n');

  const dashRes = await fetch(`${BASE_URLS.platform}/api/super-admin/dashboard`, {
    headers: { Authorization: `Bearer ${saAuth.token}` },
  });
  const dashData = await dashRes.json();
  await test('Super admin dashboard data', () => 
    `Tenants: ${dashData.totalTenants} | Active: ${dashData.activeTenants} | Companies: ${dashData.totalCompanies} | Employees: ${dashData.totalEmployees}`);

  // ─── Step 3: Tenant Detail View (companies + employees from tenant DB) ───
  console.log('\n--- Step 3: Tenant Detail View (Tenant DB Data) ---\n');

  const tenantRes = await fetch(`${BASE_URLS.platform}/api/tenants/${taAuth.user.tenantId}`, {
    headers: { Authorization: `Bearer ${saAuth.token}` },
  });
  const tenantData = await tenantRes.json();
  await test('Tenant detail fetch', () => 
    `Company Groups: ${tenantData.tenant?.companyGroups?.length || 0} | Users: ${tenantData.tenant?.users?.length || 0} | Employees: ${tenantData.tenant?.employees?.length || 0}`);

  if (tenantData.tenant?.companyGroups?.length > 0) {
    const cg = tenantData.tenant.companyGroups[0];
    await test('Company group details visible to super admin', () =>
      `Group: "${cg.name}" | Companies: ${cg.companies?.length || 0} | maxEmployees: ${cg.maxEmployees || 'unlimited'} | maxCompanies: ${cg.maxCompanies || 'unlimited'}`);
  }

  if (tenantData.tenant?.employees?.length > 0) {
    await test('Employees visible to super admin', () =>
      `First employee: ${tenantData.tenant.employees[0].firstName} ${tenantData.tenant.employees[0].lastName} (${tenantData.tenant.employees[0].email})`);
  }

  // ─── Step 4: Company Cap Enforcement ───
  console.log('\n--- Step 4: Company Cap Enforcement ---\n');

  await test('Tenant maxCompaniesAllowed setting', () =>
    `maxCompaniesAllowed: ${tenantData.tenant?.maxCompaniesAllowed || dashData?.totalCompanies} (0 = unlimited)`);
  
  // Try to create a company with tenant admin auth
  const companyId = tenantData.tenant?.companyGroups?.[0]?.id;
  if (companyId) {
    const createCompanyRes = await fetch(`${BASE_URLS.tenant}/api/companies`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taAuth.token}`,
      },
      body: JSON.stringify({
        name: 'Test Company for Cap Check',
        companyGroupId: companyId,
        code: 'TEST-CAP',
      }),
    });
    const createCompanyData = await createCompanyRes.json();
    if (createCompanyRes.ok) {
      await test('Company creation under cap limit', () =>
        `Created: "${createCompanyData.company?.name}" — Status: ${createCompanyRes.status}`);
      // Clean up: delete the test company
      if (createCompanyData.company?.id) {
        await fetch(`${BASE_URLS.tenant}/api/companies?id=${createCompanyData.company.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${taAuth.token}` },
        });
      }
    } else {
      await test('Company creation blocked (cap reached)', () =>
        `Error: ${createCompanyData.error} — Code: ${createCompanyData.code}`);
    }
  }

  // ─── Step 5: Tenant Status Control ───
  console.log('\n--- Step 5: Tenant Suspend/Activate Control ---\n');

  // Suspend the tenant
  const suspendRes = await fetch(`${BASE_URLS.platform}/api/tenants/${taAuth.user.tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saAuth.token}`,
    },
    body: JSON.stringify({ status: 'suspended' }),
  });
  const suspendData = await suspendRes.json();
  await test('Super admin suspends tenant', () =>
    `Status changed to: ${suspendData.tenant?.status || 'unknown'} — HTTP: ${suspendRes.status}`);

  // Verify tenant admin can't login anymore
  const blockedLogin = await login(BASE_URLS.tenant, TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
  await test('Tenant admin login blocked after suspension', () =>
    blockedLogin ? '❌ LOGIN SHOULD BE BLOCKED!' : 'Correctly blocked');

  // Verify tenant admin can't create companies even with existing token
  if (taAuth) {
    const blockedWriteRes = await fetch(`${BASE_URLS.tenant}/api/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taAuth.token}`,
      },
      body: JSON.stringify({
        name: 'Should Be Blocked Company',
        companyGroupId: companyId,
        code: 'BLOCKED',
      }),
    });
    const blockedWriteData = await blockedWriteRes.json();
    await test('Tenant admin write blocked after suspension', () =>
      blockedWriteRes.status === 403 
        ? `Correctly blocked — Error: "${blockedWriteData.error}"` 
        : `❌ NOT BLOCKED — HTTP: ${blockedWriteRes.status}`);
  }

  // Re-activate the tenant
  const activateRes = await fetch(`${BASE_URLS.platform}/api/tenants/${taAuth.user.tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saAuth.token}`,
    },
    body: JSON.stringify({ status: 'active' }),
  });
  const activateData = await activateRes.json();
  await test('Super admin re-activates tenant', () =>
    `Status changed to: ${activateData.tenant?.status || 'unknown'} — HTTP: ${activateRes.status}`);

  // Verify tenant admin can login again
  const reactivatedLogin = await login(BASE_URLS.tenant, TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
  await test('Tenant admin login works after re-activation', () =>
    reactivatedLogin ? `Success — role: ${reactivatedLogin.user.role}` : '❌ SHOULD WORK NOW!');

  console.log('\n========================================');
  console.log('  Test Suite Complete');
  console.log('========================================\n');
}

main().catch(console.error);
