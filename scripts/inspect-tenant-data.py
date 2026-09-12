#!/usr/bin/env python3
"""
Inspect MarqAI tenant database to find current employees.
"""

import psycopg2

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

def inspect_marqai():
    print("=== INSPECTING MARQAI TENANT DATABASE ===")
    conn = get_conn('tenant_marqaitechgroup')
    cur = conn.cursor()

    # List all employees with quoted column names (Prisma convention)
    cur.execute("""
        SELECT e."id", e."employeeId", e."firstName", e."lastName", e."status",
               u."email", u."role", c."name" as company_name, d."name" as dept_name
        FROM "Employee" e
        LEFT JOIN "User" u ON e."userId" = u."id"
        LEFT JOIN "Company" c ON e."companyId" = c."id"
        LEFT JOIN "Department" d ON e."departmentId" = d."id"
        ORDER BY e."createdAt";
    """)
    employees = cur.fetchall()
    print(f"\nTotal employees: {len(employees)}")
    print("\nEmployee list:")
    for emp in employees:
        print(f"  ID: {emp[0][:25]}... | Code: {emp[1]} | {emp[2]} {emp[3]} | Status: {emp[4]} | Email: {emp[5]} | Role: {emp[6]} | Co: {emp[7]} | Dept: {emp[8]}")

    # List all users
    cur.execute("""
        SELECT "id", "email", "name", "role", "status"
        FROM "User"
        ORDER BY "role", "email";
    """)
    users = cur.fetchall()
    print(f"\nTotal users: {len(users)}")
    for u in users:
        print(f"  ID: {u[0][:25]}... | {u[1]} | {u[2]} | {u[3]} | {u[4]}")

    # Count related records
    print("\nRelated data counts:")
    for table in ['Attendance', 'LeaveBalance', 'LeaveRequest', 'PayrollRecord',
                  'PerformanceReview', 'Goal', 'OnboardingTask', 'Document',
                  'AssetAssignment', 'TravelRequest', 'ExpenseClaim', 'Loan',
                  'Reimbursement', 'TrainingEnrollment', 'ProjectMember',
                  'Notification', 'Shift', 'SalaryStructure', 'SalaryComponent',
                  'PayrollComponent', 'PayrollRun']:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            print(f"  {table}: {count}")
        except Exception as e:
            print(f"  {table}: ERR - {str(e)[:80]}")

    conn.close()

def inspect_demo():
    print("\n=== INSPECTING DEMO DATABASE ===")
    conn = get_conn('tenant_demo')
    cur = conn.cursor()

    cur.execute('SELECT COUNT(*) FROM "Employee"')
    emp_count = cur.fetchone()[0]
    print(f"Total demo employees: {emp_count}")

    tables = ['Company', 'Department', 'Designation', 'Branch', 'User',
              'Attendance', 'LeaveBalance', 'LeaveRequest', 'LeaveType', 'Holiday',
              'PayrollComponent', 'PayrollRun', 'SalaryStructure', 'SalaryComponent',
              'PerformanceReview', 'Goal', 'Training', 'TrainingEnrollment',
              'TravelRequest', 'ExpenseClaim', 'Asset', 'AssetAssignment', 'Document',
              'Notification', 'Announcement', 'OnboardingTask',
              'Project', 'ProjectMember', 'Loan', 'Reimbursement',
              'WorkflowDefinition', 'WorkflowInstance', 'Shift',
              'HelpdeskTicket', 'Recruitment', 'Job']
    print("\nDemo data counts:")
    for table in tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            status = 'OK' if count > 0 else 'EMPTY'
            print(f"  {status:>5} {table}: {count}")
        except Exception as e:
            print(f"  ERR  {table}: {str(e)[:80]}")

    conn.close()

if __name__ == '__main__':
    inspect_marqai()
    inspect_demo()
