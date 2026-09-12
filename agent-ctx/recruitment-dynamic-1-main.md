# Task: Make Recruitment Module Pages Fully Dynamic

## Summary
Converted three Recruitment module pages from static/hardcoded content to fully dynamic API-driven pages.

## Changes Made

### 1. API Route: `/api/recruitment-settings/route.ts` (NEW)
- **GET**: Fetches recruitment settings from `Setting` model (category='recruitment'), merges with defaults
- **PUT**: Upserts recruitment settings, admin-only, creates audit log
- Settings stored as key-value pairs in `Setting` model with tenant scoping
- 19 settings keys: autoPublish, requisitionApproval, resumeParsingAI, offerTemplate, backgroundCheck, probationPeriod, noticePeriod, referralBonus, maxInterviewRounds, skillAssessment, documentVerification, offerExpiry, aiScreening, videoInterview, candidatePortal, emailNotifications, smsNotifications, hiringFreeze, piiRetention
- Auth pattern: `getTokenFromHeaders` → `verifyToken` → tenant lookup → `ensureSchemaSynced`

### 2. API Route: `/api/recruitment-reports/route.ts` (NEW)
- **GET**: Computes real recruitment report data from database
- Aggregates from `JobPosting`, `JobApplication`, `Requisition`, `Offer` models
- Returns: hiringSummary (by department), overall KPIs, timeToHire (avg + by dept), sourceAnalytics, offerAcceptance rates, monthlyTrend (6 months)

### 3. Page: `recruitment/settings/page.tsx` (UPDATED)
- Removed all hardcoded `useState` defaults with `setTimeout` mock save
- Added `useEffect`/`useCallback` to fetch settings from `/api/recruitment-settings` on mount
- Save button calls PUT endpoint
- Added loading skeleton state
- Added refresh button
- Added more settings groups: Interview & Communication, Onboarding & Periods
- Non-admin users see disabled controls

### 4. Page: `recruitment/reports/page.tsx` (UPDATED)
- Removed static `derivedHiringData` with all zeros
- Added API fetch from `/api/recruitment-reports`
- Added overall KPI cards (Open Positions, Applications, Hired, Hiring Rate)
- Hiring Summary: real department-wise data from API
- Time to Hire: shows avg days + by-department breakdown + time-to-fill + open requisitions
- Source Analytics: real source-wise application/hired/conversion data
- Offer Acceptance: real accepted/rejected/pending/rate from API
- Monthly Trend: real 6-month trend data
- Loading skeletons and empty states for all sections

### 5. Page: `job-portal/page.tsx` (UPDATED)
- Removed hardcoded `FEATURED_JOBS` array
- Removed fake AI recommendation cards
- Featured jobs now derived from API data: open positions sorted by application count (most popular), limited to 6
- Featured cards show real job data (title, department, location, salary, type, experience, applicant count)
- Apply button on featured cards works with existing apply form
- Loading skeletons and empty state for featured tab
