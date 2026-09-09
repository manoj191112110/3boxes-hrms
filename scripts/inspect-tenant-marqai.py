#!/usr/bin/env python3
"""
Inspect the tenant_marqaitechgroup database to see current employees and related data.
"""

import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")

DB = "tenant_marqaitechgroup"

conn = get_conn(DB)
conn.autocommit = True
cur = conn.cursor()

print("=" * 60)
print("INSPECTING tenant_marqaitechgroup DATABASE")
print("=" * 60)

# First, check column names for Employee table
print("\n--- Employee table columns ---")
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'Employee' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print(f"Columns: {cols}")

# Also check User table columns
print("\n--- User table columns ---")
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'User' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print(f"Columns: {cols}")

# Build the select based on what columns exist
print("\n--- EMPLOYEES ---")
# Use simple select with just the columns we know exist
cur.execute('SELECT * FROM "Employee"')
col_names = [desc[0] for desc in cur.description]
employees = cur.fetchall()
print(f"Total employees: {len(employees)}")
print(f"Column names: {col_names}")
for e in employees:
    # Print key fields
    row_dict = dict(zip(col_names, e))
    print(f"  ID: {row_dict.get('id', 'N/A')}, FirstName: {row_dict.get('firstName', 'N/A')}, LastName: {row_dict.get('lastName', 'N/A')}, Email: {row_dict.get('email', 'N/A')}, EmployeeId: {row_dict.get('employeeId', 'N/A')}, CompanyId: {row_dict.get('companyId', 'N/A')}, Status: {row_dict.get('status', 'N/A')}")

# 2. List all users
print("\n--- USERS ---")
cur.execute('SELECT * FROM "User"')
col_names = [desc[0] for desc in cur.description]
users = cur.fetchall()
print(f"Total users: {len(users)}")
print(f"Column names: {col_names}")
for u in users:
    row_dict = dict(zip(col_names, u))
    print(f"  ID: {row_dict.get('id', 'N/A')}, Name: {row_dict.get('name', 'N/A')}, Email: {row_dict.get('email', 'N/A')}, Role: {row_dict.get('role', 'N/A')}, TenantId: {row_dict.get('tenantId', 'N/A')}")

# 3. List all companies
print("\n--- COMPANIES ---")
cur.execute('SELECT id, name FROM "Company"')
companies = cur.fetchall()
print(f"Total companies: {len(companies)}")
for c in companies:
    print(f"  ID: {c[0]}, Name: {c[1]}")

# 4. List company groups
print("\n--- COMPANY GROUPS ---")
cur.execute('SELECT id, name FROM "CompanyGroup"')
groups = cur.fetchall()
print(f"Total groups: {len(groups)}")
for g in groups:
    print(f"  ID: {g[0]}, Name: {g[1]}")

# 5. Count overall related records
print("\n--- TOTAL RECORD COUNTS ---")
tables = ['Attendance', 'LeaveRequest', 'LeaveBalance', 'Payroll', 'SalaryStructure', 
          'SalaryComponent', 'EmployeeCompanyMapping', 'EmployeeDocument', 'EmployeeBankDetail',
          'Department', 'Designation', 'Branch', 'Holiday', 'LeaveType', 'Shift', 'Policy',
          'Notification', 'AuditLog', 'Role', 'Tenant', 'TenantConfiguration', 'TenantDatabase']
for table in tables:
    try:
        cur.execute(f'SELECT count(*) FROM "{table}"')
        count = cur.fetchone()[0]
        print(f"  {table}: {count}")
    except Exception as ex:
        print(f"  {table}: ERROR - {str(ex)[:80]}")

conn.close()
print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
