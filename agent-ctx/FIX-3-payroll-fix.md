# FIX-3: Fix Payroll Report API Routes

## Task
Wrap prisma calls that access `PayrollRun`, `PayrollTransactionLine`, and `StatutoryComponent` tables in try/catch blocks so the API routes gracefully handle cases where these tables don't exist in the production Neon database.

## Changes Made

### 1. `/src/app/api/payroll/reports/salary-register/route.ts`
- **`prisma.payrollRun.findMany`** (line 58-66): Wrapped in try/catch. On failure, `payrollRuns` defaults to `[]`, which causes `runIds` to be empty, skipping transaction line fetch.
- **`prisma.payrollTransactionLine.findMany`** (line 89-100): Wrapped in try/catch. On failure, `transactionLines` defaults to `[]`, which causes the code to fall back to the `Payroll` model data path.

### 2. `/src/app/api/payroll/reports/statutory/route.ts`
- **`prisma.payrollRun.findMany`** (line 41-44): Wrapped in try/catch. On failure, `payrollRuns` defaults to `[]`.
- **`prisma.statutoryComponent.findMany`** (line 66-73): Wrapped in try/catch. On failure, `statutoryComponents` defaults to `[]`.
- **`prisma.payrollTransactionLine.findMany`** (line 96-107): Wrapped in try/catch. On failure, `transactionLines` defaults to `[]`.

## Behavior
- When a table doesn't exist, the prisma error is caught, logged as a warning, and the variable is set to an empty array.
- The existing code structure, auth checks, and CORS headers remain unchanged.
- The outer try/catch still handles any other unexpected errors.
- Responses always return valid JSON with appropriate empty data structures.

## Lint
No new lint errors introduced in the modified files.
