#!/usr/bin/env python3
"""
Part 4: Seed Employees + UserRoleAssignments for both tenant DBs.
Demo = 20 fictional US employees (3 linked to existing users)
MarqAI = 20 Indian employees (4 linked to existing users)
"""
import psycopg2
import uuid

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

def uid():
    return f"seed-{uuid.uuid4().hex[:24]}"

DEMO_EMPLOYEES = [
    # (employeeId, firstName, lastName, email, phone, gender, maritalStatus, nationality, city, state, zipCode, country, bloodGroup, dateOfJoining, dateOfBirth, salary, deptId, desigId, branchId, userId_or_None)
    ('EMP-001', 'John', 'Doe', 'john.doe@3boxeshrms.com', '+1-555-0101', 'male', 'single', 'American', 'New York', 'NY', '10001', 'US', 'O+', '2022-03-15', '1990-05-12', 95000, 'demo-dept-2', 'demo-desig-10', 'demo-branch-1', 'demo-employee1'),
    ('EMP-002', 'Jane', 'Smith', 'jane.smith@3boxeshrms.com', '+1-555-0102', 'female', 'married', 'American', 'San Francisco', 'CA', '94102', 'US', 'A+', '2021-06-01', '1988-08-22', 105000, 'demo-dept-2', 'demo-desig-12', 'demo-branch-1', 'demo-employee2'),
    ('EMP-003', 'Mike', 'Wilson', 'mike.wilson@3boxeshrms.com', '+1-555-0103', 'male', 'single', 'American', 'Chicago', 'IL', '60601', 'US', 'B+', '2023-01-10', '1992-11-03', 78000, 'demo-dept-2', 'demo-desig-13', 'demo-branch-1', 'demo-employee3'),
    ('EMP-004', 'Sarah', 'Johnson', 'sarah.johnson@techcorp.com', '+1-555-0104', 'female', 'married', 'American', 'Austin', 'TX', '73301', 'US', 'AB+', '2020-09-15', '1985-04-18', 88000, 'demo-dept-3', 'demo-desig-17', 'demo-branch-1', None),
    ('EMP-005', 'Robert', 'Brown', 'robert.brown@techcorp.com', '+1-555-0105', 'male', 'single', 'American', 'Seattle', 'WA', '98101', 'US', 'O-', '2022-11-01', '1991-07-30', 72000, 'demo-dept-4', 'demo-desig-23', 'demo-branch-1', None),
    ('EMP-006', 'Emily', 'Davis', 'emily.davis@techcorp.com', '+1-555-0106', 'female', 'single', 'American', 'Boston', 'MA', '02101', 'US', 'A-', '2023-04-20', '1994-02-14', 65000, 'demo-dept-2', 'demo-desig-14', 'demo-branch-1', None),
    ('EMP-007', 'David', 'Martinez', 'david.martinez@techcorp.com', '+1-555-0107', 'male', 'married', 'American', 'Denver', 'CO', '80201', 'US', 'B-', '2021-02-01', '1987-09-25', 92000, 'demo-dept-2', 'demo-desig-11', 'demo-branch-1', None),
    ('EMP-008', 'Lisa', 'Anderson', 'lisa.anderson@techcorp.com', '+1-555-0108', 'female', 'married', 'American', 'New York', 'NY', '10001', 'US', 'AB-', '2020-05-10', '1986-12-07', 82000, 'demo-dept-0', 'demo-desig-4', 'demo-branch-1', None),
    ('EMP-009', 'James', 'Taylor', 'james.taylor@techcorp.com', '+1-555-0109', 'male', 'single', 'American', 'Los Angeles', 'CA', '90001', 'US', 'O+', '2022-07-15', '1993-06-20', 75000, 'demo-dept-5', 'demo-desig-33', 'demo-branch-1', None),
    ('EMP-010', 'Maria', 'Garcia', 'maria.garcia@techcorp.com', '+1-555-0110', 'female', 'married', 'American', 'Miami', 'FL', '33101', 'US', 'A+', '2019-11-01', '1984-03-15', 98000, 'demo-dept-1', 'demo-desig-7', 'demo-branch-1', None),
    ('EMP-011', 'Christopher', 'Lee', 'christopher.lee@techcorp.com', '+1-555-0111', 'male', 'single', 'American', 'Portland', 'OR', '97201', 'US', 'B+', '2023-06-12', '1995-01-08', 68000, 'demo-dept-2', 'demo-desig-14', 'demo-branch-1', None),
    ('EMP-012', 'Amanda', 'White', 'amanda.white@techcorp.com', '+1-555-0112', 'female', 'single', 'American', 'Nashville', 'TN', '37201', 'US', 'O+', '2021-08-20', '1990-10-30', 71000, 'demo-dept-0', 'demo-desig-3', 'demo-branch-1', None),
    ('EMP-013', 'Daniel', 'Harris', 'daniel.harris@techcorp.com', '+1-555-0113', 'male', 'married', 'American', 'Atlanta', 'GA', '30301', 'US', 'A-', '2020-01-15', '1986-05-22', 115000, 'demo-dept-2', 'demo-desig-10', 'demo-branch-1', None),
    ('EMP-014', 'Jennifer', 'Clark', 'jennifer.clark@techcorp.com', '+1-555-0114', 'female', 'married', 'American', 'Phoenix', 'AZ', '85001', 'US', 'AB+', '2022-04-01', '1989-07-04', 83000, 'demo-dept-6', 'demo-desig-37', 'demo-branch-1', None),
    ('EMP-015', 'Matthew', 'Robinson', 'matthew.robinson@techcorp.com', '+1-555-0115', 'male', 'single', 'American', 'Dallas', 'TX', '75201', 'US', 'B-', '2023-02-28', '1994-11-17', 69000, 'demo-dept-7', 'demo-desig-43', 'demo-branch-1', None),
    ('EMP-016', 'Stephanie', 'Lewis', 'stephanie.lewis@techcorp.com', '+1-555-0116', 'female', 'single', 'American', 'Minneapolis', 'MN', '55401', 'US', 'O-', '2021-10-05', '1991-03-28', 77000, 'demo-dept-3', 'demo-desig-18', 'demo-branch-1', None),
    ('EMP-017', 'Andrew', 'Walker', 'andrew.walker@techcorp.com', '+1-555-0117', 'male', 'married', 'American', 'San Diego', 'CA', '92101', 'US', 'A+', '2020-03-20', '1988-08-15', 89000, 'demo-dept-4', 'demo-desig-22', 'demo-branch-1', None),
    ('EMP-018', 'Nicole', 'Hall', 'nicole.hall@techcorp.com', '+1-555-0118', 'female', 'married', 'American', 'Charlotte', 'NC', '28201', 'US', 'AB-', '2019-07-01', '1985-12-20', 93000, 'demo-dept-1', 'demo-desig-8', 'demo-branch-1', None),
    ('EMP-019', 'Kevin', 'Allen', 'kevin.allen@techcorp.com', '+1-555-0119', 'male', 'single', 'American', 'Detroit', 'MI', '48201', 'US', 'B+', '2022-09-12', '1992-04-05', 73000, 'demo-dept-5', 'demo-desig-34', 'demo-branch-1', None),
    ('EMP-020', 'Rachel', 'Young', 'rachel.young@techcorp.com', '+1-555-0120', 'female', 'single', 'American', 'Philadelphia', 'PA', '19101', 'US', 'O+', '2023-05-08', '1995-09-12', 67000, 'demo-dept-0', 'demo-desig-4', 'demo-branch-1', None),
]


def seed_demo_employees():
    print("\n=== DEMO: Employees ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=DEMO_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    first_company = 'cmrmxegl5000804jvpbowg7cq'

    cur.execute('SELECT count(*) FROM "Employee"')
    if cur.fetchone()[0] > 0:
        print("  Employees already exist, skipping")
        cur.close()
        conn.close()
        return

    count = 0
    for emp in DEMO_EMPLOYEES:
        (emp_id_str, first, last, email, phone, gender, marital, nat,
         city, state, zipcode, country, blood, doj, dob, salary,
         dept_id, desig_id, branch_id, user_id) = emp

        eid = uid()
        bank_acct = f'US{emp_id_str[-3:]}BC'
        try:
            cur.execute(
                '''INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone,
                   "userId", "departmentId", "designationId", "branchId", "companyId",
                   "dateOfJoining", "dateOfBirth", gender, "maritalStatus", nationality,
                   city, state, "zipCode", country, "bloodGroup",
                   "emergencyContactName", "emergencyContactPhone", status,
                   "bankName", "bankAccountNo", "bankIfscCode", "panNumber",
                   salary, "salaryCurrency", "createdAt", "updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                           %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                           %s,%s,'active','Chase Bank',%s,'CHASUS33',%s,
                           %s,'USD',NOW(),NOW())''',
                (eid, emp_id_str, first, last, email, phone,
                 user_id, dept_id, desig_id, branch_id, first_company,
                 doj, dob, gender, marital, nat, city, state, zipcode, country, blood,
                 f'{first} Emergency', '+1-555-0911', bank_acct, f'PAN{emp_id_str[-3:]}US', salary)
            )
            count += 1
        except Exception as e:
            print(f"  Error {emp_id_str}: {e}")

    cur.execute('SELECT count(*) FROM "Employee"')
    print(f"  Employees: {cur.fetchone()[0]} (inserted {count})")

    # UserRoleAssignments
    print("  Creating UserRoleAssignments...")
    ura_data = [
        ('demo-superadmin', 'demo-role-super-admin', first_company),
        ('demo-tenantadmin', 'demo-role-tenant-admin', first_company),
        ('demo-hradmin', 'demo-role-hr-admin', first_company),
        ('demo-hrmanager', 'demo-role-hr-manager', first_company),
        ('demo-financeadmin', 'demo-role-finance-admin', first_company),
        ('demo-manager1', 'demo-role-manager', first_company),
        ('demo-employee1', 'demo-role-employee', first_company),
        ('demo-employee2', 'demo-role-employee', first_company),
        ('demo-employee3', 'demo-role-employee', first_company),
    ]
    for user_id, role_id, comp_id in ura_data:
        try:
            cur.execute(
                '''INSERT INTO "UserRoleAssignment" (id, "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, 'demo-superadmin', NOW(), NOW()) ON CONFLICT DO NOTHING''',
                (uid(), user_id, role_id, comp_id)
            )
        except Exception as e:
            print(f"  URA error: {e}")

    cur.execute('SELECT count(*) FROM "UserRoleAssignment"')
    print(f"  UserRoleAssignments: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


def seed_marqai_employees():
    print("\n=== MARQAI: Employees ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=MARQAI_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute('SELECT count(*) FROM "Employee"')
    if cur.fetchone()[0] > 0:
        print("  Employees already exist, skipping")
        cur.close()
        conn.close()
        return

    # Build dept/desig lookups
    cur.execute('SELECT id, name, "companyId" FROM "Department"')
    dept_rows = cur.fetchall()
    dept_lookup = {}
    for did, dname, cid in dept_rows:
        key = dname.lower().split()[0]
        if key == 'human': key = 'hr'
        dept_lookup[(cid, key)] = did

    cur.execute('SELECT id, title, "departmentId" FROM "Designation"')
    desig_rows = cur.fetchall()
    desig_lookup = {}
    for did, title, dept_id in desig_rows:
        if dept_id not in desig_lookup:
            desig_lookup[dept_id] = {}
        desig_lookup[dept_id][title] = did

    user_id_map = {
        'superadmin@3boxeshrms.com': 'cmrmr3ntfqw14da35c099aca4cd',
        'admin@marqaitechgroup.com': 'cmrmr3ntfxd76084e0ece18a003',
        'hr@marqaitech.com': 'cmrhykbuu000004jub8zgby5n',
        'FINANCE@MARQAITECH.COM': 'cmrtzowrd000204ju6t28e2qz',
    }

    MARQAI_EMP_DATA = [
        # (empId, first, last, email, phone, gender, marital, nat, city, state, zip, country, blood, doj, dob, salary, deptKey, desigTitle, branchId, companyId)
        ('MARQ-001', '3Boxes', 'Super Admin', 'superadmin@3boxeshrms.com', '+91-9876543210', 'male', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'O+', '2023-01-01', '1985-06-15', 200000, 'hr', 'CEO', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-002', 'Marq AI', 'Admin', 'admin@marqaitechgroup.com', '+91-9876543211', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'A+', '2023-01-01', '1982-03-20', 180000, 'hr', 'CEO', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-003', 'Vardhani Reddy', 'Busireddy', 'hr@marqaitech.com', '+91-9876543212', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'B+', '2023-06-15', '1992-08-10', 85000, 'hr', 'HR Manager', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-004', 'Divya Rani', 'M', 'FINANCE@MARQAITECH.COM', '+91-9876543213', 'female', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'O-', '2023-09-01', '1990-12-05', 90000, 'finance', 'Finance Manager', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-005', 'Rajesh', 'Kumar', 'rajesh.kumar@marqaitech.com', '+91-9876543214', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'A-', '2023-03-10', '1988-04-25', 75000, 'operations', 'Operations Manager', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-006', 'Priya', 'Sharma', 'priya.sharma@marqaitech.com', '+91-9876543215', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'B+', '2023-07-20', '1994-11-18', 65000, 'hr', 'HR Manager', 'cmrmr3nth5q8bd7a633c4dd28ce', 'cmrmr3ntggiaef373e0086cd965'),
        ('MARQ-007', 'Suresh', 'Reddy', 'suresh.reddy@marqaitech.com', '+91-9876543216', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'O+', '2022-11-15', '1986-02-28', 95000, 'finance', 'Finance Manager', 'cmrmr3nth5q8bd7a633c4dd28ce', 'cmrmr3ntggiaef373e0086cd965'),
        ('MARQ-008', 'Anitha', 'Devi', 'anitha.devi@marqaitech.com', '+91-9876543217', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'AB+', '2023-04-01', '1993-07-12', 60000, 'operations', 'Operations Manager', 'cmrmr3nth5q8bd7a633c4dd28ce', 'cmrmr3ntggiaef373e0086cd965'),
        ('MARQ-009', 'Venkat', 'Rao', 'venkat.rao@marqaitech.com', '+91-9876543218', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'A+', '2023-02-01', '1987-09-30', 88000, 'hr', 'HR Manager', 'cmrmr3nthc1a9a922ee9f1500ad', 'cmrmr3ntgmsee49e9f8864a6b17'),
        ('MARQ-010', 'Lakshmi', 'Kumari', 'lakshmi.kumari@marqaitech.com', '+91-9876543219', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'B-', '2023-08-15', '1995-05-20', 55000, 'finance', 'Finance Manager', 'cmrmr3nthc1a9a922ee9f1500ad', 'cmrmr3ntgmsee49e9f8864a6b17'),
        ('MARQ-011', 'Ravi', 'Prasad', 'ravi.prasad@marqaitech.com', '+91-9876543220', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'O+', '2022-06-01', '1984-01-14', 100000, 'operations', 'Operations Manager', 'cmrmr3nthc1a9a922ee9f1500ad', 'cmrmr3ntgmsee49e9f8864a6b17'),
        ('MARQ-012', 'Kavitha', 'Nair', 'kavitha.nair@marqaitech.com', '+91-9876543221', 'female', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'A-', '2023-05-10', '1990-10-08', 72000, 'hr', 'HR Manager', 'cmrmr3nthiccfb5303faabcb2f1', 'cmrmr3ntgt3e0bcea09637af7ec'),
        ('MARQ-013', 'Srinivas', 'Murthy', 'srinivas.murthy@marqaitech.com', '+91-9876543222', 'male', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'B+', '2022-08-20', '1985-06-22', 92000, 'finance', 'Finance Manager', 'cmrmr3nthiccfb5303faabcb2f1', 'cmrmr3ntgt3e0bcea09637af7ec'),
        ('MARQ-014', 'Padma', 'Lakshmi', 'padma.lakshmi@marqaitech.com', '+91-9876543223', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'AB-', '2023-09-05', '1993-03-16', 58000, 'operations', 'Operations Manager', 'cmrmr3nthiccfb5303faabcb2f1', 'cmrmr3ntgt3e0bcea09637af7ec'),
        ('MARQ-015', 'Arjun', 'Krishna', 'arjun.krishna@marqaitech.com', '+91-9876543224', 'male', 'single', 'Indian', 'Bangalore', 'Karnataka', '560001', 'IN', 'O+', '2023-04-15', '1994-12-01', 70000, 'hr', 'HR Manager', 'branch-blr', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-016', 'Meera', 'Iyer', 'meera.iyer@marqaitech.com', '+91-9876543225', 'female', 'married', 'Indian', 'Bangalore', 'Karnataka', '560001', 'IN', 'A+', '2023-06-01', '1991-08-14', 68000, 'finance', 'Finance Manager', 'branch-blr', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-017', 'Karthik', 'Subramanian', 'karthik.subramanian@marqaitech.com', '+91-9876543226', 'male', 'single', 'Indian', 'Bangalore', 'Karnataka', '560001', 'IN', 'B+', '2024-01-08', '1996-04-25', 55000, 'operations', 'Operations Manager', 'branch-blr', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-018', 'Shalini', 'Gupta', 'shalini.gupta@marqaitech.com', '+91-9876543227', 'female', 'married', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'O-', '2023-10-01', '1989-02-10', 82000, 'hr', 'CEO', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-019', 'Deepak', 'Verma', 'deepak.verma@marqaitech.com', '+91-9876543228', 'male', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'A-', '2024-02-15', '1995-07-18', 52000, 'finance', 'CEO', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('MARQ-020', 'Nithya', 'Raman', 'nithya.raman@marqaitech.com', '+91-9876543229', 'female', 'single', 'Indian', 'Hyderabad', 'Telangana', '500081', 'IN', 'AB+', '2024-03-01', '1997-01-22', 48000, 'operations', 'CEO', 'cmrmr3ntgzd745b63c6003b1622', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
    ]

    count = 0
    for emp in MARQAI_EMP_DATA:
        (emp_id_str, first, last, email, phone, gender, marital, nat,
         city, state, zipcode, country, blood, doj, dob, salary,
         dept_key, desig_title, branch_id, company_id) = emp

        eid = uid()
        user_id = user_id_map.get(email)

        # Find dept_id
        dept_id = dept_lookup.get((company_id, dept_key))
        if not dept_id:
            # fallback
            for (cid, dk), did in dept_lookup.items():
                if cid == company_id:
                    dept_id = did
                    break

        # Find designation
        desig_id = None
        if dept_id and dept_id in desig_lookup:
            for title, did in desig_lookup[dept_id].items():
                if desig_title.lower() in title.lower() or title.lower() in desig_title.lower():
                    desig_id = did
                    break
            if not desig_id:
                desig_id = list(desig_lookup[dept_id].values())[0]

        if not dept_id or not desig_id:
            print(f"  SKIP {emp_id_str}: dept={dept_id}, desig={desig_id}")
            continue

        bank_acct = f'IN{emp_id_str[-3:]}HDFC'
        pan_no = f'ABCPD{emp_id_str[-3:]}F'

        try:
            cur.execute(
                '''INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone,
                   "userId", "departmentId", "designationId", "branchId", "companyId",
                   "dateOfJoining", "dateOfBirth", gender, "maritalStatus", nationality,
                   city, state, "zipCode", country, "bloodGroup",
                   "emergencyContactName", "emergencyContactPhone", status,
                   "bankName", "bankAccountNo", "bankIfscCode", "panNumber",
                   salary, "salaryCurrency", "createdAt", "updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                           %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                           %s,%s,'active','HDFC Bank',%s,'HDFC0001234',%s,
                           %s,'INR',NOW(),NOW())''',
                (eid, emp_id_str, first, last, email, phone,
                 user_id, dept_id, desig_id, branch_id, company_id,
                 doj, dob, gender, marital, nat, city, state, zipcode, country, blood,
                 f'{first} Emergency', '+91-9876540900', bank_acct, pan_no, salary)
            )
            count += 1
        except Exception as e:
            print(f"  Error {emp_id_str}: {e}")

    cur.execute('SELECT count(*) FROM "Employee"')
    print(f"  Employees: {cur.fetchone()[0]} (inserted {count})")

    # UserRoleAssignments
    print("  Creating UserRoleAssignments...")
    marqai_ura = [
        ('cmrmr3ntfqw14da35c099aca4cd', 'super_admin', 'marqai-role-super-admin', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('cmrmr3ntfxd76084e0ece18a003', 'tenant_admin', 'marqai-role-tenant-admin', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('cmrhykbuu000004jub8zgby5n', 'hr_admin', '81882279-4b60-41a7-9920-62b3b6e8058e', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
        ('cmrtzowrd000204ju6t28e2qz', 'finance_admin', '818e100c-8a52-448b-a384-750ccb511244', 'cmrmr3ntga2ecb95cccbe4a3e2d'),
    ]
    for user_id, role_key, role_id, comp_id in marqai_ura:
        try:
            cur.execute(
                '''INSERT INTO "UserRoleAssignment" (id, "userId", "roleId", "companyId", "assignedBy", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, 'cmrmr3ntfqw14da35c099aca4cd', NOW(), NOW()) ON CONFLICT DO NOTHING''',
                (uid(), user_id, role_id, comp_id)
            )
        except Exception as e:
            print(f"  URA error: {e}")

    cur.execute('SELECT count(*) FROM "UserRoleAssignment"')
    print(f"  UserRoleAssignments: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    seed_demo_employees()
    seed_marqai_employees()
    print("\n✅ Part 4 done!")
