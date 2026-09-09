# Task 3-a: Redesign Employees Page using NexusUI Design System

## Summary
Rewrote the Employees page (`src/app/(dashboard)/employees/page.tsx`) to use NexusUI design system components while preserving all existing functionality (CRUD operations, server-side pagination, filtering, search, multi-tab form).

## Changes Made

### Presentation Layer (Replaced)
1. **Header** → `ModuleHero` with gradient background, stats (total, active, departments, new hires), integrated search bar, and add employee action
2. **Status dropdown filter** → `TabBar` (pill variant) for All/Active/On Leave/Terminated/Resigned status tabs
3. **Custom search input** → `SearchBar` (used via ModuleHero's searchProps)
4. **Inline add/edit form** → `Modal` (size='xl') with `TabBar` (underline variant) for form section navigation
5. **Status badges** → `StatusBadge` with proper status-to-type mapping (active→active, on_leave→warning, terminated→error, resigned→inactive)
6. **Avatar circles** → `GradientAvatar` with auto-gradient based on name
7. **Action buttons** → `PrimaryButton` with ghost variant
8. **Delete inline confirmation** → `ConfirmDialog` (danger variant)
9. **Loading skeleton** → `Skeleton` (table variant)
10. **Empty state** → `EmptyState` with icon, title, description, and optional action
11. **Form progress** → `ProgressBar` showing step progress
12. **Date display** → `DateDisplay` component
13. **Filter cards** → `Card` component with proper padding/variant
14. **Pagination active page** → Gradient button style matching NexusUI theme
15. **Form inputs** → Extracted `FormInput` and `FormSelect` helper components with consistent NexusUI styling

### Functionality Preserved
- All API calls (fetchEmployees, fetchDropdowns, CRUD operations)
- Server-side pagination with proper page navigation
- Search filtering (debounced via useCallback)
- Department and status filtering
- Multi-tab employee form (10 tabs: Personal, Address, Employment, Bank, Statutory, Emergency, Health, Overseas, Experience, Policies)
- All form fields including conditional rendering (hasChronicIllness, hasVisa, etc.)
- Policy dropdowns (leave, attendance, travel, salary structures)
- Delete confirmation with termination action
- Company scope (effectiveCompanyId, selectedTenantId)
- Role-based access (isAdmin check)
- ModuleTips, ModuleWorkflow, ModuleIntro preserved

## Lint Results
- 0 errors, 0 warnings after fixes
- Removed unused `SearchBar` import (used indirectly via ModuleHero)
- Removed unused `idx` parameter in formTabs.map
