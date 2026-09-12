# Task: Make Project Management Pages Fully Dynamic

## Summary
Converted three Project Management pages from static/hardcoded to fully dynamic with real API data fetching.

## Changes Made

### 1. API Route: `/src/app/api/project-settings/route.ts` (NEW)
- **GET** - Fetches project settings from the `Setting` model (category="project")
- **PUT** - Upserts project settings (admin only)
- Uses the existing `Setting` model with key-value pairs
- Settings managed: sprintDuration, autoAssign, requireApproval, defaultView, timeTrackingEnabled, overtimeEnabled, notifyOnDeadline, autoTimesheetApproval
- Follows existing auth pattern: `getDb()`, `verifyToken()`, `getTokenFromHeaders()`, `withSchemaSync()`
- Returns defaults when no settings exist yet
- Parses boolean/number/string dataTypes correctly

### 2. API Route: `/src/app/api/project-reports/route.ts` (NEW)
- **GET** - Computes aggregated report data from the database
- Computes: revenueByType, monthlyStarts (last 6 months), budgetVsActual, resourceUtilization (by department), summaryStats, taskDistribution, overdueTasks
- Uses Project, ProjectTask, and ProjectAllocation models
- Returns empty arrays when no data exists (no hardcoded fallbacks)

### 3. Settings Page: `/src/app/(dashboard)/project-management/settings/page.tsx` (UPDATED)
- Removed: setTimeout mock save
- Added: `useEffect` to fetch settings from `/api/project-settings` on mount
- Added: Real `fetch('/api/project-settings', { method: 'PUT' })` on save
- Added: Loading skeleton state
- Added: Additional settings fields (defaultView, requireApproval, overtimeEnabled, autoTimesheetApproval)
- Added: Error handling with toast notifications

### 4. Reports Page: `/src/app/(dashboard)/project-management/reports/page.tsx` (UPDATED)
- Removed: All hardcoded fallback arrays (REVENUE_BY_TYPE, MONTHLY_STARTS, BUDGET_VS_ACTUAL, RESOURCE_UTILIZATION)
- Added: Single `fetch('/api/project-reports')` call on mount
- Added: Error state with retry button
- Added: Empty chart states when no data available
- Added: Loading skeletons for all sections
- Data now comes entirely from the API

### 5. Main Page: `/src/app/(dashboard)/project-management/page.tsx` (UPDATED)
- Removed: All hardcoded demo data (DEMO_PROJECTS, DEMO_SPRINTS, DEMO_TASKS, projectStatusData, burndownData, taskDistData, teamWorkloadData, recentActivity, upcomingDeadlines)
- Added: Real API fetching from `/api/projects` and `/api/projects/[id]/tasks`
- Added: Computed chart data from real API data (projectStatusData, taskDistData, teamWorkloadData derived from actual projects/tasks)
- Added: Loading states (skeletons) for all tabs
- Added: Empty states when no data available
- Modals now reference real project data from API
- Sprints tab shows empty state since no sprint API exists yet

## Technical Patterns Used
- Auth: `getTokenFromHeaders()` + `verifyToken()` from `@/lib/auth`
- DB: `getDb(request)` from `@/lib/tenant-db` for tenant-scoped DB
- Schema: `withSchemaSync()` for runtime schema sync
- Frontend: `getAuthHeaders()` + `fetch()` + `useEffect`/`useState`
- Toast: `react-hot-toast` for notifications
- CORS: Standard `corsHeaders()` pattern matching existing routes
