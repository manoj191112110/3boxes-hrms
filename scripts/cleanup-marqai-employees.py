#!/usr/bin/env python3
"""
Clean up MarqAI tenant database:
- Keep only 3 employees (1 HR admin + 2 original employees)
- Delete all dummy employees and their related data
- Keep the tenant structure (companies, departments, branches) intact
- Keep super_admin and tenant_admin users intact

Employees to KEEP:
1. admin@marqaitechgroup.com (tenant_admin - no employee record, always kept)
2. superadmin@3boxeshrms.com (super_admin - no employee record, always kept)
3. hr@marqaitech.com + EMP-MTPL-HR001 (HR Admin - sample admin employee)
4. rajesh.kumar@marqaitech.com + EMP-MTPL-E001 (Rajesh Kumar - original employee 1)
5. priya.sharma@marqaisolutions.com + EMP-MSPL-E001 (Priya Sharma - original employee 2)

Employees to DELETE (7 dummy employees):
- hr@marqaisolutions.com (HR Admin MarqAI Solutions)
- hr@marqaidigital.com (HR Admin MarqAI Digital)
- hr@marqaiinnovations.com (HR Admin MarqAI Innovations)
- hr@marqaiconsulting.com (HR Admin MarqAI Consulting)
- amit.patel@marqaidigital.com (Amit Patel)
- sneha.reddy@marqaiinnovations.com (Sneha Reddy)
- vikram.singh@marqaiconsulting.com (Vikram Singh)
"""

import psycopg2

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
MARQAI_DB = 'tenant_marqaitechgroup'

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

def cleanup_marqai():
    print("=== CLEANING UP MARQAI TENANT DATABASE ===")
    conn = get_conn(MARQAI_DB)
    conn.autocommit = True
    cur = conn.cursor()

    # First, get all employee IDs currently in the DB
    cur.execute('SELECT "id", "employeeId", "firstName", "lastName", "userId" FROM "Employee" ORDER BY "createdAt";')
    all_employees = cur.fetchall()
    print(f"\nCurrent employees ({len(all_employees)}):")
    for e in all_employees:
        print(f"  {e[1]}: {e[2]} {e[3]} (userId: {e[4][:25]})")

    # Identify employees to KEEP (3 employees)
    keep_employee_ids = []
    keep_user_ids = []
    
    # Get the first company (MarqAI Tech) employees
    cur.execute("""
        SELECT e."id", e."userId", u."email" 
        FROM "Employee" e 
        LEFT JOIN "User" u ON e."userId" = u."id"
        WHERE e."employeeId" IN ('EMP-MTPL-HR001', 'EMP-MTPL-E001', 'EMP-MSPL-E001')
        ORDER BY e."createdAt";
    """)
    keep_emps = cur.fetchall()
    print(f"\nEmployees to KEEP ({len(keep_emps)}):")
    for e in keep_emps:
        print(f"  {e[0][:25]}... | userId: {e[1][:25]}... | email: {e[2]}")
        keep_employee_ids.append(e[0])
        if e[1]:
            keep_user_ids.append(e[1])

    # Also always keep tenant_admin and super_admin users
    cur.execute("""
        SELECT "id", "email", "role" FROM "User" 
        WHERE "email" IN ('superadmin@3boxeshrms.com', 'admin@marqaitechgroup.com')
        OR "role" IN ('super_admin', 'tenant_admin');
    """)
    essential_users = cur.fetchall()
    for u in essential_users:
        keep_user_ids.append(u[0])
    print(f"\nEssential users to keep: {len(essential_users)}")
    for u in essential_users:
        print(f"  {u[1]} ({u[2]})")

    # Get ALL employee IDs to delete
    delete_employee_ids = [e[0] for e in all_employees if e[0] not in keep_employee_ids]
    print(f"\nEmployees to DELETE: {len(delete_employee_ids)}")

    # Get user IDs to delete (those associated with deleted employees + non-essential)
    cur.execute('SELECT "id", "email", "role" FROM "User" ORDER BY "email";')
    all_users = cur.fetchall()
    delete_user_ids = [u[0] for u in all_users if u[0] not in keep_user_ids and u[2] not in ('super_admin', 'tenant_admin')]
    print(f"Users to DELETE: {len(delete_user_ids)}")
    for u in all_users:
        if u[0] in delete_user_ids:
            print(f"  {u[1]} ({u[2]})")

    # ─── DELETE RELATED DATA FIRST (to avoid FK constraint errors) ───
    # Delete all data referencing the employees being removed
    
    tables_to_clean = [
        ('OnboardingTask', 'employeeId'),
        ('PerformanceReview', 'employeeId'),
        ('Goal', 'employeeId'),
        ('TrainingEnrollment', 'employeeId'),
        ('TravelRequest', 'employeeId'),
        ('ExpenseClaim', 'employeeId'),
        ('Loan', 'employeeId'),
        ('Reimbursement', 'employeeId'),
        ('AssetAssignment', 'employeeId'),
        ('Document', 'employeeId'),
        ('ProjectMember', 'employeeId'),
    ]
    
    for table, column in tables_to_clean:
        if delete_employee_ids:
            id_str = ','.join([f"'{id}'" for id in delete_employee_ids])
            try:
                cur.execute(f'DELETE FROM "{table}" WHERE "{column}" IN ({id_str})')
                deleted = cur.rowcount
                print(f"  Deleted {deleted} rows from {table}.{column}")
            except Exception as e:
                err_msg = str(e)[:100]
                if 'does not exist' in err_msg:
                    print(f"  SKIP {table} - table doesn't exist")
                else:
                    print(f"  ERR {table}: {err_msg}")

    # Delete notifications for users being removed
    if delete_user_ids:
        id_str = ','.join([f"'{id}'" for id in delete_user_ids])
        try:
            cur.execute(f'DELETE FROM "Notification" WHERE "userId" IN ({id_str})')
            deleted = cur.rowcount
            print(f"  Deleted {deleted} rows from Notification.userId")
        except Exception as e:
            print(f"  ERR Notification: {str(e)[:100]}")

    # Delete UserRoleAssignment for users being removed
    if delete_user_ids:
        id_str = ','.join([f"'{id}'" for id in delete_user_ids])
        try:
            cur.execute(f'DELETE FROM "UserRoleAssignment" WHERE "userId" IN ({id_str})')
            deleted = cur.rowcount
            print(f"  Deleted {deleted} rows from UserRoleAssignment.userId")
        except Exception as e:
            print(f"  ERR UserRoleAssignment: {str(e)[:100]}")

    # ─── DELETE THE EMPLOYEE RECORDS ───
    if delete_employee_ids:
        id_str = ','.join([f"'{id}'" for id in delete_employee_ids])
        cur.execute(f'DELETE FROM "Employee" WHERE "id" IN ({id_str})')
        deleted = cur.rowcount
        print(f"\n  Deleted {deleted} Employee records")

    # ─── DELETE THE USER RECORDS ───
    if delete_user_ids:
        id_str = ','.join([f"'{id}'" for id in delete_user_ids])
        cur.execute(f'DELETE FROM "User" WHERE "id" IN ({id_str})')
        deleted = cur.rowcount
        print(f"  Deleted {deleted} User records")

    # ─── ALSO REMOVE EXTRA COMPANIES ───
    # Keep only the first company (MarqAI Tech Pvt Ltd) since we only have 3 employees now
    # But keep all 4 original companies (as per seed-marqai.ts) for future use
    # Actually, the user only had 3 employees originally, so let's keep the companies
    # but just remove the extra employees. The companies remain for future data entry.
    
    # ─── VERIFY ───
    print("\n=== VERIFICATION ===")
    cur.execute('SELECT COUNT(*) FROM "Employee"')
    emp_count = cur.fetchone()[0]
    print(f"Employees remaining: {emp_count}")

    cur.execute('SELECT COUNT(*) FROM "User"')
    user_count = cur.fetchone()[0]
    print(f"Users remaining: {user_count}")

    cur.execute("""
        SELECT e."employeeId", e."firstName", e."lastName", u."email", u."role"
        FROM "Employee" e
        LEFT JOIN "User" u ON e."userId" = u."id"
        ORDER BY e."createdAt";
    """)
    remaining = cur.fetchall()
    print("\nRemaining employees:")
    for r in remaining:
        print(f"  {r[0]}: {r[1]} {r[2]} ({r[3]}, {r[4]})")

    cur.execute("""
        SELECT "id", "email", "name", "role" FROM "User" ORDER BY "role", "email";
    """)
    remaining_users = cur.fetchall()
    print("\nRemaining users:")
    for u in remaining_users:
        print(f"  {u[1]} ({u[2]}, {u[3]})")

    conn.close()
    print("\n✅ MarqAI tenant cleanup complete!")

if __name__ == '__main__':
    cleanup_marqai()
