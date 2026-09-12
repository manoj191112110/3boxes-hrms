/**
 * RBAC Cleanup Script - Reduce to 3 roles only: super_admin, tenant_admin, admin
 * 
 * All other roles (hr_admin, finance_admin, it_admin, manager, employee, recruiter, candidate, etc.)
 * are migrated to admin. Users with legacy roles (hr_admin, finance_admin, it_admin, manager?)