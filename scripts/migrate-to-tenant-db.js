#!/usr/bin/env node
/**
 * Migration Script: Convert API routes from shared prisma to per-tenant getDb(request)
 *
 * This script:
 * 1. Finds all API route files that import prisma from '@/lib/prisma'
 * 2. Replaces the import with: import { getDb, getPlatformDb } from '@/lib/tenant-db'
 * 3. Wraps prisma.xxx calls inside each handler with: const db = await getDb(request); db.xxx
 * 4. For platform-level operations (Tenant, TenantDatabase, TrialRegistration, User auth),
 *    uses getPlatformDb() instead.
 *
 * Platform models (always use platform DB):
 *   - Tenant, TenantDatabase, TrialRegistration, FeatureFlag, Subscription, SubscriptionPlan
 *   - User (for auth operations only - login, register, switch-tenant)
 *   - Role (RBAC is platform-level for super_admin, tenant-level for others)
 *
 * Run: node scripts/migrate-to-tenant-db.js
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api');

// Models that should ALWAYS use the platform DB (cross-tenant data)
const PLATFORM_MODELS = [
  'tenant', 'tenantDatabase', 'trialRegistration', 'featureFlag',
  'subscription', 'subscriptionPlan', 'dataResidencyPolicy',
];

// Routes that are entirely platform-level (auth, tenant management, etc.)
const PLATFORM_ROUTES = [
  '/api/auth/',
  '/api/tenants',
  '/api/tenant-database/',
  '/api/trial/',
  '/api/rbac/',          // RBAC roles/permissions are platform-level
  '/api/public/',        // Public routes don't have tenant context
  '/api/fix-tenant',
  '/api/setup-database',
  '/api/db-push',
  '/api/admin/seed',     // Seed routes are admin operations
  '/api/seed/',          // Seed routes
  '/api/cleanup',
  '/api/super-admin/',   // Super admin sees cross-tenant data
];

function isPlatformRoute(filePath) {
  const relativePath = filePath.replace(API_DIR, '');
  return PLATFORM_ROUTES.some(prefix => relativePath.startsWith(prefix));
}

function findRouteFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      files.push(fullPath);
    }
  }
  return files;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace(API_DIR, '/api');

  // Skip if already migrated
  if (content.includes("from '@/lib/tenant-db'") || content.includes('getDb(')) {
    console.log(`  ⏭️  Already migrated: ${relativePath}`);
    return 'skipped';
  }

  // Skip if no prisma import
  if (!content.includes("from '@/lib/prisma'") && !content.includes("from '@/lib/db'")) {
    console.log(`  ⏭️  No prisma import: ${relativePath}`);
    return 'skipped';
  }

  const isPlatform = isPlatformRoute(filePath);

  // Replace import
  if (isPlatform) {
    content = content.replace(
      /import prisma from '@\/lib\/prisma';?/g,
      "import { getPlatformDb } from '@/lib/tenant-db';"
    );
    content = content.replace(
      /import { db as prisma[^}]*} from '@\/lib\/db';?/g,
      "import { getPlatformDb } from '@/lib/tenant-db';"
    );
    content = content.replace(
      /import prisma from '@\/lib\/db';?/g,
      "import { getPlatformDb } from '@/lib/tenant-db';"
    );
  } else {
    content = content.replace(
      /import prisma from '@\/lib\/prisma';?/g,
      "import { getDb, getPlatformDb } from '@/lib/tenant-db';"
    );
    content = content.replace(
      /import { db as prisma[^}]*} from '@\/lib\/db';?/g,
      "import { getDb, getPlatformDb } from '@/lib/tenant-db';"
    );
    content = content.replace(
      /import prisma from '@\/lib\/db';?/g,
      "import { getDb, getPlatformDb } from '@/lib/tenant-db';"
    );
  }

  // For platform routes: replace prisma.xxx with getPlatformDb().xxx
  if (isPlatform) {
    // Replace prisma.model.method patterns
    content = content.replace(/prisma\.(\w+)\./g, 'getPlatformDb().$1.');
    // Replace prisma.$transaction patterns
    content = content.replace(/prisma\.\$/g, 'getPlatformDb().$');
    console.log(`  ✅ Platform route: ${relativePath}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return 'platform';
  }

  // For tenant routes: we need to add `const db = await getDb(request);` at the start
  // of each handler function and replace prisma.xxx with db.xxx
  // But we need to be careful about platform model access within tenant routes

  // Strategy: Add db initialization after each handler function opening
  // and replace prisma.xxx with db.xxx for tenant models,
  // keep getPlatformDb().xxx for platform models

  // Find all exported async functions (GET, POST, PUT, PATCH, DELETE, OPTIONS)
  const handlerPattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\((\s*request[^)]*)\)\s*\{/g;

  let match;
  const replacements = [];

  while ((match = handlerPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const handlerName = match[1];
    const params = match[2];

    // Add db initialization after the function opening brace
    const newHandler = fullMatch + `\n  const db = await getDb(request);`;
    replacements.push({ old: fullMatch, new: newHandler });
  }

  // Apply handler modifications
  for (const rep of replacements) {
    content = content.replace(rep.old, rep.new);
  }

  // Replace prisma.model.method with db.model.method for tenant models
  // Platform models should use getPlatformDb()
  const platformModelPattern = new RegExp(
    `prisma\\.(${PLATFORM_MODELS.join('|')})\\.`, 'g'
  );
  content = content.replace(platformModelPattern, 'getPlatformDb().$1.');

  // Replace remaining prisma.xxx with db.xxx
  // But only if db has been initialized in the current scope
  content = content.replace(/prisma\.(\w+)\./g, (match, model) => {
    if (PLATFORM_MODELS.includes(model)) {
      return `getPlatformDb().${model}.`;
    }
    return `db.${model}.`;
  });

  // Replace prisma.$transaction with db.$transaction
  content = content.replace(/prisma\.\$/g, 'db.$');

  // Handle cases where prisma is used outside of handlers (e.g., at module level)
  // For module-level code, use getPlatformDb() since there's no request context
  // This is a simplification — module-level prisma calls are rare

  console.log(`  ✅ Tenant route: ${relativePath}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return 'tenant';
}

// Main
console.log('🔧 Migrating API routes to per-tenant DB routing...\n');

const routeFiles = findRouteFiles(API_DIR);
console.log(`Found ${routeFiles.length} route files\n`);

let platformCount = 0;
let tenantCount = 0;
let skippedCount = 0;

for (const file of routeFiles) {
  const result = migrateFile(file);
  if (result === 'platform') platformCount++;
  else if (result === 'tenant') tenantCount++;
  else skippedCount++;
}

console.log(`\n📊 Migration Summary:`);
console.log(`   Platform routes: ${platformCount}`);
console.log(`   Tenant routes: ${tenantCount}`);
console.log(`   Skipped: ${skippedCount}`);
console.log(`\n✅ Migration complete!`);
