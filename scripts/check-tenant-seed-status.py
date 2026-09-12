#!/usr/bin/env python3
"""Check current data counts in both tenant databases to identify gaps."""
import psycopg2

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

# All important tables that should have data
TABLES = [
    'Tenant', 'User', 'CompanyGroup', 'Company', 'Department', 'Designation', 'Branch',
    'Employee', 'EmployeeCompanyMapping',
    'Role', 'Module', 'Permission', 'RolePermission', 'UserRoleAssignment',
    'LeaveType', 'Holiday', 'LeaveBalance',
    'AttendancePolicyConfig', 'Attendance',
    'SalaryStructure', 'SalaryComponent', 'PayrollComponent', 'PayrollRun',
    'JobPosting', 'JobApplication', 'Interview',
    'Candidate',
    'PerformanceReview', 'Goal',
    'Training', 'TrainingEnrollment',
    'TravelRequest', 'ExpenseClaim',
    'Asset', 'AssetAssignment',
    'Document',
    'Ticket', 'TicketCategory',
    'Project', 'ProjectMember',
    'TenantConfiguration', 'TenantCountryAccess', 'TenantCurrencyAccess', 'TenantLanguageAccess', 'TenantPayrollPolicy',
    'Setting', 'Notification', 'Announcement',
    'Policy', 'CompanyPolicy', 'Shift',
    'BankAccount',
    'GratuityLedger',
    'Offer', 'OfferTemplate',
    'OnboardingTask',
    'WorkflowDefinition', 'WorkflowInstance',
    'Loan', 'Reimbursement',
]

def get_conn(dbname):
    conn = psycopg2.connect(host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD, sslmode='require', connect_timeout=15)
    conn.autocommit = True
    return conn

def check_db(dbname, label):
    print(f"\n{'='*60}")
    print(f"  {label} DATABASE ({dbname})")
    print(f"{'='*60}")
    conn = get_conn(dbname)
    cur = conn.cursor()
    
    empty_tables = []
    populated_tables = []
    missing_tables = []
    
    for table in TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}";')
            count = cur.fetchone()[0]
            if count > 0:
                populated_tables.append((table, count))
                print(f"  ✅ {table}: {count}")
            else:
                empty_tables.append(table)
                print(f"  ⚠️  {table}: 0 (empty)")
        except Exception as e:
            err = str(e)
            if 'does not exist' in err:
                missing_tables.append(table)
                print(f"  ❌ {table}: TABLE NOT FOUND")
            else:
                print(f"  ❌ {table}: {err[:60]}")
    
    # Check cross-tenant contamination
    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tenant = cur.fetchone()
    if tenant:
        tid = tenant[0]
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != %s;', (tid,))
        wrong = cur.fetchone()[0]
        if wrong > 0:
            print(f"\n  ❌ CROSS-TENANT CONTAMINATION: {wrong} users belong to wrong tenant!")
            cur.execute('SELECT id, email, "tenantId" FROM "User" WHERE "tenantId" != %s LIMIT 5;', (tid,))
            for row in cur.fetchall():
                print(f"     - {row[1]} (tenantId: {row[2][:20]}...)")
        else:
            print(f"\n  ✅ No cross-tenant contamination in User table")
    
    print(f"\n  Summary: {len(populated_tables)} populated, {len(empty_tables)} empty, {len(missing_tables)} missing tables")
    conn.close()
    return populated_tables, empty_tables, missing_tables

if __name__ == '__main__':
    demo_pop, demo_empty, demo_missing = check_db(DEMO_DB, 'DEMO')
    marq_pop, marq_empty, marq_missing = check_db(MARQAI_DB, 'MARQAI')
    
    # Tables that are empty in BOTH databases (need seeding)
    both_empty = set(demo_empty) & set(marq_empty)
    both_missing = set(demo_missing) & set(marq_missing)
    
    print(f"\n{'='*60}")
    print(f"  GAPS - Empty in BOTH databases:")
    print(f"{'='*60}")
    for t in sorted(both_empty):
        print(f"    - {t}")
    print(f"\n  GAPS - Missing in BOTH databases:")
    print(f"{'='*60}")
    for t in sorted(both_missing):
        print(f"    - {t}")
    
    # Tables empty only in one
    demo_only_empty = set(demo_empty) - set(marq_empty) - set(marq_missing)
    marq_only_empty = set(marq_empty) - set(demo_empty) - set(demo_missing)
    
    if demo_only_empty:
        print(f"\n  Empty ONLY in Demo:")
        for t in sorted(demo_only_empty):
            print(f"    - {t}")
    if marq_only_empty:
        print(f"\n  Empty ONLY in MarqAI:")
        for t in sorted(marq_only_empty):
            print(f"    - {t}")
