/**
 * Full tenant setup: push schema, seed, link TenantDatabase on platform.
 * Run: npx tsx scripts/setup-tenant-full.ts
 */
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const tenantUrl = process.env.TENANT_DATABASE_URL;
if (!tenantUrl) {
  console.error('TENANT_DATABASE_URL missing in .env');
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: tenantUrl };

console.log('=== Step 1: prisma db push (tenant DB) ===');
execSync('npx prisma db push', { stdio: 'inherit', env, cwd: process.cwd() });

console.log('\n=== Step 2: seed Marq AI (tenant DB) ===');
execSync('npx tsx prisma/seed-marqai.ts', { stdio: 'inherit', env, cwd: process.cwd() });

console.log('\n=== Step 3: link TenantDatabase on platform DB ===');
execSync('npx tsx scripts/provision-tenant-link.ts', { stdio: 'inherit', env: process.env, cwd: process.cwd() });

console.log('\nAll done.');
