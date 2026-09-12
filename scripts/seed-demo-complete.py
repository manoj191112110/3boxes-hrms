#!/usr/bin/env python3
"""
Optimized seed script for tenant_demo database using batch inserts.
"""
import psycopg2
import psycopg2.extras
import random
import uuid
from datetime import datetime, timedelta, date
from collections import defaultdict

DB_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_NAME = 'tenant_demo'
DB_USER = 'neondb_owner'
DB_PASS = 'npg_pxZd8woKe4WB'

def cuid():
    return 'sd_' + uuid.uuid4().hex[:20]

def pick(arr):
    return random.choice(arr)

def pick_n(arr, n):
    return random.sample(arr, min(n, len(arr)))

def rand_date(start, end):
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta, 1)))

def rand_float(min_v, max_v, decimals=2):
    return round(random.uniform(min_v, max_v), decimals)

def rand_int(min_v, max_v):
    return random.randint(min_v, max_v)

def batch_insert(cur, table, columns, rows, errors):
    """Batch insert using execute_values for efficiency."""
    if not rows:
        return 0
    cols = ', '.join(f'"{c}"' for c in columns)
    placeholders = ', '.join(['%s'] * len(columns))
    sql = f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
    success = 0
    # Insert in chunks of 50
    for i in range(0, len(rows), 50):
        chunk = rows[i:i+50]
        try:
            cur.executemany(sql, chunk)
            success += len(chunk)
        except Exception as e:
            errors.append(f'{table} batch: {str(e)[:200]}')
            # Try one by one
            for row in chunk:
                try:
                    cur.execute(sql, row)
                    success += 1
                except:
                    pass
    return success

def seed_all():
    conn = psycopg2.connect(host=DB_HOST, dbname=DB_NAME, user=DB_USER, password=DB_PASS, sslmode='require', connect_timeout=30)
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected to tenant_demo database (autocommit mode)")
    errors = []
    now = datetime.now()

    # Load existing data
    cur.execute('SELECT id, name, code, "companyGroupId" FROM "Company"')
    companies = cur.fetchall()
    company_ids = [c[0] for c in companies]

    cur.execute('SELECT id, name, code, "companyId" FROM "Department"')
    departments = cur.fetchall()
    dept_by_company = defaultdict(list)
    for d in departments:
        dept_by_company[d[3]].append(d)

    cur.execute('SELECT id, title, "departmentId", level FROM "Designation"')
    designations = cur.fetchall()
    desg_by_dept = defaultdict(list)
    for d in designations:
        desg_by_dept[d[2]].append(d)

    cur.execute('SELECT id, name, code, "companyId" FROM "Branch"')
    branches = cur.fetchall()
    branch_by_company = defaultdict(list)
    for b in branches:
        branch_by_company[b[3]].append(b)

    cur.execute('SELECT id, "employeeId", "firstName", "lastName", email, "departmentId", "designationId", "companyId", "branchId", "dateOfJoining", status, salary FROM "Employee"')
    employees = cur.fetchall()
    emp_ids = [e[0] for e in employees]

    cur.execute('SELECT id, email, role, "tenantId" FROM "User"')
    users = cur.fetchall()
    user_ids = [u[0] for u in users]

    cur.execute('SELECT id, name, code, "defaultDays", "companyId" FROM "LeaveType"')
    leave_types = cur.fetchall()
    lt_ids = [lt[0] for lt in leave_types]

    cur.execute('SELECT id, name, "companyId" FROM "Project"')
    projects = cur.fetchall()
    project_ids = [p[0] for p in projects]

    cur.execute('SELECT id FROM "Tenant" LIMIT 1')
    tenant_id = cur.fetchone()[0]

    first_names = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Meera', 'Arjun', 'Kavya', 'Rahul', 'Sneha',
                   'Aditya', 'Nisha', 'Suresh', 'Divya', 'Karthik', 'Pooja', 'Venkat', 'Swati', 'Nikhil', 'Ritu',
                   'Deepak', 'Suman', 'Rajesh', 'Neha', 'Amit', 'Shalini', 'Manish', 'Kavitha', 'Srinivas', 'Bhavna']
    last_names = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Joshi', 'Gupta', 'Iyer', 'Rao',
                  'Chopra', 'Malhotra', 'Bhat', 'Das', 'Menon', 'Pillai', 'Hegde', 'Shetty', 'Kulkarni', 'Deshmukh']
    skills_list = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'AWS', 'Azure', 'Docker', 'Kubernetes',
                   'PostgreSQL', 'MongoDB', 'Machine Learning', 'Data Analysis', 'Project Management', 'Agile']
    prev_companies = ['Infosys', 'TCS', 'Wipro', 'Cognizant', 'Capgemini', 'Deloitte', 'Accenture', 'HCL Tech']
    prev_desgs = ['Software Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager', 'Analyst', 'Consultant']

    # ─── 1. Add 30 more employees ───
    print("\n=== Seeding 30 additional employees ===")
    new_emp_rows = []
    new_emp_ids = []
    emp_counter = len(employees) + 1
    for i in range(30):
        fn = first_names[i]
        ln = last_names[i % len(last_names)]
        emp_id_str = f'EMP-{emp_counter:03d}'
        email = f'{fn.lower()}.{ln.lower()}@techcorp.com'
        company = pick(companies)
        comp_id = company[0]
        comp_depts = dept_by_company.get(comp_id, departments) or departments
        dept = pick(comp_depts)
        dept_id = dept[0]
        comp_desgs = desg_by_dept.get(dept_id, designations) or designations
        desg = pick(comp_desgs)
        desg_id = desg[0]
        comp_branches = branch_by_company.get(comp_id, branches) or branches
        branch_id = pick(comp_branches)[0] if comp_branches else None
        doj = rand_date(date(2020, 1, 1), date(2025, 12, 31))
        salary = rand_float(400000, 3500000)
        dob = rand_date(date(1975, 1, 1), date(2000, 12, 31))
        gender = pick(['Male', 'Female'])
        marital = pick(['Single', 'Married'])
        phone = f'+91{rand_int(7000000000, 9999999999)}'
        eid = cuid()
        new_emp_ids.append(eid)
        new_emp_rows.append((eid, emp_id_str, fn, ln, email, phone, dept_id, desg_id, comp_id, branch_id,
             doj, dob, gender, marital, 'Indian',
             f'{rand_int(1,999)} {pick(["MG Road", "Station Road", "Park Avenue", "Main Street"])}',
             pick(['Hyderabad', 'Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Delhi']),
             pick(['TG', 'MH', 'KA', 'TN', 'MH', 'DL', 'WB']),
             f'{rand_int(100000, 999999)}', 'IN', pick(['A+', 'B+', 'O+', 'AB+']),
             f'Emergency Contact {ln}', f'+91{rand_int(7000000000, 9999999999)}',
             'active', salary, 'INR', pick(['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank']),
             f'{rand_int(1000000000, 9999999999)}', f'{pick(["HDFC", "ICIC", "SBIN", "UTIB"])}0{rand_int(10000, 99999)}',
             f'{pick(["ABCDE", "FGHIJ"])}{rand_int(1000, 9999)}P', f'{rand_int(100000000000, 999999999999)}'))
        emp_counter += 1

    emp_cols = ['id', 'employeeId', 'firstName', 'lastName', 'email', 'phone', 'departmentId', 'designationId', 'companyId', 'branchId', 'dateOfJoining', 'dateOfBirth', 'gender', 'maritalStatus', 'nationality', 'address', 'city', 'state', 'zipCode', 'country', 'bloodGroup', 'emergencyContactName', 'emergencyContactPhone', 'status', 'salary', 'salaryCurrency', 'bankName', 'bankAccountNo', 'bankIfscCode', 'panNumber', 'aadhaarNumber']
    n = batch_insert(cur, 'Employee', emp_cols, new_emp_rows, errors)
    print(f"  Created {n} new employees")

    all_emp_ids = emp_ids + new_emp_ids

    # ─── 2. Dependents ───
    print("\n=== Seeding Dependents ===")
    dep_rows = []
    for eid in all_emp_ids:
        for _ in range(random.choices([0, 1, 2], weights=[30, 45, 25])[0]):
            rel = pick(['Spouse', 'Son', 'Daughter', 'Father', 'Mother'])
            dep_rows.append((cuid(), eid, f'{pick(first_names)} {pick(last_names)}', rel,
                rand_date(date(1960, 1, 1), date(2020, 12, 31)),
                'Female' if rel in ['Spouse', 'Daughter', 'Mother'] else 'Male'))
    n = batch_insert(cur, 'Dependent', ['id', 'employeeId', 'name', 'relation', 'dateOfBirth', 'gender'], dep_rows, errors)
    print(f"  Created {n} dependents")

    # ─── 3. Qualifications ───
    print("\n=== Seeding Qualifications ===")
    degrees = ['B.Tech', 'M.Tech', 'MBA', 'B.Com', 'M.Sc', 'CA', 'BCA', 'MCA']
    institutions = ['IIT Bombay', 'IIT Delhi', 'IIM Ahmedabad', 'ISB Hyderabad', 'BITS Pilani', 'NIT Trichy', 'JNTU Hyderabad', 'Anna University']
    qual_rows = []
    for eid in all_emp_ids:
        for _ in range(random.choices([1, 2], weights=[55, 45])[0]):
            qual_rows.append((cuid(), eid, pick(degrees), pick(institutions), rand_int(2005, 2023), rand_float(55, 95)))
    n = batch_insert(cur, 'Qualification', ['id', 'employeeId', 'degree', 'institution', 'year', 'percentage'], qual_rows, errors)
    print(f"  Created {n} qualifications")

    # ─── 4. Experiences ───
    print("\n=== Seeding Experiences ===")
    exp_rows = []
    for eid in all_emp_ids:
        for _ in range(random.choices([0, 1, 2], weights=[20, 50, 30])[0]):
            sd = rand_date(date(2008, 1, 1), date(2023, 12, 31))
            ed = rand_date(sd, date(2024, 12, 31))
            exp_rows.append((cuid(), eid, pick(prev_companies), pick(prev_desgs), sd, ed, False, 'Worked on various projects'))
    n = batch_insert(cur, 'Experience', ['id', 'employeeId', 'company', 'designation', 'startDate', 'endDate', 'isCurrent', 'description'], exp_rows, errors)
    print(f"  Created {n} experiences")

    # ─── 5. Employee Skills ───
    print("\n=== Seeding Employee Skills ===")
    skill_rows = []
    levels = ['beginner', 'intermediate', 'advanced', 'expert']
    for eid in all_emp_ids:
        for skill in pick_n(skills_list, random.choices([1, 2, 3, 4], weights=[10, 30, 35, 25])[0]):
            skill_rows.append((cuid(), eid, skill, pick(levels), rand_int(1, 15)))
    n = batch_insert(cur, 'EmployeeSkill', ['id', 'employeeId', 'skill', 'level', 'yearsOfExp'], skill_rows, errors)
    print(f"  Created {n} skills")

    # ─── 6. Timesheets ───
    print("\n=== Seeding Timesheets ===")
    ts_rows = []
    for eid in pick_n(all_emp_ids, min(35, len(all_emp_ids))):
        for day_offset in range(1, 25):
            ts_date = now - timedelta(days=day_offset)
            if ts_date.weekday() >= 5:
                continue
            proj = pick(projects) if projects else None
            hours = rand_float(4, 9)
            status = pick(['draft', 'submitted', 'approved', 'approved'])
            ts_rows.append((cuid(), eid, ts_date.date(), proj[0] if proj else None, proj[1] if proj else None,
                 pick(['Development', 'Code Review', 'Testing', 'Documentation']),
                 hours, f'Worked on {pick(["feature development", "bug fixes", "optimization"])}',
                 status, pick(user_ids) if status == 'approved' else None,
                 ts_date + timedelta(days=2) if status == 'approved' else None,
                 status == 'approved' and random.random() > 0.8, False))
    n = batch_insert(cur, 'Timesheet', ['id', 'employeeId', 'date', 'projectId', 'project', 'task', 'hours', 'description', 'status', 'approvedBy', 'approvedAt', 'locked', 'invoiced'], ts_rows, errors)
    print(f"  Created {n} timesheets")

    # ─── 7. Payroll ───
    print("\n=== Seeding Payroll records ===")
    payroll_rows = []
    for eid in all_emp_ids:
        for month in [1, 2, 3, 4, 5, 6]:
            basic = rand_float(25000, 150000)
            hra = basic * 0.4
            da = basic * 0.1
            gross = basic + hra + da + 3000 + 1250 + rand_float(0, 10000)
            pf = basic * 0.12
            tax = rand_float(0, basic * 0.2)
            total_ded = pf + gross * 0.0075 + tax + 200 + rand_float(0, 5000)
            net = gross - total_ded
            status = pick(['processed', 'paid', 'paid'])
            payroll_rows.append((cuid(), eid, month, 2026, basic, hra, da, 3000, 1250, gross - basic - hra - da - 3000 - 1250,
                 gross, pf, gross * 0.0075, tax, 200, rand_float(0, 5000), total_ded, net, 'INR', status,
                 date(2026, month, 28) if status == 'paid' else None))
    n = batch_insert(cur, 'Payroll', ['id', 'employeeId', 'month', 'year', 'basicSalary', 'hra', 'da', 'conveyance', 'medical', 'otherAllowances', 'grossSalary', 'pf', 'esi', 'tax', 'professionalTax', 'otherDeductions', 'totalDeductions', 'netSalary', 'currency', 'status', 'paidDate'], payroll_rows, errors)
    print(f"  Created {n} payroll records")

    # ─── 8. Promotions ───
    print("\n=== Seeding Promotions ===")
    promo_rows = []
    for eid in pick_n(all_emp_ids, 15):
        effective = rand_date(date(2023, 1, 1), date(2026, 6, 30))
        status = pick(['pending', 'approved', 'approved'])
        promo_rows.append((cuid(), eid, pick(['Associate', 'Junior Engineer', 'Senior Associate', 'Team Lead']),
             pick(['Senior Associate', 'Senior Engineer', 'Team Lead', 'Manager']),
             pick(['Engineering', 'HR', 'Finance', 'Operations']), pick(['Engineering', 'HR', 'Finance', 'Operations']),
             effective, rand_float(50000, 500000), 'Excellent performance', status,
             pick(user_ids) if status == 'approved' else None, effective + timedelta(days=1) if status == 'approved' else None))
    n = batch_insert(cur, 'Promotion', ['id', 'employeeId', 'fromDesignation', 'toDesignation', 'fromDepartment', 'toDepartment', 'effectiveDate', 'salaryChange', 'reason', 'status', 'approvedBy', 'approvedAt'], promo_rows, errors)
    print(f"  Created {n} promotions")

    # ─── 9. Separations ───
    print("\n=== Seeding Separations ===")
    sep_rows = []
    for eid in pick_n(all_emp_ids, 5):
        lwd = rand_date(date(2025, 1, 1), date(2026, 6, 30))
        status = pick(['pending', 'notice_period', 'completed', 'completed'])
        sep_rows.append((cuid(), eid, pick(['resignation', 'termination', 'retirement']),
             pick(['Better opportunity', 'Personal reasons', 'Relocation']),
             rand_int(30, 90), lwd, status,
             rand_float(50000, 500000) if status == 'completed' else None,
             pick(user_ids) if status == 'completed' else None, lwd if status == 'completed' else None))
    n = batch_insert(cur, 'Separation', ['id', 'employeeId', 'type', 'reason', 'noticePeriod', 'lastWorkingDate', 'status', 'settlementAmount', 'approvedBy', 'approvedAt'], sep_rows, errors)
    print(f"  Created {n} separations")

    # ─── 10. Incident Reports ───
    print("\n=== Seeding Incident Reports ===")
    inc_rows = []
    for eid in pick_n(all_emp_ids, 10):
        status = pick(['open', 'investigating', 'resolved', 'closed'])
        inc_rows.append((cuid(), eid, pick(['safety', 'security', 'harassment', 'other']),
             pick(['Workplace safety violation', 'Unauthorized access', 'Equipment malfunction', 'Data breach concern']),
             'Detailed incident description with relevant context',
             pick(['low', 'medium', 'high', 'critical']), status, rand_date(date(2025, 1, 1), date(2026, 6, 30)),
             'Resolved through appropriate channels' if status in ['resolved', 'closed'] else None,
             rand_date(date(2026, 1, 1), date(2026, 6, 30)) if status in ['resolved', 'closed'] else None, pick(user_ids)))
    n = batch_insert(cur, 'IncidentReport', ['id', 'employeeId', 'type', 'title', 'description', 'severity', 'status', 'reportedDate', 'resolution', 'resolvedDate', 'reportedBy'], inc_rows, errors)
    print(f"  Created {n} incident reports")

    # ─── 11. Clients ───
    print("\n=== Seeding Clients ===")
    client_rows = []
    client_names = ['Acme Corp', 'GlobalTech Inc', 'Pinnacle Solutions', 'Vertex Systems', 'Quantum Analytics',
                    'Zenith Industries', 'Apex Digital', 'NovaTech Solutions', 'CrestView Partners', 'EagleEye Consulting']
    for comp in companies:
        for cname in pick_n(client_names, rand_int(2, 3)):
            client_rows.append((cuid(), cname, f'CL-{rand_int(100, 999)}', comp[0], pick(['Technology', 'Finance', 'Healthcare', 'Manufacturing']),
                 f'{pick(first_names)} {pick(last_names)}', f'contact@{cname.lower().replace(" ", "")}.com',
                 f'+91{rand_int(7000000000, 9999999999)}', 'active'))
    n = batch_insert(cur, 'Client', ['id', 'name', 'code', 'companyId', 'industry', 'contactName', 'contactEmail', 'contactPhone', 'status'], client_rows, errors)
    print(f"  Created {n} clients")

    # ─── 12. Vendors ───
    print("\n=== Seeding Vendors ===")
    vendor_rows = []
    vendor_names = ['CloudNine Services', 'TechSupply Co', 'OfficePro Solutions', 'DataVault Systems', 'SecureNet Solutions',
                    'GreenWorks Supplies', 'FastTrack Logistics', 'PrimeEdge Consulting', 'CoreTech Hardware']
    for comp in companies:
        for vname in pick_n(vendor_names, rand_int(2, 3)):
            vendor_rows.append((cuid(), vname, f'VN-{rand_int(100, 999)}', comp[0], pick(['IT Services', 'Office Supplies', 'Cloud Infrastructure', 'Security', 'Consulting']),
                 f'{pick(first_names)} {pick(last_names)}', f'info@{vname.lower().replace(" ", "")}.com',
                 f'+91{rand_int(7000000000, 9999999999)}', 'active'))
    n = batch_insert(cur, 'Vendor', ['id', 'name', 'code', 'companyId', 'type', 'contactName', 'contactEmail', 'contactPhone', 'status'], vendor_rows, errors)
    print(f"  Created {n} vendors")

    # ─── 13. OKRs ───
    print("\n=== Seeding OKRs ===")
    okr_rows = []
    okr_objectives = ['Increase Revenue by 20%', 'Reduce Customer Churn to 5%', 'Launch New Product Line', 'Improve Employee Satisfaction', 'Achieve ISO Certification', 'Expand to 3 New Markets', 'Reduce Operating Costs by 15%', 'Achieve 95% On-time Delivery']
    for comp in companies:
        for objective in pick_n(okr_objectives, 3):
            sd = rand_date(date(2026, 1, 1), date(2026, 3, 31))
            ed = sd + timedelta(days=90)
            status = pick(['not_started', 'in_progress', 'in_progress', 'completed'])
            okr_rows.append((cuid(), objective, comp[0], pick(all_emp_ids), sd, ed, status,
                 rand_int(0, 100) if status == 'in_progress' else (100 if status == 'completed' else 0)))
    n = batch_insert(cur, 'OKR', ['id', 'objective', 'companyId', 'ownerId', 'startDate', 'endDate', 'status', 'progress'], okr_rows, errors)
    print(f"  Created {n} OKRs")

    # ─── 14. Teams ───
    print("\n=== Seeding Teams ===")
    team_rows = []
    team_names = ['Alpha Squad', 'Beta Team', 'Gamma Force', 'Delta Unit', 'Epsilon Crew', 'Phoenix Team', 'Titan Squad', 'Nebula Team']
    for comp in companies:
        for tname in pick_n(team_names, 2):
            team_rows.append((cuid(), tname, comp[0], pick(all_emp_ids), pick(['project', 'department', 'cross_functional']), True))
    n = batch_insert(cur, 'Team', ['id', 'name', 'companyId', 'leadId', 'teamType', 'isActive'], team_rows, errors)
    print(f"  Created {n} teams")

    # ─── 15. Team Members ───
    print("\n=== Seeding Team Members ===")
    tm_rows = []
    cur.execute('SELECT id FROM "Team"')
    team_ids = [t[0] for t in cur.fetchall()]
    for tid in team_ids:
        for mid in pick_n(all_emp_ids, rand_int(3, 6)):
            tm_rows.append((cuid(), tid, mid, pick(['member', 'member', 'senior_member', 'tech_lead']),
                 rand_date(date(2024, 1, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'TeamMember', ['id', 'teamId', 'employeeId', 'role', 'joinedAt'], tm_rows, errors)
    print(f"  Created {n} team members")

    # ─── 16. Recognitions ───
    print("\n=== Seeding Recognitions ===")
    rec_rows = []
    for _ in range(30):
        rec_rows.append((cuid(), pick(user_ids), pick(all_emp_ids), pick(['employee_of_month', 'spot_award', 'team_excellence', 'innovation', 'leadership']),
             pick(['Outstanding Performer', 'Team Player', 'Innovation Award', 'Star of the Month']),
             pick(['Outstanding contribution to the project delivery', 'Exemplary teamwork and collaboration', 'Innovative solution that saved significant time']),
             rand_int(50, 500), random.random() > 0.3))
    n = batch_insert(cur, 'Recognition', ['id', 'fromId', 'toId', 'type', 'title', 'message', 'points', 'isPublic'], rec_rows, errors)
    print(f"  Created {n} recognitions")

    # ─── 17. Wallets ───
    print("\n=== Seeding Wallets ===")
    wallet_rows = []
    for eid in pick_n(all_emp_ids, min(30, len(all_emp_ids))):
        wallet_rows.append((cuid(), eid, 'INR'))
    n = batch_insert(cur, 'Wallet', ['id', 'employeeId', 'currency'], wallet_rows, errors)
    print(f"  Created {n} wallets")

    # ─── 18. Marketplace Products ───
    print("\n=== Seeding Marketplace Products ===")
    mp_rows = []
    products = [('Noise Smartwatch Pro', 'electronics', 4999), ('Amazon Gift Card', 'gift_cards', 500),
                ('Book My Show Voucher', 'entertainment', 1000), ('Myntra Fashion Voucher', 'fashion', 2000),
                ('Swiggy Food Voucher', 'food', 500), ('Coursera Course Access', 'education', 3500),
                ('Spotify Premium 1 Year', 'entertainment', 1188), ('Fitbit Fitness Tracker', 'health', 7999),
                ('Apollo Pharmacy Voucher', 'health', 1000), ('Decathlon Sports Voucher', 'sports', 1500)]
    for pname, cat, price in products:
        mp_rows.append((cuid(), pname, cat, price, price * 0.85, 'INR', pick(company_ids), f'{pname} - exclusive employee benefit'))
    n = batch_insert(cur, 'MarketplaceProduct', ['id', 'name', 'category', 'publicPrice', 'corporatePrice', 'currency', 'companyId', 'description'], mp_rows, errors)
    print(f"  Created {n} marketplace products")

    # ─── 19. Insurance Policies ───
    print("\n=== Seeding Insurance Policies ===")
    ins_rows = []
    policies = [('Group Health Insurance', 'health', 500000, 12000), ('Term Life Insurance', 'life', 1000000, 8000),
                ('Personal Accident Cover', 'accident', 500000, 3000), ('Group Super Top-Up', 'health', 1000000, 5000),
                ('Critical Illness Cover', 'health', 500000, 6000), ('Group Travel Insurance', 'travel', 200000, 2000)]
    for pname, ptype, coverage, premium in policies:
        for eid in pick_n(all_emp_ids, rand_int(3, 6)):
            ins_rows.append((cuid(), eid, ptype, pick(['Star Health', 'HDFC Ergo', 'ICICI Lombard']),
                 f'POL-{rand_int(10000, 99999)}', coverage, premium, 'INR', 'salary_deduction', 'monthly',
                 date(2026, 1, 1), date(2026, 12, 31), 'active'))
    n = batch_insert(cur, 'InsurancePolicy', ['id', 'employeeId', 'policyType', 'providerName', 'policyNumber', 'coverageAmount', 'premiumAmount', 'premiumCurrency', 'paymentMode', 'deductionFrequency', 'startDate', 'endDate', 'status'], ins_rows, errors)
    print(f"  Created {n} insurance policies")

    # ─── 20. Insurance Claims ───
    print("\n=== Seeding Insurance Claims ===")
    claim_rows = []
    cur.execute('SELECT id FROM "InsurancePolicy" LIMIT 20')
    ins_policy_ids = [p[0] for p in cur.fetchall()]
    for eid in pick_n(all_emp_ids, 10):
        if ins_policy_ids:
            claim_rows.append((cuid(), pick(ins_policy_ids), eid, rand_float(5000, 200000),
                 pick(['pending', 'approved', 'rejected', 'approved']),
                 rand_date(date(2025, 6, 1), date(2026, 6, 30)),
                 rand_date(date(2026, 1, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'InsuranceClaim', ['id', 'policyId', 'employeeId', 'claimAmount', 'status', 'submittedAt', 'resolvedAt'], claim_rows, errors)
    print(f"  Created {n} insurance claims")

    # ─── 21. Gifts ───
    print("\n=== Seeding Gifts ===")
    gift_rows = []
    for _ in range(25):
        sender = pick(all_emp_ids)
        receiver = pick([e for e in all_emp_ids if e != sender])
        gift_rows.append((cuid(), receiver, sender, pick(['birthday', 'work_anniversary', 'welcome', 'festival', 'achievement']),
             pick(['Happy Birthday!', 'Congratulations on your anniversary!', 'Welcome to the team!', 'Happy Diwali!', 'Great achievement!']),
             rand_float(100, 5000), 'INR', pick(['sent', 'delivered', 'redeemed'])))
    n = batch_insert(cur, 'Gift', ['id', 'recipientId', 'senderId', 'triggerEvent', 'message', 'value', 'currency', 'status'], gift_rows, errors)
    print(f"  Created {n} gifts")

    # ─── 22. Login Activities ───
    print("\n=== Seeding Login Activities ===")
    la_rows = []
    for uid in user_ids:
        for _ in range(rand_int(3, 10)):
            la_rows.append((cuid(), uid, pick(['login', 'login', 'login', 'logout', 'failed_login']),
                 f'192.168.{rand_int(1,255)}.{rand_int(1,255)}', 'Mozilla/5.0 Chrome/120.0',
                 pick(['Hyderabad', 'Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Delhi']),
                 rand_date(date(2026, 1, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'LoginActivity', ['id', 'userId', 'action', 'ip', 'userAgent', 'location', 'createdAt'], la_rows, errors)
    print(f"  Created {n} login activities")

    # ─── 23. More Notifications ───
    print("\n=== Seeding Additional Notifications ===")
    notif_rows = []
    notif_data = [('Leave Approved', 'Your leave request has been approved', 'success', 'leave'),
                  ('Payroll Processed', 'Your salary for this month has been processed', 'info', 'payroll'),
                  ('New Policy Published', 'A new company policy has been published', 'info', 'system'),
                  ('Performance Review', 'You have a pending performance review', 'warning', 'performance'),
                  ('Document Expiring', 'Your document is expiring soon', 'warning', 'system'),
                  ('Birthday Wishes', 'Happy Birthday!', 'info', 'system'),
                  ('Work Anniversary', 'Congratulations on your work anniversary!', 'success', 'system'),
                  ('Training Reminder', 'Your training session starts tomorrow', 'info', 'system'),
                  ('Expense Approved', 'Your expense claim has been approved', 'success', 'payroll'),
                  ('Shift Update', 'Your shift schedule has been updated', 'info', 'system')]
    for uid in user_ids:
        for title, msg, ntype, cat in pick_n(notif_data, rand_int(5, 10)):
            notif_rows.append((cuid(), tenant_id, uid, title, msg, ntype, cat, random.random() > 0.5, random.random() > 0.7))
    n = batch_insert(cur, 'Notification', ['id', 'tenantId', 'userId', 'title', 'message', 'type', 'category', 'isRead', 'isEmailSent'], notif_rows, errors)
    print(f"  Created {n} notifications")

    # ─── 24. More Announcements ───
    print("\n=== Seeding Additional Announcements ===")
    ann_rows = []
    ann_data = [('Company Annual Day Celebration', 'We are excited to announce our Annual Day celebration on August 15th. All employees are invited to participate.', 'important'),
                ('New Health Insurance Benefits', 'Effective from next month, all employees will receive enhanced health insurance coverage.', 'normal'),
                ('Mandatory Cybersecurity Training', 'All employees must complete the cybersecurity awareness training by end of this month.', 'urgent'),
                ('Q2 Results & Town Hall', 'Join us for the Q2 results town hall meeting.', 'important')]
    for title, content, priority in ann_data:
        ann_rows.append((cuid(), title, content, priority, 'all', True, rand_date(date(2026, 1, 1), date(2026, 6, 30)), date(2026, 12, 31)))
    n = batch_insert(cur, 'Announcement', ['id', 'title', 'content', 'priority', 'targetAudience', 'isActive', 'publishedAt', 'expiresAt'], ann_rows, errors)
    print(f"  Created {n} announcements")

    # ─── 25. More Projects ───
    print("\n=== Seeding Additional Projects ===")
    proj_rows = []
    proj_data = [('Digital Transformation Initiative', 'Enterprise-wide digital transformation project'),
                 ('Cloud Migration Phase 2', 'Migrating legacy systems to cloud infrastructure'),
                 ('Customer Portal Redesign', 'Redesigning the customer-facing portal with modern UX'),
                 ('AI-Powered Analytics Platform', 'Building ML-driven analytics for business insights'),
                 ('Mobile App Development', 'Cross-platform mobile application for employees'),
                 ('Compliance Automation System', 'Automating regulatory compliance workflows')]
    for pname, pdesc in proj_data:
        comp = pick(companies)
        sd = rand_date(date(2025, 6, 1), date(2026, 6, 30))
        ed = sd + timedelta(days=rand_int(90, 365))
        proj_rows.append((cuid(), pname, comp[0], sd, ed, pick(['planning', 'in_progress', 'in_progress', 'completed', 'on_hold']), pdesc, rand_float(500000, 10000000)))
    n = batch_insert(cur, 'Project', ['id', 'name', 'companyId', 'startDate', 'endDate', 'status', 'description', 'budget'], proj_rows, errors)
    print(f"  Created {n} projects")

    # ─── 26. More Leave Requests ───
    print("\n=== Seeding Additional Leave Requests ===")
    lr_rows = []
    for eid in pick_n(all_emp_ids, min(25, len(all_emp_ids))):
        for _ in range(rand_int(1, 2)):
            lt = pick(leave_types)
            if not lt:
                continue
            sd = rand_date(date(2026, 1, 1), date(2026, 8, 30))
            ed = sd + timedelta(days=rand_int(1, 5))
            status = pick(['pending', 'approved', 'approved', 'rejected'])
            lr_rows.append((cuid(), eid, lt[0], sd, ed, pick(['Personal work', 'Family function', 'Health issue', 'Vacation']),
                 status, pick(user_ids) if status in ['approved', 'rejected'] else None,
                 sd + timedelta(days=1) if status in ['approved', 'rejected'] else None,
                 'Approved' if status == 'approved' else None, random.random() > 0.9))
    n = batch_insert(cur, 'LeaveRequest', ['id', 'employeeId', 'leaveTypeId', 'startDate', 'endDate', 'reason', 'status', 'approvedBy', 'approvedAt', 'comments', 'halfDay'], lr_rows, errors)
    print(f"  Created {n} leave requests")

    # ─── 27. More Attendance ───
    print("\n=== Seeding Additional Attendance ===")
    att_rows = []
    for eid in pick_n(all_emp_ids, min(35, len(all_emp_ids))):
        for day_offset in range(1, 30):
            att_date = now - timedelta(days=day_offset)
            if att_date.weekday() >= 5:
                continue
            if random.random() > 0.85:
                continue
            check_in_h = rand_int(8, 10)
            check_in = datetime.combine(att_date.date(), datetime.min.time()) + timedelta(hours=check_in_h, minutes=rand_int(0, 59))
            check_out = check_in + timedelta(hours=rand_int(8, 10), minutes=rand_int(0, 59))
            status = 'present' if check_in_h < 10 else 'late'
            att_rows.append((cuid(), eid, att_date.date(), check_in, check_out, status, rand_float(7, 10), rand_float(0, 3)))
    n = batch_insert(cur, 'Attendance', ['id', 'employeeId', 'date', 'checkIn', 'checkOut', 'status', 'workHours', 'overtime'], att_rows, errors)
    print(f"  Created {n} attendance records")

    # ─── 28. More Expense Claims ───
    print("\n=== Seeding Additional Expense Claims ===")
    exp_rows = []
    exp_categories = ['travel', 'food', 'accommodation', 'transport', 'medical', 'other']
    for eid in pick_n(all_emp_ids, 20):
        for _ in range(rand_int(1, 2)):
            exp_rows.append((cuid(), eid, f'{pick(exp_categories).title()} Expense', pick(exp_categories),
                 rand_float(200, 50000), 'INR', rand_date(date(2026, 1, 1), date(2026, 6, 30)),
                 f'Business {pick(exp_categories)} expense for project work',
                 pick(['pending', 'approved', 'approved', 'rejected', 'paid']),
                 pick(user_ids), rand_date(date(2026, 1, 1), date(2026, 6, 30)),
                 rand_date(date(2026, 2, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'ExpenseClaim', ['id', 'employeeId', 'title', 'category', 'amount', 'currency', 'date', 'description', 'status', 'approvedBy', 'approvedAt', 'paidAt'], exp_rows, errors)
    print(f"  Created {n} expense claims")

    # ─── 29. More Travel Requests ───
    print("\n=== Seeding Additional Travel Requests ===")
    tr_rows = []
    destinations = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Singapore', 'Dubai', 'London']
    for eid in pick_n(all_emp_ids, 15):
        sd = rand_date(date(2026, 1, 1), date(2026, 8, 30))
        ed = sd + timedelta(days=rand_int(1, 7))
        tr_rows.append((cuid(), eid, pick(['Client meeting', 'Conference', 'Project delivery', 'Training']),
             pick(destinations), sd, ed, pick(['flight', 'train', 'car']), rand_float(5000, 150000),
             pick(['pending', 'approved', 'approved', 'rejected', 'completed']),
             pick(user_ids), sd + timedelta(days=1), 'Business travel as per company policy'))
    n = batch_insert(cur, 'TravelRequest', ['id', 'employeeId', 'purpose', 'destination', 'startDate', 'endDate', 'mode', 'estimatedCost', 'status', 'approvedBy', 'approvedAt', 'notes'], tr_rows, errors)
    print(f"  Created {n} travel requests")

    # ─── 30. More Documents ───
    print("\n=== Seeding Additional Documents ===")
    doc_rows = []
    doc_types = ['offer_letter', 'id_proof', 'contract', 'certificate', 'policy', 'other']
    doc_names = ['Employment Offer Letter', 'Aadhaar Card', 'PAN Card', 'Employment Contract', 'NDA Agreement', 'Experience Certificate', 'Training Certificate']
    for eid in all_emp_ids:
        for dtype, dname in pick_n(list(zip(doc_types, doc_names)), rand_int(1, 2)):
            doc_rows.append((cuid(), eid, dname, dtype, f'/uploads/{dtype}/{cuid()}.pdf', 'active',
                 rand_date(date(2024, 1, 1), date(2026, 6, 30)),
                 rand_date(date(2027, 1, 1), date(2030, 12, 31)) if random.random() > 0.5 else None,
                 f'{dname} document for employee records'))
    n = batch_insert(cur, 'Document', ['id', 'employeeId', 'name', 'type', 'fileUrl', 'status', 'uploadedAt', 'expiryDate', 'description'], doc_rows, errors)
    print(f"  Created {n} documents")

    # ─── 31. More Feedback ───
    print("\n=== Seeding Additional Feedback ===")
    fb_rows = []
    fb_comments = ['Excellent team player with strong technical skills', 'Demonstrates consistent high performance', 'Great communication skills and attention to detail', 'Outstanding problem-solving abilities']
    for _ in range(30):
        from_id = pick(all_emp_ids)
        to_id = pick([e for e in all_emp_ids if e != from_id])
        fb_rows.append((cuid(), from_id, to_id, pick(['peer', 'manager', 'self', '360']), rand_int(3, 5),
             pick(fb_comments), random.random() > 0.8))
    n = batch_insert(cur, 'Feedback', ['id', 'fromId', 'toId', 'type', 'rating', 'comments', 'isAnonymous'], fb_rows, errors)
    print(f"  Created {n} feedback entries")

    # ─── 32. More Performance Reviews ───
    print("\n=== Seeding Additional Performance Reviews ===")
    pr_rows = []
    for eid in pick_n(all_emp_ids, min(25, len(all_emp_ids))):
        for cycle in pick_n(['H1 2025', 'H2 2025', 'H1 2026'], 2):
            status = pick(['pending', 'in_progress', 'completed', 'completed'])
            pr_rows.append((cuid(), eid, cycle, cycle, pick(user_ids), rand_float(3, 5),
                 rand_float(3, 5), rand_float(3, 5), rand_float(3, 5), rand_float(3, 5),
                 'Overall good performance with room for improvement', 'Strong technical skills, excellent teamwork',
                 'Could improve time management and delegation skills',
                 status, rand_date(date(2025, 6, 1), date(2026, 6, 30)) if status == 'completed' else None))
    n = batch_insert(cur, 'PerformanceReview', ['id', 'employeeId', 'reviewCycle', 'reviewPeriod', 'reviewerId', 'rating', 'goalsRating', 'skillsRating', 'behaviorRating', 'overallRating', 'comments', 'strengths', 'improvements', 'status', 'reviewDate'], pr_rows, errors)
    print(f"  Created {n} performance reviews")

    # ─── 33. More Goals ───
    print("\n=== Seeding Additional Goals ===")
    goal_rows = []
    goal_titles = [('Complete AWS certification', 'development'), ('Reduce code review turnaround by 50%', 'performance'),
                   ('Lead a cross-functional project', 'behavioral'), ('Mentor 2 junior developers', 'development'),
                   ('Achieve 100% sprint completion rate', 'performance'), ('Publish 2 technical blog posts', 'development'),
                   ('Improve customer satisfaction score by 10%', 'performance')]
    for eid in all_emp_ids:
        for title, cat in pick_n(goal_titles, rand_int(1, 2)):
            sd = rand_date(date(2026, 1, 1), date(2026, 3, 31))
            ed = sd + timedelta(days=rand_int(30, 180))
            status = pick(['not_started', 'in_progress', 'in_progress', 'completed'])
            goal_rows.append((cuid(), eid, title, f'Detailed plan for: {title}', cat, pick(['low', 'medium', 'high']),
                 status, rand_int(0, 100) if status == 'in_progress' else (100 if status == 'completed' else 0),
                 sd, ed, ed if status == 'completed' else None))
    n = batch_insert(cur, 'Goal', ['id', 'employeeId', 'title', 'description', 'category', 'priority', 'status', 'progress', 'startDate', 'endDate', 'completedDate'], goal_rows, errors)
    print(f"  Created {n} goals")

    # ─── 34. More Grievances ───
    print("\n=== Seeding Additional Grievances ===")
    grv_rows = []
    for eid in pick_n(all_emp_ids, 10):
        status = pick(['open', 'in_progress', 'resolved', 'closed'])
        grv_rows.append((cuid(), eid, pick(['harassment', 'discrimination', 'workload', 'salary', 'other']),
             pick(['Excessive workload', 'Unfair treatment in promotion', 'Workplace harassment', 'Salary discrepancy']),
             'Detailed description of the grievance with supporting evidence',
             pick(['low', 'medium', 'high', 'critical']), status,
             pick(user_ids) if status in ['in_progress', 'resolved', 'closed'] else None,
             'Issue resolved through mediation' if status in ['resolved', 'closed'] else None,
             rand_date(date(2026, 1, 1), date(2026, 6, 30)) if status in ['resolved', 'closed'] else None))
    n = batch_insert(cur, 'Grievance', ['id', 'employeeId', 'type', 'subject', 'description', 'priority', 'status', 'assignedTo', 'resolution', 'resolvedDate'], grv_rows, errors)
    print(f"  Created {n} grievances")

    # ─── 35. More Tickets ───
    print("\n=== Seeding Additional Tickets ===")
    tkt_rows = []
    for eid in pick_n(all_emp_ids, 15):
        status = pick(['open', 'in_progress', 'resolved', 'closed'])
        tkt_rows.append((cuid(), eid, pick(['VPN connection issue', 'Laptop not working', 'Leave balance query', 'Salary slip not received', 'Access card not working']),
             pick(['IT Support', 'HR Query', 'Finance', 'Admin', 'Facilities']),
             'Detailed description of the issue with steps to reproduce',
             pick(['low', 'medium', 'high', 'critical']), status,
             pick(user_ids) if status in ['in_progress', 'resolved', 'closed'] else None,
             rand_date(date(2026, 1, 1), date(2026, 6, 30)) if status in ['resolved', 'closed'] else None))
    n = batch_insert(cur, 'Ticket', ['id', 'employeeId', 'subject', 'category', 'description', 'priority', 'status', 'assignedTo', 'resolvedAt'], tkt_rows, errors)
    print(f"  Created {n} tickets")

    # ─── 36. More Candidates ───
    print("\n=== Seeding Additional Candidates ===")
    cand_rows = []
    for i in range(15):
        fn = pick(first_names)
        ln = pick(last_names)
        cand_rows.append((cuid(), tenant_id, fn, ln, f'{fn.lower()}.{ln.lower()}{rand_int(1,999)}@gmail.com',
             f'+91{rand_int(7000000000, 9999999999)}', pick(prev_companies), pick(prev_desgs),
             f'{rand_int(1, 15)} years', f'{rand_int(8, 50)} LPA', ', '.join(pick_n(skills_list, 3)),
             pick(['new', 'screening', 'interview', 'offered', 'hired', 'rejected']),
             pick(company_ids), rand_date(date(2026, 1, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'Candidate', ['id', 'tenantId', 'firstName', 'lastName', 'email', 'phone', 'currentCompany', 'currentJobTitle', 'totalExperience', 'expectedCTC', 'skills', 'status', 'companyId', 'appliedAt'], cand_rows, errors)
    print(f"  Created {n} candidates")

    # ─── 37. More Training Sessions ───
    print("\n=== Seeding Additional Training Sessions ===")
    train_rows = []
    for title, cat, loc, mode in [('Advanced React Patterns', 'technical', 'Online', 'online'),
                                   ('Effective Leadership Workshop', 'management', 'Conference Room A', 'offline'),
                                   ('AWS Certification Prep', 'technical', 'Virtual', 'online'),
                                   ('Financial Compliance Training', 'compliance', 'Training Center', 'offline'),
                                   ('Agile Methodology Bootcamp', 'methodology', 'Hybrid', 'hybrid'),
                                   ('Data Analytics with Python', 'technical', 'Lab Room 2', 'offline')]:
        sd = rand_date(date(2026, 1, 1), date(2026, 9, 30))
        ed = sd + timedelta(days=rand_int(1, 14))
        train_rows.append((cuid(), title, f'Comprehensive {title} program', cat, f'Dr. {pick(last_names)}',
             sd, ed, loc, mode, 'upcoming' if sd > now.date() else pick(['ongoing', 'completed']),
             rand_int(15, 50), rand_float(5000, 50000)))
    n = batch_insert(cur, 'Training', ['id', 'title', 'description', 'category', 'trainer', 'startDate', 'endDate', 'location', 'mode', 'status', 'maxParticipants', 'cost'], train_rows, errors)
    print(f"  Created {n} training sessions")

    # ─── 38. More Assets ───
    print("\n=== Seeding Additional Assets ===")
    asset_rows = []
    for name, cat, brand, model in [('Dell Latitude 5540', 'laptop', 'Dell', 'Latitude 5540'), ('MacBook Pro 14"', 'laptop', 'Apple', 'MacBook Pro 14'),
                                     ('iPhone 15 Pro', 'phone', 'Apple', 'iPhone 15 Pro'), ('Samsung Galaxy S24', 'phone', 'Samsung', 'Galaxy S24'),
                                     ('Dell UltraSharp 27"', 'monitor', 'Dell', 'U2723QE'), ('ThinkPad X1 Carbon', 'laptop', 'Lenovo', 'X1 Carbon Gen 11'),
                                     ('iPad Pro 12.9"', 'tablet', 'Apple', 'iPad Pro 12.9'), ('HP EliteBook 840', 'laptop', 'HP', 'EliteBook 840 G10'),
                                     ('Dell OptiPlex 7010', 'desktop', 'Dell', 'OptiPlex 7010'), ('Surface Pro 9', 'tablet', 'Microsoft', 'Surface Pro 9')]:
        comp = pick(companies)
        asset_rows.append((cuid(), name, f'IT-AST-{rand_int(1000, 9999)}', cat, brand, model,
             f'SN-{rand_int(100000, 999999)}', rand_date(date(2023, 1, 1), date(2025, 12, 31)),
             rand_float(30000, 200000), pick(['available', 'assigned', 'assigned', 'maintenance']),
             pick(['new', 'good', 'good', 'fair']), pick(['Hyderabad Office', 'Mumbai Office', 'Bengaluru Office']),
             date(2026, rand_int(1, 12), 1), 'Company asset', comp[0]))
    n = batch_insert(cur, 'Asset', ['id', 'name', 'assetTag', 'category', 'brand', 'model', 'serialNumber', 'purchaseDate', 'purchaseCost', 'status', 'condition', 'location', 'warrantyExpiry', 'notes', 'companyId'], asset_rows, errors)
    print(f"  Created {n} assets")

    # ─── 39. More Onboarding Tasks ───
    print("\n=== Seeding Additional Onboarding Tasks ===")
    ob_rows = []
    ob_data = [('general', 'Complete joining formalities'), ('it_setup', 'Setup laptop and email'), ('hr_docs', 'Submit ID proofs'),
               ('training', 'Complete compliance training'), ('introduction', 'Meet team members'), ('buddy_setup', 'Assign buddy'),
               ('payroll_setup', 'Setup payroll account'), ('project_allocation', 'Allocate to project')]
    for eid in new_emp_ids:
        for i, (cat, task) in enumerate(ob_data):
            status = pick(['pending', 'in_progress', 'completed', 'completed'])
            ob_rows.append((cuid(), eid, task, cat, status, date(2026, 1, 15) + timedelta(days=i*3),
                 date(2026, 1, 20) + timedelta(days=i*2) if status == 'completed' else None,
                 pick(user_ids), 'New employee onboarding task'))
    n = batch_insert(cur, 'OnboardingTask', ['id', 'employeeId', 'task', 'category', 'status', 'dueDate', 'completedDate', 'assignedBy', 'notes'], ob_rows, errors)
    print(f"  Created {n} onboarding tasks")

    # ─── 40. More Reimbursements ───
    print("\n=== Seeding Additional Reimbursements ===")
    reim_rows = []
    for eid in pick_n(all_emp_ids, 15):
        for _ in range(rand_int(1, 2)):
            reim_rows.append((cuid(), eid, pick(['medical', 'fuel', 'phone', 'internet', 'education', 'other']),
                 rand_float(500, 25000), 'INR', f'{pick(["medical", "fuel", "phone"])} reimbursement for the month',
                 pick(['pending', 'approved', 'approved', 'rejected', 'paid']),
                 pick(user_ids), rand_date(date(2026, 1, 1), date(2026, 6, 30)),
                 rand_date(date(2026, 2, 1), date(2026, 6, 30))))
    n = batch_insert(cur, 'Reimbursement', ['id', 'employeeId', 'type', 'amount', 'currency', 'description', 'status', 'approvedBy', 'approvedAt', 'paidAt'], reim_rows, errors)
    print(f"  Created {n} reimbursements")

    # ─── 41. More Job Postings ───
    print("\n=== Seeding Additional Job Postings ===")
    jp_rows = []
    for jtitle, jtype, jexp, jsalary in [('Senior Full Stack Developer', 'full-time', '5-8 years', '25-40 LPA'),
                                           ('Product Manager', 'full-time', '8-12 years', '30-50 LPA'),
                                           ('Data Scientist', 'full-time', '3-6 years', '20-35 LPA'),
                                           ('UX Designer', 'full-time', '3-5 years', '15-25 LPA'),
                                           ('DevOps Engineer', 'full-time', '4-7 years', '18-30 LPA'),
                                           ('HR Business Partner', 'full-time', '5-8 years', '15-25 LPA')]:
        comp = pick(companies)
        comp_depts = dept_by_company.get(comp[0], departments) or departments
        dept = pick(comp_depts)
        jp_rows.append((cuid(), jtitle, dept[0], jtitle, pick(['Hyderabad', 'Mumbai', 'Bengaluru', 'Remote']),
             jtype, jexp, jsalary, f'We are looking for an experienced {jtitle} to join our team.',
             f'Bachelor\'s degree, {jexp} of experience, strong communication skills',
             pick(['open', 'open', 'on_hold']), date(2026, rand_int(1, 6), 1), rand_int(1, 5)))
    n = batch_insert(cur, 'JobPosting', ['id', 'title', 'departmentId', 'position', 'location', 'type', 'experience', 'salary', 'description', 'requirements', 'status', 'postedDate', 'vacancies'], jp_rows, errors)
    print(f"  Created {n} job postings")

    # ─── 42. More Leave Balances for new employees ───
    print("\n=== Seeding Leave Balances for new employees ===")
    lb_rows = []
    for eid in new_emp_ids:
        for lt in leave_types:
            total = lt[3] or 0
            used = rand_int(0, int(total * 0.6))
            remaining = total - used
            lb_rows.append((cuid(), eid, lt[0], 2026, total, used, remaining, 0))
    n = batch_insert(cur, 'LeaveBalance', ['id', 'employeeId', 'leaveTypeId', 'year', 'total', 'used', 'remaining', 'carryForward'], lb_rows, errors)
    print(f"  Created {n} leave balances")

    # ─── 43. More Asset Assignments ───
    print("\n=== Seeding Additional Asset Assignments ===")
    aa_rows = []
    cur.execute('SELECT id FROM "Asset" LIMIT 20')
    asset_ids = [a[0] for a in cur.fetchall()]
    for eid in pick_n(all_emp_ids, min(15, len(all_emp_ids))):
        if asset_ids:
            aa_rows.append((cuid(), pick(asset_ids), eid, rand_date(date(2024, 1, 1), date(2026, 6, 30)), 'good', 'Assigned for daily work', 'assigned'))
    n = batch_insert(cur, 'AssetAssignment', ['id', 'assetId', 'employeeId', 'assignedDate', 'condition', 'notes', 'status'], aa_rows, errors)
    print(f"  Created {n} asset assignments")

    # ─── 44. More Interviews ───
    print("\n=== Seeding Additional Interviews ===")
    int_rows = []
    cur.execute('SELECT id FROM "JobApplication" LIMIT 20')
    app_ids = [a[0] for a in cur.fetchall()]
    for app_id in app_ids:
        for itype in pick(['technical', 'hr', 'managerial', 'final'], 2):
            idate = rand_date(date(2026, 1, 1), date(2026, 6, 30))
            int_rows.append((cuid(), app_id, itype, idate, f'{rand_int(10, 17)}:00', rand_int(30, 90),
                 pick(['Conference Room A', 'Virtual - Zoom', 'Virtual - Teams']),
                 f'https://meet.example.com/{cuid()}', f'{pick(first_names)} {pick(last_names)}',
                 pick(['scheduled', 'completed', 'cancelled']), pick(['Strong technical skills', 'Good cultural fit']),
                 rand_int(3, 10)))
    n = batch_insert(cur, 'Interview', ['id', 'jobApplicationId', 'type', 'date', 'time', 'duration', 'location', 'meetingUrl', 'interviewer', 'status', 'feedback', 'score'], int_rows, errors)
    print(f"  Created {n} interviews")

    # ─── Final Summary ───
    print(f"\n=== Seed Complete ===")
    print(f"  Errors: {len(errors)}")
    if errors:
        print("  First 10 errors:")
        for e in errors[:10]:
            print(f"    {e}")

    print("\n=== Final Data Counts ===")
    for table in ['Company', 'Branch', 'Department', 'Designation', 'Employee', 'User', 'LeaveType', 'Policy',
                  'Holiday', 'Shift', 'Attendance', 'LeaveRequest', 'LeaveBalance', 'PerformanceReview', 'Goal',
                  'Training', 'TrainingEnrollment', 'Asset', 'Project', 'JobPosting', 'JobApplication', 'Interview',
                  'Ticket', 'Notification', 'SalaryStructure', 'ExpenseClaim', 'TravelRequest', 'Timesheet',
                  'Document', 'Grievance', 'Feedback', 'OnboardingTask', 'Reimbursement', 'AssetAssignment',
                  'Announcement', 'Client', 'Vendor', 'Invoice', 'Candidate', 'Dependent', 'Qualification',
                  'Experience', 'EmployeeSkill', 'Promotion', 'Separation', 'IncidentReport', 'OKR',
                  'Team', 'TeamMember', 'Recognition', 'Wallet', 'MarketplaceProduct',
                  'InsurancePolicy', 'InsuranceClaim', 'Gift', 'Payroll', 'PayrollRun', 'LoginActivity',
                  'AuditLog', 'Offer']:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            if count > 0:
                print(f"  {table}: {count}")
        except:
            pass

    cur.close()
    conn.close()

if __name__ == '__main__':
    seed_all()
