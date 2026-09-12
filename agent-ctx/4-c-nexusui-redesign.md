# Task 4-c: NexusUI Redesign - Admin, Client, Vendor & Other Pages

## Task ID
4-c

## Summary
Redesign all remaining dashboard pages using the NexusUI Design System at `src/components/nexus-ui/index.tsx`.

## Pages to Redesign (by module)

### Super Admin (dark navy/slate gradient)
1. `super-admin/page.tsx` - Main console with tenant management
2. `super-admin/feature-flags/page.tsx` - Feature flags per tenant
3. `super-admin/collab-features/page.tsx` - Collaboration feature toggles
4. `super-admin/rbac/page.tsx` - RBAC role/permission management
5. `super-admin/sso-providers/page.tsx` - SSO provider configuration
6. `super-admin/audit-logs/page.tsx` - Audit log viewer
7. `super-admin/ediscovery/page.tsx` - Legal holds management
8. `super-admin/storage-quotas/page.tsx` - Storage quota management

### Tenant Admin (indigo gradient)
9. `tenant-admin/page.tsx` - Tenant admin dashboard
10. `tenant-admin/companies/page.tsx` - Company management
11. `tenant-admin/group-companies/page.tsx` - Group companies (read-only)
12. `tenant-admin/profile-config/page.tsx` - Profile custom fields
13. `tenant-admin/rbac/page.tsx` - Tenant RBAC
14. `tenant-admin/storage-analytics/page.tsx` - Storage analytics
15. `tenant-admin/comm-governance/page.tsx` - Communication policies

### Clients (teal gradient)
16. `clients/page.tsx` - Client management
17. `clients/insights/page.tsx` - AI client analytics
18. `clients/sow/page.tsx` - SOW management

### Vendors (orange gradient)
19. `vendors/page.tsx` - Vendor management
20. `vendors/compliance/page.tsx` - Vendor compliance tracker

### Invoices (green gradient)
21. `invoices/page.tsx` - Invoice management
22. `invoices/[id]/page.tsx` - Invoice detail

### Collaboration (purple gradient)
23. `collaboration/page.tsx` - Collaboration hub
24. `collaboration/files/page.tsx` - File hub
25. `collaboration/calls/page.tsx` - Call management
26. `collaboration/chat/page.tsx` - Chat messaging

### Marketplace (pink gradient)
27. `marketplace/page.tsx` - Marketplace hub
28. `marketplace/insights/page.tsx` - AI insights
29. `marketplace/ewa/page.tsx` - Earned wage access
30. `marketplace/insurance/page.tsx` - Insurance
31. `marketplace/catalog/page.tsx` - Corporate catalog
32. `marketplace/wallet/page.tsx` - Wallet
33. `marketplace/loans/page.tsx` - Loans
34. `marketplace/gifting/page.tsx` - Gifting & rewards

### Reports (blue gradient)
35. `reports/page.tsx` - Reports dashboard
36. `reports/schedules/page.tsx` - Scheduled reports

### Other
37. `okrs/page.tsx` - OKRs (violet gradient)
38. `succession/page.tsx` - Succession planning (amber gradient)
39. `workflows/page.tsx` - Workflow builder (cyan gradient)

## Design Pattern
- ModuleHero at top with appropriate gradient and stats
- Replace inline components with NexusUI equivalents
- Keep ALL existing functionality, API calls, state management
- Only change presentation layer

## Gradient Themes
- Super Admin: { from: '#1E293B', to: '#334155' } (dark navy/slate)
- Tenant Admin: { from: '#4F46E5', to: '#7C3AED' } (indigo)
- Clients: { from: '#0D9488', to: '#14B8A6' } (teal)
- Vendors: { from: '#EA580C', to: '#F97316' } (orange)
- Invoices: { from: '#16A34A', to: '#22C55E' } (green)
- Collaboration: { from: '#7C3AED', to: '#A78BFA' } (purple)
- Marketplace: { from: '#EC4899', to: '#F472B6' } (pink)
- Reports: { from: '#2563EB', to: '#3B82F6' } (blue)
- OKRs: { from: '#7C3AED', to: '#8B5CF6' } (violet)
- Succession: { from: '#D97706', to: '#F59E0B' } (amber)
- Workflows: { from: '#0891B2', to: '#06B6D4' } (cyan)

## Progress
- [ ] Super Admin pages
- [ ] Tenant Admin pages
- [ ] Client pages
- [ ] Vendor pages
- [ ] Invoice pages
- [ ] Collaboration pages
- [ ] Marketplace pages
- [ ] Reports pages
- [ ] OKRs, Succession, Workflows
