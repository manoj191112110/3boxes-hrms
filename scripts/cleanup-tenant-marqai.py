#!/usr/bin/env python3
"""
Clean up the tenant_marqaitechgroup database:
- Keep only 1 employee (HR Admin - hr@marqaitech.com) as the admin login
- Remove all other employees and their users
- Clean up all modules' dummy data (attendance, leave, payroll, etc.)
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
print("CLEANING tenant_marqaitechgroup DATABASE")
print("=" * 60)

# EMPLOYEES TO REMOVE (keep HR Admin as the admin login)
KEEP_EMPLOYEE_ID = "cmrmrwc0eir6899070e89fd62db"  # HR Admin - hr@marqaitech.com
REMOVE_EMPLOYEE_IDS = [
    "cmrmrwc0euuc10d20697cd8b3d8",  # Rajesh Kumar
    "cmrmrwc0fiyd086f18c959e63a3",  # Priya Sharma
]

# USERS TO REMOVE (keep tenant_admin, HR admin user, and super_admin)
KEEP_USER_IDS = [
    "cmrmrwc019z8c6772f879e5f31b",  # superadmin@3boxeshrms.com
    "cmrmrwc0ecq3ca9f187d28dfb0f",  # hr@marqaitech.com (HR Admin)
    "cmrmrwc01g1f729abb99bd0e990",  # admin@marqaitechgroup.com (tenant_admin)
]
REMOVE_USER_IDS = [
    "cmrmrwc0eos8bd25efba4703754",  # Rajesh Kumar user
    "cmrmrwc0fcx2adcefac8605ee6f",  # Priya Sharma user
]

# Tables that have employeeId foreign key
EMPLOYEE_FK_TABLES = [
    'Attendance',
    'LeaveRequest',
    'LeaveBalance',
    'Payroll',
    'SalaryStructure',
    'EmployeeCompanyMapping',
    'EmployeeDocument',
    'EmployeeBankDetail',
    'EmployeeAsset',
    'EmployeePerformance',
    'EmployeeGoal',
    'EmployeeReview',
    'EmployeeFeedback',
    'EmployeeTraining',
    'EmployeeCertification',
    'EmployeeSkill',
    'EmployeeEmergencyContact',
    'EmployeeFamilyMember',
    'EmployeeNomination',
    'EmployeeSeparation',
    'EmployeeTransfer',
    'EmployeePromotion',
    'EmployeeWarning',
    'ExpenseClaim',
    'TravelRequest',
    'TimeEntry',
    'ProjectAllocation',
    'EmployeeShift',
    'OvertimeRecord',
    'EmployeeAttendancePolicy',
    'EmployeeLeavePolicy',
    'EmployeeSalaryComponent',
]

print("\n--- Step 1: Removing dummy employee-related data ---")
for emp_id in REMOVE_EMPLOYEE_IDS:
    for table in EMPLOYEE_FK_TABLES:
        try:
            cur.execute(f'DELETE FROM "{table}" WHERE "employeeId" = \'{emp_id}\'')
            deleted = cur.rowcount
            if deleted > 0:
                print(f"  Deleted {deleted} rows from {table} for employee {emp_id}")
        except Exception as ex:
            # Table might not exist or column might not exist
            err_str = str(ex)
            if 'does not exist' not in err_str:
                print(f"  {table}: {err_str[:80]}")

print("\n--- Step 2: Removing dummy employees ---")
for emp_id in REMOVE_EMPLOYEE_IDS:
    try:
        cur.execute(f'DELETE FROM "Employee" WHERE id = \'{emp_id}\'')
        deleted = cur.rowcount
        print(f"  Deleted employee {emp_id}: {deleted} row(s)")
    except Exception as ex:
        print(f"  Error deleting employee {emp_id}: {ex}")

print("\n--- Step 3: Removing dummy users ---")
for user_id in REMOVE_USER_IDS:
    try:
        cur.execute(f'DELETE FROM "User" WHERE id = \'{user_id}\'')
        deleted = cur.rowcount
        print(f"  Deleted user {user_id}: {deleted} row(s)")
    except Exception as ex:
        print(f"  Error deleting user {user_id}: {ex}")

print("\n--- Step 4: Cleaning up all module dummy data (attendance, leave, payroll, etc.) ---")
# Remove ALL attendance, leave, payroll data for ALL employees including the kept one
# since the user wants clean modules
module_tables = [
    'Attendance',
    'LeaveRequest',
    'LeaveBalance',
    'Payroll',
    'SalaryStructure',
    'SalaryComponent',
    'Shift',
    'Policy',
    'Notification',
    'AuditLog',
    'Holiday',
    'LeaveType',
]

for table in module_tables:
    try:
        cur.execute(f'DELETE FROM "{table}"')
        deleted = cur.rowcount
        print(f"  Cleaned {table}: {deleted} rows deleted")
    except Exception as ex:
        err_str = str(ex)
        if 'does not exist' not in err_str:
            print(f"  {table}: {err_str[:80]}")

print("\n--- Step 5: Verification ---")
cur.execute('SELECT id, "firstName", "lastName", email, "employeeId" FROM "Employee"')
employees = cur.fetchall()
print(f"Remaining employees: {len(employees)}")
for e in employees:
    print(f"  {e[1]} {e[2]} - {e[3]} ({e[4]})")

cur.execute('SELECT id, name, email, role FROM "User"')
users = cur.fetchall()
print(f"\nRemaining users: {len(users)}")
for u in users:
    print(f"  {u[1]} - {u[2]} ({u[3]})")

# Verify module counts are 0
print("\nModule data counts after cleanup:")
for table in module_tables:
    try:
        cur.execute(f'SELECT count(*) FROM "{table}"')
        count = cur.fetchone()[0]
        print(f"  {table}: {count}")
    except:
        pass

conn.close()
print("\n" + "=" * 60)
print("CLEANUP COMPLETE")
