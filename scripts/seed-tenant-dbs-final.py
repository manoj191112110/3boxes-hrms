#!/usr/bin/env python3
"""
Seed separate tenant databases with correct data.
Demo = SAMPLE data only | MarqAI = REAL tenant data
"""
import psycopg2
import random
from datetime import date

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
PLATFORM_DB = 'neondb'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'
DEMO_TENANT_ID = 'cmrmxegjy000604jv9ntgcshh'
MARQAI_TENANT_ID = 'cmrmr3ntfe522ce1f3f1e37c6e7'

MODULES = ['dashboard', 'company', 'employee', 'leave', 'attendance', 'payroll',
    'recruitment', 'performance', 'training', 'travel', 'expense',
    'asset', 'document', 'helpdesk', 'settings', 'rbac', 'reports',
    'onboarding', 'separation', 'workflow', 'crm', 'project']

PERM_ACTIONS = ['view', 'create', 'edit', 'delete']


def get_conn(dbname):
    return psycopg2.connect(host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD, sslmode='require')


def seed_demo_db():
    conn = get_conn(DEMO_DB)
    conn.autocommit = True
    cur = conn.cursor()
    print("=== SEEDING DEMO DATABASE ===")

    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tenant_id = cur.fetchone()[0]

    # Get existing data
    cur.execute('SELECT id FROM "CompanyGroup" LIMIT 1;')
    cg_row = cur.fetchone()
    cg_id = cg_row[0] if cg_row else None

    cur.execute('SELECT id FROM "Company" LIMIT 10;')
    comp_ids = [r[0] for r in cur.fetchall()]

    cur.execute('SELECT id FROM "Department" LIMIT 30;')
    dept_ids = [r[0] for r in cur.fetchall()]

    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]

    # Designations (integer level)
    desig_data = [
        ('Chief Executive Officer', 1, 300000, 500000),
        ('Chief Technology Officer', 1, 280000, 450000),
        ('Vice President', 2, 200000, 350000),
        ('Director', 3, 150000, 250000),
        ('Senior Manager', 4, 120000, 200000),
        ('Manager', 5, 90000, 150000),
        ('Team Lead', 6, 80000, 130000),
        ('Senior Engineer', 7, 70000, 120000),
        ('Software Engineer', 8, 55000, 95000),
        ('Junior Engineer', 9, 40000, 65000),
        ('Analyst', 8, 50000, 85000),
        ('Specialist', 7, 60000, 100000),
        ('Coordinator', 9, 35000, 55000),
        ('Intern', 10, 20000, 35000),
    ]

    desig_ids = []
    dc = 0
    for dept_id in dept_ids[:16]:
        for title, level, min_sal, max_sal in desig_data[:5]:
            did = f'demo-desig-{dc}'
            desig_ids.append(did)
            cur.execute(
                """INSERT INTO "Designation" (id, title, "departmentId", level, "minSalary", "maxSalary", status, "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW(), NOW()) ON CONFLICT (id) DO NOTHING""",
                (did, title, dept_id, level, min_sal, max_sal))
            dc += 1
    print(f"  Designations: {dc}")

    # Get password hash from platform
    plat_conn = get_conn(PLATFORM_DB)
    plat_cur = plat_conn.cursor()
    plat_cur.execute('SELECT password FROM "User" LIMIT 1;')
    default_pwd = plat_cur.fetchone()[0]
    plat_conn.close()

    # Users
    demo_users = [
        ('demo-superadmin', 'superadmin@3boxeshrms.com', '3Boxes Super Admin', 'super_admin'),
        ('demo-tenantadmin', 'admin@3boxeshrms.com', '3Boxes Demo Admin', 'tenant_admin'),
        ('demo-hradmin', 'hr@3boxeshrms.com', 'HR Admin Demo', 'hr_admin'),
        ('demo-hrmanager', 'hrmanager@3boxeshrms.com', 'HR Manager Demo', 'hr_manager'),
        ('demo-financeadmin', 'finance@3boxeshrms.com', 'Finance Admin Demo', 'finance_admin'),
        ('demo-manager1', 'manager1@3boxeshrms.com', 'Project Manager', 'manager'),
        ('demo-employee1', 'john.doe@3boxeshrms.com', 'John Doe', 'employee'),
        ('demo-employee2', 'jane.smith@3boxeshrms.com', 'Jane Smith', 'employee'),
        ('demo-employee3', 'mike.wilson@3boxeshrms.com', 'Mike Wilson', 'employee'),
    ]

    user_ids = []
    for uid, email, name, role in demo_users:
        user_ids.append(uid)
        cur.execute(
            """INSERT INTO "User" (id, email, password, name, "tenantId", role, status, "createdAt", "updatedAt")
               VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())
               ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, role=EXCLUDED.role, "tenantId"=EXCLUDED."tenantId", status=EXCLUDED.status""",
            (uid, email, default_pwd, name, tenant_id, role))
    print(f"  Users: {len(demo_users)}")

    # Roles (with required key, level, isSystem fields)
    demo_roles = [
        ('demo-role-super-admin', 'Super Administrator', 'super_admin', 'Full system access - all modules and settings', True, 1),
        ('demo-role-tenant-admin', 'Tenant Administrator', 'tenant_admin', 'Tenant management - companies, users, configurations', True, 2),
        ('demo-role-hr-admin', 'HR Administrator', 'hr_admin', 'HR operations - employees, recruitment, onboarding, leave, attendance', True, 3),
        ('demo-role-hr-manager', 'HR Manager', 'hr_manager', 'HR team management - employee records, leave approvals', True, 3),
        ('demo-role-manager', 'Manager', 'manager', 'Team management - team employees, timesheets, performance reviews, leave approvals', True, 4),
        ('demo-role-employee', 'Employee', 'employee', 'Basic employee access - view own profile, request leave, view payslips, submit timesheets', True, 5),
        ('demo-role-finance-admin', 'Finance Administrator', 'finance_admin', 'Finance operations - payroll, salary structures, expenses, invoices', True, 3),
        ('demo-role-finance-manager', 'Finance Manager', 'finance_manager', 'Finance team management - budgets, approvals, reports', True, 4),
        ('demo-role-travel-admin', 'Travel Administrator', 'travel_admin', 'Travel management - bookings, approvals, policies', True, 3),
        ('demo-role-crm-admin', 'CRM Administrator', 'crm_admin', 'CRM management - clients, projects, vendors', True, 3),
    ]

    role_ids = []
    for rid, rname, rkey, rdesc, ris_system, rlevel in demo_roles:
        role_ids.append(rid)
        cur.execute(
            """INSERT INTO "Role" (id, name, key, description, "isSystem", level, "tenantId", status, "createdAt", "updatedAt")
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, key=EXCLUDED.key, "tenantId"=EXCLUDED."tenantId" """,
            (rid, rname, rkey, rdesc, ris_system, rlevel, tenant_id))
    print(f"  Roles: {len(demo_roles)}")

    # Modules
    module_ids = {}
    for mod in MODULES:
        mod_id = f'demo-mod-{mod}'
        module_ids[mod] = mod_id
        cur.execute(
            """INSERT INTO "Module" (id, name, "createdAt", "updatedAt")
               VALUES (%s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
            (mod_id, mod.capitalize()))

    # Permissions
    perm_ids = []
    for mod_name, mod_id in module_ids.items():
        for action in PERM_ACTIONS:
            perm_id = f'demo-perm-{mod_name}-{action}'
            perm_ids.append(perm_id)
            cur.execute(
                """INSERT INTO "Permission" (id, action, resource, "moduleId", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, NOW(), NOW())
                   ON CONFLICT (id) DO UPDATE SET action=EXCLUDED.action, resource=EXCLUDED.resource, "moduleId"=EXCLUDED."moduleId" """,
                (perm_id, action, mod_name, mod_id))
    print(f"  Modules: {len(MODULES)}, Permissions: {len(perm_ids)}")

    # Role-Permission assignments
    hr_mods = ['employee', 'leave', 'attendance', 'recruitment', 'performance', 'training', 'onboarding', 'helpdesk']
    fin_mods = ['payroll', 'expense', 'travel', 'reports']
    emp_mods = ['dashboard', 'employee', 'leave', 'attendance', 'expense', 'travel', 'document', 'helpdesk']

    role_perm_map = {
        'demo-role-super-admin': perm_ids,
        'demo-role-tenant-admin': perm_ids,
        'demo-role-hr-admin': [p for p in perm_ids if any(m in p for m in hr_mods)],
        'demo-role-hr-manager': [p for p in perm_ids if any(m in p for m in hr_mods) and ('-view' in p or '-create' in p)],
        'demo-role-manager': [p for p in perm_ids if any(m in p for m in emp_mods) and '-view' in p],
        'demo-role-employee': [p for p in perm_ids if '-view' in p and any(m in p for m in emp_mods)],
        'demo-role-finance-admin': [p for p in perm_ids if any(m in p for m in fin_mods + ['dashboard', 'reports'])],
        'demo-role-finance-manager': [p for p in perm_ids if any(m in p for m in fin_mods) and ('-view' in p or '-create' in p)],
        'demo-role-travel-admin': [p for p in perm_ids if 'travel' in p or 'expense' in p],
        'demo-role-crm-admin': [p for p in perm_ids if 'crm' in p or 'project' in p],
    }

    total = 0
    for rid, perms in role_perm_map.items():
        for pid in perms:
            try:
                cur.execute(
                    """INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                       VALUES (%s, %s, NOW(), NOW()) ON CONFLICT DO NOTHING""",
                    (rid, pid))
                total += 1
            except:
                pass
    print(f"  Role-Permission assignments: {total}")

    # UserRoleAssignments
    user_role_map = {
        'demo-superadmin': 'demo-role-super-admin',
        'demo-tenantadmin': 'demo-role-tenant-admin',
        'demo-hradmin': 'demo-role-hr-admin',
        'demo-hrmanager': 'demo-role-hr-manager',
        'demo-financeadmin': 'demo-role-finance-admin',
        'demo-manager1': 'demo-role-manager',
        'demo-employee1': 'demo-role-employee',
        'demo-employee2': 'demo-role-employee',
        'demo-employee3': 'demo-role-employee',
    }
    for uid, rid in user_role_map.items():
        cur.execute(
            """INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
               VALUES (%s, %s, NOW(), NOW()) ON CONFLICT DO NOTHING""",
            (uid, rid))
    print(f"  User-Role assignments: {len(user_role_map)}")

    # Sample Employees
    first_names = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda',
                   'William', 'Jennifer', 'Richard', 'Lisa', 'James', 'Maria', 'Thomas',
                   'Patricia', 'Daniel', 'Linda', 'Matthew', 'Elizabeth']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
                  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']

    for i in range(20):
        first = first_names[i % len(first_names)]
        last = last_names[i % len(last_names)]
        emp_id = f'demo-emp-{i+1}'
        email = f'{first.lower()}.{last.lower()}@3boxeshrms.com'
        comp_id = comp_ids[i % len(comp_ids)]
        dept_id = dept_ids[i % len(dept_ids)] if dept_ids else None
        desig_id = desig_ids[i % len(desig_ids)] if desig_ids else None
        branch_id = branch_ids[i % len(branch_ids)] if branch_ids else None
        user_id = user_ids[i] if i < len(user_ids) else None
        salary = 50000 + (i * 5000)

        cur.execute(
            """INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET "firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName",email=EXCLUDED.email,"companyId"=EXCLUDED."companyId" """,
            (emp_id, f'EMP-{1000+i}', first, last, email, f'+1-555-{1000+i}', None, user_id,
             dept_id, desig_id, branch_id, comp_id,
             date(2024, (i % 12) + 1, (i % 28) + 1), date(1985 + (i % 15), (i % 12) + 1, (i % 28) + 1),
             'male' if i % 2 == 0 else 'female', 'single', 'American',
             f'{100+i} Demo Street', 'New York', 'NY', '10001', 'United States',
             'O+', 'Emergency Contact', '+1-555-9111', 'active',
             'Demo National Bank', f'DNBNK{1000+i}', 'DNBN0000001', f'DEMO{i}1234A', salary, 'USD'))
    print(f"  Employees: 20")

    # Leave Types
    for lt_id, name, quota, lt_type in [
        ('demo-lt-casual', 'Casual Leave', 12, 'casual'),
        ('demo-lt-sick', 'Sick Leave', 10, 'sick'),
        ('demo-lt-earned', 'Earned Leave', 15, 'earned'),
        ('demo-lt-maternity', 'Maternity Leave', 180, 'maternity'),
        ('demo-lt-paternity', 'Paternity Leave', 15, 'paternity'),
        ('demo-lt-compoff', 'Compensatory Off', 5, 'compoff'),
        ('demo-lt-restricted', 'Restricted Holiday', 2, 'restricted'),
    ]:
        cur.execute(
            """INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
               VALUES (%s, %s, %s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
            (lt_id, name, quota, lt_type))

    # Holidays
    for hol_id, name, hol_date, hol_type in [
        ('demo-hol-1', "New Year's Day", date(2025, 1, 1), 'public'),
        ('demo-hol-2', 'Martin Luther King Jr. Day', date(2025, 1, 20), 'public'),
        ('demo-hol-3', "Presidents' Day", date(2025, 2, 17), 'public'),
        ('demo-hol-4', 'Memorial Day', date(2025, 5, 26), 'public'),
        ('demo-hol-5', 'Independence Day', date(2025, 7, 4), 'public'),
        ('demo-hol-6', 'Labor Day', date(2025, 9, 1), 'public'),
        ('demo-hol-7', 'Thanksgiving Day', date(2025, 11, 27), 'public'),
        ('demo-hol-8', 'Christmas Day', date(2025, 12, 25), 'public'),
    ]:
        cur.execute(
            """INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
               VALUES (%s, %s, %s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
            (hol_id, name, hol_date, hol_type))
    print(f"  Leave Types: 7, Holidays: 8")

    # TenantConfiguration
    cur.execute(
        """INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance",
           "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount",
           "activeLanguageCount", "createdAt", "updatedAt")
           VALUES ('demo-tenant-config', %s, true, true, true, true, 8, 8, 5, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET "autoProvisionPayroll"=EXCLUDED."autoProvisionPayroll" """,
        (tenant_id,))
    print(f"  TenantConfiguration: 1")

    conn.close()
    print("  Demo DB seeded! ✅\n")


def seed_marqai_db():
    conn = get_conn(MARQAI_DB)
    conn.autocommit = True
    cur = conn.cursor()
    print("=== SEEDING MARQAI DATABASE ===")

    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    m_tenant_id = cur.fetchone()[0]

    cur.execute('SELECT id FROM "Company";')
    m_comp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Department" LIMIT 20;')
    m_dept_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Designation" LIMIT 20;')
    m_desig_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    m_branch_ids = [r[0] for r in cur.fetchall()]

    # Modules & Permissions (only if not already created)
    cur.execute('SELECT COUNT(*) FROM "Module";')
    if cur.fetchone()[0] == 0:
        m_module_ids = {}
        for mod in MODULES:
            mod_id = f'marq-mod-{mod}'
            m_module_ids[mod] = mod_id
            cur.execute(
                """INSERT INTO "Module" (id, name, "createdAt", "updatedAt")
                   VALUES (%s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
                (mod_id, mod.capitalize()))

        m_perm_ids = []
        for mod_name, mod_id in m_module_ids.items():
            for action in PERM_ACTIONS:
                perm_id = f'marq-perm-{mod_name}-{action}'
                m_perm_ids.append(perm_id)
                cur.execute(
                    """INSERT INTO "Permission" (id, action, resource, "moduleId", "createdAt", "updatedAt")
                       VALUES (%s, %s, %s, %s, NOW(), NOW())
                       ON CONFLICT (id) DO UPDATE SET action=EXCLUDED.action, resource=EXCLUDED.resource, "moduleId"=EXCLUDED."moduleId" """,
                    (perm_id, action, mod_name, mod_id))

        cur.execute('SELECT id FROM "Role" WHERE "tenantId" = %s;', (m_tenant_id,))
        for role_row in cur.fetchall():
            for pid in m_perm_ids:
                cur.execute(
                    """INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                       VALUES (%s, %s, NOW(), NOW()) ON CONFLICT DO NOTHING""",
                    (role_row[0], pid))
        print(f"  Modules, Permissions, Role-Permissions created")
    else:
        print(f"  Modules already exist, skipping")

    # Employees for existing users
    cur.execute('SELECT id, email, name, role FROM "User";')
    users = cur.fetchall()
    emp_created = 0
    for uid, email, name, role in users:
        cur.execute('SELECT id FROM "Employee" WHERE "userId" = %s;', (uid,))
        if cur.fetchone():
            continue
        parts = name.split(' ', 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ''
        emp_id = f'marq-emp-{uid[:12].replace("-","").replace("_","")}'
        cur.execute(
            """INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO NOTHING""",
            (emp_id, f'MARQ-{1000+emp_created}', first, last, email, None, None, uid,
             m_dept_ids[0] if m_dept_ids else None, m_desig_ids[0] if m_desig_ids else None,
             m_branch_ids[0] if m_branch_ids else None, m_comp_ids[0] if m_comp_ids else None,
             date(2024, 1, 15), date(1990, 5, 15), 'male', 'single', 'Indian',
             '123 MarqAI Street', 'Hyderabad', 'Telangana', '500001', 'India',
             'O+', 'Emergency', '+91-9876543210', 'active',
             'HDFC Bank', '1234567890', 'HDFC0001234', 'ABCDE1234F', 75000, 'INR'))
        emp_created += 1
    print(f"  Employees for users: {emp_created}")

    # More employees
    more_emps = [
        ('marq-emp-add1', 'Rajesh', 'Kumar', 'rajesh.kumar@marqaitech.com'),
        ('marq-emp-add2', 'Priya', 'Sharma', 'priya.sharma@marqaitech.com'),
        ('marq-emp-add3', 'Arun', 'Reddy', 'arun.reddy@marqaitech.com'),
        ('marq-emp-add4', 'Sneha', 'Patil', 'sneha.patil@marqaitech.com'),
        ('marq-emp-add5', 'Meera', 'Nair', 'meera.nair@marqaitech.com'),
        ('marq-emp-add6', 'Vikram', 'Singh', 'vikram.singh@marqaitech.com'),
    ]
    for i, (eid, first, last, email) in enumerate(more_emps):
        comp_id = m_comp_ids[i % len(m_comp_ids)] if m_comp_ids else None
        dept_id = m_dept_ids[i % len(m_dept_ids)] if m_dept_ids else None
        desig_id = m_desig_ids[i % len(m_desig_ids)] if m_desig_ids else None
        branch_id = m_branch_ids[i % len(m_branch_ids)] if m_branch_ids else None
        cur.execute(
            """INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO NOTHING""",
            (eid, f'MARQ-{2000+i}', first, last, email, f'+91-98765{i}4321', None, None,
             dept_id, desig_id, branch_id, comp_id,
             date(2024, (i % 12) + 1, (i % 28) + 1), date(1985 + (i % 15), (i % 12) + 1, (i % 28) + 1),
             'male' if i % 2 == 0 else 'female', 'single', 'Indian',
             'MarqAI Campus', 'Hyderabad', 'Telangana', '500001', 'India',
             'B+', 'Emergency', '+91-9876543210', 'active',
             'HDFC Bank', f'1234{5678+i}', 'HDFC0001234', f'MARQ{i}1234F', 60000 + (i * 5000), 'INR'))
    print(f"  Additional employees: {len(more_emps)}")

    # Leave Types
    cur.execute('SELECT COUNT(*) FROM "LeaveType";')
    if cur.fetchone()[0] == 0:
        for lt_id, name, quota, lt_type in [
            ('marq-lt-casual', 'Casual Leave', 12, 'casual'),
            ('marq-lt-sick', 'Sick Leave', 10, 'sick'),
            ('marq-lt-earned', 'Earned Leave', 15, 'earned'),
            ('marq-lt-maternity', 'Maternity Leave', 180, 'maternity'),
            ('marq-lt-paternity', 'Paternity Leave', 15, 'paternity'),
            ('marq-lt-compoff', 'Compensatory Off', 5, 'compoff'),
        ]:
            cur.execute(
                """INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
                (lt_id, name, quota, lt_type))
        print(f"  Leave Types: 6")

    # Indian Holidays
    cur.execute('SELECT COUNT(*) FROM "Holiday";')
    if cur.fetchone()[0] == 0:
        for hol_id, name, hol_date, hol_type in [
            ('marq-hol-1', 'Republic Day', date(2025, 1, 26), 'public'),
            ('marq-hol-2', 'Holi', date(2025, 3, 14), 'public'),
            ('marq-hol-3', 'Good Friday', date(2025, 4, 18), 'public'),
            ('marq-hol-4', 'Independence Day', date(2025, 8, 15), 'public'),
            ('marq-hol-5', 'Gandhi Jayanti', date(2025, 10, 2), 'public'),
            ('marq-hol-6', 'Diwali', date(2025, 10, 20), 'public'),
            ('marq-hol-7', 'Christmas', date(2025, 12, 25), 'public'),
        ]:
            cur.execute(
                """INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name""",
                (hol_id, name, hol_date, hol_type))
        print(f"  Holidays: 7")

    # UserRoleAssignments
    cur.execute('SELECT id, role FROM "User" WHERE "tenantId" = %s;', (m_tenant_id,))
    m_users = cur.fetchall()
    cur.execute('SELECT id, name FROM "Role" WHERE "tenantId" = %s;', (m_tenant_id,))
    m_roles = {r[1].lower(): r[0] for r in cur.fetchall()}

    role_name_map = {
        'super_admin': 'super administrator',
        'tenant_admin': 'tenant administrator',
        'hr_admin': 'hr administrator',
        'employee': 'employee',
        'manager': 'manager',
    }
    for uid, role in m_users:
        mapped = role_name_map.get(role, role.replace('_', ' '))
        rid = m_roles.get(mapped)
        if rid:
            cur.execute(
                """INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
                   VALUES (%s, %s, NOW(), NOW()) ON CONFLICT DO NOTHING""",
                (uid, rid))
    print(f"  User-Role assignments created")

    # TenantConfiguration
    cur.execute('SELECT COUNT(*) FROM "TenantConfiguration" WHERE "tenantId" = %s;', (m_tenant_id,))
    if cur.fetchone()[0] == 0:
        cur.execute(
            """INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance",
               "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount",
               "activeLanguageCount", "createdAt", "updatedAt")
               VALUES ('marq-tenant-config', %s, true, true, true, true, 1, 1, 2, NOW(), NOW())""",
            (m_tenant_id,))
        print(f"  TenantConfiguration: 1")

    # Clean platform tables
    for table in ['TenantDatabase', 'TrialRegistration', 'DataResidencyPolicy', 'SubscriptionPlan']:
        try:
            cur.execute(f'DELETE FROM "{table}";')
        except:
            pass

    conn.close()
    print("  MarqAI DB seeded! ✅\n")


def verify():
    print("=" * 60)
    print("VERIFICATION")
    print("=" * 60)

    for db_name, label in [(DEMO_DB, 'Demo'), (MARQAI_DB, 'MarqAI')]:
        conn = get_conn(db_name)
        cur = conn.cursor()
        print(f"\n  {label}:")

        for table in ['Tenant', 'User', 'CompanyGroup', 'Company', 'Department', 'Employee',
                      'Role', 'Module', 'Permission', 'LeaveType', 'Holiday', 'Designation', 'Branch']:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                c = cur.fetchone()[0]
                s = '✅' if c > 0 else '⚠️ '
                print(f'    {s} {table}: {c}')
            except Exception as e:
                print(f'    ❌ {table}: {str(e)[:50]}')

        cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
        tid = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != %s;', (tid,))
        w = cur.fetchone()[0]
        print(f'    {"✅" if w == 0 else "❌"} Wrong-tenant users: {w}')
        conn.close()


if __name__ == '__main__':
    seed_demo_db()
    seed_marqai_db()
    verify()
    print("\n" + "=" * 60)
    print("DONE! Demo = SAMPLE data | MarqAI = REAL tenant data")
    print("=" * 60)
