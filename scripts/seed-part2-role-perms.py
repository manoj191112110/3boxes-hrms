#!/usr/bin/env python3
"""
Part 2: Seed RolePermissions for both tenant DBs.
"""
import psycopg2
import uuid

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'
DEMO_TENANT_ID = 'cmrmxegjy000604jv9ntgcshh'
MARQAI_TENANT_ID = 'cmrmr3ntfe522ce1f3f1e37c6e7'

MODULES_ALL_KEYS = [
    'dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers',
    'job_portal', 'ai_interview', 'onboarding', 'preboarding', 'attendance', 'leave',
    'timesheets', 'payroll', 'salary_structures', 'performance', 'training', 'engagement',
    'succession', 'projects', 'travel', 'expenses', 'assets', 'documents', 'clients',
    'vendors', 'helpdesk', 'grievances', 'ai_assistant', 'docs', 'workflows', 'reports',
    'settings', 'notifications', 'super_admin', 'tenant_admin', 'ai_admin',
    'tenant_configuration', 'subscriptions', 'packages', 'domain_management',
    'purchase_transactions', 'tenant_usage', 'tenant_tickets', 'storage_quotas',
    'sso_providers', 'trial_requests', 'rbac', 'storage_analytics', 'comm_governance',
    'invoices', 'accounts', 'crm', 'separation', 'insurance', 'loans', 'claims',
    'feature_flags',
]

ADMIN_ONLY_MODULES = {'super_admin', 'tenant_admin', 'ai_admin', 'tenant_configuration',
    'subscriptions', 'packages', 'domain_management', 'rbac', 'feature_flags',
    'purchase_transactions', 'tenant_usage', 'tenant_tickets', 'storage_quotas',
    'sso_providers', 'trial_requests', 'storage_analytics', 'comm_governance'}

EMPLOYEE_CREATE_MODULES = {'leave', 'attendance', 'timesheets', 'expenses', 'travel',
    'helpdesk', 'grievances', 'documents', 'ai_assistant', 'training', 'claims', 'loans'}

def uid():
    return f"seed-{uuid.uuid4().hex[:24]}"


def assign_perms(cur, role_id, perm_id_map, modules, actions, label):
    count = 0
    for mod_key in modules:
        for action in actions:
            perm_id = perm_id_map.get((mod_key, action))
            if not perm_id:
                continue
            rpid = uid()
            try:
                cur.execute(
                    '''INSERT INTO "RolePermission" (id, "roleId", "permissionId", granted, "createdAt", "updatedAt")
                       VALUES (%s, %s, %s, true, NOW(), NOW()) ON CONFLICT DO NOTHING''',
                    (rpid, role_id, perm_id)
                )
                count += 1
            except Exception as e:
                pass
    print(f"    {label}: {count} permissions assigned")
    return count


def seed_demo_role_permissions():
    print("\n=== DEMO: RolePermissions ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=DEMO_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    # Clear existing
    cur.execute('DELETE FROM "RolePermission"')

    # Get roles
    cur.execute('SELECT id, key FROM "Role"')
    role_map = {r[1]: r[0] for r in cur.fetchall()}
    print(f"  Roles: {list(role_map.keys())}")

    # Get permissions
    cur.execute('SELECT p.id, m.key, p.action FROM "Permission" p JOIN "Module" m ON p."moduleId" = m.id')
    perm_id_map = {(r[1], r[2]): r[0] for r in cur.fetchall()}
    print(f"  Permissions loaded: {len(perm_id_map)}")

    all_modules = MODULES_ALL_KEYS
    hr_modules = [m for m in all_modules if m not in ADMIN_ONLY_MODULES]
    manager_actions = ['view', 'create', 'edit', 'export']
    employee_actions = ['view']
    admin_actions = ['view', 'create', 'edit', 'delete', 'export', 'approve']

    # Super Admin
    if 'super_admin' in role_map:
        assign_perms(cur, role_map['super_admin'], perm_id_map, all_modules, admin_actions, "Super Admin")

    # Tenant Admin
    if 'tenant_admin' in role_map:
        assign_perms(cur, role_map['tenant_admin'], perm_id_map, all_modules, admin_actions, "Tenant Admin")

    # HR Admin
    if 'hr_admin' in role_map:
        assign_perms(cur, role_map['hr_admin'], perm_id_map, hr_modules, admin_actions, "HR Admin")

    # HR Manager
    if 'hr_manager' in role_map:
        assign_perms(cur, role_map['hr_manager'], perm_id_map, hr_modules, manager_actions, "HR Manager")

    # Finance Admin
    if 'finance_admin' in role_map:
        assign_perms(cur, role_map['finance_admin'], perm_id_map, hr_modules, admin_actions, "Finance Admin")

    # Finance Manager
    if 'finance_manager' in role_map:
        assign_perms(cur, role_map['finance_manager'], perm_id_map, hr_modules, manager_actions, "Finance Manager")

    # Manager
    if 'manager' in role_map:
        assign_perms(cur, role_map['manager'], perm_id_map, hr_modules, manager_actions, "Manager")

    # Travel Admin
    if 'travel_admin' in role_map:
        travel_mods = ['travel', 'expenses', 'dashboard', 'reports', 'employees']
        assign_perms(cur, role_map['travel_admin'], perm_id_map, travel_mods, admin_actions, "Travel Admin")

    # CRM Admin
    if 'crm_admin' in role_map:
        crm_mods = ['crm', 'clients', 'dashboard', 'reports', 'expenses', 'invoices', 'accounts']
        assign_perms(cur, role_map['crm_admin'], perm_id_map, crm_mods, admin_actions, "CRM Admin")

    # Employee
    if 'employee' in role_map:
        assign_perms(cur, role_map['employee'], perm_id_map, hr_modules, employee_actions, "Employee (view)")
        assign_perms(cur, role_map['employee'], perm_id_map, list(EMPLOYEE_CREATE_MODULES), ['create'], "Employee (create)")

    cur.execute('SELECT count(*) FROM "RolePermission"')
    print(f"  Total RolePermissions: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


def seed_marqai_role_permissions():
    print("\n=== MARQAI: RolePermissions ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=MARQAI_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    # Clear existing
    cur.execute('DELETE FROM "RolePermission"')

    # Add missing roles (super_admin, tenant_admin)
    for rid, name, key, desc, is_sys, level in [
        ('marqai-role-super-admin', 'Super Administrator', 'super_admin', 'Full system access', True, 1),
        ('marqai-role-tenant-admin', 'Tenant Administrator', 'tenant_admin', 'Tenant management access', True, 2),
    ]:
        cur.execute('SELECT id FROM "Role" WHERE key = %s', (key,))
        if not cur.fetchone():
            cur.execute(
                '''INSERT INTO "Role" (id, name, key, description, "isSystem", level, "tenantId", status, "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())''',
                (rid, name, key, desc, is_sys, level, MARQAI_TENANT_ID)
            )
            print(f"  Added role: {name}")

    # Get roles
    cur.execute('SELECT id, key FROM "Role"')
    role_map = {r[1]: r[0] for r in cur.fetchall()}
    print(f"  Roles: {list(role_map.keys())}")

    # Get permissions
    cur.execute('SELECT p.id, m.key, p.action FROM "Permission" p JOIN "Module" m ON p."moduleId" = m.id')
    perm_id_map = {(r[1], r[2]): r[0] for r in cur.fetchall()}
    print(f"  Permissions loaded: {len(perm_id_map)}")

    all_modules = MODULES_ALL_KEYS
    hr_modules = [m for m in all_modules if m not in ADMIN_ONLY_MODULES]
    admin_actions = ['view', 'create', 'edit', 'delete', 'export', 'approve']
    manager_actions = ['view', 'create', 'edit', 'export']
    employee_actions = ['view']

    # Super Admin
    if 'super_admin' in role_map:
        assign_perms(cur, role_map['super_admin'], perm_id_map, all_modules, admin_actions, "Super Admin")

    # Tenant Admin
    if 'tenant_admin' in role_map:
        assign_perms(cur, role_map['tenant_admin'], perm_id_map, all_modules, admin_actions, "Tenant Admin")

    # HR Admin
    if 'hr_admin' in role_map:
        assign_perms(cur, role_map['hr_admin'], perm_id_map, hr_modules, admin_actions, "HR Admin")

    # Finance Admin
    if 'finance_admin' in role_map:
        assign_perms(cur, role_map['finance_admin'], perm_id_map, hr_modules, admin_actions, "Finance Admin")

    # Manager
    if 'manager' in role_map:
        assign_perms(cur, role_map['manager'], perm_id_map, hr_modules, manager_actions, "Manager")

    # Employee
    if 'employee' in role_map:
        assign_perms(cur, role_map['employee'], perm_id_map, hr_modules, employee_actions, "Employee (view)")
        assign_perms(cur, role_map['employee'], perm_id_map, list(EMPLOYEE_CREATE_MODULES), ['create'], "Employee (create)")

    cur.execute('SELECT count(*) FROM "RolePermission"')
    print(f"  Total RolePermissions: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    seed_demo_role_permissions()
    seed_marqai_role_permissions()
    print("\n✅ Part 2 done!")
