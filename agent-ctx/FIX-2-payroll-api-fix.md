# Task FIX-2: Fix Payroll API Routes - Work Record

## Summary
Wrapped all prisma calls that touch `PayrollRun`, `PayrollTransactionLine`, or `PayrollInput` tables in individual try/catch blocks across 5 payroll API route files to prevent server crashes when these tables don't exist in the production Neon database.

## Files Modified

### 1. `/src/app/api/payroll/runs/route.ts`
- **GET handler**: Wrapped `prisma.payrollRun.findMany` → returns `{ data: [] }` on table-not-found
- **POST handler**: Wrapped `prisma.payrollRun.create` → returns 503 with error message on table-not-found

### 2. `/src/app/api/payroll/runs/[id]/route.ts`
- **GET handler**: Wrapped `prisma.payrollRun.findUnique` (with includes for transactionLines, payrollInputs, complianceFilings) → returns 404 on table-not-found
- **PUT handler**: Wrapped `prisma.payrollRun.update` → returns 404 on table-not-found
- **PATCH handler**: Wrapped `prisma.payrollRun.findUnique` and `prisma.payrollRun.update` individually → returns 404 on table-not-found
- **DELETE handler**: Wrapped each delete operation individually:
  - `prisma.payrollRun.findUnique` → returns 404 on table-not-found
  - `prisma.payrollTransactionLine.deleteMany` → logs and skips on failure
  - `prisma.payrollInput.deleteMany` → logs and skips on failure
  - `prisma.complianceFiling.deleteMany` → logs and skips on failure
  - `prisma.payrollRun.delete` → returns 404 on table-not-found

### 3. `/src/app/api/payroll/runs/[id]/calculate/route.ts`
- **POST handler**: Wrapped each prisma call individually:
  - `prisma.payrollRun.findUnique` → returns 404 on table-not-found
  - `prisma.payrollInput.findMany` → falls back to empty array `[]`
  - `prisma.payrollTransactionLine.deleteMany` → logs and skips on failure
  - `prisma.payrollTransactionLine.createMany` → logs and skips on failure
  - `prisma.payrollRun.update` → logs and skips (returns computed results even if update fails)

### 4. `/src/app/api/payroll/inputs/route.ts`
- **GET handler**: Wrapped `prisma.payrollInput.findMany` → returns `{ data: [] }` on table-not-found
- **POST handler**: Wrapped `prisma.payrollInput.create` → returns 503 with error message on table-not-found

### 5. `/src/app/api/payroll/inputs/[id]/route.ts`
- **PUT handler**: Wrapped `prisma.payrollInput.update` → returns 404 on table-not-found
- **PATCH handler**: Wrapped `prisma.payrollInput.update` → returns 404 on table-not-found
- **DELETE handler**: Wrapped `prisma.payrollInput.delete` → returns 404 on table-not-found

## Design Decisions
- **Inner try/catch approach**: Each prisma call gets its own try/catch inside the handler, while the outer try/catch remains for auth/validation errors
- **Graceful degradation**: List endpoints return empty arrays; single-item endpoints return 404; write endpoints return 503 or 404
- **No behavior changes**: Auth checks, CORS headers, and existing response formats remain unchanged
- **Calculation continues**: The calculate endpoint still computes results even if transaction lines can't be persisted, returning the summary data

## Lint Results
No new lint errors introduced. One pre-existing warning in `[id]/route.ts` (unused `runStatus` variable in PUT handler - intentionally destructured to exclude it from update data).
