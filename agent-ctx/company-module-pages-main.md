# Task: Company Module Sub-Pages

## Summary
Created 11 files for the company module in the Next.js HRMS application, replacing the single tab-based company-management.tsx with individual pages under `/company/` using Next.js URL routing.

## Files Created
1. **layout.tsx** - Company layout with breadcrumb navigation and sub-nav bar with links to all 11 sub-pages
2. **companies/page.tsx** - Company cards grid (3 cols) with full CRUD, view details, search
3. **branches/page.tsx** - Branches table with CRUD, company select, info banner
4. **departments/page.tsx** - Departments table with CRUD, company select, info banner
5. **designations/page.tsx** - Designations table with CRUD, grade badges, salary range
6. **grades/page.tsx** - Grades card grid (4 cols) derived from designations, view-only
7. **shifts/page.tsx** - Shifts table with CRUD, night/day icons, time formatting
8. **holidays/page.tsx** - Holidays table with CRUD, type badges, date/day formatting
9. **policies/page.tsx** - Policies table with CRUD, category badges, version tracking
10. **settings/page.tsx** - Full settings page with 6 sections (Company Info, Working Hours, Leave Policy, Attendance, Fiscal Year, Notifications) with toggles/inputs/selects
11. **reports/page.tsx** - Report cards grid with 7 report types, generate/download buttons

## Architecture
- Each page is standalone with `'use client'` directive
- All pages import from shared `@/components/company/useCompanyData` hook
- Layout provides breadcrumb + sub-nav with active state highlighting based on URL path
- Uses Next.js `usePathname()` and `Link` components for client-side navigation
- Consistent design patterns: gradient headers, search inputs, table/card layouts, inline forms, delete confirmations
- CSS classes from existing codebase: `thb-card`, `thb-badge`, `thb-text-*`, etc.

## Type Check Results
No type errors in the company module files. Pre-existing errors exist in `src/lib/currency.ts` and `scripts/cleanup-rbac-3roles.ts` (unrelated).

## Dev Server
Running without errors on port 3000.
