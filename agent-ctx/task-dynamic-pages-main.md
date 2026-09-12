# Task: Convert Static Pages to Dynamic API-Connected Pages

## Summary
Converted 4 static/hardcoded pages to fully dynamic pages with real API data fetching:

### API Routes Created
1. `/src/app/api/preboarding-settings/route.ts` - GET + PUT
   - Uses Setting model (category: "preboarding") for key-value storage
   - Stores: communicationItems (json), documentChecklist (json), autoAssignBuddy, sendWelcomeEmail, autoCreateAccounts, bgvOnAccept

2. `/src/app/api/preboarding-reports/route.ts` - GET
   - Aggregates from PreboardingCandidate model
   - Report types: summary, documents, pipeline
   - Computes: totals, by status, completion rate, avg onboarding days, BGV stats, monthly trends

3. `/src/app/api/support-settings/route.ts` - GET + PUT
   - Uses Setting model (category: "support") for key-value storage
   - Stores: autoAssign, priorityEscalation, aiCategorization, slaCritical/High/Normal/Low, emailNotifications, autoCloseResolved, autoCloseDays

4. `/src/app/api/support-reports/route.ts` - GET
   - Aggregates from Ticket/TicketCategory models
   - Report types: ticket-summary, sla-compliance, agent-performance, csat-scores
   - Computes: by category/priority/status, SLA compliance rates, resolution times, agent performance

### Frontend Pages Updated
1. `/src/app/(dashboard)/preboarding/settings/page.tsx` - Now fetches from API, has loading/empty states, save/refresh buttons, additional settings toggles
2. `/src/app/(dashboard)/preboarding/reports/page.tsx` - Now fetches aggregated data, renders real tables/charts with empty states
3. `/src/app/(dashboard)/helpdesk/settings/page.tsx` - Now fetches from API, real save to DB, added email notifications and auto-close settings
4. `/src/app/(dashboard)/helpdesk/reports/page.tsx` - Now fetches real data for all 4 report types with proper rendering

### Patterns Used
- Auth: verifyToken + getTokenFromHeaders from @/lib/auth
- DB: getDb(request) from @/lib/tenant-db, withSchemaSync
- Settings stored as Setting model key-value pairs with upsert
- Frontend: getAuthHeaders() + fetch() + useEffect/useState
- Loading states with skeleton/animation
- Empty states when no data
- Toast notifications for success/error
