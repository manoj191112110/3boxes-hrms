#!/usr/bin/env python3
"""
Part 1: Seed Modules and Permissions into BOTH tenant DBs.
"""
import psycopg2
import uuid

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

MODULES_ALL = [
    ('dashboard', 'Dashboard', 'Core HR', 'LayoutDashboard', 1),
    ('employees', 'Employees', 'Core HR', 'Users', 2),
    ('company', 'Company', 'Core HR', 'Building2', 3),
    ('recruitment', 'Recruitment', 'Talent', 'UserPlus', 4),
    ('requisitions', 'Requisitions', 'Talent', 'ClipboardList', 5),
    ('offers', 'Offers', 'Talent', 'FileText', 6),
    ('job_portal', 'Job Portal', 'Talent', 'Globe', 7),
    ('ai_interview', 'AI Interview', 'Talent', 'Bot', 8),
    ('onboarding', 'Onboarding', 'Lifecycle', 'UserCheck', 9),
    ('preboarding', 'Preboarding', 'Lifecycle', 'ClipboardCheck', 10),
    ('attendance', 'Attendance', 'Time', 'Clock', 11),
    ('leave', 'Leave', 'Time', 'CalendarOff', 12),
    ('timesheets', 'Timesheets', 'Time', 'Timer', 13),
    ('payroll', 'Payroll', 'Compensation', 'Banknote', 14),
    ('salary_structures', 'Salary Structures', 'Compensation', 'Coins', 15),
    ('performance', 'Performance', 'Performance', 'TrendingUp', 16),
    ('training', 'Training', 'Performance', 'GraduationCap', 17),
    ('engagement', 'Engagement', 'Performance', 'Heart', 18),
    ('succession', 'Succession', 'Performance', 'ArrowUpRight', 19),
    ('projects', 'Projects', 'Operations', 'FolderKanban', 20),
    ('travel', 'Travel', 'Operations', 'Plane', 21),
    ('expenses', 'Expenses', 'Operations', 'Receipt', 22),
    ('assets', 'Assets', 'Operations', 'Monitor', 23),
    ('documents', 'Documents', 'Operations', 'FileStack', 24),
    ('clients', 'Clients', 'External', 'Handshake', 25),
    ('vendors', 'Vendors', 'External', 'Truck', 26),
    ('helpdesk', 'Helpdesk', 'Support', 'Headphones', 27),
    ('grievances', 'Grievances', 'Support', 'AlertTriangle', 28),
    ('ai_assistant', 'AI Assistant', 'Support', 'Sparkles', 29),
    ('docs', 'Documentation', 'Knowledge', 'BookOpen', 30),
    ('workflows', 'Workflows', 'Governance', 'GitBranch', 31),
    ('reports', 'Reports', 'Governance', 'BarChart3', 32),
    ('settings', 'Settings', 'Governance', 'Settings', 33),
    ('notifications', 'Notifications', 'Governance', 'Bell', 34),
    ('super_admin', 'Super Admin', 'Admin', 'Shield', 35),
    ('tenant_admin', 'Tenant Admin', 'Admin', 'ShieldCheck', 36),
    ('ai_admin', 'AI Admin', 'Admin', 'Brain', 37),
    ('tenant_configuration', 'Tenant Configuration', 'Admin', 'Settings', 38),
    ('subscriptions', 'Subscriptions', 'Admin', 'CreditCard', 39),
    ('packages', 'Packages', 'Admin', 'Package', 40),
    ('domain_management', 'Domain Management', 'Admin', 'Globe', 41),
    ('purchase_transactions', 'Purchase Transactions', 'Admin', 'DollarSign', 42),
    ('tenant_usage', 'Tenant Usage Metrics', 'Admin', 'BarChart2', 43),
    ('tenant_tickets', 'Tenant Support Tickets', 'Admin', 'HelpCircle', 44),
    ('storage_quotas', 'Storage Quotas', 'Admin', 'HardDrive', 45),
    ('sso_providers', 'SSO Providers', 'Admin', 'Lock', 46),
    ('trial_requests', 'Trial Requests', 'Admin', 'Briefcase', 47),
    ('rbac', 'RBAC Management', 'Admin', 'Shield', 48),
    ('storage_analytics', 'Storage Analytics', 'Admin', 'Database', 49),
    ('comm_governance', 'Communication Governance', 'Admin', 'MessageCircle', 50),
    ('invoices', 'Invoices', 'Finance', 'FileText', 51),
    ('accounts', 'Accounts', 'Finance', 'Wallet', 52),
    ('crm', 'CRM', 'External', 'Users', 53),
    ('separation', 'Separation', 'Lifecycle', 'UserMinus', 54),
    ('insurance', 'Insurance', 'Benefits', 'HeartShield', 55),
    ('loans', 'Loans', 'Compensation', 'Banknote', 56),
    ('claims', 'Claims', 'Compensation', 'FileCheck', 57),
    ('feature_flags', 'Feature Flags', 'Admin', 'ToggleRight', 58),
]

PERM_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve']

def uid():
    return f"seed-{uuid.uuid4().hex[:24]}"


def seed_modules_permissions(dbname, label):
    print(f"\n=== {label}: Modules + Permissions ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    # Check existing
    cur.execute('SELECT count(*) FROM "Module"')
    existing = cur.fetchone()[0]
    if existing >= len(MODULES_ALL):
        print(f"  Modules already exist ({existing}). Skipping insert.")
        cur.execute('SELECT id, key FROM "Module"')
        module_id_map = {r[1]: r[0] for r in cur.fetchall()}
    else:
        # Delete stale and reinsert
        cur.execute('DELETE FROM "Permission"')
        cur.execute('DELETE FROM "RolePermission"')
        cur.execute('DELETE FROM "Module"')
        print(f"  Cleared old modules/perms. Inserting {len(MODULES_ALL)} modules...")

        module_id_map = {}
        for key, name, category, icon, sort in MODULES_ALL:
            mid = uid()
            cur.execute(
                '''INSERT INTO "Module" (id, key, name, category, icon, "sortOrder", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())''',
                (mid, key, name, category, icon, sort)
            )
            module_id_map[key] = mid

    cur.execute('SELECT count(*) FROM "Module"')
    print(f"  Modules: {cur.fetchone()[0]}")

    # Permissions
    cur.execute('SELECT count(*) FROM "Permission"')
    existing_perms = cur.fetchone()[0]
    if existing_perms >= len(MODULES_ALL) * len(PERM_ACTIONS):
        print(f"  Permissions already exist ({existing_perms}). Skipping.")
        cur.execute('SELECT p.id, m.key, p.action FROM "Permission" p JOIN "Module" m ON p."moduleId" = m.id')
        perm_id_map = {(r[1], r[2]): r[0] for r in cur.fetchall()}
    else:
        cur.execute('DELETE FROM "RolePermission"')
        cur.execute('DELETE FROM "Permission"')
        print(f"  Inserting {len(MODULES_ALL) * len(PERM_ACTIONS)} permissions...")

        perm_id_map = {}
        for key, mid in module_id_map.items():
            for action in PERM_ACTIONS:
                pid = uid()
                desc = f"{action.capitalize()} {key.replace('_', ' ')}"
                cur.execute(
                    '''INSERT INTO "Permission" (id, "moduleId", action, description, "createdAt", "updatedAt")
                       VALUES (%s, %s, %s, %s, NOW(), NOW())''',
                    (pid, mid, action, desc)
                )
                perm_id_map[(key, action)] = pid

    cur.execute('SELECT count(*) FROM "Permission"')
    print(f"  Permissions: {cur.fetchone()[0]}")

    cur.close()
    conn.close()
    return module_id_map, perm_id_map


if __name__ == '__main__':
    demo_mod, demo_perm = seed_modules_permissions(DEMO_DB, "DEMO")
    print(f"  Demo module_id_map keys: {len(demo_mod)}, perm_id_map keys: {len(demo_perm)}")

    marq_mod, marq_perm = seed_modules_permissions(MARQAI_DB, "MARQAI")
    print(f"  MarqAI module_id_map keys: {len(marq_mod)}, perm_id_map keys: {len(marq_perm)}")

    print("\n✅ Part 1 done!")
