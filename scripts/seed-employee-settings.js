/**
 * Seed demo data for employee settings, custom fields, and user avatars.
 * Run: node scripts/seed-employee-settings.js
 */
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech',
  database: 'tenant_demo',
  user: 'neondb_owner',
  password: 'npg_pxZd8woKe4WB',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
};

// Generate a unique ID similar to seed scripts
function cuid() {
  return 'es_' + require('crypto').randomBytes(10).toString('hex');
}

// Generate a simple SVG-based avatar as a data URL
function generateAvatarDataURL(firstName, lastName, bgColor) {
  const initials = (firstName[0] || '') + (lastName[0] || '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bgColor}" rx="50"/>
    <text x="50" y="50" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#EC4899', '#EF4444', '#F59E0B',
  '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#F97316',
  '#14B8A6', '#6366F1', '#D946EF', '#0EA5E9', '#84CC16',
];

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('Connected to tenant_demo');

  // 1. Get tenant ID
  const tenantResult = await client.query('SELECT id FROM "Tenant" LIMIT 1');
  const tenantId = tenantResult.rows[0]?.id;
  if (!tenantId) {
    console.error('No tenant found in tenant_demo DB!');
    process.exit(1);
  }
  console.log('Tenant ID:', tenantId);

  // 2. Seed EmployeeCustomField data
  const customFields = [
    { scope: 'global', label: 'Blood Group', key: 'blood_group', fieldType: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], isRequired: false, displayOrder: 1 },
    { scope: 'global', label: 'Emergency Contact', key: 'emergency_contact', fieldType: 'text', options: null, isRequired: false, displayOrder: 2 },
    { scope: 'global', label: 'PAN Number', key: 'pan_number', fieldType: 'text', options: null, isRequired: false, displayOrder: 3 },
    { scope: 'global', label: 'Aadhaar Number', key: 'aadhaar_number', fieldType: 'text', options: null, isRequired: false, displayOrder: 4 },
    { scope: 'global', label: 'UAN Number', key: 'uan_number', fieldType: 'text', options: null, isRequired: false, displayOrder: 5 },
    { scope: 'global', label: 'Passport Number', key: 'passport_number', fieldType: 'text', options: null, isRequired: false, displayOrder: 6 },
    { scope: 'global', label: 'Driving License', key: 'driving_license', fieldType: 'text', options: null, isRequired: false, displayOrder: 7 },
    { scope: 'global', label: 'Marital Status', key: 'marital_status', fieldType: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], isRequired: false, displayOrder: 8 },
    { scope: 'global', label: 'Number of Dependents', key: 'dependents_count', fieldType: 'number', options: null, isRequired: false, displayOrder: 9 },
    { scope: 'global', label: 'Highest Education', key: 'highest_education', fieldType: 'select', options: ['High School', 'Diploma', 'Bachelor\'s', 'Master\'s', 'Doctorate', 'Post-Doctorate'], isRequired: false, displayOrder: 10 },
    { scope: 'global', label: 'Work Experience (Years)', key: 'work_experience_years', fieldType: 'number', options: null, isRequired: false, displayOrder: 11 },
    { scope: 'global', label: 'Skills', key: 'skills', fieldType: 'multiselect', options: ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Machine Learning'], isRequired: false, displayOrder: 12 },
    { scope: 'global', label: 'Preferred Language', key: 'preferred_language', fieldType: 'select', options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali'], isRequired: false, displayOrder: 13 },
    { scope: 'global', label: 'Food Preference', key: 'food_preference', fieldType: 'select', options: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Eggetarian'], isRequired: false, displayOrder: 14 },
    { scope: 'global', label: 'Desk Location', key: 'desk_location', fieldType: 'text', options: null, isRequired: false, displayOrder: 15 },
  ];

  // Check existing custom fields
  const existingCF = await client.query('SELECT key FROM "EmployeeCustomField"');
  const existingKeys = new Set(existingCF.rows.map(r => r.key));
  let cfCreated = 0;

  for (const cf of customFields) {
    if (existingKeys.has(cf.key)) continue;
    try {
      await client.query(
        `INSERT INTO "EmployeeCustomField" (id, scope, "countryCode", "companyId", label, key, "fieldType", options, "isRequired", "isVisibleToManager", "isVisibleToPeer", "displayOrder", "createdById", "createdAt", "updatedAt")
         VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7, true, false, $8, NULL, NOW(), NOW())`,
        [cuid(), cf.scope, cf.label, cf.key, cf.fieldType, cf.options ? JSON.stringify(cf.options) : null, cf.isRequired, cf.displayOrder]
      );
      cfCreated++;
    } catch (err) {
      console.warn(`  Custom field ${cf.key} failed:`, err.message);
    }
  }
  console.log(`Created ${cfCreated} custom fields`);

  // 3. Add avatars to Users via Employee relationship
  const users = await client.query('SELECT u.id, u.email, e."firstName", e."lastName" FROM "User" u JOIN "Employee" e ON e."userId" = u.id WHERE u.avatar IS NULL');
  let avatarCount = 0;
  for (const user of users.rows) {
    const colorIdx = avatarCount % AVATAR_COLORS.length;
    const avatar = generateAvatarDataURL(user.firstName || 'U', user.lastName || '', AVATAR_COLORS[colorIdx]);
    try {
      await client.query('UPDATE "User" SET avatar = $1 WHERE id = $2', [avatar, user.id]);
      avatarCount++;
    } catch (err) {
      console.warn(`  Avatar for ${user.email} failed:`, err.message);
    }
  }
  console.log(`Updated ${avatarCount} user avatars`);

  // 4. Also add avatars for users without employee (like superadmin)
  const adminUsers = await client.query('SELECT id, email, role FROM "User" u WHERE u.avatar IS NULL AND NOT EXISTS (SELECT 1 FROM "Employee" e WHERE e."userId" = u.id)');
  let adminAvatarCount = 0;
  for (const user of adminUsers.rows) {
    const name = user.email.split('@')[0];
    const colorIdx = (avatarCount + adminAvatarCount) % AVATAR_COLORS.length;
    const avatar = generateAvatarDataURL(name[0]?.toUpperCase() || 'A', name[1]?.toUpperCase() || '', AVATAR_COLORS[colorIdx]);
    try {
      await client.query('UPDATE "User" SET avatar = $1 WHERE id = $2', [avatar, user.id]);
      adminAvatarCount++;
    } catch (err) {
      console.warn(`  Admin avatar for ${user.email} failed:`, err.message);
    }
  }
  console.log(`Updated ${adminAvatarCount} admin user avatars`);

  // 5. Seed EmployeeCompanyMapping data (for map-company tab)
  const employees = await client.query('SELECT id, "employeeId", "companyId", "departmentId", "designationId", "branchId" FROM "Employee" WHERE status = \'active\' LIMIT 50');
  let mappingCount = 0;
  for (const emp of employees.rows) {
    if (!emp.companyId) continue;
    // Check if mapping already exists
    const existing = await client.query('SELECT id FROM "EmployeeCompanyMapping" WHERE "employeeId" = $1 AND "companyId" = $2', [emp.id, emp.companyId]);
    if (existing.rows.length > 0) continue;
    try {
      await client.query(
        `INSERT INTO "EmployeeCompanyMapping" (id, "employeeId", "companyId", "departmentId", "designationId", "branchId", "isPrimary", status, "startDate", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, true, 'active', NOW(), NOW(), NOW())`,
        [cuid(), emp.id, emp.companyId, emp.departmentId, emp.designationId, emp.branchId]
      );
      mappingCount++;
    } catch (err) {
      console.warn(`  Mapping for ${emp.employeeId} failed:`, err.message);
    }
  }
  console.log(`Created ${mappingCount} employee company mappings`);

  // 6. Verify TenantConfiguration has correct tenantId
  const tcResult = await client.query('SELECT id, "tenantId" FROM "TenantConfiguration"');
  for (const tc of tcResult.rows) {
    if (tc.tenantId !== tenantId) {
      console.log(`Fixing TenantConfiguration tenantId from ${tc.tenantId} to ${tenantId}`);
      await client.query('UPDATE "TenantConfiguration" SET "tenantId" = $1 WHERE id = $2', [tenantId, tc.id]);
    }
  }
  console.log('TenantConfiguration tenantId verified');

  // 7. Verify all users have correct tenantId
  const wrongTenantUsers = await client.query('SELECT id, email, "tenantId" FROM "User" WHERE "tenantId" != $1', [tenantId]);
  if (wrongTenantUsers.rows.length > 0) {
    for (const u of wrongTenantUsers.rows) {
      console.log(`Fixing User ${u.email} tenantId from ${u.tenantId} to ${tenantId}`);
      await client.query('UPDATE "User" SET "tenantId" = $1 WHERE id = $2', [tenantId, u.id]);
    }
  }
  console.log('User tenantIds verified');

  await client.end();
  console.log('\nDone! All employee settings data seeded successfully.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
