/**
 * 3Boxes HRMS — Re-export of the database client (DEPRECATED)
 *
 * ⚠️  This file is DEPRECATED. Do NOT import from here in new code.
 * ⚠️  Use the tenant-aware database routing instead:
 *
 *   import { getDb, getPlatformDb } from '@/lib/tenant-db';
 *
 *   // For tenant-scoped data (most routes):
 *   const db = await getDb(request);
 *
 *   // For platform-level data (auth, tenant management):
 *   const db = getPlatformDb();
 *
 * This file still exports `db` as `prisma` and `default` for any
 * remaining non-API files that haven't been migrated yet.
 */
export { db as prisma, db as default } from '@/lib/db'
