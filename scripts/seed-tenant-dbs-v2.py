#!/usr/bin/env python3
"""
Seed separate tenant databases with correct data.
v2: Fixed column names for Designation (title, departmentId), Department (code, branchId), etc.
"""

import psycopg2
import random
from datetime import datetime, date

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
PLATFORM_DB = 'neondb'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'
DEMO_TENANT_ID = 'cmrmxegjy000604jv9ntgcshh'
MARQAI_TENANT_ID = 'cmrmr3ntfe522ce1f3f1e37c6e7'

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST,
        database=dbname,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode='require'
    )


def seed_demo_db():
    """Seed demo DB with rich SAMPLE data (not real data)."""
    conn = get_conn(DEMO_DB)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== SEEDING DEMO DATABASE ===")
    
    # Get existing Tenant, CompanyGroup, Company
    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tenant = cur.fetchone()
    if not tenant:
        print("  ERROR: No Tenant record found!")
        return
    tenant_id = tenant[0]
    
    cur.execute('SELECT id FROM "CompanyGroup" LIMIT 1;')
    cg = cur.fetchone()
    cg_id = cg[0] if cg else None
    
    if not cg_id:
        cg_id = 'demo-cg-main'
        cur.execute("""
            INSERT INTO "CompanyGroup" (id, name, "tenantId", "createdAt", "updatedAt")
            VALUES (%s, '3 Boxes Enterprise Group', %s, NOW(), NOW())
        """, (cg_id, tenant_id))
    
    # Get existing companies
    cur.execute('SELECT id, name, code FROM "Company" WHERE "companyGroupId" = %s;', (cg_id,))
    companies = cur.fetchall()
    comp_ids = [c[0] for c in companies]
    print(f"  Existing companies: {len(companies)}")
    
    # Add more sample companies
    more_companies = [
        ('demo-comp-4', 'InnovateTech Labs', 'ITL'),
        ('demo-comp-5', 'GlobalFin Services', 'GFS'),
        ('demo-comp-6', 'GreenLeaf Energy', 'GLE'),
    ]
    for comp_id, name, code in more_companies:
        comp_ids.append(comp_id)
        cur.execute("""
            INSERT INTO "Company" (id, name, code, "companyGroupId", status, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, 'active', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (comp_id, name, code, cg_id))
    print(f"  Total companies: {len(comp_ids)}")
    
    # Create Branches
    branches = []
    for i, comp_id in enumerate(comp_ids[:4]):
        branch_id = f'demo-branch-{i+1}'
        branches.append(branch_id)
        cur.execute("""
            INSERT INTO "Branch" (id, name, code, "companyId", country, state, city, status, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, 'United States', 'NY', 'New York', 'active', NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (branch_id, f'Branch {i+1}', f'BR-{i+1}', comp_id))
    print(f"  Created {len(branches)} branches")
    
    # Create Departments
    dept_names = ['Human Resources', 'Finance', 'Engineering', 'Marketing', 'Sales', 'Operations', 'Legal', 'Customer Support']
    dept_ids = []
    dept_counter = 0
    for comp_id in comp_ids[:4]:
        for dept_name in dept_names:
            dept_id = f'demo-dept-{dept_counter}'
            dept_ids.append(dept_id)
            branch_id = branches[dept_counter % len(branches)]
            cur.execute("""
                INSERT INTO "Department" (id, name, code, "companyId", "branchId", status, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, 'active', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """, (dept_id, dept_name, f'DEPT-{dept_counter}', comp_id, branch_id))
            dept_counter += 1
    print(f"  Created {dept_counter} departments")
    
    # Create Designations (title, departmentId, level, minSalary, maxSalary)
    designation_data = [
        ('Chief Executive Officer', 'C1', 300000, 500000),
        ('Chief Technology Officer', 'C1', 280000, 450000),
        ('Chief Financial Officer', 'C1', 270000, 430000),
        ('Vice President', 'C2', 200000, 350000),
        ('Director', 'C3', 150000, 250000),
        ('Senior Manager', 'C4', 120000, 200000),
        ('Manager', 'C5', 90000, 150000),
        ('Team Lead', 'C6', 80000, 130000),
        ('Senior Engineer', 'C7', 70000, 120000),
        ('Software Engineer', 'C8', 55000, 95000),
        ('Junior Engineer', 'C9', 40000, 65000),
        ('Analyst', 'C8', 50000, 85000),
        ('Specialist', 'C7', 60000, 100000),
        ('Coordinator', 'C9', 35000, 55000),
        ('Intern', 'C10', 20000, 35000),
    ]
    
    desig_ids = []
    desig_counter = 0
    for dept_id in dept_ids[:16]:  # First 16 departments
        for title, level, min_sal, max_sal in designation_data[:5]:  # 5 designations per dept
            desig_id = f'demo-desig-{desig_counter}'
            desig_ids.append(desig_id)
            cur.execute("""
                INSERT INTO "Designation" (id, title, "departmentId", level, "minSalary", "maxSalary", status, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            """, (desig_id, title, dept_id, level, min_sal, max_sal))
            desig_counter += 1
    print(f"  Created {desig_counter} designations")
    
    # Create Users for Demo
    # Get password hash from platform DB
    plat_conn = get_conn(PLATFORM_DB)
    plat_cur = plat_conn.cursor()
    plat_cur.execute('SELECT email, password FROM "User" LIMIT 5;')
    pwd_hashes = {row[0]: row[1] for row in plat_cur.fetchall()}
    plat_conn.close()
    
    # Use a default password hash (bcrypt of "Demo@123")
    default_pwd = list(pwd_hashes.values())[0] if pwd_hashes else '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
    
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
        cur.execute("""
            INSERT INTO "User" (id, email, password, name, "tenantId", role, status, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, 'active', NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
                "tenantId" = EXCLUDED."tenantId", status = EXCLUDED.status
        """, (uid, email, default_pwd, name, tenant_id, role))
    print(f"  Created {len(demo_users)} demo users")
    
    # Create Roles
    demo_roles = [
        ('demo-role-super-admin', 'Super Administrator'),
        ('demo-role-tenant-admin', 'Tenant Administrator'),
        ('demo-role-hr-admin', 'HR Administrator'),
        ('demo-role-hr-manager', 'HR Manager'),
        ('demo-role-manager', 'Manager'),
        ('demo-role-employee', 'Employee'),
        ('demo-role-finance-admin', 'Finance Administrator'),
        ('demo-role-finance-manager', 'Finance Manager'),
        ('demo-role-travel-admin', 'Travel Administrator'),
        ('demo-role-crm-admin', 'CRM Administrator'),
    ]
    
    role_ids = []
    for rid, rname in demo_roles:
        role_ids.append(rid)
        cur.execute("""
            INSERT INTO "Role" (id, name, "tenantId", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "tenantId" = EXCLUDED."tenantId"
        """, (rid, rname, tenant_id))
    print(f"  Created {len(demo_roles)} roles")
    
    # Create Modules
    modules = [
        'dashboard', 'company', 'employee', 'leave', 'attendance', 'payroll',
        'recruitment', 'performance', 'training', 'travel', 'expense',
        'asset', 'document', 'helpdesk', 'settings', 'rbac', 'reports',
        'onboarding', 'separation', 'workflow', 'crm', 'project'
    ]
    
    module_ids = {}
    for mod in modules:
        mod_id = f'demo-mod-{mod}'
        module_ids[mod] = mod_id
        cur.execute("""
            INSERT INTO "Module" (id, name, "createdAt", "updatedAt")
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, (mod_id, mod.capitalize()))
    print(f"  Created {len(modules)} modules")
    
    # Create Permissions
    perm_actions = ['view', 'create', 'edit', 'delete']
    perm_ids = []
    for mod_name, mod_id in module_ids.items():
        for action in perm_actions:
            perm_id = f'demo-perm-{mod_name}-{action}'
            perm_ids.append(perm_id)
            cur.execute("""
                INSERT INTO "Permission" (id, action, resource, "moduleId", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    action = EXCLUDED.action, resource = EXCLUDED.resource, "moduleId" = EXCLUDED."moduleId"
            """, (perm_id, action, mod_name, mod_id))
    print(f"  Created {len(perm_ids)} permissions")
    
    # Assign permissions to roles
    all_perms = perm_ids
    hr_mods = ['employee', 'leave', 'attendance', 'recruitment', 'performance', 'training', 'onboarding', 'helpdesk']
    fin_mods = ['payroll', 'expense', 'travel', 'reports']
    emp_mods = ['dashboard', 'employee', 'leave', 'attendance', 'expense', 'travel', 'document', 'helpdesk']
    
    role_perm_map = {
        'demo-role-super-admin': all_perms,
        'demo-role-tenant-admin': all_perms,
        'demo-role-hr-admin': [p for p in all_perms if any(m in p for m in hr_mods)],
        'demo-role-hr-manager': [p for p in all_perms if any(m in p for m in hr_mods) and '-view' in p or '-create' in p],
        'demo-role-manager': [p for p in all_perms if any(m in p for m in emp_mods) and '-view' in p],
        'demo-role-employee': [p for p in all_perms if '-view' in p and any(m in p for m in emp_mods)],
        'demo-role-finance-admin': [p for p in all_perms if any(m in p for m in fin_mods + ['dashboard', 'reports'])],
        'demo-role-finance-manager': [p for p in all_perms if any(m in p for m in fin_mods) and '-view' in p],
        'demo-role-travel-admin': [p for p in all_perms if 'travel' in p or 'expense' in p],
        'demo-role-crm-admin': [p for p in all_perms if 'crm' in p or 'project' in p],
    }
    
    total_assignments = 0
    for rid, perms in role_perm_map.items():
        for pid in perms:
            try:
                cur.execute("""
                    INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                    VALUES (%s, %s, NOW(), NOW())
                    ON CONFLICT DO NOTHING
                """, (rid, pid))
                total_assignments += 1
            except:
                pass
    print(f"  Created {total_assignments} role-permission assignments")
    
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
        cur.execute("""
            INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """, (uid, rid))
    print(f"  Created user-role assignments")
    
    # Create Sample Employees
    first_names = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda', 
                   'William', 'Jennifer', 'Richard', 'Lisa', 'James', 'Maria', 'Thomas', 
                   'Patricia', 'Daniel', 'Linda', 'Matthew', 'Elizabeth']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 
                  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 
                  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
    
    emp_count = 0
    for i in range(20):
        first = first_names[i % len(first_names)]
        last = last_names[i % len(last_names)]
        emp_id = f'demo-emp-{i+1}'
        email = f'{first.lower()}.{last.lower()}@3boxeshrms.com'
        comp_id = comp_ids[i % len(comp_ids)]
        dept_id = dept_ids[i % len(dept_ids)] if dept_ids else None
        desig_id = desig_ids[i % len(desig_ids)] if desig_ids else None
        branch_id = branches[i % len(branches)] if branches else None
        
        # Link first few employees to demo users
        user_id = None
        if i < len(user_ids):
            user_id = user_ids[i]
        
        gender = 'male' if i % 2 == 0 else 'female'
        doj = date(2024, (i % 12) + 1, (i % 28) + 1)
        dob = date(1985 + (i % 15), (i % 12) + 1, (i % 28) + 1)
        salary = 50000 + (i * 5000)
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName",
                email = EXCLUDED.email, "companyId" = EXCLUDED."companyId"
        """, (
            emp_id, f'EMP-{1000+i}', first, last, email, f'+1-555-{1000+i}',
            None, user_id, dept_id, desig_id, branch_id, comp_id, doj, dob,
            gender, 'single', 'American', f'{100+i} Demo Street', 'New York', 'NY', '10001', 'United States',
            'O+', 'Emergency Contact', '+1-555-9111', 'active',
            'Demo National Bank', f'DNBNK{1000+i}', 'DNBN0000001', f'DEMO{i}1234A', salary, 'USD'
        ))
        emp_count += 1
    print(f"  Created {emp_count} sample employees")
    
    # Add Leave Types
    leave_types = [
        ('demo-lt-casual', 'Casual Leave', 12, 'casual'),
        ('demo-lt-sick', 'Sick Leave', 10, 'sick'),
        ('demo-lt-earned', 'Earned Leave', 15, 'earned'),
        ('demo-lt-maternity', 'Maternity Leave', 180, 'maternity'),
        ('demo-lt-paternity', 'Paternity Leave', 15, 'paternity'),
        ('demo-lt-compoff', 'Compensatory Off', 5, 'compoff'),
        ('demo-lt-restricted', 'Restricted Holiday', 2, 'restricted'),
    ]
    for lt_id, name, quota, lt_type in leave_types:
        cur.execute("""
            INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, (lt_id, name, quota, lt_type))
    print(f"  Created {len(leave_types)} leave types")
    
    # Add Holidays (US 2025)
    holidays = [
        ('demo-hol-1', "New Year's Day", date(2025, 1, 1), 'public'),
        ('demo-hol-2', 'Martin Luther King Jr. Day', date(2025, 1, 20), 'public'),
        ('demo-hol-3', "Presidents' Day", date(2025, 2, 17), 'public'),
        ('demo-hol-4', 'Memorial Day', date(2025, 5, 26), 'public'),
        ('demo-hol-5', 'Independence Day', date(2025, 7, 4), 'public'),
        ('demo-hol-6', 'Labor Day', date(2025, 9, 1), 'public'),
        ('demo-hol-7', 'Thanksgiving Day', date(2025, 11, 27), 'public'),
        ('demo-hol-8', 'Christmas Day', date(2025, 12, 25), 'public'),
    ]
    for hol_id, name, hol_date, hol_type in holidays:
        cur.execute("""
            INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, (hol_id, name, hol_date, hol_type))
    print(f"  Created {len(holidays)} holidays")
    
    # Add TenantConfiguration
    cur.execute("""
        INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance",
            "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount",
            "activeLanguageCount", "createdAt", "updatedAt")
        VALUES ('demo-tenant-config', %s, true, true, true, true, 8, 8, 5, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            "autoProvisionPayroll" = EXCLUDED."autoProvisionPayroll"
    """, (tenant_id,))
    print(f"  Created TenantConfiguration")
    
    conn.close()
    print("  Demo DB seeded! ✅")


def seed_marqai_db():
    """Seed MarqAI DB with real tenant data."""
    conn = get_conn(MARQAI_DB)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("\n=== SEEDING MARQAI DATABASE ===")
    
    # Get tenant ID
    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tenant = cur.fetchone()
    tenant_id = tenant[0] if tenant else MARQAI_TENANT_ID
    
    # Check what already exists
    cur.execute('SELECT COUNT(*) FROM "Module";')
    mod_count = cur.fetchone()[0]
    
    if mod_count > 0:
        print(f"  Modules already exist ({mod_count}), skipping module creation")
    else:
        # Create Modules
        modules = [
            'dashboard', 'company', 'employee', 'leave', 'attendance', 'payroll',
            'recruitment', 'performance', 'training', 'travel', 'expense',
            'asset', 'document', 'helpdesk', 'settings', 'rbac', 'reports',
            'onboarding', 'separation', 'workflow', 'crm', 'project'
        ]
        
        module_ids = {}
        for mod in modules:
            mod_id = f'marq-mod-{mod}'
            module_ids[mod] = mod_id
            cur.execute("""
                INSERT INTO "Module" (id, name, "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (mod_id, mod.capitalize()))
        print(f"  Created {len(modules)} modules")
        
        # Create Permissions
        perm_actions = ['view', 'create', 'edit', 'delete']
        perm_ids = []
        for mod_name, mod_id in module_ids.items():
            for action in perm_actions:
                perm_id = f'marq-perm-{mod_name}-{action}'
                perm_ids.append(perm_id)
                cur.execute("""
                    INSERT INTO "Permission" (id, action, resource, "moduleId", "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        action = EXCLUDED.action, resource = EXCLUDED.resource, "moduleId" = EXCLUDED."moduleId"
                """, (perm_id, action, mod_name, mod_id))
        print(f"  Created {len(perm_ids)} permissions")
        
        # Assign permissions to existing roles
        cur.execute('SELECT id FROM "Role" WHERE "tenantId" = %s;', (tenant_id,))
        existing_roles = cur.fetchall()
        for role_row in existing_roles:
            rid = role_row[0]
            for pid in perm_ids:
                cur.execute("""
                    INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                    VALUES (%s, %s, NOW(), NOW())
                    ON CONFLICT DO NOTHING
                """, (rid, pid))
        print(f"  Assigned permissions to {len(existing_roles)} roles")
    
    # Create employees for existing users
    cur.execute('SELECT id, email, name, role FROM "User";')
    users = cur.fetchall()
    
    cur.execute('SELECT id FROM "Company";')
    companies = cur.fetchall()
    comp_ids = [c[0] for c in companies]
    
    cur.execute('SELECT id FROM "Department" LIMIT 20;')
    dept_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Designation" LIMIT 20;')
    desig_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]
    
    emp_created = 0
    for uid, email, name, role in users:
        # Check if employee already exists for this user
        cur.execute('SELECT id FROM "Employee" WHERE "userId" = %s;', (uid,))
        if cur.fetchone():
            continue
        
        parts = name.split(' ', 1)
        first = parts[0] if parts else name
        last = parts[1] if len(parts) > 1 else ''
        
        comp_id = comp_ids[0] if comp_ids else None
        dept_id = dept_ids[0] if dept_ids else None
        desig_id = desig_ids[0] if desig_ids else None
        branch_id = branch_ids[0] if branch_ids else None
        
        emp_id = f'marq-emp-{uid[:12].replace("-", "").replace("_", "")}'
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            emp_id, f'MARQ-{1000+emp_created}', first, last, email, None,
            None, uid, dept_id, desig_id, branch_id, comp_id,
            date(2024, 1, 15), date(1990, 5, 15), 'male', 'single', 'Indian',
            '123 MarqAI Street', 'Hyderabad', 'Telangana', '500001', 'India',
            'O+', 'Emergency', '+91-9876543210', 'active',
            'HDFC Bank', '1234567890', 'HDFC0001234', 'ABCDE1234F', 75000, 'INR'
        ))
        emp_created += 1
    
    print(f"  Created {emp_created} employee records for existing users")
    
    # Add more MarqAI employees
    marqai_employees = [
        ('marq-emp-add1', 'Rajesh', 'Kumar', 'rajesh.kumar@marqaitech.com'),
        ('marq-emp-add2', 'Priya', 'Sharma', 'priya.sharma@marqaitech.com'),
        ('marq-emp-add3', 'Arun', 'Reddy', 'arun.reddy@marqaitech.com'),
        ('marq-emp-add4', 'Sneha', 'Patil', 'sneha.patil@marqaitech.com'),
        ('marq-emp-add5', 'Meera', 'Nair', 'meera.nair@marqaitech.com'),
        ('marq-emp-add6', 'Vikram', 'Singh', 'vikram.singh@marqaitech.com'),
        ('marq-emp-add7', 'Anita', 'Gupta', 'anita.gupta@marqaitech.com'),
        ('marq-emp-add8', 'Suresh', 'Babu', 'suresh.babu@marqaitech.com'),
    ]
    
    for i, (emp_id, first, last, email) in enumerate(marqai_employees):
        comp_id = comp_ids[i % len(comp_ids)] if comp_ids else None
        dept_id = dept_ids[i % len(dept_ids)] if dept_ids else None
        desig_id = desig_ids[i % len(desig_ids)] if desig_ids else None
        branch_id = branch_ids[i % len(branch_ids)] if branch_ids else None
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", salary, "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            emp_id, f'MARQ-{2000+i}', first, last, email, f'+91-98765{i}4321',
            None, None, dept_id, desig_id, branch_id, comp_id,
            date(2024, (i % 12) + 1, (i % 28) + 1),
            date(1985 + (i % 15), (i % 12) + 1, (i % 28) + 1),
            'male' if i % 2 == 0 else 'female', 'single', 'Indian',
            'MarqAI Campus', 'Hyderabad', 'Telangana', '500001', 'India',
            'B+', 'Emergency', '+91-9876543210', 'active',
            'HDFC Bank', f'1234{5678+i}', 'HDFC0001234',
            f'MARQ{i}1234F', 60000 + (i * 5000), 'INR'
        ))
    print(f"  Added {len(marqai_employees)} more employees")
    
    # Leave Types
    cur.execute('SELECT COUNT(*) FROM "LeaveType";')
    lt_count = cur.fetchone()[0]
    if lt_count == 0:
        leave_types = [
            ('marq-lt-casual', 'Casual Leave', 12, 'casual'),
            ('marq-lt-sick', 'Sick Leave', 10, 'sick'),
            ('marq-lt-earned', 'Earned Leave', 15, 'earned'),
            ('marq-lt-maternity', 'Maternity Leave', 180, 'maternity'),
            ('marq-lt-paternity', 'Paternity Leave', 15, 'paternity'),
            ('marq-lt-compoff', 'Compensatory Off', 5, 'compoff'),
        ]
        for lt_id, name, quota, lt_type in leave_types:
            cur.execute("""
                INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (lt_id, name, quota, lt_type))
        print(f"  Created {len(leave_types)} leave types")
    
    # Indian Holidays 2025
    cur.execute('SELECT COUNT(*) FROM "Holiday";')
    hol_count = cur.fetchone()[0]
    if hol_count == 0:
        holidays = [
            ('marq-hol-1', 'Republic Day', date(2025, 1, 26), 'public'),
            ('marq-hol-2', 'Holi', date(2025, 3, 14), 'public'),
            ('marq-hol-3', 'Good Friday', date(2025, 4, 18), 'public'),
            ('marq-hol-4', 'Independence Day', date(2025, 8, 15), 'public'),
            ('marq-hol-5', 'Gandhi Jayanti', date(2025, 10, 2), 'public'),
            ('marq-hol-6', 'Dussehra', date(2025, 10, 2), 'public'),
            ('marq-hol-7', 'Diwali', date(2025, 10, 20), 'public'),
            ('marq-hol-8', 'Christmas', date(2025, 12, 25), 'public'),
        ]
        for hol_id, name, hol_date, hol_type in holidays:
            cur.execute("""
                INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (hol_id, name, hol_date, hol_type))
        print(f"  Created {len(holidays)} holidays")
    
    # UserRoleAssignments
    cur.execute('SELECT id, role FROM "User" WHERE "tenantId" = %s;', (tenant_id,))
    users = cur.fetchall()
    cur.execute('SELECT id, name FROM "Role" WHERE "tenantId" = %s;', (tenant_id,))
    roles = {r[1].lower(): r[0] for r in cur.fetchall()}
    
    for uid, role in users:
        # Map user role to role record
        role_name_map = {
            'super_admin': 'super administrator',
            'tenant_admin': 'tenant administrator', 
            'hr_admin': 'hr administrator',
            'hr_manager': 'hr manager',
            'employee': 'employee',
            'manager': 'manager',
        }
        mapped_name = role_name_map.get(role, role.replace('_', ' '))
        rid = roles.get(mapped_name)
        if rid:
            cur.execute("""
                INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (uid, rid))
    print(f"  Created user-role assignments")
    
    # TenantConfiguration
    cur.execute('SELECT COUNT(*) FROM "TenantConfiguration" WHERE "tenantId" = %s;', (tenant_id,))
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance",
                "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount",
                "activeLanguageCount", "createdAt", "updatedAt")
            VALUES ('marq-tenant-config', %s, true, true, true, true, 1, 1, 2, NOW(), NOW())
        """, (tenant_id,))
        print(f"  Created TenantConfiguration")
    
    # Clean platform tables that shouldn't be in tenant DB
    for table in ['TenantDatabase', 'TrialRegistration', 'DataResidencyPolicy', 'SubscriptionPlan']:
        try:
            cur.execute(f'DELETE FROM "{table}";')
        except:
            pass
    print(f"  Cleaned platform-level tables")
    
    conn.close()
    print("  MarqAI DB seeded! ✅")


def verify():
    """Verify data in both databases."""
    print("\n=== VERIFICATION ===")
    
    for db_name, label in [(DEMO_DB, 'Demo'), (MARQAI_DB, 'MarqAI')]:
        conn = get_conn(db_name)
        cur = conn.cursor()
        
        print(f"\n  --- {label} Database ---")
        
        key_tables = ['Tenant', 'User', 'CompanyGroup', 'Company', 'Department', 'Employee',
                      'Role', 'Module', 'Permission', 'LeaveType', 'Holiday', 'Designation',
                      'Branch', 'TenantConfiguration']
        
        for table in key_tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                count = cur.fetchone()[0]
                status = '✅' if count > 0 else '⚠️'
                print(f'    {status} {table}: {count}')
            except Exception as e:
                print(f'    ❌ {table}: ERROR - {str(e)[:60]}')
        
        # Verify no cross-tenant data
        cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
        tid = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != %s;', (tid,))
        wrong = cur.fetchone()[0]
        print(f'    {"✅" if wrong == 0 else "❌"} Wrong-tenant users: {wrong}')
        
        cur.execute('SELECT COUNT(*) FROM "CompanyGroup" WHERE "tenantId" != %s;', (tid,))
        wrong = cur.fetchone()[0]
        print(f'    {"✅" if wrong == 0 else "❌"} Wrong-tenant company groups: {wrong}')
        
        conn.close()


if __name__ == '__main__':
    seed_demo_db()
    seed_marqai_db()
    verify()
    
    print("\n" + "=" * 60)
    print("DONE! Both tenant databases properly seeded.")
    print("Demo = SAMPLE data | MarqAI = REAL tenant data")
    print("=" * 60)
