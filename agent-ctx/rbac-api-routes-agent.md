# Task: Create Complete RBAC API Routes for 3 Boxes HRMS

## Task ID: rbac-api-routes

## Summary

Created 7 complete RBAC API route files for the Next.js 16 "3 Boxes HRMS" SaaS platform. All routes use JWT authentication (`verifyToken` + `getTokenFromHeaders` from `@/lib/auth`), Prisma ORM (`import prisma from '@/lib/prisma'`), and follow the project's existing CORS header pattern.

## Files Created

1. **`/src/app/api/rbac/seed/route.ts`** (404 lines)
   - POST endpoint to seed RBAC data
   - Creates 37 HRMS modules with permissions (view, create, edit, delete, export, approve)
   - Creates 7 system roles: super_admin, tenant_admin, hr_admin, manager, employee, recruiter, candidate
   - Assigns appropriate permissions to each role
   - Idempotent - checks if modules already exist
   - Only super_admin can seed

2. **`/src/app/api/rbac/modules/route.ts`** (146 lines)
   - GET: Returns all modules grouped by category with their permissions
   - Super admin sees all modules; others see modules based on their role permissions
   - Returns modules, totalModules, and categories

3. **`/src/app/api/rbac/roles/route.ts`** (261 lines)
   - GET: List roles with user count and permission count
   - Super admin sees all; tenant admin sees roles for their tenant
   - Supports ?tenantId= and ?companyId= filters
   - POST: Create a new role with name, key, description, tenantId, companyId, level
   - Super admin can create for any tenant; tenant admin only for their tenant
   - Validates key format (lowercase, alphanumeric, underscores)

4. **`/src/app/api/rbac/roles/[id]/route.ts`** (365 lines)
   - GET: Get role with permissions grouped by module
   - PUT: Update role name/description/status (system roles cannot be deactivated)
   - DELETE: Delete role (cannot delete system roles or roles with user assignments)

5. **`/src/app/api/rbac/roles/[id]/permissions/route.ts`** (333 lines)
   - GET: Get all permissions for a role (shows granted/denied/not-set for each module)
   - PUT: Replace all permissions for a role atomically (transaction-based)
   - Validates permission IDs exist before assignment

6. **`/src/app/api/rbac/roles/[id]/assign/route.ts`** (172 lines)
   - POST: Assign role to multiple users with optional company scope
   - Handles duplicate assignments gracefully (skips instead of errors)
   - Validates users exist and are within the allowed tenant scope

7. **`/src/app/api/rbac/my-permissions/route.ts`** (235 lines)
   - GET: Returns current user's effective permissions
   - Super admin gets all permissions automatically
   - For other users, merges permissions from all role assignments
   - Higher-level roles (lower level number) take precedence
   - Backward compatible with legacy `user.role` field

## Schema Fix

Also fixed corrupted entries in `prisma/schema.prisma` where `[moduleId]` brackets were missing in the Permission model:
- `fields: oduleId]` → `fields: [moduleId]`
- `@@unique(oduleId, action])` → `@@unique([moduleId, action])`
- `@@index(oduleId])` → `@@index([moduleId])`

## Key Design Decisions

- **Access Control**: Super admin has full access; tenant admin scoped to their tenant
- **CORS**: All routes include CORS headers following the existing project pattern
- **Error Handling**: Proper HTTP status codes (401, 403, 404, 409, 500) with descriptive messages
- **Atomicity**: Permission replacement uses Prisma transactions
- **Backward Compatibility**: my-permissions route falls back to legacy `user.role` field
- **Idempotency**: Seed endpoint checks for existing data before creating
