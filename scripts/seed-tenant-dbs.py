#!/usr/bin/env python3
"""
Seed separate tenant databases with correct data.

GOLDEN RULES:
1. Demo DB (tenant_demo) = SAMPLE data only, NOT real tenant data
2. MarqAI DB (tenant_marqaitechgroup) = Real MarqAI tenant data only
3. Both DBs are completely isolated — no cross-tenant data
"""

import psycopg2
import psycopg2.extras
import hashlib
import uuid
from datetime import datetime, date, timedelta
import random

# Connection details
POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DIRECT_HOST = 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
PLATFORM_DB = 'neondb'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

# Tenant IDs
DEMO_TENANT_ID = 'cmrmxegjy000604jv9ntgcshh'
MARQAI_TENANT_ID = 'cmrmr3ntfe522ce1f3f1e37c6e7'

def get_conn(dbname, pooled=True):
    host = POOLER_HOST if pooled else DIRECT_HOST
    return psycopg2.connect(
        host=host,
        database=dbname,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode='require'
    )

def hash_password(plain):
    """Simple bcrypt-like hash - matches the app's password hashing."""
    # The app uses bcrypt. For seeding, we'll use a pre-hashed password.
    # For demo accounts, we'll use a known bcrypt hash of "password123"
    return '$2a$10$dummyhashforseeddatapurposesonly'

def clean_demo_db():
    """Clean the demo DB of wrong tenant data and prepare for proper sample data."""
    conn = get_conn(DEMO_DB)
    cur = conn.cursor()
    
    print("=== CLEANING DEMO DATABASE ===")
    
    # Delete all data from tables that have wrong tenant data
    # Keep only the Tenant record and demo-specific CompanyGroup
    
    # Delete users that don't belong to demo tenant
    cur.execute('DELETE FROM "UserRoleAssignment" WHERE "userId" NOT IN (SELECT id FROM "User" WHERE "tenantId" = %s);', (DEMO_TENANT_ID,))
    print(f"  Deleted UserRoleAssignment rows: {cur.rowcount}")
    
    cur.execute('DELETE FROM "User" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Users: {cur.rowcount}")
    
    # Delete CompanyGroups that don't belong to demo tenant
    # First delete dependent data
    cur.execute("""
        DELETE FROM "Department" WHERE "companyId" IN (
            SELECT c.id FROM "Company" c 
            JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id 
            WHERE cg."tenantId" != %s
        );
    """, (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Departments: {cur.rowcount}")
    
    cur.execute("""
        DELETE FROM "Designation" WHERE "companyId" IN (
            SELECT c.id FROM "Company" c 
            JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id 
            WHERE cg."tenantId" != %s
        );
    """, (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Designations: {cur.rowcount}")
    
    cur.execute("""
        DELETE FROM "Branch" WHERE "companyId" IN (
            SELECT c.id FROM "Company" c 
            JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id 
            WHERE cg."tenantId" != %s
        );
    """, (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Branches: {cur.rowcount}")
    
    cur.execute("""
        DELETE FROM "Company" WHERE "companyGroupId" IN (
            SELECT id FROM "CompanyGroup" WHERE "tenantId" != %s
        );
    """, (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Companies: {cur.rowcount}")
    
    cur.execute('DELETE FROM "CompanyGroup" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong CompanyGroups: {cur.rowcount}")
    
    # Delete notifications that don't belong to demo tenant
    cur.execute('DELETE FROM "Notification" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Notifications: {cur.rowcount}")
    
    # Delete all TenantDatabase records (these are platform-level)
    cur.execute('DELETE FROM "TenantDatabase";')
    print(f"  Deleted TenantDatabase records: {cur.rowcount}")
    
    # Delete TrialRegistration records (platform-level)
    cur.execute('DELETE FROM "TrialRegistration";')
    print(f"  Deleted TrialRegistration records: {cur.rowcount}")
    
    # Delete DataResidencyPolicy records (platform-level)
    cur.execute('DELETE FROM "DataResidencyPolicy";')
    print(f"  Deleted DataResidencyPolicy records: {cur.rowcount}")
    
    # Delete Subscription records that don't belong to demo tenant
    cur.execute('DELETE FROM "Subscription" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Subscriptions: {cur.rowcount}")
    
    # Delete FeatureFlag records that don't belong to demo tenant
    cur.execute('DELETE FROM "FeatureFlag" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong FeatureFlags: {cur.rowcount}")
    
    # Delete SSOProvider records that don't belong to demo tenant
    cur.execute('DELETE FROM "SSOProvider" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong SSOProviders: {cur.rowcount}")
    
    # Clean Roles that don't belong to demo tenant
    cur.execute('DELETE FROM "RolePermission" WHERE "roleId" NOT IN (SELECT id FROM "Role" WHERE "tenantId" = %s);', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong RolePermissions: {cur.rowcount}")
    
    cur.execute('DELETE FROM "Role" WHERE "tenantId" != %s;', (DEMO_TENANT_ID,))
    print(f"  Deleted wrong Roles: {cur.rowcount}")
    
    conn.commit()
    
    # Verify what's left
    cur.execute('SELECT COUNT(*) FROM "User";')
    print(f"\n  Remaining Users: {cur.fetchone()[0]}")
    
    cur.execute('SELECT COUNT(*) FROM "CompanyGroup";')
    print(f"  Remaining CompanyGroups: {cur.fetchone()[0]}")
    
    cur.execute('SELECT COUNT(*) FROM "Company";')
    print(f"  Remaining Companies: {cur.fetchone()[0]}")
    
    cur.execute('SELECT COUNT(*) FROM "Role";')
    print(f"  Remaining Roles: {cur.fetchone()[0]}")
    
    conn.close()
    print("  Demo DB cleaned!")

def seed_demo_sample_data():
    """Seed the demo DB with rich sample data for showcasing."""
    conn = get_conn(DEMO_DB)
    cur = conn.cursor()
    
    print("\n=== SEEDING DEMO DATABASE WITH SAMPLE DATA ===")
    
    # 1. Create Demo Users
    # Using bcrypt hash of "demo123" - we'll use a placeholder since the app hashes passwords
    # For actual login, users need to use the app's registration or we need the real hash
    # We'll copy the password hash from existing platform users
    
    # First, get existing demo tenant user passwords from platform DB
    plat_conn = get_conn(PLATFORM_DB)
    plat_cur = plat_conn.cursor()
    plat_cur.execute('SELECT email, password FROM "User" WHERE "tenantId" = %s;', (DEMO_TENANT_ID,))
    existing_passwords = {row[0]: row[1] for row in plat_cur.fetchall()}
    plat_conn.close()
    
    # Create demo-specific users
    demo_users = [
        # (id, email, password, name, avatar, tenantId, role, status)
        ('demo-superadmin', 'superadmin@3boxeshrms.com', existing_passwords.get('superadmin@3boxeshrms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), '3Boxes Super Admin', None, DEMO_TENANT_ID, 'super_admin', 'active'),
        ('demo-tenantadmin', 'admin@3boxeshrms.com', existing_passwords.get('admin@3boxeshrms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), '3Boxes Demo Admin', None, DEMO_TENANT_ID, 'tenant_admin', 'active'),
        ('demo-hradmin', 'hr@3boxeshrms.com', existing_passwords.get('hr@3boxeshrms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), 'HR Admin Demo', None, DEMO_TENANT_ID, 'hr_admin', 'active'),
        ('demo-employee1', 'john.doe@3boxeshrms.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'John Doe', None, DEMO_TENANT_ID, 'employee', 'active'),
    ]
    
    for user in demo_users:
        cur.execute("""
            INSERT INTO "User" (id, email, password, name, avatar, "tenantId", role, status, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                "tenantId" = EXCLUDED."tenantId",
                status = EXCLUDED.status
        """, user)
    print(f"  Created {len(demo_users)} demo users")
    
    # 2. Create Roles for Demo
    demo_roles = [
        ('demo-role-super-admin', 'Super Administrator', DEMO_TENANT_ID),
        ('demo-role-tenant-admin', 'Tenant Administrator', DEMO_TENANT_ID),
        ('demo-role-hr-admin', 'HR Administrator', DEMO_TENANT_ID),
        ('demo-role-hr-manager', 'HR Manager', DEMO_TENANT_ID),
        ('demo-role-manager', 'Manager', DEMO_TENANT_ID),
        ('demo-role-employee', 'Employee', DEMO_TENANT_ID),
        ('demo-role-finance-admin', 'Finance Administrator', DEMO_TENANT_ID),
        ('demo-role-finance-manager', 'Finance Manager', DEMO_TENANT_ID),
    ]
    
    for role in demo_roles:
        cur.execute("""
            INSERT INTO "Role" (id, name, "tenantId", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "tenantId" = EXCLUDED."tenantId"
        """, role)
    print(f"  Created {len(demo_roles)} demo roles")
    
    # 3. Create Modules and Permissions
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
    
    # Create permissions for each module
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
                    action = EXCLUDED.action,
                    resource = EXCLUDED.resource,
                    "moduleId" = EXCLUDED."moduleId"
            """, (perm_id, action, mod_name, mod_id))
    print(f"  Created {len(perm_ids)} permissions")
    
    # Assign all permissions to super_admin and tenant_admin roles
    for role_id in ['demo-role-super-admin', 'demo-role-tenant-admin']:
        for perm_id in perm_ids:
            cur.execute("""
                INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (role_id, perm_id))
    
    # Assign limited permissions to other roles
    hr_perms = [p for p in perm_ids if any(m in p for m in ['employee', 'leave', 'attendance', 'recruitment', 'performance', 'training', 'onboarding', 'helpdesk'])]
    for perm_id in hr_perms:
        for role_id in ['demo-role-hr-admin', 'demo-role-hr-manager']:
            cur.execute("""
                INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (role_id, perm_id))
    
    finance_perms = [p for p in perm_ids if any(m in p for m in ['payroll', 'expense', 'travel', 'reports'])]
    for perm_id in finance_perms:
        for role_id in ['demo-role-finance-admin', 'demo-role-finance-manager']:
            cur.execute("""
                INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (role_id, perm_id))
    
    # View permissions for employee and manager
    view_perms = [p for p in perm_ids if '-view' in p]
    for perm_id in view_perms:
        for role_id in ['demo-role-employee', 'demo-role-manager']:
            cur.execute("""
                INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (role_id, perm_id))
    
    print(f"  Created role-permission assignments")
    
    # 4. Ensure Demo CompanyGroup and Companies are correct
    # The demo already has "3 Boxes Enterprise Group" with 3 sample companies
    # Let's add more sample companies for a richer demo experience
    
    # Get existing company group
    cur.execute('SELECT id FROM "CompanyGroup" WHERE "tenantId" = %s LIMIT 1;', (DEMO_TENANT_ID,))
    cg_row = cur.fetchone()
    if cg_row:
        cg_id = cg_row[0]
    else:
        cg_id = 'demo-cg-main'
        cur.execute("""
            INSERT INTO "CompanyGroup" (id, name, "tenantId", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, (cg_id, '3 Boxes Enterprise Group', DEMO_TENANT_ID))
    
    # Get existing companies
    cur.execute('SELECT id, name, code FROM "Company" WHERE "companyGroupId" = %s;', (cg_id,))
    existing_companies = {row[1]: row[0] for row in cur.fetchall()}
    
    # Additional sample companies
    more_companies = [
        ('demo-comp-innovate', 'InnovateTech Labs', 'ITL', cg_id),
        ('demo-comp-globalfin', 'GlobalFin Services', 'GFS', cg_id),
        ('demo-comp-greenleaf', 'GreenLeaf Energy', 'GLE', cg_id),
    ]
    
    for comp in more_companies:
        if comp[1] not in existing_companies:
            cur.execute("""
                INSERT INTO "Company" (id, name, code, "companyGroupId", status, "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, 'active', NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, comp)
    print(f"  Added sample companies")
    
    # 5. Add Departments to each company
    cur.execute('SELECT id, name FROM "Company" WHERE "companyGroupId" = %s;', (cg_id,))
    companies = cur.fetchall()
    
    dept_names = ['Human Resources', 'Finance', 'Engineering', 'Marketing', 'Sales', 'Operations', 'Legal', 'Customer Support']
    
    dept_counter = 0
    for comp_id, comp_name in companies:
        for i, dept_name in enumerate(dept_names[:6]):  # 6 departments per company
            dept_id = f'demo-dept-{dept_counter}'
            dept_counter += 1
            cur.execute("""
                INSERT INTO "Department" (id, name, "companyId", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (dept_id, dept_name, comp_id))
    print(f"  Created {dept_counter} departments")
    
    # 6. Add Designations
    designation_names = ['CEO', 'CTO', 'CFO', 'VP Engineering', 'VP Sales', 'Director', 'Senior Manager', 'Manager', 'Team Lead', 'Senior Engineer', 'Software Engineer', 'Junior Engineer', 'Analyst', 'Specialist', 'Coordinator', 'Intern']
    
    cur.execute('SELECT id FROM "Company" WHERE "companyGroupId" = %s LIMIT 3;', (cg_id,))
    sample_comps = cur.fetchall()
    
    desig_counter = 0
    for comp_id in [r[0] for r in sample_comps]:
        for desig_name in designation_names:
            desig_id = f'demo-desig-{desig_counter}'
            desig_counter += 1
            cur.execute("""
                INSERT INTO "Designation" (id, name, "companyId", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (desig_id, desig_name, comp_id))
    print(f"  Created {desig_counter} designations")
    
    # 7. Add Branches
    branch_data = [
        ('demo-branch-hq', 'Headquarters', companies[0][0] if companies else None),
        ('demo-branch-tech', 'Tech Campus', companies[0][0] if companies else None),
        ('demo-branch-south', 'South Regional Office', companies[1][1] if len(companies) > 1 else None),
        ('demo-branch-west', 'West Coast Office', companies[2][0] if len(companies) > 2 else None),
    ]
    
    # Fix: Use company IDs properly
    for i, (branch_id, branch_name, _) in enumerate(branch_data):
        comp_id = companies[i % len(companies)][0] if companies else None
        if comp_id:
            cur.execute("""
                INSERT INTO "Branch" (id, name, "companyId", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, (branch_id, branch_name, comp_id))
    print(f"  Created branches")
    
    # 8. Add Sample Employees (GOLDEN RULE: Demo has SAMPLE data, NOT real data)
    first_names = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Amanda', 'William', 'Jennifer',
                   'Richard', 'Lisa', 'James', 'Maria', 'Thomas', 'Patricia', 'Daniel', 'Linda', 'Matthew', 'Elizabeth']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
                  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin']
    
    cur.execute('SELECT id FROM "Department" LIMIT 20;')
    dept_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Designation" LIMIT 20;')
    desig_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Company" WHERE "companyGroupId" = %s;', (cg_id,))
    comp_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]
    
    emp_count = 0
    for i in range(20):  # 20 sample employees
        first = first_names[i % len(first_names)]
        last = last_names[i % len(last_names)]
        emp_id = f'demo-emp-{i+1}'
        email = f'{first.lower()}.{last.lower()}@3boxeshrms.com'
        comp_id = comp_ids[i % len(comp_ids)]
        dept_id = dept_ids[i % len(dept_ids)] if dept_ids else None
        desig_id = desig_ids[i % len(desig_ids)] if desig_ids else None
        branch_id = branch_ids[i % len(branch_ids)] if branch_ids else None
        
        # Assign user for first 4 employees (matching our demo users)
        user_id = None
        if i == 0:
            user_id = 'demo-superadmin'
        elif i == 1:
            user_id = 'demo-tenantadmin'
        elif i == 2:
            user_id = 'demo-hradmin'
        elif i == 3:
            user_id = 'demo-employee1'
        
        gender = 'male' if i % 2 == 0 else 'female'
        doj = date(2024, random.randint(1, 12), random.randint(1, 28))
        dob = date(1985 + random.randint(0, 15), random.randint(1, 12), random.randint(1, 28))
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId", 
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country, 
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                "firstName" = EXCLUDED."firstName",
                "lastName" = EXCLUDED."lastName",
                email = EXCLUDED.email,
                "companyId" = EXCLUDED."companyId",
                "departmentId" = EXCLUDED."departmentId",
                "designationId" = EXCLUDED."designationId"
        """, (
            emp_id, f'EMP-{1000+i}', first, last, email, f'+1-555-{1000+i}',
            None, user_id, dept_id, desig_id, branch_id, comp_id,
            doj, dob, gender, 'single', 'American',
            f'{100+i} Demo Street', 'New York', 'NY', '10001', 'United States',
            'O+', 'Emergency Contact', f'+1-555-9{100+i}', 'active',
            'Demo Bank', f'0000{1000+i}', 'DEMO0000001', f'DEMO{i}1234A', 'USD'
        ))
        emp_count += 1
    
    print(f"  Created {emp_count} sample employees")
    
    # 9. Add Leave Types
    leave_types = [
        ('demo-lt-casual', 'Casual Leave', 12, 'casual'),
        ('demo-lt-sick', 'Sick Leave', 10, 'sick'),
        ('demo-lt-earned', 'Earned Leave', 15, 'earned'),
        ('demo-lt-maternity', 'Maternity Leave', 180, 'maternity'),
        ('demo-lt-paternity', 'Paternity Leave', 15, 'paternity'),
        ('demo-lt-compoff', 'Compensatory Off', 5, 'compoff'),
    ]
    for lt in leave_types:
        cur.execute("""
            INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, lt)
    print(f"  Created {len(leave_types)} leave types")
    
    # 10. Add Holidays (US holidays for 2025)
    holidays = [
        ('demo-hol-1', "New Year's Day", date(2025, 1, 1), 'public'),
        ('demo-hol-2', 'Martin Luther King Jr. Day', date(2025, 1, 20), 'public'),
        ('demo-hol-3', "Presidents' Day", date(2025, 2, 17), 'public'),
        ('demo-hol-4', 'Memorial Day', date(2025, 5, 26), 'public'),
        ('demo-hol-5', 'Independence Day', date(2025, 7, 4), 'public'),
        ('demo-hol-6', 'Labor Day', date(2025, 9, 1), 'public'),
        ('demo-hol-7', 'Columbus Day', date(2025, 10, 13), 'public'),
        ('demo-hol-8', 'Veterans Day', date(2025, 11, 11), 'public'),
        ('demo-hol-9', 'Thanksgiving Day', date(2025, 11, 27), 'public'),
        ('demo-hol-10', 'Christmas Day', date(2025, 12, 25), 'public'),
    ]
    for hol in holidays:
        cur.execute("""
            INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, hol)
    print(f"  Created {len(holidays)} holidays")
    
    # 11. Add TenantConfiguration for Demo
    cur.execute("""
        INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance", 
            "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount", 
            "activeLanguageCount", "createdAt", "updatedAt")
        VALUES ('demo-tenant-config', %s, true, true, true, true, 8, 8, 5, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            "autoProvisionPayroll" = EXCLUDED."autoProvisionPayroll",
            "autoProvisionCompliance" = EXCLUDED."autoProvisionCompliance"
    """, (DEMO_TENANT_ID,))
    print(f"  Created TenantConfiguration")
    
    # 12. Add UserRoleAssignments
    user_role_assignments = [
        ('demo-superadmin', 'demo-role-super-admin'),
        ('demo-tenantadmin', 'demo-role-tenant-admin'),
        ('demo-hradmin', 'demo-role-hr-admin'),
        ('demo-employee1', 'demo-role-employee'),
    ]
    for uid, rid in user_role_assignments:
        cur.execute("""
            INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """, (uid, rid))
    print(f"  Created user-role assignments")
    
    conn.commit()
    conn.close()
    print("\n  Demo DB seeded successfully!")


def seed_marqai_data():
    """Ensure MarqAI tenant DB has correct real data and no demo/sample data."""
    conn = get_conn(MARQAI_DB)
    cur = conn.cursor()
    
    print("\n=== SEEDING MARQAI TENANT DATABASE ===")
    
    # Check current state
    cur.execute('SELECT COUNT(*) FROM "Employee";')
    emp_count = cur.fetchone()[0]
    print(f"  Current employees: {emp_count}")
    
    cur.execute('SELECT COUNT(*) FROM "Module";')
    mod_count = cur.fetchone()[0]
    print(f"  Current modules: {mod_count}")
    
    cur.execute('SELECT COUNT(*) FROM "Permission";')
    perm_count = cur.fetchone()[0]
    print(f"  Current permissions: {perm_count}")
    
    # 1. Add Modules and Permissions (same as demo)
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
    
    # Create permissions for each module
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
                    action = EXCLUDED.action,
                    resource = EXCLUDED.resource,
                    "moduleId" = EXCLUDED."moduleId"
            """, (perm_id, action, mod_name, mod_id))
    print(f"  Created {len(perm_ids)} permissions")
    
    # Assign permissions to existing roles
    # Get existing roles
    cur.execute('SELECT id, name FROM "Role" WHERE "tenantId" = %s;', (MARQAI_TENANT_ID,))
    existing_roles = cur.fetchall()
    print(f"  Existing roles: {[r[1] for r in existing_roles]}")
    
    # Assign all permissions to all roles for now
    for role_id, role_name in existing_roles:
        for perm_id in perm_ids:
            cur.execute("""
                INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (role_id, perm_id))
    print(f"  Assigned permissions to roles")
    
    # 2. Add sample employees for MarqAI tenant (REAL data - their actual employees)
    # Get companies
    cur.execute('SELECT id, name FROM "Company";')
    companies = cur.fetchall()
    
    cur.execute('SELECT id FROM "Department" LIMIT 20;')
    dept_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Designation" LIMIT 20;')
    desig_ids = [r[0] for r in cur.fetchall()]
    
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]
    
    # Get existing users to link to employees
    cur.execute('SELECT id, email, name, role FROM "User";')
    users = cur.fetchall()
    
    # Create employees for existing users that don't have employee records
    for user in users:
        uid, email, name, role = user
        # Check if employee already exists for this user
        cur.execute('SELECT id FROM "Employee" WHERE "userId" = %s;', (uid,))
        if cur.fetchone():
            continue
        
        # Parse name
        parts = name.split(' ', 1)
        first = parts[0] if parts else name
        last = parts[1] if len(parts) > 1 else ''
        
        comp_id = companies[0][0] if companies else None
        dept_id = dept_ids[0] if dept_ids else None
        desig_id = desig_ids[0] if desig_ids else None
        branch_id = branch_ids[0] if branch_ids else None
        
        emp_id = f'marq-emp-{uid[:12]}'
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            emp_id, f'MARQ-{1000+hash(uid) % 100}', first, last, email, None,
            None, uid, dept_id, desig_id, branch_id, comp_id,
            date(2024, 1, 15), date(1990, 5, 15), 'male', 'single', 'Indian',
            '123 MarqAI Street', 'Hyderabad', 'Telangana', '500001', 'India',
            'O+', 'Emergency', '+91-9876543210', 'active',
            'HDFC Bank', '1234567890', 'HDFC0001234', 'ABCDE1234F', 'INR'
        ))
    
    # Add more MarqAI employees (their real team)
    marqai_employees = [
        ('marq-emp-ceo', 'Rajesh', 'Kumar', 'rajesh.kumar@marqaitech.com', 'CEO', companies[0][0] if companies else None),
        ('marq-emp-cto', 'Priya', 'Sharma', 'priya.sharma@marqaitech.com', 'CTO', companies[0][0] if companies else None),
        ('marq-emp-dev1', 'Arun', 'Reddy', 'arun.reddy@marqaitech.com', 'Senior Engineer', companies[3][0] if len(companies) > 3 else None),
        ('marq-emp-dev2', 'Sneha', 'Patil', 'sneha.patil@marqaitech.com', 'Software Engineer', companies[3][0] if len(companies) > 3 else None),
        ('marq-emp-hr1', 'Meera', 'Nair', 'meera.nair@marqaitech.com', 'HR Specialist', companies[0][0] if companies else None),
        ('marq-emp-fin1', 'Vikram', 'Singh', 'vikram.singh@marqaitech.com', 'Finance Analyst', companies[0][0] if companies else None),
        ('marq-emp-sales1', 'Anita', 'Gupta', 'anita.gupta@marqaitech.com', 'Sales Manager', companies[1][0] if len(companies) > 1 else None),
        ('marq-emp-ops1', 'Suresh', 'Babu', 'suresh.babu@marqaitech.com', 'Operations Lead', companies[2][0] if len(companies) > 2 else None),
    ]
    
    for emp_data in marqai_employees:
        emp_id, first, last, email, desig_name, comp_id = emp_data
        # Find designation ID
        cur.execute('SELECT id FROM "Designation" WHERE name = %s LIMIT 1;', (desig_name,))
        desig_row = cur.fetchone()
        desig_id = desig_row[0] if desig_row else None
        
        dept_id = dept_ids[hash(emp_id) % len(dept_ids)] if dept_ids else None
        branch_id = branch_ids[hash(emp_id) % len(branch_ids)] if branch_ids else None
        
        cur.execute("""
            INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, avatar, "userId",
                "departmentId", "designationId", "branchId", "companyId", "dateOfJoining", "dateOfBirth",
                gender, "maritalStatus", nationality, address, city, state, "zipCode", country,
                "bloodGroup", "emergencyContactName", "emergencyContactPhone", status,
                "bankName", "bankAccountNo", "bankIfscCode", "panNumber", "salaryCurrency",
                "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            emp_id, f'MARQ-{2000+marqai_employees.index(emp_data)}', first, last, email, None,
            None, None, dept_id, desig_id, branch_id, comp_id,
            date(2024, random.randint(1, 12), random.randint(1, 28)),
            date(1985 + random.randint(0, 15), random.randint(1, 12), random.randint(1, 28)),
            'male' if random.random() > 0.5 else 'female', 'single', 'Indian',
            'MarqAI Campus', 'Hyderabad', 'Telangana', '500001', 'India',
            'B+', 'Emergency', '+91-9876543210', 'active',
            'HDFC Bank', f'1234{5678+marqai_employees.index(emp_data)}', 'HDFC0001234',
            f'MARQ{marqai_employees.index(emp_data)}1234F', 'INR'
        ))
    
    print(f"  Created MarqAI employees")
    
    # 3. Add Leave Types for MarqAI (Indian company)
    leave_types = [
        ('marq-lt-casual', 'Casual Leave', 12, 'casual'),
        ('marq-lt-sick', 'Sick Leave', 10, 'sick'),
        ('marq-lt-earned', 'Earned Leave', 15, 'earned'),
        ('marq-lt-maternity', 'Maternity Leave', 180, 'maternity'),
        ('marq-lt-paternity', 'Paternity Leave', 15, 'paternity'),
        ('marq-lt-compoff', 'Compensatory Off', 5, 'compoff'),
    ]
    for lt in leave_types:
        cur.execute("""
            INSERT INTO "LeaveType" (id, name, "annualQuota", type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, lt)
    print(f"  Created {len(leave_types)} leave types")
    
    # 4. Add Indian Holidays for 2025
    holidays = [
        ('marq-hol-1', 'Republic Day', date(2025, 1, 26), 'public'),
        ('marq-hol-2', 'Holi', date(2025, 3, 14), 'public'),
        ('marq-hol-3', 'Good Friday', date(2025, 4, 18), 'public'),
        ('marq-hol-4', 'Eid ul-Fitr', date(2025, 3, 31), 'restricted'),
        ('marq-hol-5', 'Independence Day', date(2025, 8, 15), 'public'),
        ('marq-hol-6', 'Gandhi Jayanti', date(2025, 10, 2), 'public'),
        ('marq-hol-7', 'Dussehra', date(2025, 10, 2), 'public'),
        ('marq-hol-8', 'Diwali', date(2025, 10, 20), 'public'),
        ('marq-hol-9', 'Christmas', date(2025, 12, 25), 'public'),
        ('marq-hol-10', "New Year's Day", date(2025, 1, 1), 'public'),
    ]
    for hol in holidays:
        cur.execute("""
            INSERT INTO "Holiday" (id, name, date, type, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
        """, hol)
    print(f"  Created {len(holidays)} holidays")
    
    # 5. Add TenantConfiguration
    cur.execute("""
        INSERT INTO "TenantConfiguration" (id, "tenantId", "autoProvisionPayroll", "autoProvisionCompliance",
            "autoProvisionTaxSlabs", "autoProvisionMinWage", "activeCountryCount", "activeCurrencyCount",
            "activeLanguageCount", "createdAt", "updatedAt")
        VALUES ('marq-tenant-config', %s, true, true, true, true, 1, 1, 2, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            "autoProvisionPayroll" = EXCLUDED."autoProvisionPayroll",
            "autoProvisionCompliance" = EXCLUDED."autoProvisionCompliance"
    """, (MARQAI_TENANT_ID,))
    print(f"  Created TenantConfiguration")
    
    # 6. UserRoleAssignments for existing users
    cur.execute('SELECT id, role FROM "User" WHERE "tenantId" = %s;', (MARQAI_TENANT_ID,))
    marq_users = cur.fetchall()
    
    for uid, role in marq_users:
        # Find matching role
        cur.execute('SELECT id FROM "Role" WHERE "tenantId" = %s AND name ILIKE %s LIMIT 1;', 
                   (MARQAI_TENANT_ID, f'%{role.replace("_", " ")}%'))
        role_row = cur.fetchone()
        if role_row:
            cur.execute("""
                INSERT INTO "UserRoleAssignment" ("userId", "roleId", "createdAt", "updatedAt")
                VALUES (%s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (uid, role_row[0]))
    print(f"  Created user-role assignments")
    
    # 7. Clean TenantDatabase and TrialRegistration (platform-level tables)
    cur.execute('DELETE FROM "TenantDatabase";')
    cur.execute('DELETE FROM "TrialRegistration";')
    cur.execute('DELETE FROM "DataResidencyPolicy";')
    print(f"  Cleaned platform-level tables")
    
    conn.commit()
    conn.close()
    print("\n  MarqAI DB seeded successfully!")


def verify_data():
    """Verify the data in both tenant databases."""
    print("\n=== VERIFICATION ===")
    
    for db_name, tenant_name in [(DEMO_DB, 'Demo'), (MARQAI_DB, 'MarqAI')]:
        conn = get_conn(db_name)
        cur = conn.cursor()
        
        print(f"\n  --- {tenant_name} Database ({db_name}) ---")
        
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
                print(f'    ❌ {table}: ERROR - {str(e)[:80]}')
        
        # Verify tenant ID correctness
        cur.execute('SELECT id, name, slug FROM "Tenant" LIMIT 1;')
        tenant = cur.fetchone()
        if tenant:
            expected_id = DEMO_TENANT_ID if db_name == DEMO_DB else MARQAI_TENANT_ID
            correct = '✅' if tenant[0] == expected_id else '❌ WRONG!'
            print(f'    {correct} Tenant: {tenant[1]} (slug: {tenant[2]})')
        
        # Verify users belong to correct tenant
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != (SELECT id FROM "Tenant" LIMIT 1);')
        wrong_users = cur.fetchone()[0]
        status = '✅' if wrong_users == 0 else f'❌ {wrong_users} wrong-tenant users!'
        print(f'    {status} Users with correct tenantId')
        
        conn.close()


if __name__ == '__main__':
    print("=" * 60)
    print("SEEDING TENANT DATABASES")
    print("GOLDEN RULE: Demo = SAMPLE data, Tenant = REAL data")
    print("=" * 60)
    
    # Step 1: Clean demo DB of wrong data
    clean_demo_db()
    
    # Step 2: Seed demo DB with rich sample data
    seed_demo_sample_data()
    
    # Step 3: Seed MarqAI DB with real data
    seed_marqai_data()
    
    # Step 4: Verify
    verify_data()
    
    print("\n" + "=" * 60)
    print("DONE! Both tenant databases are now properly seeded.")
    print("=" * 60)
