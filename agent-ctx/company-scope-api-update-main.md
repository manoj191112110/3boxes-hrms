# Task: Company-Scoped Data Visibility for Leave & Attendance APIs

## Summary
Added company-scoped data visibility to all Leave and Attendance API routes using the `resolveCompanyScope` utility from `/src/lib/companyScope.ts`. Employees from Company A can no longer see Company B's data. Only `super_admin` and `tenant_admin` can see cross-company data.

## Files Modified

### 1. `/prisma/schema.prisma`
- Added `companyId String?` and `company Company?` relation to `AttendancePolicyConfig` model
- Added `@@index([companyId])` to the model
- Added `attendancePolicyConfigs AttendancePolicyConfig[]` back-relation to `Company` model

### 2. `/src/app/api/attendance/route.ts`
- **GET**: Replaced manual auth with `resolveCompanyScope`. Added company scoping:
  - `scope === 'self'`: employees only see their own attendance records (filtered by `employeeId`)
  - `scope.companyId` set: admins filtering by a specific company via `employee: { companyId }`
  - `scope === 'all'` with no `companyId`: admins see all
- **POST**: Added company scoping verification:
  - `scope === 'self'`: employees can only check in/out for themselves
  - `scope.companyId` set: target employee must belong to that company
  - Admin without specific company can access any employee

### 3. `/src/app/api/leave/route.ts`
- **GET**: Same company scoping pattern as attendance GET
- **POST**: Added company scoping verification for leave request creation:
  - Employees can only create leave for themselves
  - Admin with company selected: employee must belong to that company
  - All existing AI collaborative check, auto-approval, and notification logic preserved

### 4. `/src/app/api/leave/[id]/route.ts`
- **PATCH** (approval/rejection): Added company scoping:
  - `scope === 'self'`: employees can only cancel their own requests (not approve/reject)
  - `scope.companyId` set: leave request's employee must belong to that company
  - `scope === 'all'` with no companyId: admin can approve/reject any request
  - All existing balance update and notification logic preserved

### 5. `/src/app/api/leave/balance/route.ts`
- **GET**: Added company scoping:
  - `scope === 'self'`: employees only see their own balances
  - Admin with `companyId`: only see balances for employees in that company
  - Admin without `companyId`: see all balances
  - When admin doesn't specify an employee, returns aggregated balances for their company's employees
  - Leave type fallback also respects company scope

### 6. `/src/app/api/attendance-policy-config/route.ts`
- **GET**: Replaced `requireUser` with `resolveCompanyScope`. Added company scoping:
  - `scope === 'self'`: filter by `ownCompanyId`
  - `scope.companyId` set: filter by that company
  - `scope === 'all'` with no companyId: see latest policy (no filter)
- **PUT**: Added `companyId` to policy data when creating/updating:
  - Policy is associated with the admin's selected or own company
  - Admin-only check preserved via `isAdminRole`

## Key Pattern Used
```typescript
const scope = await resolveCompanyScope(request);
if (!scope) return 401;

const where = {};
if (scope.scope === 'self') {
  // Only own records
  where.employeeId = employee.id;
} else if (scope.companyId) {
  // Specific company filter
  where.employee = { companyId: scope.companyId };
}
// scope === 'all' && no companyId → see all
```

## Lint Results
All modified files pass ESLint with zero errors and zero warnings.
